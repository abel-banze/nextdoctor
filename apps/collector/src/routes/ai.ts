import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiAnalyses, issues } from '../db/schema.js';
import { runAiDoctor } from '../lib/ai-doctor.js';
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
