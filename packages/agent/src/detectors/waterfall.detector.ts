import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import type { DetectedIssue, DetectorContext } from './types.js';

/**
 * WaterfallDetector
 * 
 * Detects sequential performance bottlenecks (waterfalls) in React Server Components.
 * 
 * Pattern:
 * Span A: |---|
 * Span B:     |---|
 * This indicates that Span B waited for Span A to complete before starting,
 * which is suboptimal if they are independent data fetches.
 */
export class WaterfallDetector extends BaseDetector {
  readonly id = 'rendering-waterfall';
  readonly name = 'Server Component Waterfall Detector';
  
  private readonly minWaterfallDepth = 3;
  private readonly minSpanDurationMs = 100;
  private readonly sequentialSlackMs = 10; // Allow 10ms for CPU overhead between spans

  detect(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const issues: DetectedIssue[] = [];
    
    // Group spans by parentSpanId to analyze their relative timings
    const parentToChildren = new Map<string, ReadableSpan[]>();
    
    for (const span of spans) {
      // @ts-expect-error OTel internal parentSpanId
      const parentId = span.parentSpanId;
      if (!parentId) continue;
      
      const children = parentToChildren.get(parentId) || [];
      children.push(span);
      parentToChildren.set(parentId, children);
    }

    for (const [_parentId, children] of parentToChildren.entries()) {
      if (children.length < this.minWaterfallDepth) continue;

      // Sort children by start time
      const sorted = [...children].sort((a, b) => {
        const [aSec, aNano] = a.startTime;
        const [bSec, bNano] = b.startTime;
        return aSec !== bSec ? aSec - bSec : aNano - bNano;
      });

      let waterfallChain: ReadableSpan[] = [];
      let currentChain: ReadableSpan[] = [];

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i]!;
        const next = sorted[i+1]!;
        
        const currentEndMs = this.getSpanEndTimeMs(current);
        const nextStartMs = this.getSpanStartTimeMs(next);
        const currentDuration = this.getSpanDurationMs(current);
        const nextDuration = this.getSpanDurationMs(next);

        // Check if next starts AFTER current ends (with slack)
        // AND both are significant durations
        if (
          nextStartMs >= currentEndMs - this.sequentialSlackMs &&
          currentDuration > this.minSpanDurationMs &&
          nextDuration > this.minSpanDurationMs
        ) {
          if (currentChain.length === 0) {
            currentChain.push(current);
          }
          currentChain.push(next);
        } else {
          if (currentChain.length > waterfallChain.length) {
            waterfallChain = [...currentChain];
          }
          currentChain = [];
        }
      }

      if (currentChain.length > waterfallChain.length) {
        waterfallChain = [...currentChain];
      }

      if (waterfallChain.length >= this.minWaterfallDepth) {
        const totalDuration = waterfallChain.reduce((sum, s) => sum + this.getSpanDurationMs(s), 0);
        const names = waterfallChain.map(s => s.name).join(' → ');

        issues.push({
          id: this.id,
          type: 'RENDERING_WATERFALL',
          severity: 'high',
          message: `Server Component Waterfall detected in "${context.route}": ${waterfallChain.length} sequential operations costing ${Math.round(totalDuration)}ms.`,
          suggestion: `Avoid sequential 'await' calls for independent data. Use Promise.all() or start fetches earlier.
          
Example:
// ❌ Sequential
const user = await getUser();
const posts = await getPosts();

// ✅ Parallel
const [user, posts] = await Promise.all([getUser(), getPosts()]);`,
          route: context.route,
          detectedAt: Date.now(),
          attributes: {
            chainLength: waterfallChain.length,
            totalDurationMs: Math.round(totalDuration),
            chainNames: names,
            spans: waterfallChain.map(s => ({ name: s.name, duration: Math.round(this.getSpanDurationMs(s)) }))
          }
        });
      }
    }

    return issues;
  }

  private getSpanStartTimeMs(span: ReadableSpan): number {
    const [sec, nano] = span.startTime;
    return sec * 1000 + nano / 1_000_000;
  }

  private getSpanEndTimeMs(span: ReadableSpan): number {
    const [sec, nano] = span.endTime;
    return sec * 1000 + nano / 1_000_000;
  }
}
