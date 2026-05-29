# Implementation Plan: Correções NextDoctor

## Overview

Implementação das correções identificadas na avaliação técnica do NextDoctor, organizadas por prioridade. As tarefas cobrem bugs críticos (T1–T5), dívida técnica de alto impacto (T8–T11) e melhorias de nível médio (T13–T17, T19–T20).

## Task Dependency Graph

```json
{
  "waves": [
    ["1", "2", "3", "4", "5"],
    ["6", "7", "8", "9", "10"],
    ["11", "12", "13", "14", "15"]
  ]
}
```

## Tasks

- [ ] 1. T1 — Corrigir autenticação Bearer no Collector
  - Em `apps/collector/src/middleware/bearer-auth.ts`, linha 22, substituir `projectTokens.token` por `projectTokens.tokenHash` na cláusula `eq()`
  - Verificar que a função `hashToken` continua inalterada (já usa SHA-256 corretamente)
  - _Requisitos: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. T2 — Mover dependências CLI para devDependencies
  - Em `packages/agent/package.json`, mover `ts-morph`, `chalk`, `commander`, `enquirer`, `react-scan` de `dependencies` para `devDependencies`
  - Executar `pnpm install` para atualizar o lockfile
  - Verificar que `pnpm build` no package `agent` continua a funcionar sem erros
  - _Requisitos: 2.1, 2.3, 2.4_

- [ ] 3. T3 — Corrigir cálculo de CPU no SystemMonitor
  - Em `packages/agent/src/system-monitor.ts`, introduzir a interface `CPUSnapshot` com campos `user`, `sys`, `idle`, `irq`, `total`
  - Substituir o array `lastCPUTimes: number[]` por `lastCPUSnapshots: CPUSnapshot[]`
  - Atualizar `initializeBaseline()` para guardar snapshots individuais
  - Atualizar `getCPUUsage()` para calcular deltas por tipo e dividir pelo delta total
  - Garantir que o resultado está sempre no intervalo [0, 100] com `Math.min(100, Math.max(0, usage))`
  - _Requisitos: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. T4 — Exportar `withNextDoctorAppRoute` no index público
  - Em `packages/agent/src/index.ts`, adicionar `withNextDoctorAppRoute` à exportação existente de `./middleware.js`
  - Verificar que o TypeScript resolve o tipo corretamente com `tsc --noEmit`
  - _Requisitos: 4.1, 4.2, 4.3_

- [ ] 5. T5 — Corrigir retry logic na inicialização do Agent
  - Em `packages/agent/src/init.ts`, refatorar o método `initialize()` para usar um loop `while` em vez de try/catch aninhados
  - Mover `this.initialized = true` e `this.health.initialized = true` para dentro do bloco de sucesso, após `registerOTel`
  - Implementar backoff exponencial com `initialDelayMs * backoffMultiplier^attempt`
  - Garantir que após `maxRetries` tentativas falhadas, o erro é lançado e `health.initialized = false`
  - _Requisitos: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. T9 — Adicionar task `test` ao pipeline Turborepo
  - Em `turbo.json`, adicionar a task `test` com `dependsOn: ["^build"]`, `inputs: ["src/**", "vitest.config.*", "tsconfig.json"]` e `outputs: ["coverage/**"]`
  - _Requisitos: 7.1, 7.2, 7.3, 7.4_

- [ ] 7. T8 — Configurar CI/CD com GitHub Actions
  - Criar o ficheiro `.github/workflows/ci.yml`
  - Configurar trigger em `push` e `pull_request` para o branch `main`
  - Adicionar steps: checkout, setup pnpm v9, setup node 20 com cache pnpm, `pnpm install --frozen-lockfile`
  - Adicionar jobs sequenciais: `turbo lint`, `turbo typecheck`, `turbo test -- --run`, `turbo build`
  - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. T10 — Adicionar testes unitários para RscIntrospectionDetector
  - Criar `packages/agent/src/detectors/__tests__/rsc-introspection.detector.test.ts`
  - Seguir o padrão dos outros testes de detectores: usar `createMockSpan()` e `createMockContext()`
  - Implementar os 5 casos de teste: metadata heavy (>500ms), metadata ok (<500ms), payload bloat (>250000 bytes), sem render span, ambos os thresholds
  - _Requisitos: 8.1, 8.2, 8.3, 8.4_

- [ ] 9. T14 — Corrigir documentação do monorepo
  - Em `README.md`, atualizar a secção "Monorepo Structure" para refletir a estrutura real: `apps/collector`, `apps/dashboard`, `apps/web`, `packages/agent`, `packages/nextdoctor-cli`
  - Remover todas as referências a `apps/api`, `apps/marketing`, `packages/shared`
  - Aplicar as mesmas correções ao ficheiro `DOCTOR.md`
  - _Requisitos: 11.1, 11.2, 11.3_

- [ ] 10. T15 — Corrigir comentário enganoso no schema
  - Em `apps/collector/src/db/schema.ts`, na definição da coluna `tokenHash` da tabela `project_tokens`, alterar o comentário de `bcrypt hash of the raw token` para `sha256 hash of the raw token`
  - _Requisitos: 12.1_

- [ ] 11. T11 — Corrigir `routeToFilePath` para rotas dinâmicas
  - Em `apps/collector/src/lib/ai-doctor.ts`, adicionar as constantes `UUID_PATTERN` e `NUMERIC_PATTERN`
  - Implementar a função `normalizeSegment(segment: string): string` que substitui segmentos numéricos e UUIDs por `[id]`
  - Refatorar `routeToFilePath` para dividir a rota em segmentos, aplicar `normalizeSegment` a cada um, e reconstruir o caminho
  - _Requisitos: 9.1, 9.2, 9.3, 9.4_

- [ ] 12. T13 — Adicionar PII sanitization configurável no Agent
  - Em `packages/agent/src/types.ts`, adicionar o campo opcional `piiSanitization` ao tipo `NextDoctorConfig` com as propriedades `enabled`, `redactAttributes` e `redactPattern`
  - Em `packages/agent/src/exporter.ts`, implementar a função `sanitizeAttributes(attributes, config)` que aplica redação por nome de atributo e por padrão regex
  - Chamar `sanitizeAttributes` em `serializeSpan()` antes de construir o payload JSON, usando a config passada ao exporter
  - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 13. T16 — Resolver singleton DetectionEngine para multi-tenant
  - Em `packages/agent/src/detectors/types.ts`, adicionar o campo opcional `projectId?: string` à interface `IssueDeduplicationKey` e ao tipo `DetectorContext`
  - Em `packages/agent/src/detectors/index.ts`, atualizar o método `getDeduplicationKey` para incluir `projectId` na chave quando presente no contexto
  - Atualizar `analyzeSpans` para passar `context.projectId` ao método de deduplicação
  - _Requisitos: 13.1, 13.2, 13.3, 13.4_

- [ ] 14. T17 — Tornar modelo do AI Doctor configurável
  - Em `apps/collector/src/lib/ai-doctor.ts`, substituir o modelo hardcoded `'claude-sonnet-4-5'` por `process.env.AI_DOCTOR_MODEL ?? 'claude-sonnet-4-5'`
  - Garantir que o valor da variável de ambiente é usado tanto no insert de `ai_analyses` (campo `model`) como na chamada `anthropic()`
  - _Requisitos: 14.1, 14.2, 14.3_

- [ ] 15. T19 + T20 — Validar versão Next.js e configurar next.config no CLI
  - Em `packages/nextdoctor-cli/src/init.ts`, implementar a função `getNextVersion(pkgJson)` que lê a versão do `next` e usa `semver.coerce` para normalizar
  - Implementar `assertNextVersion(pkgJson)` que emite aviso se a versão for inferior a `13.4.0`
  - Implementar `configureNextConfig(target, nextVersion)` que cria ou modifica `next.config.js` com `experimental.instrumentationHook: true` quando a versão é inferior a `15.0.0`
  - Chamar `assertNextVersion` e `configureNextConfig` em `runInit` após a deteção do package manager
  - Adicionar `semver` às dependências do `packages/nextdoctor-cli`
  - _Requisitos: 15.1, 15.2, 15.3, 15.4, 16.1, 16.2, 16.3, 16.4_

## Notes

- A ordem das tarefas reflete a prioridade: crítico (1–5) → alto (6–10) → médio (11–15)
- Os testes de propriedade usam Vitest (já configurado no projeto)
- O CI (tarefa 7) deve ser configurado antes de abrir PRs para as tarefas seguintes
