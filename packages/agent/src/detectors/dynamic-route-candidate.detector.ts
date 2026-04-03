import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import type { DetectedIssue, DetectorContext } from './types.js';

export class DynamicRouteCandidateDetector extends BaseDetector {
  readonly id = 'DYNAMIC_ROUTE_CANDIDATE';
  readonly name = 'Dynamic Route Candidate Detector';

  detect(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    if (!context.route) {
      return issues;
    }

    // Find spans that indicate reading of cookies/headers
    const cookiesSpans = spans.filter(s => 
      s.name === 'cookies' || 
      s.name.toLowerCase().includes('cookies')
    );

    const headersSpans = spans.filter(s =>
      s.name === 'headers' ||
      s.name.toLowerCase().includes('headers')
    );

    const dynamicTriggerSpans = [...cookiesSpans, ...headersSpans];

    dynamicTriggerSpans.forEach(span => {
      const children = this.getChildSpans(span, spans);

      // Check if there's actually a specific key being read
      const hasKeyAccess = children.some(child => {
        const nameAttr = this.getStringAttribute(child, 'next.key');
        return nameAttr !== undefined;
      });

      // If cookies/headers is called but no specific key is accessed
      // → the route is forced dynamic with no benefit
      if (!hasKeyAccess) {
        const spanName = span.name === 'cookies' ? 'cookies()' : 'headers()';
        
        issues.push({
          id: this.id,
          severity: 'warning',
          message: `Route "${context.route}" is forced dynamic by ${spanName}() but reads no value → could be static`,
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
            hasKeyAccess,
          },
          detectedAt: Date.now(),
        });
      }
    });

    return issues;
  }
}