import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import type { DetectedIssue, DetectorContext } from './types.js';

export class ColdStartThresholdDetector extends BaseDetector {
  readonly id = 'COLD_START_THRESHOLD';
  readonly name = 'Cold Start Threshold Detector';
  private readonly threshold = 800; // ms
  private readonly minSamplesForVariance = 20;

  detect(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    // Check startup time if provided
    if (context.startupTimeMs && context.startupTimeMs > this.threshold) {
      issues.push({
        id: this.id,
        type: 'COLD_START',
        severity: 'critical',
        message: `Edge cold start ${context.startupTimeMs}ms > ${this.threshold}ms → users are paying this cost on every cold invocation`,
        suggestion: `Opções por ordem de impacto:

1. Mova imports pesados para fora do handler:
// ❌ Dentro do handler
export default async function handler(req, res) {
  const { heavy } = await import('./heavy-lib');
  return handleRequest(heavy, req);
}

// ✅ Fora do handler (Pre-warmed)
const heavyPromise = import('./heavy-lib');
export default async function handler(req, res) {
  const { heavy } = await heavyPromise;
  return handleRequest(heavy, req);
}

2. Mude para runtime 'nodejs' se o Edge não for estritamente necessário.
3. Configure 'Route Warming' para manter instâncias ativas.`,
        route: context.route,
        attributes: {
          startupTimeMs: context.startupTimeMs,
          threshold: this.threshold,
          runtime: context.runtime,
        },
        detectedAt: Date.now(),
      });
    }

    // Detect intermittent cold starts via span latency variance
    const routeSpans = context.route
      ? spans.filter(s => s.attributes?.['http.route'] === context.route)
      : spans.filter(s => s.attributes?.['http.route']);

    if (routeSpans.length >= this.minSamplesForVariance) {
      const durations = routeSpans.map(s => this.getSpanDurationMs(s));
      const sorted = [...durations].sort((a, b) => a - b);
      const p50 = this.percentile(sorted, 50);
      const p99 = this.percentile(sorted, 99);
      const variance = p99 - p50;

      if (variance > 2000) {
        issues.push({
          id: 'COLD_START_INTERMITTENT',
          type: 'COLD_START_INTERMITTENT',
          severity: 'warning',
          message: `Route "${context.route || 'unknown'}" has high latency variance: P50=${Math.round(p50)}ms vs P99=${Math.round(p99)}ms → likely intermittent cold starts`,
          suggestion: `A difference > 2000ms between P50 and P99 indicates periodic cold starts. Consider these strategies:

1. Keep-warm via external cron job (call your endpoint every 5 minutes)
2. Migrate to Node.js runtime if Edge Runtime is optional:
export const runtime = 'nodejs';

3. Use Next.js Middleware to keep the runtime warm — middleware runs on every
   request and prevents full cold starts on subsequent edge invocations:

// middleware.ts
export const config = { matcher: '/api/:path*' };
export function middleware() {
  // Intentionally lightweight — presence keeps runtime warm
}`,
          route: context.route,
          attributes: {
            p50: Math.round(p50),
            p99: Math.round(p99),
            variance: Math.round(variance),
            sampleCount: sorted.length,
          },
          detectedAt: Date.now(),
        });
      }
    }

    return issues;
  }
}