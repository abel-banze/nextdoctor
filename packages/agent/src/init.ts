import { registerOTel } from '@vercel/otel';
import { trace, Span } from '@opentelemetry/api';
import { SpanProcessor, ReadableSpan, Sampler, SamplingDecision, SamplingResult, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NextDoctorExporter } from './exporter.js';
import type {
  NextDoctorConfig,
  RetryPolicy,
  AgentHealth,
  DetectedIssue,
  LogLevel,
} from './types.js';
import { LogLevel as LogLevelEnum } from './types.js';
import { SystemMonitor, type SystemMetrics } from './system-monitor.js';
import { detectionEngine } from './detectors/index.js';
import { IntelligentSampler } from './optimization.js';
import { V8MemoryRescue } from './profiler/v8-rescue.js';

class IntelligentSamplerAdapter implements Sampler {
  private sampler: IntelligentSampler;
  
  constructor(samplingRate: number) {
    this.sampler = new IntelligentSampler(samplingRate);
  }

  shouldSample(_context: unknown, _traceId: string, spanName: string): SamplingResult {
    const shouldSample = this.sampler.shouldSample(spanName);
    this.sampler.recordSpan();
    return {
      decision: shouldSample ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD,
    };
  }
  
  toString(): string {
    return `IntelligentSamplerAdapter{rate=${this.sampler.getSamplingRate()}}`;
  }

  setRate(newRate: number): void {
    this.sampler.setRate(newRate);
  }
}

class NextDoctorAgent {
  private config: NextDoctorConfig;
  private systemMonitor: SystemMonitor;
  private memoryRescue: V8MemoryRescue;
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
  private spansBuffer: (ReadableSpan & { bufferedAt: number })[] = [];
  private lastAnalysisTime = Date.now();
  private readonly analysisIntervalMs = 5000;
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
    this.memoryRescue = new V8MemoryRescue((level, message, meta) => this.log(level, message, meta));
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

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (level < this.logLevel) return;

    const timestamp = new Date().toISOString();
    const prefix = `[NextDoctor ${timestamp}]`;

    if (meta) {
      console.log(`${prefix} ${message}`, meta);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  private createTraceExporter(): NextDoctorExporter {
    return new NextDoctorExporter({
      endpoint: this.config.endpoint,
      projectToken: this.config.projectToken,
      getIssues: () => this.detectedIssues,
      clearIssues: (sent) => {
        const sentSet = new Set(sent.map(i => `${i.id}:${i.detectedAt}`));
        this.detectedIssues = this.detectedIssues.filter(
          i => !sentSet.has(`${i.id}:${i.detectedAt}`)
        );
      },
      getContext: () => {
        const firstSpan = this.spansBuffer[0];
        const route =
          firstSpan?.attributes?.['http.route'] ??
          firstSpan?.attributes?.['http.url'] ??
          undefined;
        return {
          route: route ? String(route) : undefined,
          runtime: (process.env.NEXT_RUNTIME ?? 'nodejs') as 'nodejs' | 'edge',
          startupTimeMs: Date.now() - this.startTime < 30_000
            ? Date.now() - this.startTime
            : undefined,
        };
      },
      timeoutMs: this.config.timeout ?? 10_000,
    });
  }

  private createResource(): { attributes: Record<string, string | number> } {
    return {
      attributes: {
        'service.name': this.config.serviceName || 'nextdoctor-app',
        'service.version': this.config.version || '0.1.0',
        'deployment.environment': this.config.environment || 'production',
        'service.instance.id': this.generateInstanceId(),
      }
    };
  }

  private generateInstanceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  public analyzeSpanFromProcessor(span: ReadableSpan): void {
    try {
      this.spansBuffer.push(Object.assign({}, span, { bufferedAt: Date.now() }) as ReadableSpan & { bufferedAt: number });

      this.health.bufferedSpans = this.spansBuffer.length;

      const now = Date.now();
      if (now - this.lastAnalysisTime >= this.analysisIntervalMs || this.spansBuffer.length >= 500) {
        this.runDetectionEngine();
        this.lastAnalysisTime = now;
      }
    } catch (error) {
      this.log(LogLevelEnum.DEBUG, 'Error buffering span', { error: String(error) });
    }
  }

  private runDetectionEngine(): void {
    try {
      if (this.spansBuffer.length === 0) return;

      const spansToAnalyze = [...this.spansBuffer];
      this.spansBuffer = [];
      this.health.bufferedSpans = 0;

      const firstSpan = spansToAnalyze[0];
      const route = firstSpan?.attributes?.['http.route'] || 
                   firstSpan?.attributes?.['http.url'] || 
                   'unknown';
      const runtime = (process.env.NEXT_RUNTIME || 'nodejs') as 'nodejs' | 'edge';

      const startupTimeMs = Date.now() - this.startTime;
      const metrics = this.systemMonitor.getSystemMetrics();

      const detectedIssues = detectionEngine.analyzeSpans(spansToAnalyze, {
        route: String(route),
        runtime,
        startupTimeMs: startupTimeMs < 30000 ? startupTimeMs : undefined,
        systemMetrics: {
          cpuUsage: metrics.cpu.usage,
          memoryUsagePercent: metrics.memory.systemMemoryUsagePercent,
          heapUsed: metrics.memory.heapUsed,
          heapTotal: metrics.memory.heapTotal,
        },
      });

      if (detectedIssues.length > 0) {
        this.detectedIssues.push(...detectedIssues);
        if (this.detectedIssues.length > 500) {
          this.detectedIssues = this.detectedIssues.slice(-250);
        }

        this.log(LogLevelEnum.DEBUG, `Detection engine found ${detectedIssues.length} issues`);
      }
    } catch (error) {
      this.log(LogLevelEnum.DEBUG, 'Error running detection engine', { error: String(error) });
    }
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
        
        const batchSpanProcessor = new BatchSpanProcessor(traceExporter, {
          maxExportBatchSize: this.config.exporter?.batchSize ?? 100,
          scheduledDelayMillis: this.config.exporter?.batchTimeoutMs ?? 5000,
        });

        const detectionSpanProcessor: SpanProcessor = {
          forceFlush: async () => {},
          onStart: () => {},
          onEnd: (span) => {
             this.analyzeSpanFromProcessor(span);
          },
          shutdown: async () => {},
        };

        const agentSampler = new IntelligentSamplerAdapter(this.config.samplingRate ?? 1.0);

        // --- Modular Instrumentation Loading ---
        const instrumentations: any[] = [];
        const modules = this.config.modules || { db: true, profiling: true, rsc: true, client: true };

        if (modules.db && process.env.NEXT_RUNTIME === 'nodejs') {
          try {
            const { PrismaInstrumentation } = await import('@prisma/instrumentation');
            const { PgInstrumentation } = await import('@opentelemetry/instrumentation-pg');
            const { MySQL2Instrumentation } = await import('@opentelemetry/instrumentation-mysql2');
            const { PostgresInstrumentation } = await import('otel-instrumentation-postgres');
            
            instrumentations.push(
              new PrismaInstrumentation(),
              new PgInstrumentation(),
              new MySQL2Instrumentation(),
              new PostgresInstrumentation()
            );
          } catch (e) {
            this.log(LogLevelEnum.DEBUG, 'DB Instrumentations not available, skipping...');
          }
        }

        registerOTel({
          serviceName: this.config.serviceName || 'nextdoctor-app',
          attributes: resource.attributes,
          spanProcessors: [batchSpanProcessor, detectionSpanProcessor],
          sampler: agentSampler,
          instrumentations,
          instrumentationConfig: {
            fetch: { ignoreUrls: [/ingest\.nextdoctor\.dev/] }
          }
        });

        this.health.initialized = true;
        if (modules.profiling && process.env.NEXT_RUNTIME === 'nodejs') {
          this.memoryRescue.start();
        }
        this.health.isHealthy = true;
        this.log(LogLevelEnum.INFO, 'NextDoctor agent initialized successfully');

        // --- Adaptive Sampling Loop ---
        if (process.env.NEXT_RUNTIME === 'nodejs') {
          setInterval(() => {
            const metrics = this.systemMonitor.getSystemMetrics();
            if (metrics.cpu.usage > 90) {
              this.log(LogLevelEnum.WARN, `High CPU detected (${metrics.cpu.usage.toFixed(1)}%). Reducing sampling to 0% to preserve system.`);
              agentSampler.setRate(0);
            } else if (metrics.cpu.usage > 70) {
              const currentRate = this.config.samplingRate ?? 1.0;
              agentSampler.setRate(currentRate * 0.2); // Throttle to 20% of target
            } else {
              agentSampler.setRate(this.config.samplingRate ?? 1.0);
            }
          }, 10000); // Check every 10s
        }
      } catch (retryError) {
        this.health.errorCount++;
        if (this.health.errorCount < this.retryPolicy.maxRetries) {
          this.log(LogLevelEnum.WARN, `Initialization attempt failed, retrying... (${this.health.errorCount}/${this.retryPolicy.maxRetries})`, {
            error: retryError instanceof Error ? retryError.message : String(retryError),
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

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      this.log(LogLevelEnum.WARN, 'NextDoctor agent not initialized');
      return;
    }

    try {
      if (this.spansBuffer.length > 0) {
        this.runDetectionEngine();
      }

      this.log(LogLevelEnum.INFO, 'Shutting down NextDoctor agent...');
      this.memoryRescue.stop();
      // OTel via Vercel shuts down globally on process exit
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

  reportCustomMetric(name: string, value: number, attributes?: Record<string, string | number | boolean>): void {
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

export function reportMetric(name: string, value: number, attributes?: Record<string, string | number | boolean>): void {
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