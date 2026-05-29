import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tenants, subscriptions, users } from '../db/schema.js';
import type { AppVariables } from '../types.js';

export const tenantsRouter = new Hono<{ Variables: AppVariables }>();

// GET /me — return the current authenticated user + tenant + plan
tenantsRouter.get('/me', async (c) => {
  const tenantId = c.get('tenantId') as string | undefined;
  const userId = c.get('userId') as string | undefined; // set by session middleware

  // If no tenant yet (onboarding), return user info without tenant
  if (!tenantId) {
    if (!userId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return c.json({ tenant: null, subscription: null, user: u ?? null });
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  let user = null;
  if (userId) {
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    user = u ?? null;
  }

  return c.json({ tenant, subscription: sub ?? null, user });
});

// POST /tenants — register a new tenant (called during onboarding)
const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
});

tenantsRouter.post(
  '/',
  zValidator('json', CreateTenantSchema, (result, c) => {
    if (!result.success) return c.json({ error: result.error.flatten() }, 400);
  }),
  async (c) => {
    const userId = c.get('userId') as string | undefined;
    if (!userId) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const { name, slug } = c.req.valid('json');

    // Check slug uniqueness
    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (existing) {
      return c.json({ error: 'This slug is already taken.' }, 409);
    }

    const [tenant] = await db
      .insert(tenants)
      .values({ name, slug })
      .returning();

    // Seed free plan subscription
    await db.insert(subscriptions).values({
      tenantId: tenant!.id,
      plan: 'free',
      status: 'active',
    });

    // Associate the user with the new tenant
    await db
      .update(users)
      .set({ tenantId: tenant!.id, role: 'owner' })
      .where(eq(users.id, userId));

    // Set tenantId on context for subsequent requests
    c.set('tenantId', tenant!.id);

    return c.json({ tenant }, 201);
  }
);
