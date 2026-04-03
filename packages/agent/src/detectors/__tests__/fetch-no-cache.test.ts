import { describe, it, expect } from 'vitest';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { FetchNoCacheDetector } from '../fetch-no-cache.detector';

// Helper to create mock spans
function createMockSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  const defaultStartTime: [number, number] = [Math.floor(Date.now() / 1000), 0];
  const defaultEndTime: [number, number] = [
    defaultStartTime[0],
    defaultStartTime[1] + 100_000_000, // 100ms
  ];

  return {
    name: 'fetch',
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
      'http.method': 'GET',
      'http.url': 'https://api.example.com/data',
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

describe('FetchNoCacheDetector', () => {
  const detector = new FetchNoCacheDetector();

  it('detects GET fetch with no cache', () => {
    const span = createMockSpan({
      name: 'fetch',
      attributes: {
        'http.method': 'GET',
        'http.url': 'https://api.example.com/users',
      },
    });

    const issues = detector.detect([span], { runtime: 'nodejs' });

    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('FETCH_NO_CACHE');
    expect(issues[0].severity).toBe('high');
    expect(issues[0].message).toContain('no cache');
  });

  it('ignores POST fetch (no cache expected)', () => {
    const span = createMockSpan({
      name: 'fetch',
      attributes: {
        'http.method': 'POST',
        'http.url': 'https://api.example.com/users',
      },
    });

    const issues = detector.detect([span], { runtime: 'nodejs' });

    expect(issues).toHaveLength(0);
  });

  it('ignores fetch with force-cache', () => {
    const span = createMockSpan({
      name: 'fetch',
      attributes: {
        'http.method': 'GET',
        'http.url': 'https://api.example.com/users',
        'fetch.cache': 'force-cache',
      },
    });

    const issues = detector.detect([span], { runtime: 'nodejs' });

    expect(issues).toHaveLength(0);
  });

  it('ignores fetch with next.revalidate', () => {
    const span = createMockSpan({
      name: 'fetch',
      attributes: {
        'http.method': 'GET',
        'http.url': 'https://api.example.com/users',
        'next.revalidate': 3600,
      },
    });

    const issues = detector.detect([span], { runtime: 'nodejs' });

    expect(issues).toHaveLength(0);
  });

  it('ignores internal URLs (localhost)', () => {
    const span = createMockSpan({
      name: 'fetch',
      attributes: {
        'http.method': 'GET',
        'http.url': 'http://localhost:3000/api/internal',
      },
    });

    const issues = detector.detect([span], { runtime: 'nodejs' });

    expect(issues).toHaveLength(0);
  });

  it('ignores internal URLs (192.168)', () => {
    const span = createMockSpan({
      name: 'fetch',
      attributes: {
        'http.method': 'GET',
        'http.url': 'http://192.168.1.1:3000/api', 
      },
    });

    const issues = detector.detect([span], { runtime: 'nodejs' });

    expect(issues).toHaveLength(0);
  });

  it('ignores fetch with duration < 50ms', () => {
    const span = createMockSpan({
      name: 'fetch',
      attributes: {
        'http.method': 'GET',
        'http.url': 'https://api.example.com/users',
      },
      startTime: [1000, 0],
      endTime: [1000, 10_000_000], // 10ms only
    });

    const issues = detector.detect([span], { runtime: 'nodejs' });

    expect(issues).toHaveLength(0);
  });

  it('detects N+1 fetch pattern (>= 3 calls)', () => {
    const url = 'https://api.example.com/user/123';
    const spans = Array.from({ length: 3 }).map((_, i) =>
      createMockSpan({
        name: 'fetch',
        attributes: {
          'http.method': 'GET',
          'http.url': url,
        },
        spanContext: () => ({
          traceId: 'test-trace',
          spanId: `span-${i}`,
          traceFlags: 0x01,
          traceState: undefined,
          isRecording: true,
        }),
      })
    );

    const issues = detector.detect(spans, { runtime: 'nodejs' });

    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('FETCH_NO_CACHE');
    expect(issues[0].severity).toBe('critical');
    expect(issues[0].message).toContain('3x');
  });

  it('includes URL and duration in attributes', () => {
    const span = createMockSpan({
      name: 'fetch',
      attributes: {
        'http.method': 'GET',
        'http.url': 'https://api.example.com/slow',
      },
    });

    const issues = detector.detect([span], { runtime: 'nodejs' });

    expect(issues[0].attributes?.url).toBe('https://api.example.com/slow');
    expect(issues[0].attributes?.duration).toBeDefined();
  });

  it('includes route in issue if context provides it', () => {
    const span = createMockSpan({
      name: 'fetch',
      attributes: {
        'http.method': 'GET',
        'http.url': 'https://api.example.com/data',
      },
    });

    const issues = detector.detect([span], { 
      runtime: 'nodejs',
      route: '/products',
    });

    expect(issues[0].route).toBe('/products');
  });
});