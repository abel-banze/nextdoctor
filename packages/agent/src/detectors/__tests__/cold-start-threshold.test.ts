import { describe, it, expect } from 'vitest';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ColdStartThresholdDetector } from '../cold-start-threshold.detector.js';

function createMockSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  const defaultStartTime: [number, number] = [Math.floor(Date.now() / 1000), 0];
  const defaultEndTime: [number, number] = [
    defaultStartTime[0],
    defaultStartTime[1] + 100_000_000, // 100ms
  ];

  return {
    name: 'http.request',
    spanContext: () => ({
      traceId: 'test-trace',
      spanId: 'test-span-' + Math.random().toString(36).substr(2, 9),
      traceFlags: 0x01,
      traceState: undefined,
      isRecording: true,
    }),
    parentSpanId: undefined,
    startTime: defaultStartTime,
    endTime: defaultEndTime,
    attributes: {
      'http.route': '/api/test',
      ...overrides.attributes,
    },
    links: [],
    events: [],
    status: { code: 0 },
    instrumentationLibrary: {
      name: 'nextdoctor',
      version: '0.1.0',
    },
    resource: {
      attributes: {},
    },
    duration: defaultEndTime,
    ended: true,
    ...overrides,
  } as ReadableSpan;
}

describe('ColdStartThresholdDetector', () => {
  const detector = new ColdStartThresholdDetector();

  it('detects cold start above threshold (800ms)', () => {
    const issues = detector.detect([], { 
      runtime: 'edge',
      startupTimeMs: 1200,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.id).toBe('COLD_START_THRESHOLD');
    expect(issues[0]!.severity).toBe('critical');
    expect(issues[0]!.message).toContain('1200ms');
    expect(issues[0]!.message).toContain('800ms');
  });

  it('ignores cold start below threshold', () => {
    const issues = detector.detect([], { 
      runtime: 'edge',
      startupTimeMs: 500,
    });

    expect(issues).toHaveLength(0);
  });

  it('detects cold start exactly at threshold', () => {
    const issues = detector.detect([], { 
      runtime: 'edge',
      startupTimeMs: 800,
    });

    // At threshold should pass (not exceed)
    expect(issues).toHaveLength(0);
  });

  it('fires with 20+ spans when P99 - P50 > 2000ms', () => {
    const spans = Array.from({ length: 20 }).map((_, i) => {
      const durationNano = i < 10 
        ? 100_000_000 // 100ms (P50)
        : 2500_000_000; // 2500ms (P99)

      return createMockSpan({
        name: 'http.request',
        attributes: {
          'http.route': '/api/users',
        },
        startTime: [1000, 0],
        endTime: [1000, durationNano],
        spanContext: () => ({
          traceId: 'test-trace',
          spanId: `span-${i}`,
          traceFlags: 0x01,
          traceState: undefined,
          isRecording: true,
        }),
      });
    });

    const issues = detector.detect(spans, { 
      runtime: 'edge',
      route: '/api/users',
    });

    expect(issues.some(i => i.id === 'COLD_START_INTERMITTENT')).toBe(true);
    const issue = issues.find(i => i.id === 'COLD_START_INTERMITTENT');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('high latency variance');
  });

  it('ignores low variance', () => {
    const spans = Array.from({ length: 20 }).map((_, i) =>
      createMockSpan({
        name: 'http.request',
        attributes: {
          'http.route': '/api/test',
        },
        startTime: [1000, 0],
        endTime: [1000, 100_000_000 + i * 10_000_000], // 100-190ms range
        spanContext: () => ({
          traceId: 'test-trace',
          spanId: `span-${i}`,
          traceFlags: 0x01,
          traceState: undefined,
          isRecording: true,
        }),
      })
    );

    const issues = detector.detect(spans, { 
      runtime: 'edge',
      route: '/api/test',
    });

    expect(issues.filter(i => i.id === 'COLD_START_INTERMITTENT')).toHaveLength(0);
  });

  it('does not fire with fewer than 20 spans for variance calculation', () => {
    const spans = Array.from({ length: 19 }).map((_, i) =>
      createMockSpan({
        startTime: [1000, 0],
        endTime: [1000, i < 2 ? 100_000_000 : 3000_000_000],
        spanContext: () => ({
          traceId: 'test-trace',
          spanId: `span-${i}`,
          traceFlags: 0x01,
          traceState: undefined,
          isRecording: true,
        }),
      })
    );

    const issues = detector.detect(spans, { 
      runtime: 'edge',
      route: '/api/test',
    });

    expect(issues.every(i => i.id !== 'COLD_START_INTERMITTENT')).toBe(true);
  });

  it('includes suggestions in issue', () => {
    const issues = detector.detect([], { 
      runtime: 'edge',
      startupTimeMs: 1200,
    });

    expect(issues[0]!.suggestion).toContain('Mova');
  });

  it('includes attributes with threshold data', () => {
    const issues = detector.detect([], { 
      runtime: 'edge',
      startupTimeMs: 1200,
    });

    expect(issues[0]!.attributes?.startupTimeMs).toBe(1200);
    expect(issues[0]!.attributes?.threshold).toBe(800);
    expect(issues[0]!.attributes?.runtime).toBe('edge');
  });
});