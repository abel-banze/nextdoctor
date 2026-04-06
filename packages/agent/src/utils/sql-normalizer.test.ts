import { describe, it, expect } from 'vitest';
import { normalizeSql } from './sql-normalizer.js';

describe('normalizeSql', () => {
  it('should mask numeric literals', () => {
    const sql = 'SELECT * FROM users WHERE id = 123';
    expect(normalizeSql(sql)).toBe('SELECT * FROM users WHERE id = ?');
  });

  it('should mask string literals', () => {
    const sql = "SELECT * FROM users WHERE email = 'test@example.com'";
    expect(normalizeSql(sql)).toBe('SELECT * FROM users WHERE email = ?');
  });

  it('should handle complex queries with multiple values', () => {
    const sql = "UPDATE orders SET status = 'shipped', price = 99.99 WHERE id = 456 AND active = true";
    const normalized = normalizeSql(sql);
    expect(normalized).toContain('status = ?');
    expect(normalized).toContain('price = ?');
    expect(normalized).toContain('active = ?');
  });

  it('should strip comments', () => {
    const sql = 'SELECT 1; -- Some comment\n/* Block\ncomment */ SELECT 2;';
    const normalized = normalizeSql(sql);
    expect(normalized).not.toContain('comment');
    expect(normalized).toBe('SELECT ?; SELECT ?;');
  });

  it('should normalize whitespace', () => {
    const sql = 'SELECT    *   FROM \n users';
    expect(normalizeSql(sql)).toBe('SELECT * FROM users');
  });

  it('should mask boolean and null literals', () => {
    const sql = 'SELECT * FROM table WHERE col1 IS NULL AND col2 = TRUE';
    expect(normalizeSql(sql)).toBe('SELECT * FROM table WHERE col1 IS ? AND col2 = ?');
  });

  it('should generate same fingerprint for different values', () => {
    const q1 = "SELECT name FROM users WHERE id = 1 AND status = 'active'";
    const q2 = "SELECT name FROM users WHERE id = 999 AND status = 'deleted'";
    expect(normalizeSql(q1)).toBe(normalizeSql(q2));
  });
});
