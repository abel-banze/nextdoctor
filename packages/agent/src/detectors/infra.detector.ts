import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import type { DetectedIssue, DetectorContext } from './types.js';

export class InfraDetector extends BaseDetector {
  readonly id = 'infra-monitor';
  readonly name = 'Infrastructure & Runtime Detector';
  
  private memoryHistory: { timestamp: number, usage: number }[] = [];
  private readonly MAX_HISTORY = 10;
  private readonly LEAK_THRESHOLD_PERCENT = 15; // 15% growth in an hour (extrapolated)

  detect(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    // 1. Node.js API in Edge Runtime
    if (context.runtime === 'edge') {
      const nodeSpecificSpans = spans.filter(s => {
        const name = s.name.toLowerCase();
        return (
          name.includes('fs.') || 
          name.includes('net.') || 
          name.includes('tls.') || 
          name.includes('child_process') ||
          name.includes('dns.')
        );
      });

      if (nodeSpecificSpans.length > 0) {
        issues.push({
          id: this.id,
          type: 'NODEJS_API_IN_EDGE',
          severity: 'critical',
          message: `Node.js specific API (${nodeSpecificSpans[0]?.name}) used in Edge Runtime route "${context.route}".`,
          suggestion: `Edge Runtime does not support Node.js built-in modules like 'fs' or 'net'. Use Web APIs or switch the route to Node.js runtime:
          
export const runtime = 'nodejs';`,
          route: context.route,
          detectedAt: Date.now(),
          attributes: {
            disallowedApi: nodeSpecificSpans[0]?.name,
            spanCount: nodeSpecificSpans.length
          }
        });
      }
    }

    // 2. Memory Leak Pattern (Node.js only)
    if (context.runtime === 'nodejs' && context.systemMetrics) {
      const now = Date.now();
      const currentUsage = context.systemMetrics.heapUsed;
      
      this.memoryHistory.push({ timestamp: now, usage: currentUsage });
      if (this.memoryHistory.length > this.MAX_HISTORY) {
        this.memoryHistory.shift();
      }

      if (this.memoryHistory.length >= 5) {
        const first = this.memoryHistory[0]!;
        const last = this.memoryHistory[this.memoryHistory.length - 1]!;
        
        const timeDiffHours = (last.timestamp - first.timestamp) / (1000 * 60 * 60);
        const usageDiff = last.usage - first.usage;
        const growthRatePercent = (usageDiff / context.systemMetrics.heapTotal) * 100;
        
        // Extrapolate growth to 1 hour
        const hourlyGrowth = timeDiffHours > 0 ? growthRatePercent / timeDiffHours : 0;

        if (hourlyGrowth > this.LEAK_THRESHOLD_PERCENT && usageDiff > 0) {
          issues.push({
            id: this.id,
            type: 'MEMORY_LEAK_PATTERN',
            severity: 'high',
            message: `Potential memory leak: Heap is growing at ~${hourlyGrowth.toFixed(1)}% per hour.`,
            suggestion: `O uso de memória está a crescer consistentemente sem recuperação. Verifique closures pendentes, caches globais infinitos ou listeners não removidos.`,
            route: context.route,
            detectedAt: Date.now(),
            attributes: {
              hourlyGrowthRate: hourlyGrowth,
              totalGrowthPercent: growthRatePercent,
              heapUsedMb: Math.round(currentUsage / 1024 / 1024)
            }
          });
        }
      }
    }

    return issues;
  }
}
