import type { ExportResult } from '@opentelemetry/core';
import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { DetectedIssue, DetectorContext } from './detectors/types.js';
import type { PiiSanitizationConfig } from './types.js';
import { CircuitBreaker } from './optimization.js';

export interface NextDoctorExporterOptions {
  endpoint: string;               // e.g. 'https://ingest.nextdoctor.dev'
  projectToken: string;
  /** Called just before export — lets init.ts inject current detected issues */
  getIssues: () => DetectedIssue[];
  /** Called after a successful export — lets init.ts clear sent issues */
  clearIssues: (sent: DetectedIssue[]) => void;
  /** Called to get the current detection context (route, runtime) */
  getContext: () => DetectorContext;
  timeoutMs?: number;
  piiSanitization?: PiiSanitizationConfig;
}

/**
 * Custom OTel SpanExporter for NextDoctor.
 *
 * Instead of sending raw OTLP protobuf, this exporter converts spans to
 * the lightweight JSON format the collector's POST /ingest endpoint expects,
 * and bundles in the detected issues from the detection engine.
 *
 * This gives us full control over the payload and avoids an OTLP parser
 * on the collector side.
 */
export class NextDoctorExporter implements SpanExporter {
  private readonly endpoint: string;
  private readonly projectToken: string;
  private readonly getIssues: () => DetectedIssue[];
  private readonly clearIssues: (sent: DetectedIssue[]) => void;
  private readonly getContext: () => DetectorContext;
  private readonly timeoutMs: number;
  private readonly piiSanitization?: PiiSanitizationConfig;
  private isShutdown = false;
  private circuitBreaker = new CircuitBreaker();

  constructor(opts: NextDoctorExporterOptions) {
    this.endpoint = opts.endpoint.replace(/\/$/, '');
    this.projectToken = opts.projectToken;
    this.getIssues = opts.getIssues;
    this.clearIssues = opts.clearIssues;
    this.getContext = opts.getContext;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.piiSanitization = opts.piiSanitization;
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    if (this.isShutdown) {
      resultCallback({ code: 1 }); // ExportResultCode.FAILED
      return;
    }

    void this.doExport(spans, resultCallback);
  }

  private async doExport(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): Promise<void> {
    const issuesToSend = this.getIssues();
    const context = this.getContext();

    const payload = {
      spans: spans.map(s => serializeSpan(s, this.piiSanitization)),
      context: {
        route: context.route,
        runtime: context.runtime,
        startupTimeMs: context.startupTimeMs,
      },
      detectedIssues: issuesToSend.length > 0 ? issuesToSend : undefined,
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await this.circuitBreaker.execute(async () => {
        return fetch(`${this.endpoint}/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.projectToken}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      });

      clearTimeout(timer);

      if (!response || !response.ok) {
        resultCallback({ code: 1 }); // FAILED
        return;
      }

      // Clear only the issues we successfully sent
      if (issuesToSend.length > 0) {
        this.clearIssues(issuesToSend);
      }

      resultCallback({ code: 0 }); // SUCCESS
    } catch {
      resultCallback({ code: 1 }); // FAILED (timeout, network error, etc.)
    }
  }

  async shutdown(): Promise<void> {
    this.isShutdown = true;
  }

  async forceFlush(): Promise<void> {
    // Nothing to flush — each export is fire-and-forget with its own retry
  }
}

// ─── Span serialiser ──────────────────────────────────────────────────────────
// Converts an OTel ReadableSpan to the lightweight JSON the collector expects.

function sanitizeAttributes(
  attributes: Record<string, unknown>,
  config: PiiSanitizationConfig,
): Record<string, unknown> {
  if (!config.enabled) return attributes;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    let sanitized: unknown = value;

    if (config.redactAttributes?.includes(key)) {
      sanitized = '[REDACTED]';
    } else if (config.redactPattern && typeof value === 'string') {
      sanitized = value.replace(config.redactPattern, '[REDACTED]');
    }

    result[key] = sanitized;
  }
  return result;
}

function serializeSpan(span: ReadableSpan, piiConfig?: PiiSanitizationConfig): object {
  const ctx = span.spanContext();
  const [startSec, startNano] = span.startTime;
  const [endSec, endNano] = span.endTime;

  const attributes = piiConfig?.enabled
    ? sanitizeAttributes(span.attributes as Record<string, unknown>, piiConfig)
    : span.attributes;

  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    // @ts-expect-error parentSpanId exists in newer OTel versions
    parentSpanId: span.parentSpanId ?? null,
    name: span.name,
    startTime: span.startTime,
    endTime: span.endTime,
    durationMs: Math.round(
      (endSec - startSec) * 1000 + (endNano - startNano) / 1_000_000
    ),
    attributes,
    status: span.status,
    events: span.events,
    links: span.links,
  };
}
