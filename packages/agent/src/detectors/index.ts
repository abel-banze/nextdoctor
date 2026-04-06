import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import { ColdStartThresholdDetector } from './cold-start-threshold.detector.js';
import { FetchNoCacheDetector } from './fetch-no-cache.detector.js';
import { DynamicRouteCandidateDetector } from './dynamic-route-candidate.detector.js';
import { RscIntrospectionDetector } from './rsc-introspection.detector.js';
import { DbPerformanceDetector } from './db-performance.detector.js';
import { WaterfallDetector } from './waterfall.detector.js';
import { DataFetchingDetector } from './data-fetching.detector.js';
import { InfraDetector } from './infra.detector.js';
import { ClientVitalsDetector } from './client-vitals.detector.js';
import type { DetectedIssue, DetectorContext, IssueDeduplicationKey, DedupedIssue } from './types.js';

export class DetectionEngine {
  private detectors: BaseDetector[];
  private issueCache = new Map<string, DedupedIssue>();
  private readonly dedupWindowMs = 60_000; // 60 seconds

  constructor(config?: { disabledDetectors?: string[] }) {
    const disabledSet = new Set(config?.disabledDetectors || []);

    // Instantiate all detectors
    const allDetectors: BaseDetector[] = [
      new ColdStartThresholdDetector(),
      new FetchNoCacheDetector(),
      new DynamicRouteCandidateDetector(),
      new RscIntrospectionDetector(),
      new DbPerformanceDetector(),
      new WaterfallDetector(),
      new DataFetchingDetector(),
      new InfraDetector(),
      new ClientVitalsDetector(),
    ];

    this.detectors = allDetectors.filter(d => !disabledSet.has(d.id));
  }

  analyzeSpans(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const allIssues: DetectedIssue[] = [];

    // Run all detectors
    for (const detector of this.detectors) {
      const result = detector.run(spans, context);
      allIssues.push(...result.issues);
    }

    // Deduplicate within the window
    const deduped = this.deduplicateIssues(allIssues);

    // Sort by severity: critical > high > warning > info
    const severityOrder = { critical: 0, high: 1, warning: 2, info: 3 };
    deduped.sort(
      (a, b) => 
        severityOrder[a.severity as keyof typeof severityOrder] -
        severityOrder[b.severity as keyof typeof severityOrder]
    );

    return deduped;
  }

  private deduplicateIssues(issues: DetectedIssue[]): DetectedIssue[] {
    const now = Date.now();
    const dedupedMap = new Map<string, DedupedIssue>();

    // Clean old entries from cache
    for (const [key, cached] of this.issueCache.entries()) {
      if (now - cached.lastDetectedAt > this.dedupWindowMs) {
        this.issueCache.delete(key);
      }
    }

    // Process new issues
    for (const issue of issues) {
      const key = this.getDeduplicationKey(issue);
      const existingCached = this.issueCache.get(key);

      if (existingCached) {
        // Update cache
        existingCached.lastDetectedAt = now;
        existingCached.count++;
        // Don't duplicate in output if already reported recently
        continue;
      }

      // New issue - add to cache and output
      const dedupedIssue: DedupedIssue = {
        ...issue,
        firstDetectedAt: now,
        lastDetectedAt: now,
        count: 1,
      };

      this.issueCache.set(key, dedupedIssue);
      dedupedMap.set(key, dedupedIssue);
    }

    return Array.from(dedupedMap.values());
  }

  private getDeduplicationKey(issue: DetectedIssue): string {
    const key: IssueDeduplicationKey = {
      id: issue.id,
      route: issue.route,
    };
    return JSON.stringify(key);
  }

  getDetectorById(id: string): BaseDetector | undefined {
    return this.detectors.find(d => d.id === id);
  }

  listDetectors(): Array<{ id: string; name: string }> {
    return this.detectors.map(d => ({
      id: d.id,
      name: d.name,
    }));
  }

  clearCache(): void {
    this.issueCache.clear();
  }

  getCacheSize(): number {
    return this.issueCache.size;
  }
}

// Singleton instance
// MVP LIMITATION: In persistent Node.js environments (self-hosted), this cache 
// is shared globally. Deduplication keys include 'id' and 'route', but lack 
// project-level scope, which could cause cache collisions in multi-tenant usages.
export const detectionEngine = new DetectionEngine();

// Re-export all types and detectors for public API
export type { DetectedIssue, DetectorContext, DetectorResult } from './types.js';
export { BaseDetector } from './base-detector.js';
export { ColdStartThresholdDetector } from './cold-start-threshold.detector.js';
export { FetchNoCacheDetector } from './fetch-no-cache.detector.js';
export { DynamicRouteCandidateDetector } from './dynamic-route-candidate.detector.js';
export { RscIntrospectionDetector } from './rsc-introspection.detector.js';
export { WaterfallDetector } from './waterfall.detector.js';
export { DataFetchingDetector } from './data-fetching.detector.js';
export { InfraDetector } from './infra.detector.js';
export { ClientVitalsDetector } from './client-vitals.detector.js';
export { DbPerformanceDetector } from './db-performance.detector.js';