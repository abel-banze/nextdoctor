import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

export type IssueSeverity = 'info' | 'warning' | 'high' | 'critical';

export interface DetectedIssue {
  id: string;
  type: string;
  severity: IssueSeverity;
  message: string;
  suggestion: string;
  route?: string;
  spanId?: string;
  attributes?: Record<string, unknown>;
  detectedAt: number;
}

export interface DetectorResult {
  issues: DetectedIssue[];
  detectorId: string;
  analyzedSpans: number;
  durationMs: number;
}

export interface DetectorContext {
  route?: string;
  runtime: 'nodejs' | 'edge';
  startupTimeMs?: number;
  systemMetrics?: {
    cpuUsage: number;
    memoryUsagePercent: number;
    heapUsed: number;
    heapTotal: number;
  };
}

export interface IssueDeduplicationKey {
  id: string;
  route?: string;
}

export interface DedupedIssue extends DetectedIssue {
  firstDetectedAt: number;
  lastDetectedAt: number;
  count: number;
}