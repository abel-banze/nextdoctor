import { describe, it, expect } from 'vitest';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ClientVitalsDetector } from '../client-vitals.detector.js';

function createMockVitalSpan(name: string, value: number, attributes: Record<string, any> = {}): ReadableSpan {
  return {
    name,
    spanContext: () => ({
      traceId: 'trace-1',
      spanId: 'span-' + Math.random(),
      traceFlags: 0x01,
      isRecording: true,
    }),
    startTime: [1000, 0],
    endTime: [1000, 100_000_000],
    attributes: {
      'web_vitals.value': value,
      ...attributes
    },
    links: [],
    events: [],
    status: { code: 0 },
  } as any as ReadableSpan;
}

describe('ClientVitalsDetector', () => {
  const detector = new ClientVitalsDetector();

  it('detects LCP > 2500ms', () => {
    const spans = [
      createMockVitalSpan('largest-contentful-paint', 3000),
    ];

    const issues = detector.detect(spans, { route: '/lcp', runtime: 'nodejs' });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe('LCP_DEGRADED');
  });

  it('detects CLS > 0.1', () => {
    const spans = [
      createMockVitalSpan('cumulative-layout-shift', 0.2),
    ];

    const issues = detector.detect(spans, { route: '/cls', runtime: 'nodejs' });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe('LAYOUT_SHIFT_HIGH');
  });

  it('detects excessive re-renders from react-scan', () => {
    const spans = [
      createMockVitalSpan('react-scan:render', 0, {
        'render_count': 15,
        'component_name': 'HeavyButton'
      }),
    ];

    const issues = detector.detect(spans, { route: '/renders', runtime: 'nodejs' });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe('EXCESSIVE_RE_RENDERS');
    expect(issues[0]!.attributes?.componentName).toBe('HeavyButton');
  });
});
