import { describe, it, expect } from 'vitest';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { RscIntrospectionDetector } from '../rsc-introspection.detector.js';

/**
 * Creates a mock ReadableSpan with the given name, timing, and optional attributes.
 */
function createMockSpan(
  name: string,
  startTimeMs: number,
  durationMs: number,
  attributes: Record<string, unknown> = {},
  parentId?: string,
): ReadableSpan {
  const startSec = Math.floor(startTimeMs / 1000);
  const startNano = (startTimeMs % 1000) * 1_000_000;
  const endMs = startTimeMs + durationMs;
  const endSec = Math.floor(endMs / 1000);
  const endNano = (endMs % 1000) * 1_000_000;

  return {
    name,
    spanContext: () => ({
      traceId: 'trace-1',
      spanId: 'span-' + name.replace(/\s+/g, '-'),
      traceFlags: 0x01,
      isRecording: true,
    }),
    parentSpanId: parentId,
    startTime: [startSec, startNano],
    endTime: [endSec, endNano],
    attributes,
    links: [],
    events: [],
    status: { code: 0 },
  } as any as ReadableSpan;
}

describe('RscIntrospectionDetector', () => {
  const detector = new RscIntrospectionDetector();
  const context = { route: '/dashboard', runtime: 'nodejs' as const };

  // ─── Test 1: generateMetadata > 500ms → RSC_METADATA_HEAVY (high) ───────────
  it('emits RSC_METADATA_HEAVY with severity high when generateMetadata exceeds 500ms', () => {
    const spans = [
      createMockSpan('render route (app)', 1000, 800),
      createMockSpan('generateMetadata', 1000, 600), // 600ms > 500ms threshold
    ];

    const issues = detector.detect(spans, context);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.id).toBe('RSC_METADATA_HEAVY');
    expect(issues[0]!.type).toBe('RSC_METADATA_HEAVY');
    expect(issues[0]!.severity).toBe('high');
    expect(issues[0]!.route).toBe('/dashboard');
    expect(issues[0]!.attributes?.metadataTimeMs).toBeGreaterThan(500);
  });

  // ─── Test 2: generateMetadata < 500ms → no issues ────────────────────────────
  it('does not emit issues when generateMetadata is below 500ms', () => {
    const spans = [
      createMockSpan('render route (app)', 1000, 400),
      createMockSpan('generateMetadata', 1000, 300), // 300ms < 500ms threshold
    ];

    const issues = detector.detect(spans, context);

    expect(issues).toHaveLength(0);
  });

  // ─── Test 3: next.rsc_payload_size > 250000 → RSC_PAYLOAD_BLOAT ─────────────
  it('emits RSC_PAYLOAD_BLOAT when next.rsc_payload_size exceeds 250000 bytes', () => {
    const spans = [
      createMockSpan('render route (app)', 1000, 200, {
        'next.rsc_payload_size': 300000, // 300kb > 250kb threshold
      }),
    ];

    const issues = detector.detect(spans, context);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.id).toBe('RSC_PAYLOAD_BLOAT');
    expect(issues[0]!.type).toBe('RSC_PAYLOAD_BLOAT');
    expect(issues[0]!.severity).toBe('warning');
    expect(issues[0]!.attributes?.payloadSizeBytes).toBe(300000);
    expect(issues[0]!.attributes?.thresholdBytes).toBe(250000);
  });

  // ─── Test 4: no render span → no issues ──────────────────────────────────────
  it('does not emit issues when there is no render route (app) span', () => {
    const spans = [
      createMockSpan('generateMetadata', 1000, 700), // > threshold but no render span
      createMockSpan('some other span', 1000, 200),
    ];

    const issues = detector.detect(spans, context);

    expect(issues).toHaveLength(0);
  });

  // ─── Test 5: both thresholds exceeded → two issues ───────────────────────────
  it('emits both RSC_METADATA_HEAVY and RSC_PAYLOAD_BLOAT when both thresholds are exceeded', () => {
    const spans = [
      createMockSpan('render route (app)', 1000, 900, {
        'next.rsc_payload_size': 400000, // 400kb > 250kb threshold
      }),
      createMockSpan('generateMetadata', 1000, 600), // 600ms > 500ms threshold
    ];

    const issues = detector.detect(spans, context);

    expect(issues).toHaveLength(2);

    const metadataIssue = issues.find(i => i.id === 'RSC_METADATA_HEAVY');
    const payloadIssue = issues.find(i => i.id === 'RSC_PAYLOAD_BLOAT');

    expect(metadataIssue).toBeDefined();
    expect(metadataIssue!.severity).toBe('high');

    expect(payloadIssue).toBeDefined();
    expect(payloadIssue!.severity).toBe('warning');
  });
});
