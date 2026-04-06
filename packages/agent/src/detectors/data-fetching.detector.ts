import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import type { DetectedIssue, DetectorContext } from './types.js';

/**
 * DataFetchingDetector
 * 
 * Detects:
 * 1. Short Revalidation (revalidate < 10s)
 * 2. Request without Deduplication (repeated fetches in same trace)
 */
export class DataFetchingDetector extends BaseDetector {
  readonly id = 'data-fetching';
  readonly name = 'Data Fetching Optimization Detector';
  
  private readonly minRevalidateThresholdSeconds = 10;

  detect(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const issues: DetectedIssue[] = [];
    
    const fetchSpans = spans.filter(s => 
      s.name.toLowerCase().includes('fetch') || 
      !!s.attributes?.['http.url']
    );

    // 1. Short Revalidation Detection
    for (const span of fetchSpans) {
      const nextRevalidate = this.getNumberAttribute(span, 'next.revalidate');
      
      if (nextRevalidate !== undefined && nextRevalidate > 0 && nextRevalidate < this.minRevalidateThresholdSeconds) {
        issues.push({
          id: this.id,
          type: 'SHORT_REVALIDATE',
          severity: 'warning',
          message: `Short revalidation detected: ${nextRevalidate}s (threshold: ${this.minRevalidateThresholdSeconds}s).`,
          suggestion: `Avoid extremely low revalidation times for common routes to reduce server load.
          
Example:
// ❌ Low (1s)
await fetch(..., { next: { revalidate: 1 } });

// ✅ Recommended (>=10s)
await fetch(..., { next: { revalidate: 3600 } });`,
          route: context.route,
          detectedAt: Date.now(),
          attributes: {
            revalidateSeconds: nextRevalidate,
            url: this.getSpanUrl(span)
          }
        });
      }
    }

    // 2. Request without Deduplication (within same trace)
    const urlMap = new Map<string, ReadableSpan[]>();
    for (const span of fetchSpans) {
      const url = this.getSpanUrl(span);
      if (!url) continue;

      // Skip non-GET requests as they aren't meant for deduplication
      const method = this.getStringAttribute(span, 'http.method');
      if (method && method !== 'GET') continue;

      const list = urlMap.get(url) || [];
      list.push(span);
      urlMap.set(url, list);
    }

    for (const [url, duplicates] of urlMap.entries()) {
      if (duplicates.length > 1) {
        // Only report if it's not explicitly cached/deduplicated by Next.js
        // If they are separate spans, it means Next.js fetch cache didn't catch them.
        issues.push({
          id: this.id,
          type: 'REQUEST_DEDUPLICATION_MISSING',
          severity: 'high',
          message: `Redundant "${url}" request called ${duplicates.length}x in a single trace.`,
          suggestion: `This fetch is being repeated across component boundaries. Use React 'cache()' or ensure the Next.js fetch cache is active.
          
Example:
// Move fetch to a shared utility wrapped in cache()
import { cache } from 'react';
export const getUser = cache(async () => {
  return await fetch('/api/user').then(r => r.json());
});`,
          route: context.route,
          detectedAt: Date.now(),
          attributes: {
            url,
            count: duplicates.length,
            totalWasteMs: Math.round(duplicates.reduce((sum, s) => sum + this.getSpanDurationMs(s), 0))
          }
        });
      }
    }

    return issues;
  }
}
