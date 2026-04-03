# `@codebaz/nextdoctor-agent`

**Enterprise-grade OpenTelemetry agent for Next.js.** Automatic performance monitoring, anomaly detection, and issue diagnostics for production applications.

## Features

- ✅ **Zero-Config Instrumentation**: Works out-of-the-box via Next.js Instrumentation Hook
- ✅ **Vercel Native**: Seamless integration with Vercel deployments and `@vercel/otel`
- ✅ **CPU & Memory Monitoring**: Real-time system resource tracking with threshold alerts
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

### System Monitoring (CPU & Memory)

The agent automatically monitors system resources and detects performance degradation.

#### `getSystemMetrics()`

Get real-time CPU and memory metrics.

```typescript
import { getSystemMetrics } from '@codebaz/nextdoctor-agent';

const metrics = getSystemMetrics();
console.log(metrics);
// {
//   cpu: {
//     timestamp: 1712154800000,
//     usage: 45.2,           // percentage 0-100
//     coreCount: 4,
//     systemLoadPerCore: 1.13,
//     loadAverage: {
//       oneMinute: 4.52,
//       fiveMinutes: 3.89,
//       fifteenMinutes: 2.45
//     }
//   },
//   memory: {
//     timestamp: 1712154800000,
//     heapUsed: 124567890,    // bytes
//     heapTotal: 536870912,
//     heapUsagePercent: 23.2,
//     systemMemoryUsed: 8589934592,    // bytes
//     systemMemoryTotal: 34359738368,
//     systemMemoryUsagePercent: 25.0
//   },
//   uptime: 3600000          // milliseconds
// }
```

#### `getSystemHealth(cpuThreshold, memThreshold)`

Check system health with configurable thresholds (default: CPU 80%, Memory 85%).

```typescript
import { getSystemHealth } from '@codebaz/nextdoctor-agent';

const health = getSystemHealth(80, 85); // CPU and Memory thresholds
console.log(health);
// {
//   healthy: true,
//   warnings: [
//     'High CPU usage: 92% (threshold: 80%)',
//     'High heap memory: 89% (threshold: 85%)'
//   ],
//   metrics: { ... }
// }
```

#### `getSystemSummary()`

Get a formatted dashboard-friendly summary.

```typescript
import { getSystemSummary } from '@codebaz/nextdoctor-agent';

const summary = getSystemSummary();
console.log(summary);
// {
//   status: 'warning',
//   cpu: {
//     usage: '45.2%',
//     cores: 4,
//     load: { oneMinute: 4.52, fiveMinutes: 3.89, fifteenMinutes: 2.45 }
//   },
//   memory: {
//     heap: {
//       used: '118.7 MB',
//       total: '512 MB',
//       usage: '23.2%'
//     },
//     system: {
//       used: '8 GB',
//       total: '32 GB',
//       usage: '25.0%'
//     }
//   },
//   warnings: []
// }
```

#### Monitoring CPU in API Routes

```typescript
import { withNextDoctorMonitoring, getSystemMetrics } from '@codebaz/nextdoctor-agent';

const handler = async (req, res) => {
  const metrics = getSystemMetrics();
  
  if (metrics && metrics.cpu.usage > 80) {
    console.warn('High CPU detected, consider rate limiting');
  }

  const data = await processData();
  res.json(data);
};

export default withNextDoctorMonitoring(handler);
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

## Detection Engine

The NextDoctor Detection Engine automatically analyzes OpenTelemetry traces and identifies Next.js-specific performance anti-patterns. Unlike generic monitoring, it provides **actionable diagnostics** with concrete code suggestions.

### Automatic Issue Detection

The engine continuously monitors traces and reports detected issues via `getDetectedIssues()`:

```typescript
import { getDetectedIssues } from '@codebaz/nextdoctor-agent';

// In a dashboard or monitoring endpoint
app.get('/api/nextdoctor/issues', (req, res) => {
  const issues = getDetectedIssues();
  res.json({
    total: issues.length,
    byRoute: groupBy(issues, i => i.route),
    critical: issues.filter(i => i.severity === 'critical'),
  });
});
```

### Three MVP Detection Rules

#### 1. **Cold Start Threshold** (Edge Functions)

Detects when your Next.js Edge Function startup time exceeds 800ms, or when there's high latency variance (P50 vs P99 > 2000ms) indicating intermittent cold starts.

**Example Detection:**
```json
{
  "id": "COLD_START_THRESHOLD",
  "severity": "critical",
  "message": "Edge function cold start: 1200ms (threshold: 800ms)",
  "route": "/api/auth",
  "suggestion": "Move heavy imports outside handler, consider Node.js runtime for this route, or implement keep-warm strategy"
}
```

**When it triggers:**
- Startup time > 800ms on Edge runtime
- P99 latency is 2000ms+ higher than P50 (intermittent cold starts)

#### 2. **Uncached Fetch Detection** (Server Components)

Detects `fetch()` calls in Server Components without cache directives, especially N+1 patterns where the same URL is fetched multiple times.

**Example Detection - Single Fetch:**
```json
{
  "id": "FETCH_NO_CACHE",
  "severity": "high",
  "message": "Uncached fetch(): https://api.example.com/user",
  "route": "/dashboard",
  "suggestion": "Add cache directive. Example:\n\nconst data = await fetch(\n  'https://api.example.com/user',\n  { cache: 'force-cache' }\n);\n\nOr use revalidate:\n\nconst data = await fetch(..., {\n  next: { revalidate: 3600 }\n});"
}
```

**Example Detection - N+1 Pattern:**
```json
{
  "id": "FETCH_NO_CACHE",
  "severity": "critical",
  "message": "N+1 fetch pattern: https://api.example.com/posts called 5 times without cache",
  "route": "/user/[id]",
  "suggestion": "This URL is being fetched 5 times in a single request (N+1 pattern). Refactor to:\n\n1. Batch fetch all posts in one request\n2. Use Next.js Data Cache (cache directive)\n3. Use Database Queries instead of HTTP fetches"
}
```

**When it triggers:**
- `fetch()` called without `cache: 'no-store'` or `cache: 'no-cache'` in Server Component
- No `next.revalidate` specified
- Filtered: Ignores POST/PUT/DELETE, internal URLs, and calls < 50ms

#### 3. **Dynamic Route Candidate** (Unnecessary Dynamic Rendering)

Detects when `cookies()` or `headers()` are called but never actually read specific values, forcing the entire page to be dynamic when it could be static.

**Example Detection:**
```json
{
  "id": "DYNAMIC_ROUTE_CANDIDATE",
  "severity": "warning",
  "message": "Unnecessary dynamic rendering: cookies() called but no specific key accessed",
  "route": "/products/[id]",
  "suggestion": "Option 1: Remove the cookies() call if not needed\n\nOption 2: Move to Server Action:\n\n'use server';\nexport async function getUser() {\n  const sessionId = cookies().get('session')?.value;\n  // ...\n}\n\nOption 3: Add export const dynamic = 'force-static' if this route is truly static"
}
```

**When it triggers:**
- `cookies()` or `headers()` function is invoked
- No child span shows specific key access (e.g., `cookies().get('key')`)
- Route contains `[` indicating dynamic segment

### Accessing Detected Issues

#### Real-time in Application

```typescript
// app/api/health/route.ts
import { getDetectedIssues, getHealthStatus } from '@codebaz/nextdoctor-agent';

export async function GET() {
  const issues = getDetectedIssues();
  const health = getHealthStatus();
  
  return Response.json({
    agent: health,
    detected: {
      critical: issues.filter(i => i.severity === 'critical'),
      high: issues.filter(i => i.severity === 'high'),
      count: issues.length,
    },
  });
}
```

#### In Dashboard

```typescript
// pages/dashboard/diagnostics.tsx
import { useSuspenseQuery } from '@tanstack/react-query';

export default function DiagnosticsPage() {
  const { data } = useSuspenseQuery({
    queryKey: ['nextdoctor/issues'],
    queryFn: () => fetch('/api/nextdoctor/issues').then(r => r.json()),
    refetchInterval: 5000,
  });

  return (
    <div>
      <h2>NextDoctor Issues</h2>
      {data.critical.map(issue => (
        <div key={issue.id} className="critical">
          <strong>{issue.message}</strong>
          <pre>{issue.suggestion}</pre>
        </div>
      ))}
    </div>
  );
}
```

### Deduplication & Smart Reporting

The engine automatically:
- **Deduplicates** identical issues within 60-second windows
- **Groups** similar issues (e.g., multiple fetches to same URL)
- **Escalates severity** for N+1 patterns (1x = high, 3x+ = critical)
- **Tracks counts** so you know how many times an issue occurred
- **Sorts results** by severity (critical → high → warning → info)

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