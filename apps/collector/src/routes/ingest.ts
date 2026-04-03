import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { spans, issues } from '../db/schema.js';
import { bearerAuth } from '../middleware/bearer-auth.js';
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

const IngestPayloadSchema = z.object({
  spans: z.array(SpanSchema).min(1).max(200),
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
    if (body.spans.length > 0) {
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
            receivedAt: now,
          };
        })
      );
    }

    // Upsert detected issues
    if (body.detectedIssues && body.detectedIssues.length > 0) {
      await db.insert(issues).values(
        body.detectedIssues.map((issue) => ({
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
        }))
      );
    }

    return c.json({ accepted: body.spans.length }, 202);
  }
);
