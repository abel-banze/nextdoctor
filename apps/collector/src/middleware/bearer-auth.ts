import type { Context, Next } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projectTokens } from '../db/schema.js';
import { createHash } from 'crypto';

export type BearerAuthVariables = {
  tenantId: string;
  projectId: string;
};

/**
 * Middleware for ingest routes.
 * Validates the Bearer token against hashed project_tokens entries.
 */
export async function bearerAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const rawToken = authHeader.slice('Bearer '.length).trim();
  const tokenHash = hashToken(rawToken);

  const [row] = await db
    .select()
    .from(projectTokens)
    .where(and(eq(projectTokens.token, tokenHash), eq(projectTokens.isActive, true)))
    .limit(1);

  if (!row) {
    return c.json({ error: 'Invalid or revoked token' }, 401);
  }

  // Async — do not await, do not block the request
  db.update(projectTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(projectTokens.id, row.id))
    .execute()
    .catch(() => {/* ignore */});

  c.set('tenantId', row.tenantId);
  c.set('projectId', row.projectId);

  await next();
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
