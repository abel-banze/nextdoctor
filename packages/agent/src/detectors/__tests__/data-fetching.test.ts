import { describe, it, expect } from 'vitest';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { DataFetchingDetector } from '../data-fetching.detector.js';

function createMockFetchSpan(url: string, revalidate?: number, overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  return {
    name: 'fetch',
    spanContext: () => ({
      traceId: 'trace-1',
      spanId: 'span-' + Math.random(),
      traceFlags: 0x01,
      isRecording: true,
    }),
    startTime: [1000, 0],
    endTime: [1000, 100_000_000],
    attributes: {
      'http.url': url,
      'http.method': 'GET',
      'next.revalidate': revalidate,
      ...(overrides.attributes || {}),
    },
    links: [],
    events: [],
    status: { code: 0 },
    ...overrides,
  } as any as ReadableSpan;
}

describe('DataFetchingDetector', () => {
  const detector = new DataFetchingDetector();

  it('detects short revalidation times (< 10s)', () => {
    const spans = [
      createMockFetchSpan('https://api.test/data', 5), // 5 seconds
    ];

    const issues = detector.detect(spans, { route: '/short-revalidate', runtime: 'nodejs' });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe('SHORT_REVALIDATE');
    expect(issues[0]!.attributes?.revalidateSeconds).toBe(5);
  });

  it('detects redundant requests in the same trace', () => {
    const url = 'https://api.test/user';
    const spans = [
      createMockFetchSpan(url),
      createMockFetchSpan(url),
    ];

    const issues = detector.detect(spans, { route: '/redundant', runtime: 'nodejs' });
    expect(issues.some(i => i.type === 'REQUEST_DEDUPLICATION_MISSING')).toBe(true);
    const issue = issues.find(i => i.type === 'REQUEST_DEDUPLICATION_MISSING');
    expect(issue?.attributes?.count).toBe(2);
  });

  it('ignores distinct URLs', () => {
    const spans = [
      createMockFetchSpan('https://api.test/user'),
      createMockFetchSpan('https://api.test/posts'),
    ];

    const issues = detector.detect(spans, { route: '/distinct', runtime: 'nodejs' });
    expect(issues.filter(i => i.type === 'REQUEST_DEDUPLICATION_MISSING')).toHaveLength(0);
  });

  it('ignores non-GET redundant requests', () => {
    const url = 'https://api.test/user';
    const spans = [
      createMockFetchSpan(url, undefined, { attributes: { 'http.method': 'POST' } }),
      createMockFetchSpan(url, undefined, { attributes: { 'http.method': 'POST' } }),
    ];

    const issues = detector.detect(spans, { route: '/post', runtime: 'nodejs' });
    expect(issues.filter(i => i.type === 'REQUEST_DEDUPLICATION_MISSING')).toHaveLength(0);
  });
});
