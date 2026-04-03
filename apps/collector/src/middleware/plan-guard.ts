import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { subscriptions, projects } from '../db/schema.js';

const PLAN_LIMITS = {
  free: { maxProjects: 5 },
  pro: { maxProjects: Infinity },
  team: { maxProjects: Infinity },
  enterprise: { maxProjects: Infinity },
} as const;

/**
 * Checks the tenant's current plan and enforces project count limits.
 * Used on project creation routes.
 */
export async function planGuard(c: Context, next: Next) {
  const tenantId = c.get('tenantId') as string | undefined;
  if (!tenantId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  const plan = (sub?.plan ?? 'free') as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan];

  // Count existing projects for this tenant
  const tenantProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.tenantId, tenantId));

  if (tenantProjects.length >= limits.maxProjects) {
    return c.json({
      error: `Plan limit reached: ${plan} plan allows up to ${limits.maxProjects} projects. Upgrade to Pro for unlimited projects.`,
    }, 403);
  }

  await next();
}
