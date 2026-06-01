# NextDoctor

> Production debugger specialized for Next.js. Detects performance problems, explains them in plain language, and delivers actionable fix suggestions.

---

## What is NextDoctor?

NextDoctor is **not** a generic monitoring tool. It is a debugger that natively understands the Next.js ecosystem (App Router, Server Components, ISR, Edge Runtime, PPR) and delivers clear diagnostics with copy-paste fix snippets.

**Core value proposition:**
- Detects Next.js-specific anti-patterns automatically
- Explains problems in developer language (not just raw metrics)
- Works first-class with self-hosted deployments (Coolify, Dokploy, Railway, Fly.io)
- Zero-config setup via `npx @codebaz/nextdoctor init`

---

## Monorepo Structure

```
nextdoctor/
├── apps/
│   ├── collector/     # Backend Hono: ingest de spans, auth, AI Doctor
│   ├── dashboard/     # Dashboard Next.js (em desenvolvimento)
│   └── web/           # Landing page (em desenvolvimento)
│
├── packages/
│   ├── agent/         # @codebaz/nextdoctor-agent — publicado no npm
│   ├── nextdoctor-cli/ # @codebaz/nextdoctor — CLI de inicialização
│   ├── ui/            # Componentes UI partilhados
│   ├── eslint-config/ # Configuração ESLint partilhada
│   └── typescript-config/ # Configuração TypeScript partilhada
│
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

### Why packages/ and not apps/ for the CLI?

- `apps/` = things you **deploy** (web servers, frontends)
- `packages/` = things you **publish and consume** externally (npm packages)

The CLI (`@codebaz/nextdoctor`) and the agent (`@codebaz/nextdoctor-agent`) are installed in the **user's project**, not deployed by us. They belong in `packages/`.

---

## Package Responsibilities

### `packages/nextdoctor-cli`
- Entry point: `npx @codebaz/nextdoctor init`
- Responsibilities:
  - Scaffold `instrumentation.ts` in the user's Next.js project
  - Install and configure `@codebaz/nextdoctor-agent`
  - Write `nextdoctor.config.ts` with project token and options
  - Validate Next.js version compatibility
- Published as: `@codebaz/nextdoctor` on npm
- Runtime: Node.js (not Edge)

### `packages/agent`
- Injected via Next.js [Instrumentation Hook](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- Responsibilities:
  - Capture OpenTelemetry traces scoped to Next.js primitives
  - Detect anti-patterns at runtime (see Detection Rules below)
  - Send trace data to `apps/collector` (or local endpoint if self-hosted)
- Published as: `@codebaz/nextdoctor-agent` on npm
- Runtime: Node.js + Edge Runtime compatible
- Must be **zero-dependency** or near-zero to avoid bloating the user's bundle

### `apps/collector`
- Receives trace payloads from agents in production
- Runs analysis pipeline: pattern matching → diagnosis generation
- Stores results (diagnosis history, route metrics)
- Exposes REST + WebSocket endpoints for the dashboard
- Auth: project tokens (MVP), OAuth (later)

### `apps/dashboard`
- Dashboard: displays diagnoses, route performance, fix suggestions
- Real-time updates via WebSocket from `apps/collector`
- Auth: project token login (MVP)

### `apps/web`
- Public landing page
- Waitlist capture
- Docs (or separate `apps/docs` later)

---

## Core Detection Rules (MVP — v1.0)

These are the three patterns the agent detects in the first version. Precision over quantity.

| ID | Pattern | Example diagnosis |
|----|---------|-------------------|
| `FETCH_NO_CACHE` | `fetch()` called without cache option in Server Component | "This route fetches `/api/products` on every request with no cache → +380ms per request. Add `{ cache: 'force-cache' }` or `{ next: { revalidate: 3600 } }`." |
| `DYNAMIC_ROUTE_CANDIDATE` | Route uses `cookies()` or `headers()` but doesn't need dynamic data | "This route is forced dynamic because of `cookies()` but doesn't read any cookie value → could be static. Remove the `cookies()` call or move it to a Server Action." |
| `COLD_START_THRESHOLD` | Edge Runtime cold start exceeds 800ms | "Edge function `/api/hello` cold started in 1240ms → above 800ms threshold. Consider moving heavy imports outside the handler or switching to Node.js runtime." |

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Monorepo | Turborepo + pnpm workspaces | Fast caching, native pnpm support |
| Language | TypeScript (strict) | All packages |
| Dashboard | Next.js 15 + Tailwind CSS | App Router, Server Components |
| API | Node.js + Hono | Lightweight, Edge-compatible |
| Database | PostgreSQL + Drizzle ORM | Simple, type-safe |
| Traces | OpenTelemetry SDK | Industry standard, exportable |
| Auth | Better Auth | Self-hostable |
| Payments | Stripe | Freemium model |

---

## Data Flow

```
User's Next.js App (production)
        │
        │  OpenTelemetry traces
        ▼
@codebaz/nextdoctor-agent
        │
        │  POST /ingest (project token auth)
        ▼
apps/collector  ──→  Pattern matching engine
        │
        │  Diagnosis + fix suggestion
        ▼
apps/dashboard (dashboard)
        │
        ▼
Developer sees: "This route is slow because X → here's the fix"
```

---

## Pricing Model

| Plan | Price | Limits |
|------|-------|--------|
| Free | $0 | 5 routes · 10k req/month |
| Pro | $19/mo or $190/yr | Unlimited routes · AI Doctor · 90-day history |
| Team | $49/mo (up to 10 devs) | Pro + SSO + PDF reports + priority support |
| Enterprise | Custom | Self-hosted · SLA 99.9% · on-premise |

---

## Roadmap

### Phase 1 — Validate (now → 4 weeks, no code)
- [ ] Interview 10 Next.js self-hosting developers
- [ ] Confirm: "would you pay $19/mo for better production diagnostics?"
- [ ] Build waitlist and measure conversion

### Phase 2 — MVP (month 1–2)
- [ ] `packages/agent`: capture OTel traces via Instrumentation Hook
- [ ] `packages/nextdoctor-cli`: `npx nextdoctor init` scaffolding
- [ ] `apps/api`: ingest endpoint + 3 detection rules
- [ ] `apps/web`: minimal dashboard (route list + diagnosis card + fix snippet)
- [ ] Self-host support (Docker Compose)

### Phase 3 — Monetization validation (month 3)
- [ ] 20 real users on the product
- [ ] Freemium gate implemented
- [ ] First paying customers

### Phase 4 — AI Doctor + Growth (month 4+)
- [ ] AI Doctor Mode: GPT-4o / Claude analyzes trace + source → exact fix
- [ ] Smart alerts (Slack / Discord / email)
- [ ] Deploy history + trend graphs
- [ ] One-click GitHub PR suggestions

---

## Environment Variables

```bash
# apps/api
DATABASE_URL=
NEXTDOCTOR_SECRET=          # internal signing secret

# apps/dashboard
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_STRIPE_KEY=

# packages/agent (set in user's project via nextdoctor.config.ts)
NEXTDOCTOR_PROJECT_TOKEN=
NEXTDOCTOR_ENDPOINT=        # default: https://ingest.nextdoctor.dev
```

---

## Development

```bash
# Install dependencies
pnpm install

# Run all apps in dev mode
pnpm dev

# Run a specific app
pnpm --filter dashboard dev
pnpm --filter collector dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Publish CLI (when ready)
pnpm --filter nextdoctor publish
```

---

## Self-Hosting

NextDoctor is self-host first. Users can run the full stack on their own infrastructure.

```bash
# Clone and configure
git clone https://github.com/your-org/nextdoctor
cp .env.example .env

# Start with Docker Compose
docker compose up -d
```

The agent in the user's Next.js app points to their own instance via `NEXTDOCTOR_ENDPOINT`.

---

## Key Decisions Log

| Decision | Choice | Reason |
|----------|--------|--------|
| CLI placement | `packages/cli` not `apps/cli` | CLI is published to npm, not deployed |
| Agent vs CLI separation | Two separate packages | CLI runs once (setup); agent runs in production continuously |
| MVP detection rules | 3 rules only | Precision over quantity — wrong diagnoses kill trust |
| AI Doctor timing | Phase 4 (after paying users) | Avoid building features before validating core value |
| Database | PostgreSQL | Simpler than time-series DB for MVP; migrate later if needed |