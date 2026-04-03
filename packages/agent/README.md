# `@codebaz/nextdoctor-agent`

**Enterprise-grade OpenTelemetry agent for Next.js.** Automatic performance monitoring, anomaly detection, and issue diagnostics for production applications.

## Features

- ✅ **Zero-Config Instrumentation**: Works out-of-the-box via Next.js Instrumentation Hook
- ✅ **Vercel Native**: Seamless integration with Vercel deployments and `@vercel/otel`
- ✅ **Intelligent Sampling**: Adaptive sampling rate to manage trace volume
- ✅ **Performance Monitoring**: Automatic detection of slow routes and database queries
- ✅ **Anomaly Detection**: Real-time issue detection with actionable suggestions
- ✅ **Circuit Breaker**: Protected exports with automatic failover
- ✅ **Batch Processing**: Memory-efficient trace batching
- ✅ **Enterprise Logging**: Structured logging with multiple levels (DEBUG, INFO, WARN, ERROR)
- ✅ **Custom Metrics**: Easy API for application-level metrics
- ✅ **Health Monitoring**: Real-time agent health status
- ✅ **Middleware Support**: Ready-made instrumentation for API routes
- ✅ **Retry Policy**: Configurable exponential backoff with jitter
- ✅ **Multi-Environment**: Support for development, staging, and production

## Installation

```bash
npm install @codebaz/nextdoctor-agent
# or
pnpm add @codebaz/nextdoctor-agent
# or
yarn add @codebaz/nextdoctor-agent
```

Requires **Next.js 14+** and **Node.js 18+**

## Quick Start

### 1. Initialize in `instrumentation.ts`

Create `instrumentation.ts` in your Next.js project root:

```typescript
import { initNextDoctor } from '@codebaz/nextdoctor-agent';

export default async function instrumentation() {
  // Only initialize in production
  if (process.env.NODE_ENV === 'development') return;

  await initNextDoctor({
    projectToken: process.env.NEXTDOCTOR_PROJECT_TOKEN!,
    endpoint: process.env.NEXTDOCTOR_ENDPOINT || 'https://ingest.nextdoctor.dev',
  });
}
```

### 2. Add Environment Variables

```bash
NEXTDOCTOR_PROJECT_TOKEN=your-secure-project-token
NEXTDOCTOR_ENDPOINT=https://ingest.nextdoctor.dev
```

### 3. Deploy

Your Next.js app will now automatically:
- 🔍 Capture OpenTelemetry traces
- 📊 Report performance metrics
- 🚨 Detect performance issues
- 📤 Send data to NextDoctor dashboard

## Configuration

### Advanced Setup

```typescript
import { initNextDoctor, LogLevel } from '@codebaz/nextdoctor-agent';

await initNextDoctor({
  // Required
  projectToken: process.env.NEXTDOCTOR_PROJECT_TOKEN!,
  endpoint: process.env.NEXTDOCTOR_ENDPOINT || 'https://ingest.nextdoctor.dev',

  // Optional - Enterprise Features
  enabled: true,
  serviceName: 'my-next-app',
  version: '1.2.3',
  environment: 'production',
  logLevel: LogLevel.INFO,
  samplingRate: 1.0, // 0.0 to 1.0
  timeout: 30000, // ms
  enableDebugLogging: false,

  // Exporter Configuration
  exporter: {
    type: 'vercel', // or 'otlp-http', 'none'
    batchSize: 100,
    batchTimeoutMs: 5000,
  },

  // Retry Policy
  retryPolicy: {
    maxRetries: 5,
    initialDelayMs: 100,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    randomizationFactor: 0.1,
  },

  // Feature Flags
  captureLogs: true,
  captureMetrics: true,
  captureExceptions: true,
});
```

## API Reference

### `initNextDoctor(config)`

Initializes the NextDoctor agent with automatic retries and validation.

```typescript
await initNextDoctor({
  projectToken: '...',
  endpoint: '...',
});
```

### `shutdownNextDoctor()`

Gracefully shuts down the agent (e.g., before serverless function timeout).

```typescript
await shutdownNextDoctor();
```

### `reportMetric(name, value, attributes?)`

Report a custom application metric.

```typescript
import { reportMetric } from '@codebaz/nextdoctor-agent';

reportMetric('checkout.total', 12999, {
  currency: 'USD',
  items: 5,
});
```

### `getHealthStatus()`

Get real-time agent health information.

```typescript
import { getHealthStatus } from '@codebaz/nextdoctor-agent';

const health = getHealthStatus();
console.log(health);
// {
//   initialized: true,
//   isHealthy: true,
//   exporterStatus: 'healthy',
//   bufferedSpans: 42,
//   errorCount: 0
// }
```

### `getDetectedIssues()`

Retrieve detected performance issues and anomalies.

```typescript
import { getDetectedIssues } from '@codebaz/nextdoctor-agent';

const issues = getDetectedIssues();
issues.forEach(issue => {
  console.log(`${issue.severity}: ${issue.message}`);
  console.log(`💡 ${issue.suggestion}`);
});
```

## Middleware

### API Route Monitoring

Automatically capture and monitor API routes:

```typescript
// app/api/users/route.ts
import { withNextDoctorMonitoring } from '@codebaz/nextdoctor-agent/middleware';

const handler = async (req, res) => {
  const users = await db.users.findAll();
  res.json(users);
};

export default withNextDoctorMonitoring(handler);
```

### Operation Timing

Monitor async operations with automatic timing:

```typescript
import { withNextDoctorTiming } from '@codebaz/nextdoctor-agent/middleware';

const users = await withNextDoctorTiming(
  'fetch-users',
  async () => {
    return await db.users.findAll();
  },
  { source: 'homepage' }
);
```

## Enterprise Features

### Intelligent Sampling

Automatically adapts sampling rate based on trace volume:

```typescript
import { IntelligentSampler } from '@codebaz/nextdoctor-agent/optimization';

const sampler = new IntelligentSampler(0.1); // Start at 10%
if (sampler.shouldSample('http.request')) {
  // capture trace
}
```

### Circuit Breaker

Protects against degraded exporters:

```typescript
import { CircuitBreaker } from '@codebaz/nextdoctor-agent/optimization';

const breaker = new CircuitBreaker();
const result = await breaker.execute(async () => {
  return await exporter.export(traces);
});
```

### Batch Processing

Memory-efficient batch processing for high-throughput scenarios:

```typescript
import { BatchProcessor } from '@codebaz/nextdoctor-agent/optimization';

const processor = new BatchProcessor(
  100, // batch size
  5000, // timeout ms
  async (batch) => {
    await exporter.export(batch);
  }
);

processor.add(spanData);
await processor.flush();
```

## Telemetry Types

### Supported Metrics

- **API Latency**: HTTP request/response times
- **Database Performance**: Query execution times
- **Memory Usage**: Heap size and GC metrics
- **Error Rates**: Exception tracking
- **Custom Metrics**: Application-specific KPIs

### Detected Issues

The agent automatically detects:
- Slow API routes (> 3s)
- N+1 database queries
- Memory leaks
- Uncaught exceptions
- External API timeouts

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXTDOCTOR_PROJECT_TOKEN` | ✅ | - | Your project authentication token |
| `NEXTDOCTOR_ENDPOINT` | ✅ | - | Ingest endpoint URL |
| `NODE_ENV` | - | - | Set to "production" to enable collection |

## Best Practices

1. **Use In Production**: Agent is disabled in development by default
2. **Set Sample Rate**: For high-traffic apps, use `samplingRate: 0.1` to 0.5
3. **Monitor Health**: Regularly check `getHealthStatus()` in dashboards
4. **Handle Shutdown**: Call `shutdownNextDoctor()` in serverless timeouts
5. **Environment-Specific Config**: Use environment variables for endpoint switching
6. **Error Boundaries**: Custom metrics should wrap try-catch blocks

## Support

- 📖 [Documentation](https://codebaz.com/nextdoctor)
- 🐛 [Report Issues](https://github.com/codebaz/nextdoctor/issues)
- 💬 [Discord Community](https://discord.gg/codebaz)
- 📧 [Enterprise Support](mailto:enterprise@codebaz.com)

## License

MIT - See LICENSE file