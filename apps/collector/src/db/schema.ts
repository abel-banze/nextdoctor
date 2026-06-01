import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  real,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// TENANTS
// The top-level SaaS account (organisation or individual).
// Every other table cascades from here.
// ─────────────────────────────────────────────────────────────────────────────
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),         // used in dashboard URLs
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTIONS
// One subscription per tenant. Tracks the active plan and Dodo Payments state.
// ─────────────────────────────────────────────────────────────────────────────
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .unique()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  plan: text('plan', {
    enum: ['free', 'pro', 'team', 'enterprise'],
  }).notNull().default('free'),
  status: text('status', {
    enum: ['active', 'cancelled', 'past_due', 'trialing'],
  }).notNull().default('active'),
  // Dodo Payments fields
  dodoCustomerId: text('dodo_customer_id'),
  dodoSubscriptionId: text('dodo_subscription_id'),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  trialEndsAt: timestamp('trial_ends_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// Dashboard users. Better Auth compatible — do not rename these columns.
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: text('id').primaryKey(),                  // Better Auth uses string IDs
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role', {
    enum: ['owner', 'admin', 'member'],
  }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('users_tenant_id_idx').on(t.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS
// Better Auth sessions — do not rename these columns.
// ─────────────────────────────────────────────────────────────────────────────
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTS
// Better Auth OAuth accounts (GitHub, Google, etc.) — do not rename.
// ─────────────────────────────────────────────────────────────────────────────
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),    // 'github', 'google', etc.
  password: text('password'),                   // hashed password for credential provider
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('accounts_user_id_idx').on(t.userId),
  uniqueIndex('accounts_provider_account_idx').on(t.providerId, t.accountId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATIONS
// Better Auth email verifications and magic links — do not rename.
// ─────────────────────────────────────────────────────────────────────────────
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// Each tenant can have multiple projects — one per Next.js application.
// ─────────────────────────────────────────────────────────────────────────────
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  framework: text('framework', {
    enum: ['nextjs'],
  }).notNull().default('nextjs'),              // extensible for future frameworks
  environment: text('environment', {
    enum: ['production', 'preview', 'development'],
  }).notNull().default('production'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('projects_tenant_id_idx').on(t.tenantId),
  uniqueIndex('projects_tenant_slug_idx').on(t.tenantId, t.slug),
]);

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT TOKENS
// Bearer tokens used by @codebaz/nextdoctor-agent to authenticate ingest.
// Stored hashed. A project can have multiple tokens for key rotation.
// ─────────────────────────────────────────────────────────────────────────────
export const projectTokens = pgTable('project_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(), // sha256 hash of the raw token
  hint: text('hint').notNull(),                     // last 4 chars, shown in dashboard
  label: text('label'),                             // e.g. 'Production key'
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),               // null = never expires
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('project_tokens_hash_idx').on(t.tokenHash),
  index('project_tokens_project_id_idx').on(t.projectId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// GITHUB CONNECTIONS
// One GitHub repo connected per project.
// Enables the AI Doctor to fetch source code for precise diagnostics.
// Access token is stored encrypted (AES-256-GCM via oslo).
// ─────────────────────────────────────────────────────────────────────────────
export const githubConnections = pgTable('github_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  // GitHub App installation (preferred) or OAuth token fallback
  installationId: text('installation_id'),
  repoOwner: text('repo_owner').notNull(),          // 'acme-corp'
  repoName: text('repo_name').notNull(),            // 'my-next-app'
  defaultBranch: text('default_branch').notNull().default('main'),
  // OAuth token — encrypted at rest, scope: repo:read only
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  tokenExpiresAt: timestamp('token_expires_at'),
  // Metadata cached from GitHub API
  repoUrl: text('repo_url'),
  isPrivate: boolean('is_private').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('github_connections_tenant_idx').on(t.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOYS
// Deployment events reported by the agent or CI/CD integration.
// Enables "this issue appeared after deploy X" correlation in the dashboard.
// ─────────────────────────────────────────────────────────────────────────────
export const deploys = pgTable('deploys', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  commitSha: text('commit_sha'),
  commitMessage: text('commit_message'),
  branch: text('branch'),
  author: text('author'),                           // GitHub username
  environment: text('environment', {
    enum: ['production', 'preview', 'development'],
  }).notNull().default('production'),
  deployedAt: timestamp('deployed_at').notNull().defaultNow(),
}, (t) => [
  index('deploys_project_idx').on(t.projectId),
  index('deploys_deployed_at_idx').on(t.deployedAt),
]);

// ─────────────────────────────────────────────────────────────────────────────
// SPANS
// Raw OTel span payloads ingested from @codebaz/nextdoctor-agent.
// Retention: configurable per plan (Free: 24h, Pro: 90 days, Team: 1 year).
// ─────────────────────────────────────────────────────────────────────────────
export const spans = pgTable('spans', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  deployId: uuid('deploy_id')
    .references(() => deploys.id, { onDelete: 'set null' }),
  traceId: text('trace_id').notNull(),
  spanId: text('span_id').notNull(),
  parentSpanId: text('parent_span_id'),
  name: text('name').notNull(),                     // span name — indexed for detection
  route: text('route'),                             // extracted from span attributes
  durationMs: integer('duration_ms'),               // pre-computed for fast queries
  payload: jsonb('payload').notNull(),              // full OTel span JSON
  receivedAt: timestamp('received_at').notNull().defaultNow(),
  runtime: text('runtime', { enum: ['nodejs', 'edge'] }),
  startupTimeMs: integer('startup_time_ms'),
}, (t) => [
  index('spans_tenant_project_idx').on(t.tenantId, t.projectId),
  index('spans_trace_id_idx').on(t.traceId),
  index('spans_span_id_idx').on(t.spanId),
  index('spans_received_at_idx').on(t.receivedAt),
  index('spans_route_idx').on(t.route),
  index('spans_name_idx').on(t.name),
  index('spans_runtime_idx').on(t.runtime),
]);

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS EVENTS
// Browser and session analytics events from the client-side analytics component.
// Captures pageviews, session start/end, referrer, source, browser/OS/device and bounce information.
// ─────────────────────────────────────────────────────────────────────────────
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  visitorId: text('visitor_id').notNull(),
  eventType: text('event_type', {
    enum: [
      'session_start',
      'pageview',
      'session_end',
      'performance',
      'conversion',
      'feature',
      'form_abandonment',
      'custom',
    ],
  }).notNull(),
  eventName: text('event_name'),
  url: text('url').notNull(),
  referrer: text('referrer'),
  title: text('title').notNull(),
  browser: text('browser').notNull(),
  os: text('os').notNull(),
  device: text('device').notNull(),
  language: text('language').notNull(),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  utmTerm: text('utm_term'),
  utmContent: text('utm_content'),
  visitSource: text('visit_source'),
  durationMs: integer('duration_ms'),
  isBounce: boolean('is_bounce').notNull().default(false),
  lcpMs: integer('lcp_ms'),
  cls: real('cls'),
  fidMs: integer('fid_ms'),
  inpMs: integer('inp_ms'),
  ttfbMs: integer('ttfb_ms'),
  fcpMs: integer('fcp_ms'),
  domInteractiveMs: integer('dom_interactive_ms'),
  scrollDepthPercent: integer('scroll_depth_percent'),
  clickCount: integer('click_count'),
  engagementTimeMs: integer('engagement_time_ms'),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').notNull(),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
}, (t) => [
  index('analytics_events_tenant_idx').on(t.tenantId),
  index('analytics_events_project_idx').on(t.projectId),
  index('analytics_events_session_idx').on(t.sessionId),
  index('analytics_events_event_type_idx').on(t.eventType),
  index('analytics_events_received_at_idx').on(t.receivedAt),
]);

// ─────────────────────────────────────────────────────────────────────────────
// ISSUES
// Detected issues produced by the Detection Engine from span analysis.
// Deduplicated by (projectId, detectorId, route) within 60s windows.
// ─────────────────────────────────────────────────────────────────────────────
export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  deployId: uuid('deploy_id')
    .references(() => deploys.id, { onDelete: 'set null' }),
  detectorId: text('detector_id').notNull(),        // 'FETCH_NO_CACHE'
  severity: text('severity', {
    enum: ['info', 'warning', 'high', 'critical'],
  }).notNull(),
  message: text('message').notNull(),
  suggestion: text('suggestion').notNull(),
  route: text('route'),
  attributes: jsonb('attributes'),                  // raw detector attributes
  // Deduplication counters
  firstDetectedAt: timestamp('first_detected_at').notNull().defaultNow(),
  lastDetectedAt: timestamp('last_detected_at').notNull().defaultNow(),
  count: integer('count').notNull().default(1),
  // Resolution
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  ignoredAt: timestamp('ignored_at'),               // user dismissed this issue
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('issues_tenant_project_idx').on(t.tenantId, t.projectId),
  index('issues_detector_id_idx').on(t.detectorId),
  index('issues_severity_idx').on(t.severity),
  index('issues_last_detected_idx').on(t.lastDetectedAt),
  index('issues_route_idx').on(t.route),
  index('issues_deploy_id_idx').on(t.deployId),
  // Composite unique index for deduplication of active (unresolved) issues
  uniqueIndex('issues_dedup_idx')
    .on(t.projectId, t.detectorId, t.route)
    .where(sql`resolved_at IS NULL`),
]);

// ─────────────────────────────────────────────────────────────────────────────
// AI ANALYSES
// Cached results from the AI Doctor feature.
// One analysis per issue — re-run manually or on new deploy.
// Never re-call the AI if a valid analysis already exists.
// ─────────────────────────────────────────────────────────────────────────────
export const aiAnalyses = pgTable('ai_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  // GitHub context used for this analysis
  githubConnectionId: uuid('github_connection_id')
    .references(() => githubConnections.id, { onDelete: 'set null' }),
  filePath: text('file_path'),                      // 'app/dashboard/page.tsx'
  fileCommitSha: text('file_commit_sha'),           // exact commit analysed
  startLine: integer('start_line'),                 // first affected line
  endLine: integer('end_line'),                     // last affected line
  // AI output
  explanation: text('explanation'),                 // 1-sentence why this is a problem
  diff: text('diff'),                               // unified diff format
  fixedSnippet: text('fixed_snippet'),              // full fixed code block
  // Model metadata
  model: text('model').notNull(),                   // 'claude-sonnet-4-6'
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  status: text('status', {
    enum: ['pending', 'completed', 'failed'],
  }).notNull().default('pending'),
  errorMessage: text('error_message'),              // if status = 'failed'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (t) => [
  index('ai_analyses_issue_idx').on(t.issueId),
  index('ai_analyses_project_idx').on(t.projectId),
  index('ai_analyses_status_idx').on(t.status),
]);

// ─────────────────────────────────────────────────────────────────────────────
// ALERT RULES
// Per-project alert configuration. Supports multiple channels per rule.
// ─────────────────────────────────────────────────────────────────────────────
export const alertRules = pgTable('alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                     // 'CPU spike on /api/checkout'
  condition: text('condition', {
    enum: [
      'cpu_above',          // CPU usage > threshold %
      'memory_above',       // heap usage > threshold %
      'latency_spike',      // route P99 > threshold ms
      'error_rate_above',   // error rate > threshold %
      'issue_severity',     // new issue with severity >= threshold
      'cold_start',         // cold start detected
    ],
  }).notNull(),
  // Flexible threshold — shape depends on condition type
  // cpu_above:      { value: 80 }
  // latency_spike:  { route: '/api/checkout', value: 3000 }
  // issue_severity: { severity: 'critical' }
  threshold: jsonb('threshold').notNull(),
  // Notification channels
  // [{ type: 'slack', webhookUrl: '...' }, { type: 'email', to: '...' }]
  channels: jsonb('channels').notNull(),
  // Cooldown — minimum minutes between consecutive alerts for same rule
  cooldownMinutes: integer('cooldown_minutes').notNull().default(60),
  isActive: boolean('is_active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('alert_rules_project_idx').on(t.projectId),
  index('alert_rules_condition_idx').on(t.condition),
]);

// ─────────────────────────────────────────────────────────────────────────────
// ALERT EVENTS
// Immutable log of every alert notification sent.
// Used for audit trail and preventing duplicate sends (cooldown enforcement).
// ─────────────────────────────────────────────────────────────────────────────
export const alertEvents = pgTable('alert_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleId: uuid('rule_id')
    .notNull()
    .references(() => alertRules.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  issueId: uuid('issue_id')
    .references(() => issues.id, { onDelete: 'set null' }),
  channel: text('channel', {
    enum: ['slack', 'discord', 'email', 'webhook'],
  }).notNull(),
  payload: jsonb('payload').notNull(),              // what was sent
  status: text('status', {
    enum: ['sent', 'failed'],
  }).notNull(),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
}, (t) => [
  index('alert_events_rule_idx').on(t.ruleId),
  index('alert_events_project_idx').on(t.projectId),
  index('alert_events_sent_at_idx').on(t.sentAt),
]);

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// Immutable log of user actions in the dashboard.
// Required for Enterprise plan (compliance, SOC 2).
// ─────────────────────────────────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  // 'project.token.created', 'issue.resolved', 'alert.rule.deleted', etc.
  resourceType: text('resource_type'),              // 'project', 'issue', 'token'
  resourceId: text('resource_id'),                  // ID of affected resource
  metadata: jsonb('metadata'),                      // extra context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('audit_logs_tenant_idx').on(t.tenantId),
  index('audit_logs_user_idx').on(t.userId),
  index('audit_logs_action_idx').on(t.action),
  index('audit_logs_created_at_idx').on(t.createdAt),
]);