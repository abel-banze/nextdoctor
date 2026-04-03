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
          severity: 'info',
          message: `Route "${context.route}" may be unnecessarily dynamic: ${spanName} called with no subsequent reads detected`,
          suggestion: `This route is paying the dynamic rendering cost without reading any actual values.

Option 1 — Remove the ${spanName}() call:
// ❌ Before
export default async function Page() {
  const cookies = cookies(); // forces dynamic but never used
  return <div>Static content</div>;
}

// ✅ After
export default function Page() {
  return <div>Static content</div>;
}

Option 2 — Move to a Server Action:
'use client';
import { getSessionCookie } from './actions';

export default function Page() {
  const handleClick = async () => {
    const session = await getSessionCookie();
    // ...
  };
  return <button onClick={handleClick}>Click me</button>;
}

// app/actions.ts
'use server';
import { cookies } from 'next/headers';

export async function getSessionCookie() {
  const c = cookies();
  return c.get('session')?.value;
}

Option 3 — If the route is fully static and shouldn't trigger dynamic rendering:
export const dynamic = 'force-static';

export default function Page() {
  // ... static content
}

See: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic`,
          route: context.route,
          spanId: span.spanContext().spanId,
          attributes: {
            trigger: span.name,
            childrenCount: children.length,
          },
          detectedAt: Date.now(),
        });
      }
    });

    return issues;
  }
}