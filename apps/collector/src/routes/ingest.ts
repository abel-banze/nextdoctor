import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { spans, issues, analyticsEvents } from '../db/schema.js';
import { bearerAuth } from '../middleware/bearer-auth.js';
import { sql } from 'drizzle-orm';
import type { AppVariables } from '../types.js';

const SpanSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  name: z.string(),
  startTime: z.array(z.number()).length(2),
  endTime: z.array(z.number()).length(2),
  attributes: z.record(z.unknown()).optional(),
  events: z.array(z.unknown()).optional(),
  links: z.array(z.unknown()).optional(),
  status: z.object({ code: z.number() }).optional(),
});

const AnalyticsEventSchema = z.object({
  type: z.enum([
    'session_start',
    'pageview',
    'session_end',
    'performance',
    'conversion',
    'feature',
    'form_abandonment',
    'custom',
  ]),
  eventName: z.string().optional(),
  sessionId: z.string(),
  visitorId: z.string(),
  url: z.string(),
  referrer: z.string().nullable().optional(),
  title: z.string(),
  browser: z.string(),
  os: z.string(),
  device: z.string(),
  language: z.string(),
  utmSource: z.string().nullable().optional(),
  utmMedium: z.string().nullable().optional(),
  utmCampaign: z.string().nullable().optional(),
  utmTerm: z.string().nullable().optional(),
  utmContent: z.string().nullable().optional(),
  visitSource: z.string().nullable().optional(),
  durationMs: z.number().int().optional(),
  isBounce: z.boolean().optional(),
  lcpMs: z.number().int().optional(),
  cls: z.number().optional(),
  fidMs: z.number().int().optional(),
  inpMs: z.number().int().optional(),
  ttfbMs: z.number().int().optional(),
  fcpMs: z.number().int().optional(),
  domInteractiveMs: z.number().int().optional(),
  scrollDepthPercent: z.number().int().min(0).max(100).optional(),
  clickCount: z.number().int().optional(),
  engagementTimeMs: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.number(),
});

const IngestPayloadSchema = z.object({
  spans: z.array(SpanSchema).min(1).max(200).optional(),
  context: z.object({
    route: z.string().optional(),
    runtime: z.enum(['nodejs', 'edge']).default('nodejs'),
    startupTimeMs: z.number().optional(),
  }).optional(),
  detectedIssues: z.array(z.object({
    id: z.string(),
    severity: z.enum(['info', 'warning', 'high', 'critical']),
    message: z.string(),
    suggestion: z.string(),
    route: z.string().optional(),
    spanId: z.string().optional(),
    attributes: z.record(z.unknown()).optional(),
    detectedAt: z.number(),
  })).optional(),
  analytics: z.array(AnalyticsEventSchema).optional(),
});

export const ingestRouter = new Hono<{ Variables: AppVariables }>();

ingestRouter.post(
  '/',
  bearerAuth,
  zValidator('json', IngestPayloadSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: 'Invalid payload', details: result.error.flatten() }, 400);
    }
  }),
  async (c) => {
    const tenantId = c.get('tenantId') as string;
    const projectId = c.get('projectId') as string;
    const body = c.req.valid('json');
    const now = new Date();

    // Bulk insert spans — pre-compute indexed columns from the payload
    if (body.spans && body.spans.length > 0) {
      await db.insert(spans).values(
        body.spans.map((span) => {
          // Pre-compute duration from HrTime tuples [sec, nano]
          const [startSec, startNano] = span.startTime;
          const [endSec, endNano] = span.endTime;
          const durationMs = Math.round(
            (endSec - startSec) * 1000 + (endNano - startNano) / 1_000_000
          );

          return {
            tenantId,
            projectId,
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: (span as Record<string, unknown>)['parentSpanId'] as string | null ?? null,
            name: span.name,
            route: (span.attributes?.['http.route'] as string | undefined) ?? body.context?.route ?? null,
            durationMs,
            payload: span,
            runtime: body.context?.runtime ?? 'nodejs',
            startupTimeMs: body.context?.startupTimeMs ?? null,
            receivedAt: now,
          };
        })
      );
    }

    // Upsert detected issues — deduplicate based on (projectId, detectorId, route) where unresolved
    if (body.detectedIssues && body.detectedIssues.length > 0) {
      for (const issue of body.detectedIssues) {
        await db
          .insert(issues)
          .values({
            tenantId,
            projectId,
            detectorId: issue.id,
            severity: issue.severity,
            message: issue.message,
            suggestion: issue.suggestion,
            route: issue.route ?? null,
            attributes: issue.attributes ?? null,
            firstDetectedAt: new Date(issue.detectedAt),
            lastDetectedAt: new Date(issue.detectedAt),
            count: 1,
          })
          .onConflictDoUpdate({
            target: [issues.projectId, issues.detectorId, issues.route],
            where: sql`resolved_at IS NULL`,
            set: {
              lastDetectedAt: new Date(issue.detectedAt),
              count: sql`${issues.count} + 1`,
              message: issue.message,
              suggestion: issue.suggestion,
              attributes: issue.attributes ?? null,
            },
          });
      }
    }

    if (body.analytics && body.analytics.length > 0) {
      await db.insert(analyticsEvents).values(
        body.analytics.map((event) => ({
          tenantId,
          projectId,
          sessionId: event.sessionId,
          visitorId: event.visitorId,
          eventType: event.type,
          eventName: event.eventName ?? null,
          url: event.url,
          referrer: event.referrer ?? null,
          title: event.title,
          browser: event.browser,
          os: event.os,
          device: event.device,
          language: event.language,
          utmSource: event.utmSource ?? null,
          utmMedium: event.utmMedium ?? null,
          utmCampaign: event.utmCampaign ?? null,
          utmTerm: event.utmTerm ?? null,
          utmContent: event.utmContent ?? null,
          visitSource: event.visitSource ?? null,
          durationMs: event.durationMs ?? null,
          isBounce: event.isBounce ?? false,
          lcpMs: event.lcpMs ?? null,
          cls: event.cls ?? null,
          fidMs: event.fidMs ?? null,
          inpMs: event.inpMs ?? null,
          ttfbMs: event.ttfbMs ?? null,
          fcpMs: event.fcpMs ?? null,
          domInteractiveMs: event.domInteractiveMs ?? null,
          scrollDepthPercent: event.scrollDepthPercent ?? null,
          clickCount: event.clickCount ?? null,
          engagementTimeMs: event.engagementTimeMs ?? null,
          metadata: event.metadata ?? null,
          timestamp: new Date(event.timestamp),
          receivedAt: now,
        }))
      );
    }

    return c.json({ accepted: body.spans?.length ?? 0 }, 202);
  }
);
