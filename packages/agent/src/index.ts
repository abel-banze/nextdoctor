export {
  initNextDoctor,
  shutdownNextDoctor,
  getNextDoctorAgent,
  reportMetric,
  getHealthStatus,
  getDetectedIssues,
  getSystemMetrics,
  getSystemHealth,
  getSystemSummary,
} from './init';

export type {
  NextDoctorConfig,
  DetectedIssue,
  AgentHealth,
  RetryPolicy,
  ExporterConfig,
} from './types';

export {
  LogLevel,
  ExporterType,
} from './types';

export {
  withNextDoctorMonitoring,
  withNextDoctorTiming,
} from './middleware';

export {
  IntelligentSampler,
  BatchProcessor,
  CircuitBreaker,
} from './optimization';

export {
  SystemMonitor,
  CPUMonitor,
  MemoryMonitor,
} from './system-monitor';

export type {
  CPUMetrics,
  MemoryMetrics,
  SystemMetrics,
} from './system-monitor';