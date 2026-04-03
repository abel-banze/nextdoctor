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

class NextDoctorAgent {
  private sdk: NodeSDK | null = null;
  private config: NextDoctorConfig;
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
    // Span analysis for detecting performance issues
    // This will be enhanced with specific Next.js pattern detection
    try {
      const duration = span.duration ?? 0;
      const durationMs = duration / 1000000; // Convert nanoseconds to ms

      // Check for slow routes
      if (durationMs > 3000 && span.attributes?.['http.url']) {
        const url = String(span.attributes['http.url']);
        this.detectedIssues.push({
          id: `slow-route-${Date.now()}-${Math.random()}`,
          severity: durationMs > 10000 ? 'critical' : 'high',
          message: `Slow route detected: ${url} took ${durationMs.toFixed(2)}ms`,
          suggestion: 'Optimize database queries, cache responses, or break down the computation',
          affected: [url],
          metrics: {
            duration: durationMs,
            threshold: 3000,
          },
        });
      }
    } catch (error) {
      this.log(LogLevelEnum.DEBUG, 'Error analyzing span', { error });
    }
  }

  async shutdown(): Promise<void> {
    if (!this.sdk) {
      this.log(LogLevelEnum.WARN, 'NextDoctor agent not initialized');
      return;
    }

    try {
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

  getStats() {
    return {
      uptime: this.getUptime(),
      initialized: this.initialized,
      health: this.getHealth(),
      detectedIssues: this.getDetectedIssues(),
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