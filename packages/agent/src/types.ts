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
  endpoint?: string;
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
  modules?: AgentModules;
  piiSanitization?: PiiSanitizationConfig;
}

export interface AgentModules {
  db?: boolean;
  profiling?: boolean;
  rsc?: boolean;
  client?: boolean;
}

export interface PiiSanitizationConfig {
  enabled: boolean;
  redactAttributes?: string[];  // e.g. ['http.url', 'db.statement']
  redactPattern?: RegExp;       // e.g. /email=[\w@.]+/
}

export interface DetectedIssue {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  message: string;
  suggestion: string;
  route?: string;
  spanId?: string;
  attributes?: Record<string, unknown>;
  detectedAt: number;
}

export interface AgentHealth {
  initialized: boolean;
  isHealthy: boolean;
  lastHealthCheckAt?: number;
  exporterStatus: 'healthy' | 'degraded' | 'unreachable';
  bufferedSpans: number;
  errorCount: number;
}