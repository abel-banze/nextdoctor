import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import type { DetectedIssue, DetectorContext } from './types.js';

/**
 * RSC_INTROSPECTION Detector
 * 
 * Specifically monitors React Server Components rendering internals.
 * - Detects heavy generateMetadata calls that block the first byte.
 * - Monitors RSC Payload size to prevent "Over-fetching" into Client Components.
 */
export class RscIntrospectionDetector extends BaseDetector {
  readonly id = 'RSC_INTROSPECTION';
  readonly name = 'RSC Deep Introspection Detector';
  
  private readonly metadataThresholdMs = 500;
  private readonly payloadSizeThresholdBytes = 250000; // 250kb default

  detect(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    // Find the main RSC render span
    const renderSpan = spans.find(s => s.name.includes('render route (app)'));
    if (!renderSpan) return issues;

    const totalRenderTime = this.getSpanDurationMs(renderSpan);

    // 1. Check Metadata generation time
    // generateMetadata is serial and blocks the entire RSC stream from starting
    const metadataSpans = spans.filter(s => s.name.includes('generateMetadata'));
    const totalMetadataTime = metadataSpans.reduce((sum, s) => sum + this.getSpanDurationMs(s), 0);

    if (totalMetadataTime > this.metadataThresholdMs) {
      issues.push({
        id: 'RSC_METADATA_HEAVY',
        type: 'RSC_METADATA_HEAVY',
        severity: 'high',
        message: `Metadata generation for "${context.route}" took ${Math.round(totalMetadataTime)}ms → blocking first bit of RSC stream`,
        suggestion: `O bloqueio de metadados atrasa o TTFB. Use cache() ou mova lógica pesada para fora do metadata.`,
        route: context.route,
        spanId: metadataSpans[0]?.spanContext().spanId,
        detectedAt: Date.now(),
        attributes: {
          metadataTimeMs: Math.round(totalMetadataTime),
          totalRenderTimeMs: Math.round(totalRenderTime),
        },
      });
    }

    // 2. Check Payload Size (Bloat)
    const rootSpan = spans.find(s => s.attributes?.['http.target'] || s.attributes?.['http.url']);
    const responseSize = this.getNumberAttribute(rootSpan || renderSpan, 'http.response_content_length') || 
                         this.getNumberAttribute(renderSpan, 'next.rsc_payload_size');

    if (responseSize && responseSize > this.payloadSizeThresholdBytes) {
      issues.push({
        id: 'RSC_PAYLOAD_BLOAT',
        type: 'RSC_PAYLOAD_BLOAT',
        severity: 'warning',
        message: `RSC Payload for "${context.route}" is ${Math.round(responseSize / 1024)}kb → hydration performance may suffer`,
        suggestion: `Payload RSC excessivo. Evite passar objetos inteiros do DB para Componentes Client.`,
        route: context.route,
        spanId: renderSpan.spanContext().spanId,
        detectedAt: Date.now(),
        attributes: {
          payloadSizeBytes: responseSize,
          thresholdBytes: this.payloadSizeThresholdBytes,
        },
      });
    }

    return issues;
  }
}
