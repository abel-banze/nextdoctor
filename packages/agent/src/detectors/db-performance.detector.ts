import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BaseDetector } from './base-detector.js';
import type { DetectedIssue, DetectorContext } from './types.js';
import { normalizeSql } from '../utils/sql-normalizer.js';

/**
 * DbPerformanceDetector
 * 
 * Detects performance anti-patterns in database queries:
 * 1. Slow Queries (latency > 500ms)
 * 2. N+1 Queries (repeated similar statements in same trace)
 */
export class DbPerformanceDetector extends BaseDetector {
  readonly id = 'db-performance';
  readonly name = 'Database Performance Detector';

  private readonly N_PLUS_ONE_THRESHOLD = 5;
  private readonly SLOW_QUERY_THRESHOLD_MS = 500;

  detect(spans: ReadableSpan[], context: DetectorContext): DetectedIssue[] {
    const issues: DetectedIssue[] = [];
    const queryCounts = new Map<string, { count: number; totalTime: number; original: string }>();

    for (const span of spans) {
      const attributes = span.attributes || {};
      const name = span.name.toLowerCase();
      
      // Identify DB Spans (Standard OTel attributes or Prisma)
      const dbStatement = attributes['db.statement'] || 
                         attributes['prisma.client.command'] || 
                         attributes['prisma.client.method'] ||
                         attributes['prisma.client.operation'];
      
      const isDbSpan = !!attributes['db.system'] || 
                       !!attributes['db.type'] ||
                       !!attributes['prisma.client.model'] ||
                       (!!dbStatement && (attributes['db.query.text'] || span.name.includes('db.')));

      // 1. Long Transaction Detection
      const duration = this.getSpanDurationMs(span);
      if (name.includes('transaction') || attributes['db.operation'] === 'transaction') {
        if (duration > 2000) {
          issues.push({
            id: this.id,
            type: 'LONG_DATABASE_TRANSACTION',
            severity: 'high',
            message: `Long database transaction detected: ${duration.toFixed(2)}ms (threshold: 2000ms).`,
            suggestion: 'Mantenha transações curtas. Evite chamadas de rede ou processamento pesado dentro de blocos de transação.',
            route: context.route,
            detectedAt: Date.now(),
            attributes: { duration }
          });
        }
      }

      if (!dbStatement && !isDbSpan) continue;

      // 2. Select without Projection Detection
      const statementStr = String(dbStatement);
      const isSelectAll = statementStr.toUpperCase().includes('SELECT *') || 
                         (attributes['prisma.client.method'] === 'findMany' && !attributes['prisma.client.select']);
      
      if (isSelectAll) {
        issues.push({
          id: this.id,
          type: 'DB_SELECT_WITHOUT_PROJECTION',
          severity: 'warning',
          message: `Query "SELECT *" detectada. Trazendo colunas desnecessárias.`,
          suggestion: 'Especifique apenas as colunas necessárias para reduzir o payload do banco de dados e uso de memória.',
          route: context.route,
          detectedAt: Date.now(),
          attributes: {
            statement: statementStr.substring(0, 200)
          }
        });
      }

      // --- SLOW QUERY DETECTION ---
      if (duration > this.SLOW_QUERY_THRESHOLD_MS) {
        issues.push({
          id: this.id,
          type: 'SLOW_DATABASE_QUERY',
          severity: 'warning',
          message: `Slow database query detected: ${duration.toFixed(2)}ms`,
          suggestion: 'Considere adicionar índices ou otimizar o comando SQL.',
          route: context.route,
          detectedAt: Date.now(),
          attributes: {
            statement: String(dbStatement).substring(0, 500),
            duration,
          }
        });
      }

      // --- N+1 DETECTION ---
      const fingerprint = normalizeSql(String(dbStatement));
      const stats = queryCounts.get(fingerprint) || { count: 0, totalTime: 0, original: String(dbStatement) };
      stats.count++;
      stats.totalTime += duration;
      queryCounts.set(fingerprint, stats);
    }

    for (const [fingerprint, stats] of queryCounts.entries()) {
      if (stats.count >= this.N_PLUS_ONE_THRESHOLD) {
        issues.push({
          id: this.id,
          type: 'N_PLUS_ONE_DB_QUERIES',
          severity: 'critical',
          message: `N+1 Query pattern detected. Query repeated ${stats.count} times.`,
          suggestion: 'Utilize carregamento antecipado (ex: Prisma "include") em vez de lazy-loading em loops.',
          route: context.route,
          detectedAt: Date.now(),
          attributes: {
            fingerprint: fingerprint.substring(0, 500),
            example: stats.original.substring(0, 200),
            repeats: stats.count,
            totalDuration: stats.totalTime
          }
        });
      }
    }

    return issues;
  }
}

