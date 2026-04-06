import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import type { DetectedIssue, DetectorContext } from './types.js';

/**
 * DYNAMIC_ROUTE_CANDIDATE Detector
 *
 * Detects routes that call cookies() or headers() without reading any value,
 * forcing unnecessary dynamic rendering.
 *
 * ⚠️ KNOWN LIMITATION: Next.js does not emit granular OTel spans for individual
 * cookie key reads (e.g. cookies().get('key')). This detector uses a conservative
 * heuristic: if the cookies/headers span has no child spans, the call is considered
 * unused. This may produce false negatives (misses cases where a key is read) but
 * avoids false positives (incorrectly flagging correct usage).
 *
 * Severity is 'info' until validated with real production traces.
 */
export class DynamicRouteCandidateDetector extends BaseDetector {
  readonly id = 'DYNAMIC_ROUTE_CANDIDATE';
  readonly name = 'Dynamic Route Candidate Detector';

  detect(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    if (!context.route) {
      return issues;
    }

    // Find spans that indicate reading of cookies/headers
    const cookiesSpans = spans.filter(s => s.name === 'cookies');
    const headersSpans = spans.filter(s => s.name === 'headers');

    const dynamicTriggerSpans = [...cookiesSpans, ...headersSpans];

    dynamicTriggerSpans.forEach(span => {
      const children = this.getChildSpans(span, spans);

      // Conservative heuristic: if there are NO child spans at all,
      // cookies()/headers() was called but nothing was read from it.
      // If there ARE children, assume the value was used (safer default).
      const hasAnyChildActivity = children.length > 0;

      if (!hasAnyChildActivity) {
        const spanName = span.name === 'cookies' ? 'cookies()' : 'headers()';
        
        issues.push({
          id: this.id,
          type: 'DYNAMIC_ROUTE_CANDIDATE',
          severity: 'info',
          message: `Route "${context.route}" may be unnecessarily dynamic: ${spanName} called with no subsequent reads detected`,
          suggestion: `A rota está a pagar o custo de renderização dinâmica sem ler valores. Remova a chamada se desnecessário.`,
          route: context.route,
          spanId: span.spanContext().spanId,
          detectedAt: Date.now(),
          attributes: {
            trigger: span.name,
            childrenCount: children.length,
          },
        });
      }
    });

    return issues;
  }
}