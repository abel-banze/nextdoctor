# Tarefas de Melhoria — NextDoctor

**Data:** 2026-05-27 (gerado a partir de análise completa do código-fonte)

---

## 🔴 Crítico — Bugs que quebram funcionalidade em produção

### T1 — Corrigir `bearer-auth.ts`: coluna `token` → `tokenHash`
- **Ficheiro:** `apps/collector/src/middleware/bearer-auth.ts:22`
- **Problema:** A query usa `projectTokens.token` mas a coluna no schema chama-se `tokenHash`. Qualquer request ao `/ingest` retorna erro de coluna inexistente.
- **Fix:**
  ```typescript
  // Antes
  eq(projectTokens.token, tokenHash)
  // Depois
  eq(projectTokens.tokenHash, tokenHash)
  ```
- **Esforço:** 15 minutos
- **Impacto:** Sem este fix, o ingest está completamente quebrado

---

### T2 — Mover dependências CLI para fora do bundle runtime do agent
- **Ficheiro:** `packages/agent/package.json`
- **Problema:** `ts-morph` (~50MB), `react-scan`, `chalk`, `commander`, `enquirer` estão em `dependencies` mas são usados apenas em `src/cli/` e `src/auto-fixer/` — nunca em runtime de produção.
- **Fix:**
  1. Mover `chalk`, `commander`, `enquirer` para `devDependencies` do agent (ou para `packages/nextdoctor-cli`)
  2. Mover `ts-morph` para `devDependencies` do agent
  3. Mover `src/auto-fixer/ast-worker.ts` e `src/cli/` para `packages/nextdoctor-cli`
  4. Verificar que o build do agent não inclui esses módulos: `pnpm build && du -sh dist/`
- **Esforço:** 1 dia
- **Impacto:** Reduz o bundle publicado de ~80MB para ~5-10MB

---

## 🟠 Alto — Bugs que afetam correctude

### T3 — Corrigir cálculo de CPU em `system-monitor.ts`
- **Ficheiro:** `packages/agent/src/system-monitor.ts` — `CPUMonitor.getCPUUsage()`
- **Problema:** `this.lastCPUTimes[index]` guarda o total acumulado `(user + sys + idle + irq)` mas é subtraído de `cpu.times.user` e `cpu.times.sys` individualmente. O resultado é CPU usage incorreto (pode ser negativo).
- **Fix:** Guardar os valores individuais por tipo:
  ```typescript
  interface CPUSnapshot { user: number; sys: number; idle: number; irq: number; total: number; }
  private lastCPUSnapshots: CPUSnapshot[] = [];
  
  // No cálculo:
  const prev = this.lastCPUSnapshots[index];
  const userDiff = cpu.times.user - prev.user;
  const sysDiff = cpu.times.sys - prev.sys;
  const totalDiff = currentTotal - prev.total;
  const usage = totalDiff > 0 ? ((userDiff + sysDiff) / totalDiff) * 100 : 0;
  ```
- **Esforço:** 2 horas

---

### T4 — Exportar `withNextDoctorAppRoute` em `index.ts`
- **Ficheiro:** `packages/agent/src/index.ts` e `packages/agent/src/middleware.ts`
- **Problema:** `withNextDoctorAppRoute` está implementada em `middleware.ts` mas não está exportada em `index.ts`. Utilizadores do App Router não conseguem usá-la.
- **Fix:** Adicionar a `index.ts`:
  ```typescript
  export { withNextDoctorAppRoute, withNextDoctorMonitoring, withNextDoctorTiming } from './middleware.js';
  ```
- **Esforço:** 5 minutos

---

### T5 — Corrigir retry logic em `init.ts`
- **Ficheiro:** `packages/agent/src/init.ts` — método `initialize()`
- **Problema:** O bloco `try/catch` interno re-lança o erro após incrementar `errorCount`, mas o bloco externo captura e define `initialized = false`. Se o retry interno bem-sucedido (sem re-throw), `this.initialized` nunca é definido como `true` porque o `this.initialized = true` está fora do bloco interno.
- **Fix:** Mover `this.initialized = true` para dentro do bloco interno após `registerOTel`, antes do catch.
- **Esforço:** 30 minutos

---

## 🟡 Médio — Dívida técnica e gaps de produto

### T6 — Implementar dashboard (`apps/dashboard`)
- **Ficheiro:** `apps/dashboard/app/`
- **Problema:** O dashboard é um esqueleto `create-next-app` sem nenhuma UI implementada. Sem dashboard, o produto não tem valor demonstrável.
- **Páginas mínimas a implementar:**
  - `/` — lista de projetos
  - `/projects/[slug]` — lista de issues do projeto com severidade e rota
  - `/projects/[slug]/issues/[id]` — detalhe do issue com sugestão de fix e AI Doctor
  - `/projects/[slug]/settings` — tokens de projeto
- **Integração:** chamadas ao `apps/collector` via fetch server-side
- **Esforço:** 5-8 dias

---

### T7 — Implementar landing page (`apps/web`)
- **Ficheiro:** `apps/web/app/`
- **Problema:** `apps/web` está completamente vazio. Sem landing page não há aquisição de utilizadores.
- **Conteúdo mínimo:** hero, proposta de valor, pricing, waitlist/CTA
- **Esforço:** 2-3 dias

---

### T8 — Configurar CI/CD (GitHub Actions)
- **Ficheiro:** `.github/workflows/` (a criar)
- **Problema:** Não existe nenhum workflow de CI. Bugs como T1 e T3 passariam despercebidos.
- **Workflows a criar:**
  ```yaml
  # ci.yml
  - lint (turbo lint)
  - typecheck (turbo typecheck)
  - test (turbo test -- --run)
  - build (turbo build)
  ```
- **Opcional:** job de bundle-size que falha se `dist/` do agent exceder 15MB
- **Esforço:** 1 dia

---

### T9 — Adicionar task `test` ao pipeline Turborepo
- **Ficheiro:** `turbo.json`
- **Problema:** `test` não está configurado no pipeline. `pnpm test` funciona mas sem cache Turborepo.
- **Fix:**
  ```json
  "test": {
    "dependsOn": ["^build"],
    "inputs": ["src/**", "vitest.config.*"],
    "outputs": ["coverage/**"]
  }
  ```
- **Esforço:** 15 minutos

---

### T10 — Adicionar testes para `RscIntrospectionDetector`
- **Ficheiro:** `packages/agent/src/detectors/__tests__/` (a criar)
- **Problema:** É o único detector sem testes unitários.
- **Esforço:** 2 horas

---

### T11 — Corrigir `routeToFilePath` para rotas dinâmicas no AI Doctor
- **Ficheiro:** `apps/collector/src/lib/ai-doctor.ts`
- **Problema:** `/users/[id]` → `app/users/[id]/page.tsx` (correto), mas `/users/123` → `app/users/123/page.tsx` (errado — o ficheiro real é `app/users/[id]/page.tsx`).
- **Fix:** Normalizar segmentos numéricos para `[param]`:
  ```typescript
  function routeToFilePath(route: string | null): string {
    if (!route) return 'app/page.tsx';
    const clean = route.replace(/^\//, '').replace(/\/$/, '');
    // Normalizar segmentos que parecem IDs dinâmicos
    const normalized = clean.replace(/\/\d+/g, '/[id]').replace(/\/[a-f0-9-]{36}/g, '/[id]');
    if (normalized.startsWith('api/')) return `app/${normalized}/route.ts`;
    return normalized ? `app/${normalized}/page.tsx` : 'app/page.tsx';
  }
  ```
- **Esforço:** 1 hora

---

### T12 — Adicionar queue persistente para AI Doctor
- **Ficheiro:** `apps/collector/src/lib/ai-doctor.ts` e `apps/collector/src/routes/ai.ts`
- **Problema:** O AI Doctor é fire-and-forget. Se o processo reiniciar enquanto uma análise está a correr, o registo fica em estado `pending` para sempre.
- **Fix:** Ao iniciar o collector, fazer `SELECT * FROM ai_analyses WHERE status = 'pending'` e re-enfileirar. Ou usar uma queue simples em memória com persistência via DB.
- **Esforço:** 1-2 dias

---

### T13 — Adicionar PII sanitization configurável no agent
- **Ficheiro:** `packages/agent/src/exporter.ts` e `packages/agent/src/types.ts`
- **Problema:** Spans podem conter PII em atributos (URLs com query params, headers, etc.). Não há nenhum mecanismo de redaction.
- **Fix:**
  ```typescript
  // Em NextDoctorConfig
  piiSanitization?: {
    enabled: boolean;
    redactAttributes?: string[];   // ['http.url', 'db.statement']
    redactPattern?: RegExp;        // /email=[\w@.]+/
  }
  ```
  Aplicar no `serializeSpan` antes de enviar.
- **Esforço:** 1-2 dias

---

### T14 — Corrigir documentação (README.md e DOCTOR.md)
- **Ficheiro:** `README.md`, `DOCTOR.md`
- **Problema:** Ambos descrevem `apps/api`, `apps/marketing`, `packages/shared` que não existem. A estrutura real é `apps/collector`, `apps/dashboard`, `apps/web`.
- **Fix:** Atualizar a secção "Monorepo Structure" para refletir a estrutura real.
- **Esforço:** 30 minutos

---

### T15 — Corrigir comentário enganoso no schema (`bcrypt` vs `sha256`)
- **Ficheiro:** `apps/collector/src/db/schema.ts:projectTokens`
- **Problema:** O comentário diz `bcrypt hash` mas `bearer-auth.ts` usa SHA-256. SHA-256 é aceitável para tokens aleatórios longos, mas o comentário induz em erro.
- **Fix:** Atualizar comentário para `-- sha256 hash of the raw token`.
- **Esforço:** 5 minutos

---

## 🟢 Baixo — Melhorias de longo prazo

### T16 — Resolver singleton `detectionEngine` para multi-tenant
- **Ficheiro:** `packages/agent/src/detectors/index.ts`
- **Problema:** O singleton partilha cache de deduplicação entre todos os projetos no mesmo processo. Em self-hosted multi-tenant, pode causar supressão incorreta de issues.
- **Fix:** Instanciar `DetectionEngine` por projeto ou incluir `projectId` na chave de deduplicação.
- **Esforço:** 2-3 horas

---

### T17 — Tornar modelo do AI Doctor configurável
- **Ficheiro:** `apps/collector/src/lib/ai-doctor.ts`
- **Problema:** `claude-sonnet-4-5` está hardcoded. O schema já tem campo `model`.
- **Fix:** Ler modelo de configuração do projeto ou variável de ambiente `AI_DOCTOR_MODEL`.
- **Esforço:** 1 hora

---

### T18 — Adicionar testes para `packages/nextdoctor-cli`
- **Ficheiro:** `packages/nextdoctor-cli/src/`
- **Problema:** CLI sem nenhum teste. `runInit` tem lógica de detecção de package manager e scaffolding que devia ser testada.
- **Esforço:** 1 dia

---

### T19 — Validar versão do Next.js no CLI init
- **Ficheiro:** `packages/nextdoctor-cli/src/init.ts`
- **Problema:** `assertNextPresent` só verifica se `next` existe, não a versão. Next.js < 13.4 não suporta Instrumentation Hook.
- **Fix:** Ler versão do `package.json` e avisar se `< 13.4.0`.
- **Esforço:** 1 hora

---

### T20 — Configurar `next.config.ts` no CLI init para Next.js < 15
- **Ficheiro:** `packages/nextdoctor-cli/src/init.ts`
- **Problema:** Next.js < 15 requer `experimental.instrumentationHook: true` em `next.config.js`. O CLI não configura isso.
- **Fix:** Detetar versão do Next.js e adicionar a flag se necessário.
- **Esforço:** 2 horas

---

## Ordem de Execução Recomendada

```
Semana 1 (bugs críticos):
  T1 → T2 → T3 → T4 → T5

Semana 2 (CI + qualidade):
  T8 → T9 → T10 → T14 → T15

Semana 3-4 (produto):
  T6 (dashboard) — maior esforço, mais impacto

Semana 5 (segurança e fiabilidade):
  T13 (PII) → T12 (AI Doctor queue) → T11 (routeToFilePath)

Backlog:
  T7 (web) → T16 → T17 → T18 → T19 → T20
```
