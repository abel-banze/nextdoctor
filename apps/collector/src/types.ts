/**
 * Shared Hono context variable types for the collector app.
 * Used by middleware and routes to ensure type-safe context access.
 */
export type AppVariables = {
  tenantId: string;
  projectId: string;
  userId: string;
};
