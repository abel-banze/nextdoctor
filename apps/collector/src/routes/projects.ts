import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { desc, eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, githubConnections, projects, projectTokens } from '../db/schema.js';
import { planGuard } from '../middleware/plan-guard.js';
import { randomBytes } from 'crypto';
import { hashToken } from '../middleware/bearer-auth.js';
import { encryptToken, fetchGitHubRepository, fetchGitHubRepos } from '../lib/github.js';
import type { AppVariables } from '../types.js';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
});

const ConnectGitHubRepositorySchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
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
      tokenHash: tokenHash,
      hint: rawToken.slice(-4),
      label: 'Default key',
    });

    return c.json({ project, token: rawToken }, 201);
  }
);

projectsRouter.get('/:id/github', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  const projectId = c.req.param('id');

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .limit(1);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const [githubAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'github')))
    .orderBy(desc(accounts.createdAt))
    .limit(1);

  if (!githubAccount?.accessToken) {
    return c.json({ error: 'GitHub account not connected' }, 400);
  }

  const [connection] = await db
    .select()
    .from(githubConnections)
    .where(and(eq(githubConnections.projectId, projectId), eq(githubConnections.tenantId, tenantId)))
    .limit(1);

  return c.json({
    githubConnected: Boolean(connection),
    connection: connection ?? null,
  });
});

projectsRouter.get('/:id/github/repos', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string;
  const projectId = c.req.param('id');

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .limit(1);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const [githubAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'github')))
    .orderBy(desc(accounts.createdAt))
    .limit(1);

  if (!githubAccount?.accessToken) {
    return c.json({ error: 'GitHub account not connected' }, 400);
  }

  const repositories = await fetchGitHubRepos(githubAccount.accessToken);

  return c.json({ repositories });
});

projectsRouter.post(
  '/:id/github',
  zValidator('json', ConnectGitHubRepositorySchema, (result, c) => {
    if (!result.success) return c.json({ error: result.error.flatten() }, 400);
  }),
  async (c) => {
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    const projectId = c.req.param('id');
    const { owner, name } = c.req.valid('json');

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
      .limit(1);

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    const [githubAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'github')))
      .orderBy(desc(accounts.createdAt))
      .limit(1);

    if (!githubAccount?.accessToken) {
      return c.json({ error: 'GitHub account not connected' }, 400);
    }

    const repository = await fetchGitHubRepository(owner, name, githubAccount.accessToken);

    const encryptedToken = encryptToken(githubAccount.accessToken);
    const connectionValues = {
      projectId,
      tenantId,
      installationId: null,
      repoOwner: repository.owner,
      repoName: repository.name,
      defaultBranch: repository.defaultBranch,
      accessTokenEncrypted: encryptedToken,
      tokenExpiresAt: null,
      repoUrl: repository.htmlUrl,
      isPrivate: repository.isPrivate,
      isActive: true,
      updatedAt: new Date(),
    };

    const [existing] = await db
      .select({ id: githubConnections.id })
      .from(githubConnections)
      .where(and(eq(githubConnections.projectId, projectId), eq(githubConnections.tenantId, tenantId)))
      .limit(1);

    const [connection] = existing
      ? await db
          .update(githubConnections)
          .set(connectionValues)
          .where(and(eq(githubConnections.projectId, projectId), eq(githubConnections.tenantId, tenantId)))
          .returning()
      : await db
          .insert(githubConnections)
          .values({
            id: undefined,
            ...connectionValues,
            connectedAt: new Date(),
          })
          .returning();

    return c.json({ connection }, 200);
  }
);

projectsRouter.delete('/:id/github', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const projectId = c.req.param('id');

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .limit(1);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const deleted = await db
    .delete(githubConnections)
    .where(and(eq(githubConnections.projectId, projectId), eq(githubConnections.tenantId, tenantId)))
    .returning({ id: githubConnections.id });

  return c.json({ disconnected: deleted.length > 0 });
});

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

// List tokens for a project
projectsRouter.get('/:id/tokens', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const projectId = c.req.param('id');

  const rows = await db
    .select({ id: projectTokens.id, hint: projectTokens.hint, label: projectTokens.label, isActive: projectTokens.isActive, lastUsedAt: projectTokens.lastUsedAt, createdAt: projectTokens.createdAt })
    .from(projectTokens)
    .where(and(eq(projectTokens.projectId, projectId), eq(projectTokens.tenantId, tenantId)))
    .orderBy(projectTokens.createdAt);

  return c.json({ tokens: rows });
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
    tokenHash: tokenHash,
    hint: rawToken.slice(-4),
    label: 'Rotated key',
  }).returning({ id: projectTokens.id, hint: projectTokens.hint, createdAt: projectTokens.createdAt });

  return c.json({ token: rawToken, hint: token!.hint }, 201);
});
