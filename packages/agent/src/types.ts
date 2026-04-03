export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export enum ExporterType {
  OTLP_HTTP = 'otlp-http',
  VERCEL = 'vercel',
  NONE = 'none',
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  randomizationFactor: number;
}

export interface ExporterConfig {
  type: ExporterType;
  url?: string;
  headers?: Record<string, string>;
  batchSize?: number;
  batchTimeoutMs?: number;
}

export interface NextDoctorConfig {
  projectToken: string;
  endpoint: string;
  enabled?: boolean;
  serviceName?: string;
  version?: string;
  environment?: 'development' | 'staging' | 'production';
  logLevel?: LogLevel;
  exporter?: ExporterConfig;
  retryPolicy?: Partial<RetryPolicy>;
  captureLogs?: boolean;
  captureMetrics?: boolean;
  captureExceptions?: boolean;
  samplingRate?: number; // 0.0 to 1.0
  enableDebugLogging?: boolean;
  timeout?: number; // ms
}

export interface DetectedIssue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  suggestion: string;
  affected: string[];
  metrics?: Record<string, number>;
}

export interface AgentHealth {
  initialized: boolean;
  isHealthy: boolean;
  lastHealthCheckAt?: number;
  exporterStatus: 'healthy' | 'degraded' | 'unreachable';
  bufferedSpans: number;
  errorCount: number;
}