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

const app = new Hono();

// ─── Global middleware ────────────────────────────────────────────────────────
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://app.nextdoctor.dev'],
  credentials: true,
}));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ status: 'ok', service: 'nextdoctor-collector' }));

// ─── Better Auth handler ──────────────────────────────────────────────────────
// Handles /auth/** (sign-in, sign-up, session, etc.)
app.on(['GET', 'POST'], '/auth/**', (c) => auth.handler(c.req.raw));

// ─── API routes ───────────────────────────────────────────────────────────────
app.route('/ingest', ingestRouter);
app.route('/projects', projectsRouter);
app.route('/issues', issuesRouter);
app.route('/tenants', tenantsRouter);
app.route('/subscriptions', subscriptionsRouter);
app.route('/ai', aiRouter);

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
