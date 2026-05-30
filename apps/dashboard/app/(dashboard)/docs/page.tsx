import { CopyButton } from "@/components/copy-button"

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
      <code className="flex-1 overflow-x-auto text-sm font-mono whitespace-pre">{code}</code>
      <CopyButton value={code} label={label} />
    </div>
  )
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
}

export default function DocsPage() {
  return (
    <div className="space-y-10">
      {/* ── Overview ────────────────────────────────────────────── */}
      <section id="overview" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">How the agent works</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p>
            NextDoctor instruments your Next.js application via OpenTelemetry. The agent lives inside your app&apos;s
            process and hooks into the Next.js <InlineCode>instrumentation.ts</InlineCode> lifecycle to automatically
            capture traces for every request &mdash; page renders, API routes, server components, and server actions.
          </p>

          <p>
            Traces are analyzed in real time by the detection engine, which identifies performance anti-patterns such as
            N+1 queries, uncached fetches, cold starts, and RSC payload bloat. Data is then sent to the NextDoctor
            collector for persistent storage and dashboard visualization.
          </p>

          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium text-foreground">Data flow</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">Your Next.js app</span>
              <span className="text-muted-foreground">&rarr;</span>
              <span className="rounded-md bg-muted px-2 py-1 font-medium">Agent</span>
              <span className="text-muted-foreground">&rarr;</span>
              <span className="rounded-md bg-muted px-2 py-1 font-medium">Collector</span>
              <span className="text-muted-foreground">&rarr;</span>
              <span className="rounded-md bg-muted px-2 py-1 font-medium">Dashboard</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Installation ─────────────────────────────────────────── */}
      <section id="installation" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">Installation</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p>Install the NextDoctor agent package:</p>
          <CodeBlock code="npm install @codebaz/nextdoctor-agent" label="Install command copied" />
          <p>Requires <strong>Next.js 14+</strong> and <strong>Node.js 18+</strong>.</p>
        </div>
      </section>

      {/* ── Quick Start ──────────────────────────────────────────── */}
      <section id="quick-start" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">Quick start</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <h3 className="text-base font-semibold text-foreground">
            1. Create <InlineCode>instrumentation.ts</InlineCode>
          </h3>
          <p>In your Next.js project root, create the instrumentation file:</p>
          <CodeBlock
            code={`import { initNextDoctor } from '@codebaz/nextdoctor-agent';

export default async function instrumentation() {
  if (process.env.NODE_ENV === 'development') return;

  await initNextDoctor({
    projectToken: process.env.NEXTDOCTOR_PROJECT_TOKEN!,
    endpoint: process.env.NEXTDOCTOR_ENDPOINT || 'https://ingest.nextdoctor.dev',
  });
}`}
            label="Instrumentation copied"
          />

          <h3 className="text-base font-semibold text-foreground">2. Enable instrumentation in <InlineCode>next.config.ts</InlineCode></h3>
          <p>
            Add <InlineCode>instrumentationHook: true</InlineCode> to your Next.js config (the
            <InlineCode>init</InlineCode> command does this automatically):
          </p>
          <CodeBlock
            code={`// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  // ... your other config
};

export default nextConfig;`}
            label="Config copied"
          />

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="text-sm font-medium">No wrapper needed</p>
            <p className="mt-1 text-xs">
              There is no <InlineCode>withNextDoctor</InlineCode> wrapper for next.config.ts. The agent works through
              <InlineCode>instrumentation.ts</InlineCode> only. Do not try to import anything from
              <InlineCode>@codebaz/nextdoctor</InlineCode> in your config &mdash; that package is just the CLI init
              tool and does not export any config helpers.
            </p>
          </div>

          <h3 className="text-base font-semibold text-foreground">3. Add environment variables</h3>
          <CodeBlock
            code={`NEXTDOCTOR_PROJECT_TOKEN=your-secure-project-token
NEXTDOCTOR_ENDPOINT=https://ingest.nextdoctor.dev`}
            label="Env vars copied"
          />

          <h3 className="text-base font-semibold text-foreground">4. Deploy</h3>
          <p>
            Your Next.js app will now automatically capture OpenTelemetry traces, report performance metrics, detect
            issues, and send data to the NextDoctor dashboard.
          </p>
        </div>
      </section>

      {/* ── Advanced Setup ───────────────────────────────────────── */}
      <section id="advanced-setup" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">Advanced configuration</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <CodeBlock
            code={`import { initNextDoctor, LogLevel } from '@codebaz/nextdoctor-agent';

await initNextDoctor({
  // Required
  projectToken: process.env.NEXTDOCTOR_PROJECT_TOKEN!,
  endpoint: process.env.NEXTDOCTOR_ENDPOINT || 'https://ingest.nextdoctor.dev',

  // Environment & context
  enabled: process.env.NODE_ENV === 'production',
  serviceName: 'my-next-app',
  version: '1.2.3',
  environment: 'production',
  logLevel: LogLevel.INFO,
  samplingRate: 1.0,
  timeout: 30000,

  // Feature modules (all enabled by default)
  modules: {
    db: true,        // Database tracing & N+1 detection
    profiling: true, // V8 Memory Rescue (Node.js only)
    rsc: true,       // React Server Component introspection
    client: true,    // Browser vitals & React-Scan
  },

  // Exporter
  exporter: {
    batchSize: 100,
    batchTimeoutMs: 5000,
  },

  // Retry policy
  retryPolicy: {
    maxRetries: 5,
    initialDelayMs: 100,
    maxDelayMs: 30000,
  },
});`}
            label="Advanced config copied"
          />
        </div>
      </section>

      {/* ── API Reference ────────────────────────────────────────── */}
      <section id="api-reference" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">API reference</h2>
        <div className="mt-4 space-y-6 text-sm text-muted-foreground">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              <InlineCode>initNextDoctor(config)</InlineCode>
            </h3>
            <p className="mt-1">
              Initializes the agent with automatic retries and validation. Call this inside
              <InlineCode>instrumentation.ts</InlineCode>.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              <InlineCode>shutdownNextDoctor()</InlineCode>
            </h3>
            <p className="mt-1">Gracefully shuts down the agent (e.g., before a serverless function timeout).</p>
            <CodeBlock code="await shutdownNextDoctor();" label="Shutdown copied" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              <InlineCode>reportMetric(name, value, attributes?)</InlineCode>
            </h3>
            <p className="mt-1">Report a custom application metric:</p>
            <CodeBlock
              code={`import { reportMetric } from '@codebaz/nextdoctor-agent';

reportMetric('checkout.total', 12999, {
  currency: 'USD',
  items: 5,
});`}
              label="Metric copied"
            />
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              <InlineCode>getDetectedIssues()</InlineCode>
            </h3>
            <p className="mt-1">Retrieve detected performance issues and anomalies:</p>
            <CodeBlock
              code={`import { getDetectedIssues } from '@codebaz/nextdoctor-agent';

const issues = getDetectedIssues();
issues.forEach(issue => {
  console.log(\`\${issue.severity}: \${issue.message}\`);
  console.log(\`💡 \${issue.suggestion}\`);
});`}
              label="Issues copied"
            />
          </div>
        </div>
      </section>

      {/* ── Middleware ────────────────────────────────────────────── */}
      <section id="middleware" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">Middleware</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p>
            The agent provides high-performance wrappers for API routes and custom operation timing. Import them from
            <InlineCode>@codebaz/nextdoctor-agent/middleware</InlineCode>.
          </p>

          <h3 className="text-base font-semibold text-foreground">
            <InlineCode>withNextDoctorMonitoring(handler)</InlineCode>
          </h3>
          <p>Wrap API route handlers to automatically capture traces and detect issues:</p>
          <CodeBlock
            code={`import { withNextDoctorMonitoring } from '@codebaz/nextdoctor-agent/middleware';

const handler = async (req, res) => {
  const users = await db.users.findAll();
  res.json(users);
};

export default withNextDoctorMonitoring(handler);`}
            label="Middleware copied"
          />

          <h3 className="text-base font-semibold text-foreground">
            <InlineCode>withNextDoctorTiming(name, fn, attributes?)</InlineCode>
          </h3>
          <p>Monitor async operations with automatic timing:</p>
          <CodeBlock
            code={`import { withNextDoctorTiming } from '@codebaz/nextdoctor-agent/middleware';

const users = await withNextDoctorTiming(
  'fetch-users',
  async () => {
    return await db.users.findAll();
  },
  { source: 'homepage' }
);`}
            label="Timing copied"
          />
        </div>
      </section>

      {/* ── System Monitoring ────────────────────────────────────── */}
      <section id="system-monitoring" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">System monitoring</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p>The agent automatically monitors CPU and memory. Access metrics programmatically:</p>

          <CodeBlock
            code={`import { getSystemMetrics, getSystemHealth, getSystemSummary }
  from '@codebaz/nextdoctor-agent';

// Real-time CPU & memory
const metrics = getSystemMetrics();
console.log(metrics);
// {
//   cpu: { usage: 45.2, coreCount: 8, ... },
//   memory: { heapUsed: 124567890, heapUsagePercent: 23.2, ... }
// }

// Health check with thresholds (CPU 80%, Memory 85%)
const health = getSystemHealth(80, 85);

// Dashboard-friendly summary
const summary = getSystemSummary();
// { status: 'healthy', cpu: '45.2%', memory: '118.7 MB / 512 MB' }`}
            label="System monitoring copied"
          />
        </div>
      </section>

      {/* ── Detection Engine ─────────────────────────────────────── */}
      <section id="detection-engine" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">Detection engine</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p>
            The engine automatically analyzes traces and identifies Next.js-specific performance anti-patterns. Issues
            are accessible via <InlineCode>getDetectedIssues()</InlineCode> or visible directly in the dashboard.
          </p>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 font-medium">Detector</th>
                  <th className="px-4 py-2 font-medium">Trigger</th>
                  <th className="px-4 py-2 font-medium">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2 font-medium">Cold Start</td>
                  <td className="px-4 py-2">Edge startup &gt; 800ms or P50/P99 variance &gt; 2000ms</td>
                  <td className="px-4 py-2">critical</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Uncached Fetch</td>
                  <td className="px-4 py-2">
                    <InlineCode>fetch()</InlineCode> without cache directive in RSC
                  </td>
                  <td className="px-4 py-2">high / critical</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Dynamic Route</td>
                  <td className="px-4 py-2">
                    <InlineCode>cookies()</InlineCode> or <InlineCode>headers()</InlineCode> without key access
                  </td>
                  <td className="px-4 py-2">warning</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">DB Performance</td>
                  <td className="px-4 py-2">N+1 queries or queries &gt; 500ms</td>
                  <td className="px-4 py-2">high</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">RSC Bloat</td>
                  <td className="px-4 py-2">RSC payload &gt; 250KB</td>
                  <td className="px-4 py-2">warning</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Waterfall</td>
                  <td className="px-4 py-2">3+ sequential awaits &gt; 100ms each, total &gt; 300ms</td>
                  <td className="px-4 py-2">warning</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Infrastructure</td>
                  <td className="px-4 py-2">Node.js APIs in Edge, memory leaks, long transactions</td>
                  <td className="px-4 py-2">high</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">UX Vitals</td>
                  <td className="px-4 py-2">LCP &gt; 2.5s, CLS &gt; 0.1, excessive re-renders</td>
                  <td className="px-4 py-2">info</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── CLI ──────────────────────────────────────────────────── */}
      <section id="cli" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">CLI commands</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <h3 className="text-base font-semibold text-foreground">
            <InlineCode>npx nextdoctor-agent setup</InlineCode>
          </h3>
          <p>
            Interactive wizard to configure the agent. Guides you through setting your project token, selecting modules,
            and generating the <InlineCode>instrumentation.ts</InlineCode> snippet.
          </p>

          <h3 className="text-base font-semibold text-foreground">
            <InlineCode>npx nextdoctor-agent fix</InlineCode>
          </h3>
          <p>
            Automated performance refactoring using AST analysis. Supports adding fetch cache directives, updating async
            cookies, removing unnecessary <InlineCode>'use client'</InlineCode> directives, and security scanning.
          </p>
          <CodeBlock code="npx nextdoctor-agent fix --dry-run" label="CLI fix copied" />
        </div>
      </section>

      {/* ── Environment Variables ────────────────────────────────── */}
      <section id="environment-variables" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">Environment variables</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 font-medium">Variable</th>
                  <th className="px-4 py-2 font-medium">Required</th>
                  <th className="px-4 py-2 font-medium">Default</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">NEXTDOCTOR_PROJECT_TOKEN</td>
                  <td className="px-4 py-2">Yes</td>
                  <td className="px-4 py-2">&mdash;</td>
                  <td className="px-4 py-2">Project authentication token from the dashboard</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">NEXTDOCTOR_ENDPOINT</td>
                  <td className="px-4 py-2">Yes</td>
                  <td className="px-4 py-2">&mdash;</td>
                  <td className="px-4 py-2">Ingest endpoint URL</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">NODE_ENV</td>
                  <td className="px-4 py-2">No</td>
                  <td className="px-4 py-2">&mdash;</td>
                  <td className="px-4 py-2">Set to "production" to enable collection</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Best Practices ────────────────────────────────────────── */}
      <section id="best-practices" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">Best practices</h2>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Use in production</strong> &mdash; The agent is disabled in development by default. Set
              <InlineCode>NODE_ENV=production</InlineCode> to enable.
            </li>
            <li>
              <strong>Set sample rate</strong> &mdash; For high-traffic apps, use <InlineCode>samplingRate: 0.1</InlineCode>
              to <InlineCode>0.5</InlineCode>.
            </li>
            <li>
              <strong>Monitor health</strong> &mdash; Regularly check <InlineCode>getHealthStatus()</InlineCode> in your
              dashboards.
            </li>
            <li>
              <strong>Handle shutdown</strong> &mdash; Call <InlineCode>shutdownNextDoctor()</InlineCode> before serverless
              function timeouts.
            </li>
            <li>
              <strong>Environment-specific config</strong> &mdash; Use environment variables to switch endpoints between
              dev/staging/production.
            </li>
            <li>
              <strong>Error boundaries</strong> &mdash; Wrap custom metrics in try-catch blocks so they never break your
              application.
            </li>
          </ol>
        </div>
      </section>

      {/* ── Troubleshooting ──────────────────────────────────────── */}
      <section id="troubleshooting" className="scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight">Troubleshooting</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              No data in the dashboard? Verify that <InlineCode>NEXTDOCTOR_PROJECT_TOKEN</InlineCode> and
              <InlineCode>NEXTDOCTOR_ENDPOINT</InlineCode> are set, and
              <InlineCode>NODE_ENV=production</InlineCode>.
            </li>
            <li>
              Agent not initializing? Run <InlineCode>npx nextdoctor-agent setup</InlineCode> to regenerate the
              configuration.
            </li>
            <li>Ensure you are using Next.js 14+ and Node.js 18+.</li>
            <li>Check server logs for initialization errors during app startup.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
