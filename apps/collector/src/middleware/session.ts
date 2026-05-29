import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { auth } from '../lib/auth.js';

/**
 * Middleware for dashboard routes.
 * Validates the Better Auth session from cookies/headers.
 * Sets tenantId and userId on the context if authenticated.
 */
export async function sessionMiddleware(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  c.set('userId', session.user.id);

  // Look up the user to find their tenant
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (user?.tenantId) {
    c.set('tenantId', user.tenantId);
  }

  await next();
}
