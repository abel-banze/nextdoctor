import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { trace } from '@opentelemetry/api';
import type {
  NextDoctorConfig,
  ExporterType,
  RetryPolicy,
  AgentHealth,
  DetectedIssue,
  LogLevel,
} from './types.js';
import { LogLevel as LogLevelEnum, ExporterType as ExporterTypeEnum } from './types.js';
import { SystemMonitor, type SystemMetrics } from './system-monitor.js';
import { detectionEngine } from './detectors/index.js';

class NextDoctorAgent {
  private sdk: NodeSDK | null = null;
  private config: NextDoctorConfig;
  private systemMonitor: SystemMonitor;
  private health: AgentHealth = {
    initialized: false,
    isHealthy: true,
    exporterStatus: 'healthy',
    bufferedSpans: 0,
    errorCount: 0,
  };
  private retryPolicy: RetryPolicy;
  private logLevel: LogLevel;
  private initialized = false;
  private detectedIssues: DetectedIssue[] = [];
  private spansBuffer: any[] = [];
  private lastAnalysisTime = Date.now();
  private readonly analysisIntervalMs = 5000; // Analyze spans every 5 seconds
  private startTime = Date.now();

  constructor(config: NextDoctorConfig) {
    this.validateConfig(config);
    this.config = {
      enabled: true,
      serviceName: 'nextdoctor-app',
      version: '0.1.0',
      environment: 'production',
      logLevel: LogLevelEnum.INFO,
      samplingRate: 1.0,
      timeout: 30000,
      ...config,
    };
    this.logLevel = this.config.logLevel || LogLevelEnum.INFO;
    this.retryPolicy = {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      randomizationFactor: 0.1,
    };
    if (config.retryPolicy) {
      this.retryPolicy = { ...this.retryPolicy, ...config.retryPolicy };
    }
    this.systemMonitor = new SystemMonitor((level, message, meta) => this.log(level, message, meta));
  }

  private validateConfig(config: Partial<NextDoctorConfig>): void {
    if (!config.projectToken) {
      throw new Error('NextDoctor: projectToken is required');
    }
    if (!config.endpoint) {
      throw new Error('NextDoctor: endpoint is required');
    }
    if (config.samplingRate !== undefined && (config.samplingRate < 0 || config.samplingRate > 1)) {
      throw new Error('NextDoctor: samplingRate must be between 0 and 1');
    }
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (level < this.logLevel) return;

    const timestamp = new Date().toISOString();
    const prefix = `[NextDoctor ${timestamp}]`;

    if (meta) {
      console.log(`${prefix} ${message}`, meta);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  private createTraceExporter(): any {
    const exporterConfig = (this.config.exporter || {}) as any;
    const isVercel = exporterConfig.type === ExporterTypeEnum.VERCEL || this.isVercelEnvironment();

    if (isVercel || !exporterConfig.url) {
      this.log(LogLevelEnum.INFO, 'Using Vercel OTEL exporter');
      return new OTLPTraceExporter({
        url: this.config.endpoint,
        headers: {
          authorization: `Bearer ${this.config.projectToken}`,
          'content-type': 'application/json',
        },
      } as any);
    }

    return new OTLPTraceExporter({
      url: exporterConfig.url || this.config.endpoint,
      headers: {
        ...exporterConfig.headers,
        authorization: `Bearer ${this.config.projectToken}`,
        'content-type': 'application/json',
      },
    } as any);
  }

  private createResource(): any {
    // Using any to avoid version mismatch issues with OpenTelemetry
    const attributes: Record<string, string | number> = {
      'service.name': this.config.serviceName || 'nextdoctor-app',
      'service.version': this.config.version || '0.1.0',
      'deployment.environment': this.config.environment || 'production',
      'service.instance.id': this.generateInstanceId(),
    };

    return { attributes };
  }

  private generateInstanceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private isVercelEnvironment(): boolean {
    return !!(
      typeof process !== 'undefined' &&
      process.env.VERCEL === '1'
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.log(LogLevelEnum.WARN, 'NextDoctor agent already initialized');
      return;
    }

    if (!this.config.enabled) {
      this.log(LogLevelEnum.INFO, 'NextDoctor agent is disabled');
      return;
    }

    try {
      try {
        this.log(LogLevelEnum.DEBUG, 'Initializing NextDoctor agent...');

        const traceExporter = this.createTraceExporter();
        const resource = this.createResource();

        this.sdk = new NodeSDK({
          resource: resource as any,
          traceExporter,
          instrumentations: [
            getNodeAutoInstrumentations({
              '@opentelemetry/instrumentation-http': {
                enabled: true,
                responseHook: (span: any, response: any) => {
                  if (response.statusCode) {
                    span.setAttribute('http.response.status', response.statusCode);
                  }
                },
              },
              '@opentelemetry/instrumentation-fs': {
                enabled: true,
              },
              '@opentelemetry/instrumentation-express': {
                enabled: true,
              },
            }),
          ],
        });

        await this.sdk.start();
        this.health.initialized = true;
        this.health.isHealthy = true;
        this.log(LogLevelEnum.INFO, 'NextDoctor agent initialized successfully');
      } catch (retryError: any) {
        this.health.errorCount++;
        if (this.health.errorCount < this.retryPolicy.maxRetries) {
          this.log(LogLevelEnum.WARN, `Initialization attempt failed, retrying... (${this.health.errorCount}/${this.retryPolicy.maxRetries})`, {
            error: retryError?.message,
          });
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, this.health.errorCount)));
          throw retryError;
        }
        throw retryError;
      }

      this.initialized = true;
    } catch (error) {
      this.health.initialized = false;
      this.health.isHealthy = false;
      this.health.exporterStatus = 'unreachable';
      this.health.errorCount++;

      const message = error instanceof Error ? error.message : String(error);
      this.log(LogLevelEnum.ERROR, 'Failed to initialize NextDoctor agent', { error: message });
      throw error;
    }
  }

  private analyzeSpan(span: any): void {
    // Buffer span for batch analysis by detection engine
    try {
      if (!span) return;

      // Add span to buffer with timestamp
      this.spansBuffer.push({
        ...span,
        bufferedAt: Date.now(),
      });

      // Keep buffer size manageable (max 1000 spans)
      if (this.spansBuffer.length > 1000) {
        this.spansBuffer = this.spansBuffer.slice(-500);
      }

      // Run detection engine periodically
      const now = Date.now();
      if (now - this.lastAnalysisTime >= this.analysisIntervalMs) {
        this.runDetectionEngine();
        this.lastAnalysisTime = now;
      }
    } catch (error) {
      this.log(LogLevelEnum.DEBUG, 'Error buffering span', { error });
    }
  }

  private runDetectionEngine(): void {
    // Run detection engine on buffered spans
    try {
      if (this.spansBuffer.length === 0) return;

      // Extract context from spans
      const firstSpan = this.spansBuffer[0];
      const route = firstSpan?.attributes?.['http.route'] || 
                   firstSpan?.attributes?.['http.url'] || 
                   'unknown';
      const runtime = (process.env.NEXT_RUNTIME || 'nodejs') as 'nodejs' | 'edge';

      // Calculate startup time if this is the first request
      const startupTimeMs = Date.now() - this.startTime;

      // Analyze spans with detection engine
      const detectedIssues = detectionEngine.analyzeSpans(this.spansBuffer, {
        route: String(route),
        runtime,
        startupTimeMs: startupTimeMs < 30000 ? startupTimeMs : undefined, // Only report first 30s
      });

      // Merge with existing detections (detection engine handles deduplication internally)
      if (detectedIssues.length > 0) {
        this.detectedIssues.push(...detectedIssues);

        // Keep detected issues list manageable (max 500 most recent)
        if (this.detectedIssues.length > 500) {
          this.detectedIssues = this.detectedIssues.slice(-250);
        }

        this.log(LogLevelEnum.DEBUG, `Detection engine found ${detectedIssues.length} issues`, {
          issues: detectedIssues.map(i => ({ id: i.id, severity: i.severity })),
        });
      }

      // Clear buffer after analysis to avoid re-analyzing
      this.spansBuffer = [];
    } catch (error) {
      this.log(LogLevelEnum.DEBUG, 'Error running detection engine', { error });
    }
  }

  async shutdown(): Promise<void> {
    if (!this.sdk) {
      this.log(LogLevelEnum.WARN, 'NextDoctor agent not initialized');
      return;
    }

    try {
      // Run detection engine one final time for any remaining buffered spans
      if (this.spansBuffer.length > 0) {
        this.runDetectionEngine();
      }

      this.log(LogLevelEnum.INFO, 'Shutting down NextDoctor agent...');
      await this.sdk.shutdown();
      this.initialized = false;
      this.health.initialized = false;
      this.log(LogLevelEnum.INFO, 'NextDoctor agent shut down successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(LogLevelEnum.ERROR, 'Error during shutdown', { error: message });
      throw error;
    }
  }

  getHealth(): AgentHealth {
    return {
      ...this.health,
      errorCount: this.health.errorCount,
    };
  }

  getDetectedIssues(): DetectedIssue[] {
    return this.detectedIssues;
  }

  clearDetectedIssues(): void {
    this.detectedIssues = [];
  }

  reportCustomMetric(name: string, value: number, attributes?: Record<string, any>): void {
    if (!this.initialized) {
      this.log(LogLevelEnum.WARN, 'Agent not initialized, metric not reported', { name });
      return;
    }

    const tracer = trace.getTracer('nextdoctor');
    const span = tracer.startSpan(`custom-metric: ${name}`);
    span.setAttribute('metric.name', name);
    span.setAttribute('metric.value', value);
    if (attributes) {
      Object.entries(attributes).forEach(([key, val]) => {
        span.setAttribute(`metric.${key}`, val);
      });
    }
    span.end();
  }

  private getUptime(): number {
    return Date.now() - this.startTime;
  }

  getSystemMetrics(): SystemMetrics {
    return this.systemMonitor.getSystemMetrics();
  }

  getSystemHealth(cpuThreshold: number = 80, memThreshold: number = 85) {
    return this.systemMonitor.getSystemHealth(cpuThreshold, memThreshold);
  }

  getSystemSummary() {
    return this.systemMonitor.getSummary();
  }

  getStats() {
    return {
      uptime: this.getUptime(),
      initialized: this.initialized,
      health: this.getHealth(),
      detectedIssues: this.getDetectedIssues(),
      system: this.getSystemSummary(),
    };
  }
}

// Global singleton instance
let agentInstance: NextDoctorAgent | null = null;

export async function initNextDoctor(config: NextDoctorConfig): Promise<void> {
  if (agentInstance) {
    console.warn('NextDoctor agent already initialized');
    return;
  }

  agentInstance = new NextDoctorAgent(config);
  await agentInstance.initialize();
}

export async function shutdownNextDoctor(): Promise<void> {
  if (!agentInstance) {
    console.warn('NextDoctor agent not initialized');
    return;
  }

  await agentInstance.shutdown();
  agentInstance = null;
}

export function getNextDoctorAgent(): NextDoctorAgent | null {
  return agentInstance;
}

export function reportMetric(name: string, value: number, attributes?: Record<string, any>): void {
  if (!agentInstance) {
    console.warn('NextDoctor agent not initialized, metric not reported');
    return;
  }

  agentInstance.reportCustomMetric(name, value, attributes);
}

export function getHealthStatus(): AgentHealth | null {
  return agentInstance?.getHealth() || null;
}

export function getDetectedIssues(): DetectedIssue[] {
  return agentInstance?.getDetectedIssues() || [];
}

export function getSystemMetrics(): SystemMetrics | null {
  return agentInstance?.getSystemMetrics() || null;
}

export function getSystemHealth(cpuThreshold: number = 80, memThreshold: number = 85) {
  if (!agentInstance) {
    console.warn('NextDoctor agent not initialized, system health unavailable');
    return null;
  }

  return agentInstance.getSystemHealth(cpuThreshold, memThreshold);
}

export function getSystemSummary() {
  if (!agentInstance) {
    console.warn('NextDoctor agent not initialized, system summary unavailable');
    return null;
  }

  return agentInstance.getSystemSummary();
}