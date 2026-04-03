import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import type { DetectedIssue, DetectorContext } from './types.js';

interface FetchInfo {
  url: string;
  duration: number;
  spanId: string;
}

export class FetchNoCacheDetector extends BaseDetector {
  readonly id = 'FETCH_NO_CACHE';
  readonly name = 'Fetch Without Cache Detector';
  private readonly minDurationMs = 50;
  private readonly nPlus1Threshold = 3;

  detect(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    // Find fetch spans without cache directive
    const fetchSpans = spans.filter(span => {
      const name = span.name.toLowerCase();
      return name.includes('fetch') || name.includes('http.client');
    });

    const noCacheFetches: FetchInfo[] = [];
    const urlCounts = new Map<string, FetchInfo[]>();

    fetchSpans.forEach(span => {
      const method = this.getSpanMethod(span);
      const url = this.getSpanUrl(span);

      // Ignore non-GET and non-POST (POST/PUT/DELETE shouldn't be cached anyway)
      if (!method || !['GET', 'HEAD'].includes(method.toUpperCase())) {
        return;
      }

      if (!url) {
        return;
      }

      // Ignore internal URLs
      if (this.isInternalUrl(url)) {
        return;
      }

      // Check cache directive
      const cacheAttr = this.getStringAttribute(span, 'fetch.cache');
      const nextRevalidate = this.getNumberAttribute(span, 'next.revalidate');

      // Has cache if:
      // - has fetch.cache='force-cache' or 'force-revalidate'
      // - has next.revalidate > 0
      const hasCache = 
        cacheAttr === 'force-cache' ||
        cacheAttr === 'force-revalidate' ||
        (nextRevalidate !== undefined && nextRevalidate > 0);

      if (hasCache) {
        return;
      }

      const duration = this.getSpanDurationMs(span);
      if (duration < this.minDurationMs) {
        return;
      }

      const fetchInfo = {
        url,
        duration,
        spanId: span.spanContext().spanId,
      };

      noCacheFetches.push(fetchInfo);

      // Track for N+1 detection
      if (!urlCounts.has(url)) {
        urlCounts.set(url, []);
      }
      urlCounts.get(url)!.push(fetchInfo);
    });

    // Report individual fetches and group N+1s
    urlCounts.forEach((fetches, url) => {
      if (fetches.length >= this.nPlus1Threshold) {
        // N+1 detected
        issues.push({
          id: this.id,
          severity: 'critical',
          message: `Fetch "${url}" called ${fetches.length}x with no cache → likely fetch N+1 pattern`,
          suggestion: `This endpoint is being called multiple times without caching. Add a cache directive:

// Option 1: Force cache (recommended for static data)
fetch("${url}", { cache: 'force-cache' })

// Option 2: Revalidate after time (recommended for semi-dynamic data)
fetch("${url}", { 
  next: { revalidate: 3600 } // revalidate every hour
})

// Option 3: Use server-side data fetching instead
// Move to a parent Server Component or Route Handler

// Option 4: Use unstable_cache wrapper (experimental)
import { unstable_cache } from 'next/cache';
const cachedFetch = unstable_cache(
  async () => fetch("${url}").then(r => r.json()),
  [${JSON.stringify(url)}],
  { revalidate: 3600 }
);`,
          route: context.route,
          spanId: fetches[0]?.spanId,
          attributes: {
            url,
            callCount: fetches.length,
            totalDuration: Math.round(fetches.reduce((sum, f) => sum + f.duration, 0)),
            avgDuration: Math.round(
              fetches.reduce((sum, f) => sum + f.duration, 0) / fetches.length
            ),
          },
          detectedAt: Date.now(),
        });
      } else if (fetches.length === 1) {
        // Single slow fetch without cache
        const fetch = fetches[0]!;
        issues.push({
          id: this.id,
          severity: 'high',
          message: `Fetch "${url}" has no cache → +${Math.round(fetch.duration)}ms per request`,
          suggestion: `Add a cache directive to this fetch:

// Option 1: Force cache (best for static APIs)
fetch("${url}", { cache: 'force-cache' })

// Option 2: Revalidate after time (better for semi-dynamic data)
fetch("${url}", { 
  next: { revalidate: 3600 } // revalidate every hour
})

// Option 3: Combine with other optimizations
const data = await fetch("${url}", {
  cache: 'force-cache',
  headers: {
    'User-Agent': 'NextDoctor-Agent/1.0'
  }
});`,
          route: context.route,
          spanId: fetch.spanId,
          attributes: {
            url,
            duration: Math.round(fetch.duration),
          },
          detectedAt: Date.now(),
        });
      }
    });

    return issues;
  }

  private isInternalUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.test') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.')
      );
    } catch {
      return false;
    }
  }
}