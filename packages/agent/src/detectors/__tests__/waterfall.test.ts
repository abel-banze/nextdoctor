import { describe, it, expect } from 'vitest';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { WaterfallDetector } from '../waterfall.detector.js';

function createMockSpan(name: string, startTimeMs: number, durationMs: number, parentId?: string): ReadableSpan {
  const startSec = Math.floor(startTimeMs / 1000);
  const startNano = (startTimeMs % 1000) * 1_000_000;
  const endMs = startTimeMs + durationMs;
  const endSec = Math.floor(endMs / 1000);
  const endNano = (endMs % 1000) * 1_000_000;

  return {
    name,
    spanContext: () => ({
      traceId: 'trace-1',
      spanId: 'span-' + name,
      traceFlags: 0x01,
      isRecording: true,
    }),
    parentSpanId: parentId,
    startTime: [startSec, startNano],
    endTime: [endSec, endNano],
    attributes: {},
    links: [],
    events: [],
    status: { code: 0 },
  } as any as ReadableSpan;
}

describe('WaterfallDetector', () => {
  const detector = new WaterfallDetector();

  it('detects sequential waterfalls of 3+ long spans', () => {
    const parentId = 'root-span';
    const spans = [
      createMockSpan('Fetch 1', 1000, 150, parentId), // 1000-1150
      createMockSpan('Fetch 2', 1155, 150, parentId), // 1155-1305 (sequential)
      createMockSpan('Fetch 3', 1310, 150, parentId), // 1310-1460 (sequential)
    ];

    const issues = detector.detect(spans, { route: '/waterfall', runtime: 'nodejs' });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe('RENDERING_WATERFALL');
    expect(issues[0]!.attributes?.chainLength).toBe(3);
    expect(issues[0]!.attributes?.totalDurationMs).toBeGreaterThan(400);
  });

  it('ignores sequential spans if they are shorter than threshold', () => {
    const parentId = 'root-span';
    const spans = [
      createMockSpan('Fast 1', 1000, 50, parentId),
      createMockSpan('Fast 2', 1060, 50, parentId),
      createMockSpan('Fast 3', 1120, 50, parentId),
    ];

    const issues = detector.detect(spans, { route: '/fast', runtime: 'nodejs' });
    expect(issues).toHaveLength(0);
  });

  it('ignores parallel spans (overlapping timings)', () => {
    const parentId = 'root-span';
    const spans = [
      createMockSpan('Parallel 1', 1000, 150, parentId), // 1000-1150
      createMockSpan('Parallel 2', 1010, 150, parentId), // 1010-1160
      createMockSpan('Parallel 3', 1020, 150, parentId), // 1020-1170
    ];

    const issues = detector.detect(spans, { route: '/parallel', runtime: 'nodejs' });
    expect(issues).toHaveLength(0);
  });

  it('handles disjoint spans correctly', () => {
    const parentId = 'root-span';
    const spans = [
      createMockSpan('Chain 1', 1000, 150, parentId),
      createMockSpan('Chain 2', 1160, 150, parentId),
      createMockSpan('Chain 3', 1320, 150, parentId),
      // This span is parallel to Chain 3, so it should break the sequence at Chain 3
      createMockSpan('Parallel', 1330, 150, parentId),
    ];

    const issues = detector.detect(spans, { route: '/mixed', runtime: 'nodejs' });
    // Should not detect if the sequential chain length is < 3
    // In this case, maybe it detects 1-2-3? 
    // Wait, 1-2 are sequential. 2-3 are sequential (1160-1310, 1320-1470).
    // Let's see: 1 ends 1150, 2 starts 1160. YES.
    // 2 ends 1310, 3 starts 1320. YES.
    // So 1-2-3 IS a chain of 3.
    expect(issues).toHaveLength(1);
    expect(issues[0]!.attributes?.chainLength).toBe(3);
  });
});
