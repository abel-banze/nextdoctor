import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects, projectTokens } from '../db/schema.js';
import { planGuard } from '../middleware/plan-guard.js';
import { randomBytes } from 'crypto';
import { hashToken } from '../middleware/bearer-auth.js';
import type { AppVariables } from '../types.js';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
});

export const projectsRouter = new Hono<{ Variables: AppVariables }>();

// List all projects for the authenticated tenant
projectsRouter.get('/', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.tenantId, tenantId));
  return c.json(rows);
});

// Create a new project (subject to plan limits)
projectsRouter.post(
  '/',
  planGuard,
  zValidator('json', CreateProjectSchema, (result, c) => {
    if (!result.success) return c.json({ error: result.error.flatten() }, 400);
  }),
  async (c) => {
    const tenantId = c.get('tenantId') as string;
    const { name, slug } = c.req.valid('json');

    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), eq(projects.slug, slug)))
      .limit(1);

    if (existing) {
      return c.json({ error: 'A project with this slug already exists.' }, 409);
    }

    const [project] = await db
      .insert(projects)
      .values({ tenantId, name, slug })
      .returning();

    // Auto-create first API token
    const rawToken = `nd_${randomBytes(32).toString('hex')}`;
    const tokenHash = hashToken(rawToken);

    await db.insert(projectTokens).values({
      projectId: project!.id,
      tenantId,
      token: tokenHash,
      hint: rawToken.slice(-4),
      label: 'Default key',
    });

    return c.json({ project, token: rawToken }, 201);
  }
);

// Delete a project
projectsRouter.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const id = c.req.param('id');

  const [deleted] = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.tenantId, tenantId)))
    .returning({ id: projects.id });

  if (!deleted) {
    return c.json({ error: 'Project not found' }, 404);
  }

  return c.json({ deleted: deleted.id });
});

// Rotate / create a new API token for a project
projectsRouter.post('/:id/tokens', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const projectId = c.req.param('id');

  // Verify project belongs to this tenant
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .limit(1);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Deactivate all existing tokens
  await db
    .update(projectTokens)
    .set({ isActive: false })
    .where(and(eq(projectTokens.projectId, projectId), eq(projectTokens.tenantId, tenantId)));

  // Issue new token
  const rawToken = `nd_${randomBytes(32).toString('hex')}`;
  const tokenHash = hashToken(rawToken);

  const [token] = await db.insert(projectTokens).values({
    projectId,
    tenantId,
    token: tokenHash,
    hint: rawToken.slice(-4),
    label: 'Rotated key',
  }).returning({ id: projectTokens.id, hint: projectTokens.hint, createdAt: projectTokens.createdAt });

  return c.json({ token: rawToken, hint: token!.hint }, 201);
});
