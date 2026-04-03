import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { issues } from '../db/schema.js';
import type { AppVariables } from '../types.js';

export const issuesRouter = new Hono<{ Variables: AppVariables }>();

// GET /issues?projectId=&route=&severity=&limit=&offset=
issuesRouter.get('/', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const projectId = c.req.query('projectId');
  const route = c.req.query('route');
  const severity = c.req.query('severity');
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const offset = Number(c.req.query('offset') ?? 0);

  const SeveritySchema = z.enum(['info', 'warning', 'high', 'critical']).optional();
  const parsedSeverity = SeveritySchema.safeParse(severity);
  if (severity && !parsedSeverity.success) {
    return c.json({ error: 'Invalid severity value' }, 400);
  }

  const conditions = [eq(issues.tenantId, tenantId)];
  if (projectId) conditions.push(eq(issues.projectId, projectId));
  if (route) conditions.push(eq(issues.route, route));
  if (parsedSeverity.data) conditions.push(eq(issues.severity, parsedSeverity.data));

  const rows = await db
    .select()
    .from(issues)
    .where(and(...conditions))
    .orderBy(desc(issues.lastDetectedAt))
    .limit(limit)
    .offset(offset);

  return c.json({ issues: rows, limit, offset });
});

// PATCH /issues/:id/resolve — mark an issue as resolved
issuesRouter.patch('/:id/resolve', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const id = c.req.param('id');

  const [updated] = await db
    .update(issues)
    .set({ resolvedAt: new Date() })
    .where(and(eq(issues.id, id), eq(issues.tenantId, tenantId)))
    .returning({ id: issues.id });

  if (!updated) {
    return c.json({ error: 'Issue not found' }, 404);
  }

  return c.json({ resolved: updated.id });
});
