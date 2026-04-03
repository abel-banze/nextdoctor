import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { DetectedIssue, DetectorContext, DetectorResult } from './types.js';

export abstract class BaseDetector {
  abstract readonly id: string;
  abstract readonly name: string;

  abstract detect(
    spans: ReadableSpan[],
    context: DetectorContext
  ): DetectedIssue[];

  run(spans: ReadableSpan[], context: DetectorContext): DetectorResult {
    const start = Date.now();
    const issues = this.detect(spans, context);
    const durationMs = Date.now() - start;

    return {
      issues,
      detectorId: this.id,
      analyzedSpans: spans.length,
      durationMs,
    };
  }

  protected getSpanDurationMs(span: ReadableSpan): number {
    const [startSec, startNano] = span.startTime;
    const [endSec, endNano] = span.endTime;
    return (endSec - startSec) * 1000 + (endNano - startNano) / 1_000_000;
  }

  protected getStringAttribute(span: ReadableSpan, key: string): string | undefined {
    const val = span.attributes?.[key];
    return typeof val === 'string' ? val : undefined;
  }

  protected getNumberAttribute(span: ReadableSpan, key: string): number | undefined {
    const val = span.attributes?.[key];
    return typeof val === 'number' ? val : undefined;
  }

  protected getSpanUrl(span: ReadableSpan): string | undefined {
    return this.getStringAttribute(span, 'http.url');
  }

  protected getSpanMethod(span: ReadableSpan): string | undefined {
    return this.getStringAttribute(span, 'http.method');
  }

  protected hasChildSpanWithName(parent: ReadableSpan, childName: string, allSpans: ReadableSpan[]): boolean {
    const parentSpanId = parent.spanContext().spanId;
    return allSpans.some(
      // @ts-expect-error parentSpanId exists in newer OTel versions
      s => s.parentSpanId === parentSpanId && s.name === childName
    );
  }

  protected getChildSpans(parent: ReadableSpan, allSpans: ReadableSpan[]): ReadableSpan[] {
    const parentSpanId = parent.spanContext().spanId;
    // @ts-expect-error parentSpanId exists in newer OTel versions
    return allSpans.filter(s => s.parentSpanId === parentSpanId);
  }

  protected percentile(sortedAsc: number[], p: number): number {
    if (sortedAsc.length === 0) return 0;
    const idx = Math.ceil(sortedAsc.length * (p / 100)) - 1;
    return sortedAsc[Math.max(0, idx)]!;
  }
}