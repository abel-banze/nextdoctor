import { describe, it, expect } from 'vitest';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { DbPerformanceDetector } from '../db-performance.detector.js';

function createMockDbSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  return {
    name: 'db.query',
    spanContext: () => ({
      traceId: 'test-trace',
      spanId: 'span-' + Math.random(),
      traceFlags: 0x01,
      isRecording: true,
    }),
    startTime: [1000, 0],
    endTime: [1000, 100_000_000], // 100ms
    attributes: {
      'db.system': 'postgresql',
      'db.statement': 'SELECT * FROM users WHERE id = 1',
      ...(overrides.attributes || {}),
    },
    links: [],
    events: [],
    status: { code: 0 },
    ...overrides,
  } as any as ReadableSpan;
}

describe('DbPerformanceDetector', () => {
  const detector = new DbPerformanceDetector();

  it('detects slow queries (> 500ms)', () => {
    const slowSpan = createMockDbSpan({
      endTime: [1000, 600_000_000], // 600ms
      attributes: {
        'db.statement': 'SELECT id FROM heavy_table',
      }
    });

    const issues = detector.detect([slowSpan], { route: '/api/slow', runtime: 'nodejs' });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe('SLOW_DATABASE_QUERY');
    expect(issues[0]!.attributes?.duration).toBeGreaterThan(500);
  });

  it('detects N+1 queries using intelligent normalization', () => {
    const spans = [
      createMockDbSpan({ attributes: { 'db.statement': 'SELECT * FROM users WHERE id = 1' } }),
      createMockDbSpan({ attributes: { 'db.statement': 'SELECT * FROM users WHERE id = 2' } }),
      createMockDbSpan({ attributes: { 'db.statement': 'SELECT * FROM users WHERE id = 3' } }),
      createMockDbSpan({ attributes: { 'db.statement': 'SELECT * FROM users WHERE id = 4' } }),
      createMockDbSpan({ attributes: { 'db.statement': 'SELECT * FROM users WHERE id = 5' } }),
    ];

    const issues = detector.detect(spans, { route: '/users', runtime: 'nodejs' });
    
    // Should group them because the normalized SQL is the same
    expect(issues.some(i => i.type === 'N_PLUS_ONE_DB_QUERIES')).toBe(true);
    const issue = issues.find(i => i.type === 'N_PLUS_ONE_DB_QUERIES');
    expect(issue?.attributes?.repeats).toBe(5);
    expect(issue?.attributes?.fingerprint).toBe('SELECT * FROM users WHERE id = ?');
  });

  it('ignores distinct queries', () => {
    const spans = [
      createMockDbSpan({ attributes: { 'db.statement': 'SELECT * FROM users' } }),
      createMockDbSpan({ attributes: { 'db.statement': 'SELECT * FROM posts' } }),
      createMockDbSpan({ attributes: { 'db.statement': 'SELECT * FROM comments' } }),
    ];

    const issues = detector.detect(spans, { route: '/dashboard', runtime: 'nodejs' });
    expect(issues.filter(i => i.type === 'N_PLUS_ONE_DB_QUERIES')).toHaveLength(0);
  });

  it('detects SELECT * without projection', () => {
    const spans = [
      createMockDbSpan({ attributes: { 'db.statement': 'SELECT * FROM users' } }),
    ];

    const issues = detector.detect(spans, { route: '/select-all', runtime: 'nodejs' });
    expect(issues.some(i => i.type === 'DB_SELECT_WITHOUT_PROJECTION')).toBe(true);
  });

  it('detects Prisma findMany without select', () => {
    const spans = [
      createMockDbSpan({ 
        attributes: { 
          'prisma.client.method': 'findMany',
          'prisma.client.model': 'User'
        } 
      }),
    ];

    const issues = detector.detect(spans, { route: '/prisma-all', runtime: 'nodejs' });
    expect(issues.some(i => i.type === 'DB_SELECT_WITHOUT_PROJECTION')).toBe(true);
  });

  it('detects long transactions (> 2s)', () => {
    const spans = [
      createMockDbSpan({ 
        name: 'prisma:client:transaction',
        startTime: [1000, 0],
        endTime: [1003, 0], // 3 seconds
        attributes: { 'db.operation': 'transaction' }
      }),
    ];

    const issues = detector.detect(spans, { route: '/tx', runtime: 'nodejs' });
    expect(issues.some(i => i.type === 'LONG_DATABASE_TRANSACTION')).toBe(true);
  });
});
