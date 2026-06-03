import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiAnalyses, issues, githubConnections, projects } from '../db/schema.js';
import { runAiDoctor } from '../lib/ai-doctor.js';
import { generateAnalyticsInsights, AnalyticsInsightsResultSchema } from '../lib/ai-analytics.js';
import { decryptToken } from '../lib/github.js';
import type { AppVariables } from '../types.js';

export const aiRouter = new Hono<{ Variables: AppVariables }>();

const TriggerSchema = z.object({
  issueId: z.string().uuid(),
});

/**
 * POST /ai/analyze
 * Trigger AI Doctor for a specific issue.
 * Runs asynchronously — returns immediately with the analysis ID.
 * The client should poll GET /ai/analyses/:id for the result.
 */
aiRouter.post(
  '/analyze',
  zValidator('json', TriggerSchema, (result, c) => {
    if (!result.success) return c.json({ error: result.error.flatten() }, 400);
  }),
  async (c) => {
    const tenantId = c.get('tenantId');
    const projectId = c.get('projectId');
    const { issueId } = c.req.valid('json');

    // Verify the issue belongs to this tenant
    const [issue] = await db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.tenantId, tenantId)))
      .limit(1);

    if (!issue) {
      return c.json({ error: 'Issue not found' }, 404);
    }

    // Fire-and-forget — run analysis in background
    runAiDoctor({ issueId, projectId, tenantId }).catch((err) => {
      console.error('[ai-doctor] analysis failed for issue', issueId, err);
    });

    return c.json({ queued: true, issueId }, 202);
  }
);

/**
 * GET /ai/analyses/:issueId
 * Poll for the AI analysis result for a given issue.
 */
aiRouter.get('/analyses/:issueId', async (c) => {
  const tenantId = c.get('tenantId');
  const issueId = c.req.param('issueId');

  const [analysis] = await db
    .select()
    .from(aiAnalyses)
    .where(and(eq(aiAnalyses.issueId, issueId), eq(aiAnalyses.tenantId, tenantId)))
    .limit(1);

  if (!analysis) {
    return c.json({ status: 'not_found' }, 404);
  }

  return c.json({
    id: analysis.id,
    status: analysis.status,
    explanation: analysis.explanation,
    diff: analysis.diff,
    fixedSnippet: analysis.fixedSnippet,
    filePath: analysis.filePath,
    startLine: analysis.startLine,
    endLine: analysis.endLine,
    model: analysis.model,
    completedAt: analysis.completedAt,
    errorMessage: analysis.errorMessage,
  });
});

// ── Analytics Insights ────────────────────────────────────────────────────────

const AnalyticsInsightsRequestSchema = z.object({
  projectId: z.string().uuid(),
  analytics: z.object({
    overview: z.object({
      totalVisitors: z.number(),
      totalSessions: z.number(),
      totalPageviews: z.number(),
      bounceRate: z.number(),
      avgSessionDuration: z.number(),
    }),
    webVitals: z.object({
      avgLcp: z.number(),
      avgCls: z.number(),
      avgFid: z.number(),
      avgInp: z.number(),
      avgTtfb: z.number(),
      avgFcp: z.number(),
      avgDomInteractive: z.number(),
    }),
    dailyStats: z.array(z.object({
      date: z.string(),
      visitors: z.number(),
      sessions: z.number(),
      pageviews: z.number(),
    })),
    topPages: z.array(z.object({ url: z.string(), count: z.number() })),
    trafficSources: z.array(z.object({ source: z.string(), count: z.number() })),
    browsers: z.array(z.object({ browser: z.string(), count: z.number() })),
    os: z.array(z.object({ os: z.string(), count: z.number() })),
    devices: z.array(z.object({ device: z.string(), count: z.number() })),
    countries: z.array(z.object({ country: z.string(), count: z.number() })),
  }),
});

/**
 * POST /ai/analytics-insights
 * Generate AI-powered insights from analytics data.
 * Synchronous — the client sends analytics data + project info.
 * The AI can fetch GitHub code and web pages to provide richer insights.
 */
aiRouter.post(
  '/analytics-insights',
  zValidator('json', AnalyticsInsightsRequestSchema, (result, c) => {
    if (!result.success) return c.json({ error: result.error.flatten() }, 400);
  }),
  async (c) => {
    const tenantId = c.get('tenantId');
    const { projectId, analytics } = c.req.valid('json');

    // Fetch project name
    const [project] = await db
      .select({ name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
      .limit(1);

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Try to load GitHub connection for code access
    let githubInfo: {
      repoOwner: string;
      repoName: string;
      defaultBranch: string;
      accessToken: string;
    } | null = null;

    try {
      const [connection] = await db
        .select()
        .from(githubConnections)
        .where(and(
          eq(githubConnections.projectId, projectId),
          eq(githubConnections.isActive, true),
        ))
        .limit(1);

      if (connection) {
        const accessToken = await decryptToken(connection.accessTokenEncrypted);
        githubInfo = {
          repoOwner: connection.repoOwner,
          repoName: connection.repoName,
          defaultBranch: connection.defaultBranch,
          accessToken,
        };
      }
    } catch (err) {
      console.error('[ai-analytics] failed to load GitHub connection:', err);
    }

    try {
      const result = await generateAnalyticsInsights(
        analytics,
        project.name,
        githubInfo,
      );

      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ai-analytics] generation failed:', message);
      return c.json({
        summary: 'AI analysis failed. Please try again later.',
        insights: [],
        error: message,
      }, 500);
    }
  }
);
