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
} from './init.js';

export type {
  NextDoctorConfig,
  DetectedIssue,
  AgentHealth,
  RetryPolicy,
  ExporterConfig,
} from './types.js';

export {
  LogLevel,
  ExporterType,
} from './types.js';

export {
  withNextDoctorAppRoute,
  withNextDoctorMonitoring,
  withNextDoctorTiming,
} from './middleware.js';

export {
  NextDoctorProvider,
  Analytics,
} from './client/index.js';

export {
  IntelligentSampler,
  BatchProcessor,
  CircuitBreaker,
} from './optimization.js';

export {
  SystemMonitor,
  CPUMonitor,
  MemoryMonitor,
} from './system-monitor.js';

export type {
  CPUMetrics,
  MemoryMetrics,
  SystemMetrics,
} from './system-monitor.js';

export {
  detectionEngine,
  ColdStartThresholdDetector,
  FetchNoCacheDetector,
  DynamicRouteCandidateDetector,
} from './detectors/index.js';

export type {
  DetectorContext,
  DetectorResult,
  IssueSeverity,
} from './detectors/types.js';