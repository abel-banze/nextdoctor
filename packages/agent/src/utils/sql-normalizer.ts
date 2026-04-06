/**
 * Sanitizes and normalizes SQL queries by stripping specific values
 * to allow accurate N+1 fingerprinting and prevent PII leakage.
 */
export function normalizeSql(sql: string): string {
  if (!sql) return '';

  return sql
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Replace string literals with ?
    .replace(/'(?:''|[^'])*'/g, '?')
    // Replace numeric literals with ?
    .replace(/\b\d+\b/g, '?')
    // Replace hex literals
    .replace(/\b0x[a-fA-F\d]+\b/g, '?')
    // Replace boolean literals
    .replace(/\b(true|false|null)\b/gi, '?')
    .trim();
}
