import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { subscriptions } from '../db/schema.js';
import type { AppVariables } from '../types.js';

export const subscriptionsRouter = new Hono<{ Variables: AppVariables }>();

/**
 * GET /subscriptions/current
 * Returns the current tenant's plan.
 *
 * TODO: Wire to Dodo Payments webhook to update plan on payment events.
 */
subscriptionsRouter.get('/current', async (c) => {
  const tenantId = c.get('tenantId') as string;

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (!sub) {
    return c.json({ plan: 'free', status: 'active', externalId: null });
  }

  return c.json({
    plan: sub.plan,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    dodoCustomerId: sub.dodoCustomerId,
    dodoSubscriptionId: sub.dodoSubscriptionId,
  });
});
