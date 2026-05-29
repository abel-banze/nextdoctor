# Documento de Design — Correções NextDoctor

## Visão Geral

Este documento descreve as alterações técnicas necessárias para implementar as correções identificadas na avaliação técnica do NextDoctor. As correções são agrupadas por componente e ordenadas por prioridade.

---

## Componentes Afetados

### 1. `apps/collector/src/middleware/bearer-auth.ts` (T1)

**Problema:** A query usa `projectTokens.token` mas a coluna no schema chama-se `tokenHash`.

**Solução:** Substituir `projectTokens.token` por `projectTokens.tokenHash` na cláusula `eq()`.

```typescript
// Antes (linha 22)
.where(and(eq(projectTokens.token, tokenHash), eq(projectTokens.isActive, true)))

// Depois
.where(and(eq(projectTokens.tokenHash, tokenHash), eq(projectTokens.isActive, true)))
```

Não são necessárias outras alterações — a função `hashToken` já usa SHA-256 corretamente.

---

### 2. `packages/agent/package.json` (T2)

**Problema:** `ts-morph`, `chalk`, `commander`, `enquirer`, `react-scan` estão em `dependencies`.

**Solução:** Mover para `devDependencies`. Estas dependências são usadas apenas em `src/cli/` e `src/auto-fixer/` — nunca em runtime de produção.

```json
// Remover de "dependencies":
"chalk": "^5.6.2",
"commander": "^14.0.3",
"enquirer": "^2.4.1",
"react-scan": "^0.5.3",
"ts-morph": "^27.0.2"

// Adicionar a "devDependencies":
"chalk": "^5.6.2",
"commander": "^14.0.3",
"enquirer": "^2.4.1",
"react-scan": "^0.5.3",
"ts-morph": "^27.0.2"
```


---

### 3. `packages/agent/src/system-monitor.ts` (T3)

**Problema:** `this.lastCPUTimes[index]` guarda o total acumulado mas é subtraído de `user` e `sys` individualmente.

**Solução:** Introduzir uma interface `CPUSnapshot` e armazenar valores individuais por tipo.

```typescript
interface CPUSnapshot {
  user: number;
  sys: number;
  idle: number;
  irq: number;
  total: number;
}

export class CPUMonitor {
  private lastCPUSnapshots: CPUSnapshot[] = [];

  private initializeBaseline(): void {
    const cpus_info = cpus();
    this.lastCPUSnapshots = cpus_info.map((cpu) => ({
      user: cpu.times.user,
      sys: cpu.times.sys,
      idle: cpu.times.idle,
      irq: cpu.times.irq,
      total: cpu.times.user + cpu.times.sys + cpu.times.idle + cpu.times.irq,
    }));
  }

  getCPUUsage(): CPUMetrics {
    const cpus_info = cpus();
    let totalUsage = 0;

    cpus_info.forEach((cpu, index) => {
      const currentTotal = cpu.times.user + cpu.times.sys + cpu.times.idle + cpu.times.irq;
      const prev = this.lastCPUSnapshots[index] ?? {
        user: cpu.times.user, sys: cpu.times.sys,
        idle: cpu.times.idle, irq: cpu.times.irq, total: currentTotal,
      };

      const totalDiff = currentTotal - prev.total;
      const userDiff = cpu.times.user - prev.user;
      const sysDiff = cpu.times.sys - prev.sys;

      const usage = totalDiff > 0
        ? ((userDiff + sysDiff) / totalDiff) * 100
        : 0;

      totalUsage += Math.min(100, Math.max(0, usage));

      this.lastCPUSnapshots[index] = {
        user: cpu.times.user, sys: cpu.times.sys,
        idle: cpu.times.idle, irq: cpu.times.irq, total: currentTotal,
      };
    });

    // ... resto do método inalterado
  }
}
```


---

### 4. `packages/agent/src/index.ts` (T4)

**Problema:** `withNextDoctorAppRoute` não está exportada no ponto de entrada público.

**Solução:** Adicionar à lista de exports em `index.ts`.

```typescript
// Antes
export {
  withNextDoctorMonitoring,
  withNextDoctorTiming,
} from './middleware.js';

// Depois
export {
  withNextDoctorAppRoute,
  withNextDoctorMonitoring,
  withNextDoctorTiming,
} from './middleware.js';
```

---

### 5. `packages/agent/src/init.ts` (T5)

**Problema:** `this.initialized = true` está fora do bloco `try` interno, por isso nunca é executado quando o retry tem sucesso — o erro é re-lançado antes de chegar a essa linha.

**Análise do fluxo atual:**

```
try (externo) {
  try (interno) {
    registerOTel(...)       // pode falhar
    // ... setup ...
    // SE FALHAR: vai para catch interno
  } catch (retryError) {
    errorCount++
    if (errorCount < maxRetries) throw retryError  // re-lança SEMPRE
    throw retryError
  }
  // this.initialized = true  ← NUNCA CHEGA AQUI se houve retry
}
```

**Solução:** Mover `this.initialized = true` para dentro do bloco `try` interno, após o setup completo, e remover o re-throw incondicional quando `errorCount < maxRetries` (deve fazer retry recursivo ou usar um loop).

```typescript
async initialize(): Promise<void> {
  if (this.initialized) return;
  if (!this.config.enabled) return;

  let attempt = 0;
  while (attempt <= this.retryPolicy.maxRetries) {
    try {
      // ... setup (registerOTel, samplers, etc.) ...
      this.initialized = true;          // ← dentro do try, após sucesso
      this.health.initialized = true;
      this.health.isHealthy = true;
      return;                           // sucesso — sair do loop
    } catch (err) {
      attempt++;
      this.health.errorCount = attempt;
      if (attempt > this.retryPolicy.maxRetries) {
        this.health.initialized = false;
        this.health.isHealthy = false;
        throw err;
      }
      const delay = Math.min(
        this.retryPolicy.initialDelayMs * Math.pow(this.retryPolicy.backoffMultiplier, attempt - 1),
        this.retryPolicy.maxDelayMs,
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```


---

### 6. `.github/workflows/ci.yml` (T8)

**Solução:** Criar o ficheiro de workflow com 4 jobs em sequência.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: Lint, Typecheck, Test, Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm turbo lint

      - name: Typecheck
        run: pnpm turbo typecheck

      - name: Test
        run: pnpm turbo test -- --run

      - name: Build
        run: pnpm turbo build
```

---

### 7. `turbo.json` (T9)

**Solução:** Adicionar a task `test` ao pipeline.

```json
"test": {
  "dependsOn": ["^build"],
  "inputs": ["src/**", "vitest.config.*", "tsconfig.json"],
  "outputs": ["coverage/**"]
}
```

---

### 8. Testes para `RscIntrospectionDetector` (T10)

**Ficheiro a criar:** `packages/agent/src/detectors/__tests__/rsc-introspection.detector.test.ts`

O ficheiro de testes deve seguir o padrão dos outros detectores (e.g., `waterfall.detector.test.ts`): criar spans mock com `createMockSpan()`, invocar `detector.run()`, e verificar o array de issues retornado.

Casos de teste necessários:
1. `generateMetadata` com duração > 500ms → issue `RSC_METADATA_HEAVY`
2. `generateMetadata` com duração < 500ms → sem issues
3. `next.rsc_payload_size` > 250000 bytes → issue `RSC_PAYLOAD_BLOAT`
4. Sem span `render route (app)` → sem issues
5. Ambos os thresholds excedidos → dois issues


---

### 9. `apps/collector/src/lib/ai-doctor.ts` — `routeToFilePath` (T11)

**Solução:** Normalizar segmentos numéricos e UUIDs para `[id]`.

```typescript
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_PATTERN = /^\d+$/;

function normalizeSegment(segment: string): string {
  if (NUMERIC_PATTERN.test(segment) || UUID_PATTERN.test(segment)) {
    return '[id]';
  }
  return segment;
}

function routeToFilePath(route: string | null): string {
  if (!route) return 'app/page.tsx';

  const clean = route.replace(/^\//, '').replace(/\/$/, '');
  const segments = clean.split('/').map(normalizeSegment);
  const normalized = segments.join('/');

  if (normalized.startsWith('api/')) {
    return `app/${normalized}/route.ts`;
  }

  return normalized ? `app/${normalized}/page.tsx` : 'app/page.tsx';
}
```

---

### 10. PII Sanitization no Agent (T13)

**Ficheiros afetados:** `packages/agent/src/types.ts`, `packages/agent/src/exporter.ts`

**Adição ao tipo `NextDoctorConfig`:**

```typescript
piiSanitization?: {
  enabled: boolean;
  redactAttributes?: string[];  // e.g. ['http.url', 'db.statement']
  redactPattern?: RegExp;       // e.g. /email=[\w@.]+/
};
```

**Função de sanitização a adicionar em `exporter.ts`:**

```typescript
function sanitizeAttributes(
  attributes: Record<string, unknown>,
  config: NonNullable<NextDoctorConfig['piiSanitization']>,
): Record<string, unknown> {
  if (!config.enabled) return attributes;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    let sanitized = value;

    if (config.redactAttributes?.includes(key)) {
      sanitized = '[REDACTED]';
    } else if (config.redactPattern && typeof value === 'string') {
      sanitized = value.replace(config.redactPattern, '[REDACTED]');
    }

    result[key] = sanitized;
  }
  return result;
}
```

A função é chamada em `serializeSpan()` antes de construir o payload JSON.


---

### 11. Documentação (T14) e Comentário no Schema (T15)

**T14 — README.md:** Atualizar a secção "Monorepo Structure" para refletir a estrutura real:

```
nextdoctor/
├── apps/
│   ├── collector/     # Backend Hono: ingest, auth, AI Doctor
│   ├── dashboard/     # Dashboard Next.js (em desenvolvimento)
│   └── web/           # Landing page (em desenvolvimento)
├── packages/
│   ├── agent/         # @codebaz/nextdoctor-agent — publicado no npm
│   └── nextdoctor-cli/ # @codebaz/nextdoctor — CLI de inicialização
```

Remover todas as referências a `apps/api`, `apps/marketing`, `packages/shared`.

**T15 — Schema:** Alterar o comentário na coluna `tokenHash`:

```typescript
// Antes
tokenHash: text('token_hash').notNull().unique(), // bcrypt hash of the raw token

// Depois
tokenHash: text('token_hash').notNull().unique(), // sha256 hash of the raw token
```

---

### 12. Singleton DetectionEngine para multi-tenant (T16)

**Ficheiros afetados:** `packages/agent/src/detectors/types.ts`, `packages/agent/src/detectors/index.ts`

**Alteração ao tipo `IssueDeduplicationKey`:**

```typescript
// types.ts
export interface IssueDeduplicationKey {
  id: string;
  route: string | undefined;
  projectId?: string;  // novo campo
}

export interface DetectorContext {
  route: string;
  runtime: 'nodejs' | 'edge';
  startupTimeMs?: number;
  systemMetrics?: { ... };
  projectId?: string;  // novo campo
}
```

**Alteração ao método `getDeduplicationKey` em `DetectionEngine`:**

```typescript
private getDeduplicationKey(issue: DetectedIssue, projectId?: string): string {
  const key: IssueDeduplicationKey = {
    id: issue.id,
    route: issue.route,
    projectId,
  };
  return JSON.stringify(key);
}
```

O `projectId` é passado a partir do `DetectorContext` quando disponível.

---

### 13. Modelo configurável no AI Doctor (T17)

**Ficheiro afetado:** `apps/collector/src/lib/ai-doctor.ts`

```typescript
// Antes
const DEFAULT_MODEL = 'claude-sonnet-4-5';

// Depois — ler de variável de ambiente com fallback
const DEFAULT_MODEL = process.env.AI_DOCTOR_MODEL ?? 'claude-sonnet-4-5';

// No insert de ai_analyses:
model: DEFAULT_MODEL,

// Na chamada generateText:
model: anthropic(DEFAULT_MODEL),
```


---

### 14. Validação de versão Next.js no CLI (T19 + T20)

**Ficheiro afetado:** `packages/nextdoctor-cli/src/init.ts`

**Função de validação de versão:**

```typescript
import semver from 'semver';

function getNextVersion(pkgJson: Record<string, unknown>): string | null {
  const deps = Object.assign(
    {},
    pkgJson.dependencies,
    pkgJson.devDependencies,
    pkgJson.peerDependencies,
  ) as Record<string, string>;
  const raw = deps?.next;
  if (!raw) return null;
  return semver.coerce(raw)?.version ?? null;
}

function assertNextVersion(pkgJson: Record<string, unknown>): void {
  const version = getNextVersion(pkgJson);
  if (!version) {
    console.warn('warning: não foi possível determinar a versão do Next.js.');
    return;
  }
  if (semver.lt(version, '13.4.0')) {
    console.warn(
      `warning: Next.js ${version} não suporta o Instrumentation Hook. Versão mínima: 13.4.0.`,
    );
  }
}
```

**Configuração de `next.config.js` para Next.js < 15 (T20):**

```typescript
function configureNextConfig(target: string, nextVersion: string | null): void {
  if (!nextVersion || !semver.lt(nextVersion, '15.0.0')) return;

  const configPath = path.join(target, 'next.config.js');
  const tsConfigPath = path.join(target, 'next.config.ts');

  const existingPath = fs.existsSync(tsConfigPath) ? tsConfigPath
    : fs.existsSync(configPath) ? configPath
    : null;

  if (existingPath) {
    const content = fs.readFileSync(existingPath, 'utf8');
    if (content.includes('instrumentationHook')) {
      console.log(`skip: instrumentationHook já configurado em ${path.basename(existingPath)}`);
      return;
    }
    // Adicionar flag ao config existente (inserção simples antes do export default)
    const updated = content.replace(
      /experimental\s*:\s*\{/,
      'experimental: {\n    instrumentationHook: true,',
    );
    if (updated !== content) {
      fs.writeFileSync(existingPath, updated, 'utf8');
      console.log(`updated: ${path.basename(existingPath)} — adicionado instrumentationHook: true`);
      return;
    }
  }

  // Criar next.config.js mínimo
  safeWriteFile(configPath, `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
`);
}
```

---

## Modelo de Dados — Alterações

Não são necessárias migrações de base de dados. Todas as alterações são ao nível do código TypeScript.

A única alteração ao schema é a correção do comentário na coluna `tokenHash` (T15) — sem impacto na estrutura da tabela.

---

## Estratégia de Testes

- **Testes unitários existentes:** Vitest, em `packages/agent/src/detectors/__tests__/`
- **Novos testes:** Seguir o padrão existente com `createMockSpan()` e `createMockContext()`
- **CI:** GitHub Actions executa `turbo test -- --run` (modo single-run, sem watch)
- **Cobertura:** Não é obrigatório atingir um threshold específico nesta fase


---

## Propriedades de Correção

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas do sistema — essencialmente, uma afirmação formal sobre o que o sistema deve fazer. As propriedades servem de ponte entre especificações legíveis por humanos e garantias de correção verificáveis automaticamente.*

### Propriedade 1: CPU usage está sempre no intervalo válido

*Para qualquer* par de snapshots de CPU consecutivos com valores não-negativos, o valor de `usage` retornado por `getCPUUsage()` deve estar entre 0 e 100 (inclusive).

**Valida: Requisito 3.3**

---

### Propriedade 2: CPU usage é zero quando não há diferença entre amostras

*Para qualquer* core onde o total acumulado não mudou entre duas amostras (delta = 0), o `usage` calculado para esse core deve ser 0.

**Valida: Requisito 3.4**

---

### Propriedade 3: RscIntrospectionDetector emite RSC_METADATA_HEAVY para qualquer duração acima do threshold

*Para qualquer* conjunto de spans que inclua um span `render route (app)` e um ou mais spans `generateMetadata` cuja soma de durações exceda 500ms, o detector deve emitir exatamente um issue com `id = 'RSC_METADATA_HEAVY'` e `severity = 'high'`.

**Valida: Requisito 8.1**

---

### Propriedade 4: RscIntrospectionDetector não emite issues para durações abaixo do threshold

*Para qualquer* conjunto de spans onde a soma das durações de `generateMetadata` é inferior a 500ms e o payload RSC é inferior a 250000 bytes, o detector não deve emitir nenhum issue.

**Valida: Requisito 8.2**

---

### Propriedade 5: routeToFilePath normaliza segmentos dinâmicos

*Para qualquer* rota que contenha segmentos numéricos ou UUIDs, o caminho retornado por `routeToFilePath` não deve conter esses valores literais — deve conter `[id]` nos segmentos correspondentes.

**Valida: Requisitos 9.1, 9.2**

---

### Propriedade 6: routeToFilePath preserva rotas estáticas

*Para qualquer* rota composta exclusivamente por segmentos alfanuméricos sem números isolados nem UUIDs, o caminho retornado deve ser idêntico ao que seria gerado sem normalização.

**Valida: Requisito 9.3**

---

### Propriedade 7: PII sanitization redige atributos configurados

*Para qualquer* span com um atributo cujo nome está em `redactAttributes`, após aplicar `sanitizeAttributes`, o valor desse atributo deve ser `'[REDACTED]'`.

**Valida: Requisito 10.1**

---

### Propriedade 8: PII sanitization aplica padrão regex

*Para qualquer* span com um atributo de tipo string cujo valor contém um match do `redactPattern`, após aplicar `sanitizeAttributes`, o match deve ser substituído por `'[REDACTED]'`.

**Valida: Requisito 10.2**

---

### Propriedade 9: PII sanitization desativada não altera spans

*Para qualquer* span, quando `piiSanitization.enabled` é `false`, o resultado de `sanitizeAttributes` deve ser idêntico ao input original.

**Valida: Requisito 10.3**

---

### Propriedade 10: Deduplicação isolada por projeto

*Para quaisquer* dois `projectId` distintos que gerem o mesmo issue com o mesmo `id` e `route`, ambos os issues devem aparecer no output do `DetectionEngine` sem supressão cruzada.

**Valida: Requisito 13.2**
