export {
  initNextDoctor,
  shutdownNextDoctor,
  getNextDoctorAgent,
  reportMetric,
  getHealthStatus,
  getDetectedIssues,
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