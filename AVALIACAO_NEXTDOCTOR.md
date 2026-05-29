# Avaliação Técnica — NextDoctor

**Data:** 2026-05-27 (atualizada com análise completa do código-fonte)

---

## Resumo Executivo

NextDoctor é um depurador de performance especializado para Next.js. A arquitetura é sólida: monorepo Turborepo/pnpm com separação clara entre o que é publicado (`packages/`) e o que é deployado (`apps/`). O código-fonte foi lido na íntegra — esta avaliação reflete o estado real do projeto, não suposições.

**Pontos fortes identificados no código:**
- Detection engine com 9 detectores implementados, cada um com testes unitários dedicados
- Exporter customizado (JSON sobre HTTP) que evita dependência de parser OTLP no collector
- Circuit breaker, sampler adaptativo e batch processor implementados em `optimization.ts`
- Schema de base de dados bem modelado com deduplicação de issues por `(projectId, detectorId, route)`
- AI Doctor com fluxo completo: GitHub → Claude → diff/snippet persistido
- V8MemoryRescue com cooldown de 5 minutos e proteção contra Edge runtime
- CLI funcional com detecção de package manager e scaffolding de `instrumentation.ts`

**Problemas críticos identificados:**
- `ts-morph` está em `dependencies` (runtime) — é uma biblioteca de 50+ MB usada apenas no `ASTWorker` (CLI/dev-time)
- `react-scan`, `chalk`, `commander`, `enquirer` também em `dependencies` do agent — pertencem à CLI
- O `ASTWorker` vive em `packages/agent/src/auto-fixer/` mas usa `ts-morph` que não deve estar no bundle runtime
- Dashboard (`apps/dashboard`) é um esqueleto Next.js sem nenhuma UI implementada
- `apps/web` está completamente vazio (apenas `.gitkeep` nos diretórios)
- O `DOCTOR.md` e `README.md` descrevem uma estrutura diferente da real (referem `apps/api`, `apps/marketing`, `packages/shared` que não existem)

---

## Análise por Área

### 1. `packages/agent` — Núcleo do produto

**O que foi lido:** `index.ts`, `init.ts`, `exporter.ts`, `types.ts`, `optimization.ts`, `middleware.ts`, `system-monitor.ts`, `profiler/v8-rescue.ts`, `auto-fixer/ast-worker.ts`, `detectors/` (todos os 9 detectores + testes)

#### Arquitetura do agent — boa

O `NextDoctorAgent` em `init.ts` é bem estruturado:
- Inicialização com retry exponencial (até `maxRetries`)
- `IntelligentSamplerAdapter` que adapta o `IntelligentSampler` para a interface OTel `Sampler`
- Loop adaptativo de sampling a cada 10s: reduz para 0% se CPU > 90%, para 20% se CPU > 70%
- `detectionSpanProcessor` que analisa spans em background sem bloquear o exporter
- Carregamento dinâmico (`await import(...)`) das instrumentações de DB — correto para evitar erros em ambientes sem essas libs

O `NextDoctorExporter` em `exporter.ts` é uma decisão de design acertada: em vez de OTLP binário, envia JSON customizado com spans + issues detectados numa única chamada POST. Isso simplifica o collector e reduz overhead.

#### Problema crítico: dependências runtime vs dev-time

```json
// package.json atual — ERRADO
"dependencies": {
  "ts-morph": "^27.0.2",      // ~50MB, usado APENAS em auto-fixer/ast-worker.ts
  "react-scan": "^0.5.3",     // ferramenta de dev, não runtime
  "chalk": "^5.6.2",          // CLI only
  "commander": "^14.0.3",     // CLI only
  "enquirer": "^2.4.1"        // CLI only
}
```

O `ASTWorker` (`auto-fixer/ast-worker.ts`) usa `ts-morph` para fazer fixes AST no código do utilizador. Esta funcionalidade é invocada pelo comando `nextdoctor-agent fix` (CLI), nunca em runtime de produção. Mas como está em `dependencies`, qualquer `npm install @codebaz/nextdoctor-agent` puxa `ts-morph` para o projeto do utilizador.

`chalk`, `commander` e `enquirer` são usados em `src/cli/index.ts` — também CLI-only.

**Impacto estimado:** o bundle do agent publicado inclui ~50-80MB de dependências que nunca são executadas em produção.

#### Detection Engine — muito bom

9 detectores implementados com testes:

| Detector | Tipo | Severidade | Testes |
|----------|------|-----------|--------|
| `ColdStartThresholdDetector` | cold start > threshold | warning/high | ✅ |
| `FetchNoCacheDetector` | fetch sem cache | warning | ✅ |
| `DynamicRouteCandidateDetector` | rota forçada dinâmica | info | ✅ |
| `RscIntrospectionDetector` | RSC com dados desnecessários | warning | — |
| `DbPerformanceDetector` | N+1, slow query, SELECT *, long tx | warning/critical | ✅ |
| `WaterfallDetector` | sequential awaits em RSC | high | ✅ |
| `DataFetchingDetector` | padrões de fetch | warning | ✅ |
| `InfraDetector` | problemas de infra | info/warning | ✅ |
| `ClientVitalsDetector` | Core Web Vitals | info/warning | ✅ |

O `WaterfallDetector` tem uma lógica de detecção de cadeia sequencial bem implementada com `sequentialSlackMs = 10ms` para tolerar overhead de CPU. Os testes cobrem casos de paralelo, sequencial e misto.

O `DbPerformanceDetector` usa `normalizeSql` para fingerprinting de queries N+1 — boa decisão para agrupar `WHERE id = 1`, `WHERE id = 2`, etc.

**Gap:** `RscIntrospectionDetector` não tem testes unitários.

#### `DetectionEngine` — singleton com limitação documentada

```typescript
// MVP LIMITATION: In persistent Node.js environments (self-hosted), this cache 
// is shared globally. Deduplication keys include 'id' and 'route', but lack 
// project-level scope, which could cause cache collisions in multi-tenant usages.
export const detectionEngine = new DetectionEngine();
```

O comentário no código reconhece o problema. Para SaaS multi-tenant, o singleton partilhado pode causar colisões de deduplicação entre projetos diferentes no mesmo processo. Não é crítico para MVP single-tenant mas precisa de atenção antes de escalar.

#### `V8MemoryRescue` — bem implementado

Cooldown de 5 minutos, proteção contra Edge runtime, comentário explicando por que `writeHeapSnapshot` é síncrono (justificado: processo já instável a 90% heap). Correto.

#### `SystemMonitor` — bug no cálculo de CPU

```typescript
// system-monitor.ts — CPUMonitor.getCPUUsage()
const userTime = cpu.times.user - (this.lastCPUTimes[index] || 0);
const systemTime = cpu.times.sys - (this.lastCPUTimes[index] || 0);
```

`this.lastCPUTimes[index]` guarda o **total** de todos os tempos (user + sys + idle + irq), mas é subtraído de `cpu.times.user` e `cpu.times.sys` individualmente. O cálculo está errado — devia guardar os valores individuais por tipo, não o total. O resultado é que `usage` pode ser negativo ou incorreto.

#### `middleware.ts` — bom, mas exporta função não documentada

`withNextDoctorAppRoute` está implementada mas não está exportada em `index.ts`. Só `withNextDoctorMonitoring` (deprecated) e `withNextDoctorTiming` são exportadas. Inconsistência.

---

### 2. `apps/collector` — Backend sólido

**O que foi lido:** `src/routes/ingest.ts`, `src/routes/ai.ts`, `src/db/schema.ts`, `src/middleware/bearer-auth.ts`, `src/lib/ai-doctor.ts`

#### Schema de base de dados — excelente

O schema em `schema.ts` é o ponto mais maduro do projeto:
- 14 tabelas com relações bem definidas e cascades corretos
- `issues` com `uniqueIndex` parcial em `(projectId, detectorId, route) WHERE resolved_at IS NULL` — deduplicação correta
- `projectTokens` com `tokenHash` (SHA-256) e `hint` (últimos 4 chars) — boa prática de segurança
- `githubConnections` com `accessTokenEncrypted` (AES-256-GCM via oslo) — correto
- `auditLogs` para compliance Enterprise
- `alertRules` com `threshold: jsonb` flexível para diferentes tipos de condição
- Índices bem pensados em todas as tabelas de alta leitura

#### `bearer-auth.ts` — problema de segurança

```typescript
// bearer-auth.ts — linha com bug
.where(and(eq(projectTokens.token, tokenHash), eq(projectTokens.isActive, true)))
```

A coluna no schema chama-se `tokenHash`, não `token`. Esta query vai falhar em runtime com um erro de coluna inexistente. O campo correto é `projectTokens.tokenHash`.

Adicionalmente, o middleware usa SHA-256 direto para hash do token. O schema menciona "bcrypt hash" nos comentários mas o código usa SHA-256. Inconsistência entre documentação e implementação — SHA-256 é aceitável para tokens aleatórios longos, mas o comentário no schema induz em erro.

#### `ingest.ts` — correto

Bulk insert de spans com cálculo de `durationMs` pré-computado. Upsert de issues com `onConflictDoUpdate` usando o índice parcial. Limite de 200 spans por payload. Tudo correto.

#### `ai-doctor.ts` — funcional mas com gaps

O fluxo AI Doctor está implementado:
1. Carrega issue + GitHub connection
2. Infere `filePath` da route (heurística: `/api/x` → `app/api/x/route.ts`)
3. Fetch do ficheiro no GitHub com token desencriptado
4. Chama Claude com prompt estruturado em XML
5. Persiste resultado

**Gaps:**
- Usa `claude-sonnet-4-5` hardcoded mas o schema tem campo `model` — devia ser configurável
- `routeToFilePath` é uma heurística simples que falha para rotas com parâmetros dinâmicos (`/users/[id]`)
- Não há rate limiting nem budget de tokens por projeto
- Fire-and-forget sem queue — se o processo reiniciar, análises pendentes perdem-se

---

### 3. `packages/nextdoctor-cli` — Funcional mas mínimo

**O que foi lido:** `src/index.ts`, `src/init.ts`

O CLI `npx @codebaz/nextdoctor init` funciona:
- Deteta package manager (pnpm/yarn/npm) por lock file
- Pergunta hosting (Vercel vs self-host)
- Instala `@codebaz/nextdoctor-agent`
- Cria `instrumentation.ts` e `nextdoctor.config.ts` com `safeWriteFile` (não sobrescreve)

**Gaps:**
- Não valida versão do Next.js (o `assertNextPresent` só verifica se `next` existe, não a versão)
- Não configura `next.config.ts` para habilitar `instrumentationHook: true` (necessário em Next.js < 15)
- Não tem testes
- `inquirer` v9 usa CommonJS — pode ter problemas com `"type": "module"` no package.json

---

### 4. `apps/dashboard` — Esqueleto sem UI

O dashboard é um projeto Next.js 16 com Tailwind e shadcn/ui configurados, mas sem nenhuma página implementada além do `app/page.tsx` padrão do `create-next-app`. Não há rotas, componentes de dados, ou integração com o collector.

**Estado:** placeholder. Precisa de implementação completa.

---

### 5. `apps/web` — Vazio

`apps/web` tem apenas `.gitkeep` nos diretórios `components/`, `hooks/`, `lib/`. A página `app/page.tsx` é o template padrão do Next.js. Não há landing page implementada.

---

### 6. Monorepo e tooling

**Turborepo:** configuração mínima em `turbo.json`. Falta o task `test` no pipeline — os testes não são executados por `turbo build` nem têm cache configurado.

**TypeScript:** `typescript: 5.9.3` na root — versão recente, boa. Cada package tem o seu `tsconfig.json` estendendo `@workspace/typescript-config`.

**ESLint/Prettier:** configurados na root com `prettier-plugin-tailwindcss`. Sem CI configurado (não há `.github/workflows/`).

**Documentação vs realidade:** `DOCTOR.md` e `README.md` descrevem `apps/api`, `apps/marketing`, `packages/shared` que não existem. A estrutura real é diferente do que está documentado.

---

## Inventário de Bugs Confirmados

| # | Ficheiro | Descrição | Severidade |
|---|---------|-----------|-----------|
| B1 | `apps/collector/src/middleware/bearer-auth.ts:22` | `projectTokens.token` devia ser `projectTokens.tokenHash` — query falha em runtime | **Crítico** |
| B2 | `packages/agent/src/system-monitor.ts` | `CPUMonitor.getCPUUsage()` subtrai total acumulado de valores individuais — CPU usage incorreto | **Alto** |
| B3 | `packages/agent/src/middleware.ts` | `withNextDoctorAppRoute` implementada mas não exportada em `index.ts` | **Médio** |
| B4 | `apps/collector/src/lib/ai-doctor.ts` | `routeToFilePath` falha para rotas dinâmicas (`/users/[id]`) | **Médio** |
| B5 | `packages/agent/src/init.ts` | Retry logic aninhada: o `catch` interno re-lança o erro mas o `initialized` nunca é `true` após retry bem-sucedido | **Médio** |

---

## Inventário de Dívida Técnica

| # | Área | Descrição | Impacto |
|---|------|-----------|---------|
| D1 | `packages/agent/package.json` | `ts-morph`, `react-scan`, `chalk`, `commander`, `enquirer` em `dependencies` em vez de `devDependencies` | Bundle inflado ~50-80MB |
| D2 | `packages/agent/src/detectors/index.ts` | Singleton `detectionEngine` sem scope de projeto — colisões em multi-tenant | Escalabilidade |
| D3 | `apps/collector/src/lib/ai-doctor.ts` | AI Doctor fire-and-forget sem queue persistente | Fiabilidade |
| D4 | `apps/dashboard/` | Dashboard sem UI implementada | Produto incompleto |
| D5 | `apps/web/` | Landing page vazia | Produto incompleto |
| D6 | `DOCTOR.md` / `README.md` | Documentação desatualizada (estrutura diferente da real) | Confusão para novos contribuidores |
| D7 | Monorepo | Sem CI/CD (`.github/workflows/`) | Qualidade |
| D8 | `turbo.json` | Task `test` não configurada no pipeline Turborepo | DX |
| D9 | `packages/agent/src/detectors/rsc-introspection.detector.ts` | Sem testes unitários | Qualidade |
| D10 | `apps/collector/src/db/schema.ts` | Comentário diz "bcrypt hash" mas código usa SHA-256 | Documentação enganosa |

---

## Avaliação por Dimensão

| Dimensão | Nota | Justificação |
|----------|------|-------------|
| Arquitetura geral | 8/10 | Monorepo bem estruturado, separação clara de responsabilidades, schema de DB maduro |
| Qualidade do código (agent) | 7/10 | Bom design, mas bugs no CPU monitor e dependências mal classificadas |
| Testes | 6/10 | Bons testes para detectors, mas sem testes para CLI, collector, dashboard |
| Segurança | 6/10 | Token hashing correto, mas bug crítico no bearer-auth e sem PII sanitization |
| Completude do produto | 4/10 | Dashboard e web vazios; collector funcional mas sem queue para AI Doctor |
| Documentação | 3/10 | README/DOCTOR.md desatualizados, estrutura descrita não corresponde à real |
| CI/CD | 1/10 | Sem workflows de CI configurados |

---

## Prioridades Imediatas

1. **Corrigir bug crítico** em `bearer-auth.ts` (`token` → `tokenHash`) — o ingest está quebrado
2. **Mover dependências CLI** (`ts-morph`, `chalk`, `commander`, `enquirer`, `react-scan`) para `devDependencies` ou para `packages/nextdoctor-cli`
3. **Corrigir cálculo de CPU** em `system-monitor.ts`
4. **Exportar `withNextDoctorAppRoute`** em `index.ts`
5. **Implementar dashboard** — sem UI o produto não tem valor demonstrável
6. **Configurar CI** com pelo menos lint + typecheck + test
