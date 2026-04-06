
import { DbPerformanceDetector } from './src/detectors/db-performance.detector.js';
import { normalizeSql } from './src/utils/sql-normalizer.js';

const detector = new DbPerformanceDetector();
const span = {
  startTime: [1000, 0],
  endTime: [1000, 600_000_000],
  attributes: {
    'db.system': 'postgresql',
    'db.statement': 'SELECT * FROM heavy_table',
  },
  spanContext: () => ({ spanId: '1' })
};

const issues = detector.detect([span], { route: '/test', runtime: 'nodejs' });
console.log('Issues:', JSON.stringify(issues, null, 2));

const sql = 'SELECT * FROM users WHERE id = 1';
console.log('Normalized SQL:', normalizeSql(sql));
