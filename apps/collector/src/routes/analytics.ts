import { Hono } from 'hono';
import { eq, and, gte, desc, count, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { analyticsEvents, projects as projectsTable } from '../db/schema.js';
import type { AppVariables } from '../types.js';

export const analyticsRouter = new Hono<{ Variables: AppVariables }>();

analyticsRouter.get('/', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const projectId = c.req.query('projectId');
  const period = c.req.query('period') ?? '7d';

  let days: number;
  if (period === '30d') days = 30;
  else if (period === '90d') days = 90;
  else days = 7;

  if (!projectId) {
    return c.json({ error: 'projectId query param is required' }, 400);
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const baseConditions = [
    eq(analyticsEvents.tenantId, tenantId),
    eq(analyticsEvents.projectId, projectId),
    gte(analyticsEvents.receivedAt, since),
  ];

  // ── Overview stats ─────────────────────────────────────────────────────────
  const [overview] = await db
    .select({
      totalVisitors: count(sql`DISTINCT ${analyticsEvents.visitorId}`),
      totalSessions: count(sql`DISTINCT ${analyticsEvents.sessionId}`),
      totalPageviews: count(
        sql`CASE WHEN ${analyticsEvents.eventType} = 'pageview' THEN 1 END`,
      ),
      totalSessionEnds: count(
        sql`CASE WHEN ${analyticsEvents.eventType} = 'session_end' THEN 1 END`,
      ),
      bounces: count(
        sql`CASE WHEN ${analyticsEvents.isBounce} = true THEN 1 END`,
      ),
      totalDuration: sql`COALESCE(SUM(${analyticsEvents.durationMs}), 0)`,
    })
    .from(analyticsEvents)
    .where(and(...baseConditions));

  const sessionEnds = Number(overview?.totalSessionEnds ?? 0);

  const bounceRate = sessionEnds > 0
    ? Math.round((Number(overview?.bounces ?? 0) / sessionEnds) * 100)
    : 0;

  const avgSessionDuration = sessionEnds > 0
    ? Math.round(Number(overview?.totalDuration ?? 0) / sessionEnds)
    : 0;

  // ── Daily time series ───────────────────────────────────────────────────────
  const dailyStats = await db
    .select({
      date: sql<string>`DATE(${analyticsEvents.receivedAt})`,
      visitors: count(sql`DISTINCT ${analyticsEvents.visitorId}`),
      sessions: count(sql`DISTINCT ${analyticsEvents.sessionId}`),
      pageviews: count(
        sql`CASE WHEN ${analyticsEvents.eventType} = 'pageview' THEN 1 END`,
      ),
    })
    .from(analyticsEvents)
    .where(and(...baseConditions))
    .groupBy(sql`DATE(${analyticsEvents.receivedAt})`)
    .orderBy(sql`DATE(${analyticsEvents.receivedAt})`);

  // ── Top pages ────────────────────────────────────────────────────────────────
  const topPages = await db
    .select({
      url: analyticsEvents.url,
      count: count(),
    })
    .from(analyticsEvents)
    .where(and(...baseConditions, eq(analyticsEvents.eventType, 'pageview')))
    .groupBy(analyticsEvents.url)
    .orderBy(desc(count()))
    .limit(10);

  // ── Traffic sources ─────────────────────────────────────────────────────────
  const trafficSources = await db
    .select({
      source: sql<string>`COALESCE(NULLIF(${analyticsEvents.visitSource}, ''), 'direct')`,
      count: count(sql`DISTINCT ${analyticsEvents.visitorId}`),
    })
    .from(analyticsEvents)
    .where(and(...baseConditions))
    .groupBy(sql`COALESCE(NULLIF(${analyticsEvents.visitSource}, ''), 'direct')`)
    .orderBy(desc(count(sql`DISTINCT ${analyticsEvents.visitorId}`)));

  // ── Browsers ────────────────────────────────────────────────────────────────
  const browsers = await db
    .select({
      browser: analyticsEvents.browser,
      count: count(sql`DISTINCT ${analyticsEvents.visitorId}`),
    })
    .from(analyticsEvents)
    .where(and(...baseConditions))
    .groupBy(analyticsEvents.browser)
    .orderBy(desc(count(sql`DISTINCT ${analyticsEvents.visitorId}`)))
    .limit(5);

  // ── OS ──────────────────────────────────────────────────────────────────────
  const os = await db
    .select({
      os: analyticsEvents.os,
      count: count(sql`DISTINCT ${analyticsEvents.visitorId}`),
    })
    .from(analyticsEvents)
    .where(and(...baseConditions))
    .groupBy(analyticsEvents.os)
    .orderBy(desc(count(sql`DISTINCT ${analyticsEvents.visitorId}`)))
    .limit(5);

  // ── Devices ─────────────────────────────────────────────────────────────────
  const devices = await db
    .select({
      device: analyticsEvents.device,
      count: count(sql`DISTINCT ${analyticsEvents.visitorId}`),
    })
    .from(analyticsEvents)
    .where(and(...baseConditions))
    .groupBy(analyticsEvents.device)
    .orderBy(desc(count(sql`DISTINCT ${analyticsEvents.visitorId}`)))
    .limit(3);

  // ── Countries (derived from language region) ────────────────────────────────
  const countries = await db
    .select({
      country: sql<string>`UPPER(SPLIT_PART(${analyticsEvents.language}, '-', 2))`,
      count: count(sql`DISTINCT ${analyticsEvents.visitorId}`),
    })
    .from(analyticsEvents)
    .where(and(
      ...baseConditions,
      sql`POSITION('-' IN ${analyticsEvents.language}) > 0`,
    ))
    .groupBy(sql`SPLIT_PART(${analyticsEvents.language}, '-', 2)`)
    .orderBy(desc(count(sql`DISTINCT ${analyticsEvents.visitorId}`)))
    .limit(10);

  return c.json({
    overview: {
      totalVisitors: Number(overview?.totalVisitors ?? 0),
      totalSessions: Number(overview?.totalSessions ?? 0),
      totalPageviews: Number(overview?.totalPageviews ?? 0),
      bounceRate,
      avgSessionDuration,
    },
    dailyStats,
    topPages,
    trafficSources,
    browsers,
    os,
    devices,
    countries,
  });
});
