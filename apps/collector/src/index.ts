import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './config.js';
import { auth } from './lib/auth.js';
import { ingestRouter } from './routes/ingest.js';
import { projectsRouter } from './routes/projects.js';
import { issuesRouter } from './routes/issues.js';
import { tenantsRouter } from './routes/tenants.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { aiRouter } from './routes/ai.js';
import { analyticsRouter } from './routes/analytics.js';
import { sessionMiddleware } from './middleware/session.js';

const app = new Hono();

// ─── Global middleware ────────────────────────────────────────────────────────
app.use('*', logger());

// Reflective CORS: ingest accepts any origin (bearer auth),
// dashboard routes accept any origin too (session auth).
app.use('*', cors({
  origin: (origin) => origin,
  credentials: true,
}));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ status: 'ok', service: 'nextdoctor-collector' }));

// ─── Better Auth handler ──────────────────────────────────────────────────────
// Handles /auth/* (sign-in, sign-up, session, etc.)
app.all('/auth/*', async (c) => {
  const res = await auth.handler(c.req.raw);
  // Copy status and headers from better-auth Response to Hono response
  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
});

// ─── Dashboard API routes (session-based auth) ────────────────────────────────
app.use('/tenants/*', sessionMiddleware);
app.use('/projects/*', sessionMiddleware);
app.use('/issues/*', sessionMiddleware);
app.use('/subscriptions/*', sessionMiddleware);
app.use('/ai/*', sessionMiddleware);
app.use('/analytics/*', sessionMiddleware);

app.route('/projects', projectsRouter);
app.route('/issues', issuesRouter);
app.route('/tenants', tenantsRouter);
app.route('/subscriptions', subscriptionsRouter);
app.route('/ai', aiRouter);
app.route('/analytics', analyticsRouter);

// ─── Ingest routes (bearer token auth) ─────────────────────────────────────────
app.route('/ingest', ingestRouter);

// ─── Global error handler ─────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('[collector error]', err);
  return c.json({ error: 'Internal server error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

// ─── Start server ─────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`✅ NextDoctor collector running on http://localhost:${info.port}`);
  console.log(`   ENV: ${env.NODE_ENV}`);
});
