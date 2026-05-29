# Documento de Requisitos — Correções NextDoctor

## Introdução

Este documento especifica os requisitos para implementar as correções identificadas na avaliação técnica do projeto NextDoctor. As correções abrangem bugs críticos que quebram funcionalidade em produção, dívida técnica de alto impacto e melhorias de nível médio. O âmbito cobre as tarefas T1–T5 (crítico), T8–T11 (alto), T13–T17 (médio) e T19–T20 (médio).

O projeto é um monorepo Turborepo/pnpm com os seguintes pacotes relevantes:
- `apps/collector` — backend Hono que recebe spans e autentica via Bearer token
- `packages/agent` — agente OTel publicado no npm, injetado em apps Next.js
- `packages/nextdoctor-cli` — CLI de inicialização (`npx @codebaz/nextdoctor init`)

---

## Glossário

- **Agent**: O pacote `@codebaz/nextdoctor-agent` (`packages/agent`) injetado via Instrumentation Hook no projeto Next.js do utilizador.
- **Collector**: A aplicação `apps/collector` (Hono) que recebe spans via POST `/ingest` e persiste issues na base de dados.
- **Bearer Token**: Token de autenticação enviado pelo Agent no header `Authorization: Bearer <token>`.
- **tokenHash**: Coluna na tabela `project_tokens` que armazena o hash SHA-256 do token em bruto.
- **DetectionEngine**: Classe em `packages/agent/src/detectors/index.ts` que agrega os 9 detectores de anti-padrões.
- **RscIntrospectionDetector**: Detector que identifica problemas em React Server Components (metadata pesado, payload excessivo).
- **AI Doctor**: Funcionalidade em `apps/collector/src/lib/ai-doctor.ts` que usa Claude para analisar issues e gerar diffs de correção.
- **routeToFilePath**: Função heurística que mapeia uma rota Next.js para o caminho do ficheiro fonte no repositório GitHub.
- **CPUMonitor**: Classe em `packages/agent/src/system-monitor.ts` que mede o uso de CPU por core.
- **withNextDoctorAppRoute**: Função em `packages/agent/src/middleware.ts` que envolve route handlers do App Router.
- **Turborepo**: Ferramenta de build para monorepos; o pipeline é configurado em `turbo.json`.
- **CI/CD**: Pipeline de integração contínua configurado em `.github/workflows/`.
- **PII**: Informação Pessoalmente Identificável (e.g., emails, IDs em URLs, query params).
- **CLI**: O pacote `packages/nextdoctor-cli` que executa `npx @codebaz/nextdoctor init`.

---

## Requisitos

### Requisito 1 — Corrigir autenticação Bearer no Collector (T1)

**User Story:** Como operador do Collector, quero que a autenticação Bearer funcione corretamente, para que os agentes consigam enviar spans sem erros de coluna inexistente.

#### Critérios de Aceitação

1. QUANDO o Collector recebe um pedido com header `Authorization: Bearer <token>`, O Collector SHALL calcular o hash SHA-256 do token em bruto e comparar com a coluna `tokenHash` da tabela `project_tokens`.
2. THE Collector SHALL usar `projectTokens.tokenHash` (e não `projectTokens.token`) na cláusula `WHERE` da query de validação do token.
3. QUANDO o token é válido e está ativo, O Collector SHALL prosseguir para o handler seguinte e definir `tenantId` e `projectId` no contexto.
4. IF o token não existe ou `isActive` é falso, THEN O Collector SHALL retornar HTTP 401 com corpo `{ "error": "Invalid or revoked token" }`.

---

### Requisito 2 — Mover dependências CLI para devDependencies (T2)

**User Story:** Como utilizador que instala `@codebaz/nextdoctor-agent`, quero que o pacote não inclua dependências de desenvolvimento no bundle de produção, para que a instalação seja rápida e o bundle seja pequeno.

#### Critérios de Aceitação

1. THE Agent SHALL ter `ts-morph`, `chalk`, `commander`, `enquirer` e `react-scan` listados em `devDependencies` (e não em `dependencies`) no ficheiro `packages/agent/package.json`.
2. QUANDO o Agent é instalado via `npm install @codebaz/nextdoctor-agent`, o gestor de pacotes SHALL instalar apenas as dependências de runtime (OpenTelemetry, `@vercel/otel`, etc.) e não as dependências CLI.
3. THE Agent SHALL continuar a compilar e a executar corretamente após a movimentação das dependências.
4. THE Agent SHALL continuar a expor o binário `nextdoctor-agent` via o campo `bin` do `package.json`.

---

### Requisito 3 — Corrigir cálculo de CPU no SystemMonitor (T3)

**User Story:** Como operador que monitoriza o sistema, quero que o uso de CPU reportado seja correto, para que o sampler adaptativo tome decisões baseadas em dados reais.

#### Critérios de Aceitação

1. THE CPUMonitor SHALL armazenar snapshots individuais por tipo de tempo (`user`, `sys`, `idle`, `irq`) para cada core, em vez de armazenar apenas o total acumulado.
2. QUANDO `getCPUUsage()` é chamado, O CPUMonitor SHALL calcular o delta de `user` e `sys` dividido pelo delta do total acumulado para obter a percentagem de uso.
3. THE CPUMonitor SHALL retornar um valor de `usage` entre 0 e 100 (inclusive) para qualquer sequência de chamadas.
4. IF o delta total entre duas amostras é zero, THEN O CPUMonitor SHALL retornar `usage = 0` para esse core.

---

### Requisito 4 — Exportar `withNextDoctorAppRoute` no index público (T4)

**User Story:** Como developer que usa o App Router do Next.js, quero importar `withNextDoctorAppRoute` diretamente de `@codebaz/nextdoctor-agent`, para que possa instrumentar os meus route handlers sem importar de um sub-caminho interno.

#### Critérios de Aceitação

1. THE Agent SHALL exportar `withNextDoctorAppRoute` a partir do ponto de entrada principal (`packages/agent/src/index.ts`).
2. QUANDO um utilizador escreve `import { withNextDoctorAppRoute } from '@codebaz/nextdoctor-agent'`, o TypeScript SHALL resolver o tipo corretamente sem erros.
3. THE Agent SHALL continuar a exportar `withNextDoctorMonitoring` e `withNextDoctorTiming` sem alterações.

---

### Requisito 5 — Corrigir retry logic na inicialização do Agent (T5)

**User Story:** Como developer que usa o Agent, quero que o Agent inicialize corretamente mesmo após uma falha transitória, para que o sistema de monitorização fique ativo sem necessitar de reiniciar o processo.

#### Critérios de Aceitação

1. QUANDO `initialize()` é chamado e a inicialização interna falha, O Agent SHALL incrementar `errorCount` e aguardar com backoff exponencial antes de re-tentar.
2. QUANDO a inicialização interna tem sucesso (após zero ou mais retries), O Agent SHALL definir `this.initialized = true` imediatamente após o `registerOTel` bem-sucedido.
3. IF `errorCount` atinge `maxRetries` sem sucesso, THEN O Agent SHALL lançar o erro e definir `health.initialized = false`.
4. WHILE `initialized` é `false`, O Agent SHALL rejeitar chamadas a `reportCustomMetric` com um aviso de log.

---

### Requisito 6 — Configurar CI/CD com GitHub Actions (T8)

**User Story:** Como contribuidor do projeto, quero que o CI execute lint, typecheck, testes e build automaticamente em cada pull request, para que bugs como T1 e T3 sejam detetados antes de chegar ao main.

#### Critérios de Aceitação

1. THE Repositório SHALL ter um ficheiro `.github/workflows/ci.yml` que define um workflow de CI.
2. QUANDO um pull request é aberto ou atualizado para o branch `main`, O CI SHALL executar os jobs `lint`, `typecheck`, `test` e `build` em sequência.
3. THE CI SHALL usar `turbo lint`, `turbo typecheck`, `turbo test -- --run` e `turbo build` para executar cada job.
4. IF qualquer job falhar, THEN O CI SHALL marcar o pull request como falhado e impedir o merge.
5. THE CI SHALL usar cache do Turborepo para acelerar execuções subsequentes.

---

### Requisito 7 — Adicionar task `test` ao pipeline Turborepo (T9)

**User Story:** Como developer que executa `pnpm test` no monorepo, quero que os testes beneficiem do cache do Turborepo, para que execuções repetidas sem alterações de código sejam instantâneas.

#### Critérios de Aceitação

1. THE `turbo.json` SHALL conter uma task `test` com `dependsOn: ["^build"]`.
2. THE task `test` SHALL declarar `inputs` que incluem `src/**` e ficheiros de configuração do Vitest.
3. THE task `test` SHALL declarar `outputs: ["coverage/**"]` para persistir relatórios de cobertura.
4. QUANDO `turbo test` é executado sem alterações de código, O Turborepo SHALL usar o resultado em cache e não re-executar os testes.

---

### Requisito 8 — Adicionar testes unitários para RscIntrospectionDetector (T10)

**User Story:** Como developer que mantém os detectores, quero que o `RscIntrospectionDetector` tenha testes unitários, para que alterações futuras não introduzam regressões silenciosas.

#### Critérios de Aceitação

1. THE Repositório SHALL ter um ficheiro de testes `packages/agent/src/detectors/__tests__/rsc-introspection.detector.test.ts`.
2. QUANDO o detector recebe spans com `generateMetadata` com duração superior a 500ms, O teste SHALL verificar que é emitido um issue `RSC_METADATA_HEAVY` com severidade `high`.
3. QUANDO o detector recebe spans com `generateMetadata` com duração inferior a 500ms, O teste SHALL verificar que nenhum issue é emitido.
4. QUANDO o detector recebe spans com `next.rsc_payload_size` superior a 250000 bytes, O teste SHALL verificar que é emitido um issue `RSC_PAYLOAD_BLOAT` com severidade `warning`.
5. QUANDO o detector recebe spans sem span de render (`render route (app)`), O teste SHALL verificar que nenhum issue é emitido.

---

### Requisito 9 — Corrigir `routeToFilePath` para rotas dinâmicas (T11)

**User Story:** Como utilizador do AI Doctor, quero que a análise de issues em rotas dinâmicas (e.g., `/users/123`) encontre o ficheiro correto no GitHub, para que o Claude receba o código fonte relevante e não um erro 404.

#### Critérios de Aceitação

1. QUANDO `routeToFilePath` recebe uma rota com segmentos numéricos (e.g., `/users/123`), O AI Doctor SHALL normalizar esses segmentos para `[id]` (e.g., `app/users/[id]/page.tsx`).
2. QUANDO `routeToFilePath` recebe uma rota com segmentos UUID (e.g., `/orders/550e8400-e29b-41d4-a716-446655440000`), O AI Doctor SHALL normalizar esses segmentos para `[id]`.
3. QUANDO `routeToFilePath` recebe uma rota de API com segmentos dinâmicos (e.g., `/api/users/123`), O AI Doctor SHALL retornar `app/api/users/[id]/route.ts`.
4. QUANDO `routeToFilePath` recebe uma rota sem segmentos dinâmicos (e.g., `/dashboard`), O AI Doctor SHALL retornar o caminho sem alterações (`app/dashboard/page.tsx`).

---

### Requisito 10 — Adicionar PII sanitization configurável no Agent (T13)

**User Story:** Como developer que usa o Agent em produção, quero poder configurar a redação de PII nos spans antes de serem enviados ao Collector, para que dados sensíveis dos utilizadores não sejam transmitidos nem armazenados.

#### Critérios de Aceitação

1. THE `NextDoctorConfig` SHALL aceitar um campo opcional `piiSanitization` com as propriedades `enabled: boolean`, `redactAttributes?: string[]` e `redactPattern?: RegExp`.
2. QUANDO `piiSanitization.enabled` é `true`, O Agent SHALL aplicar redação nos atributos dos spans antes de os serializar para envio.
3. QUANDO `redactAttributes` contém `'http.url'`, O Agent SHALL substituir o valor do atributo `http.url` por `[REDACTED]` em todos os spans.
4. QUANDO `redactPattern` é definido, O Agent SHALL aplicar a expressão regular ao valor de cada atributo e substituir os matches por `[REDACTED]`.
5. QUANDO `piiSanitization.enabled` é `false` ou o campo não está definido, O Agent SHALL enviar os spans sem qualquer redação.

---

### Requisito 11 — Corrigir documentação do monorepo (T14)

**User Story:** Como novo contribuidor do projeto, quero que o README.md e o DOCTOR.md descrevam a estrutura real do monorepo, para que não perca tempo à procura de diretórios que não existem.

#### Critérios de Aceitação

1. THE `README.md` SHALL descrever a estrutura real do monorepo: `apps/collector`, `apps/dashboard`, `apps/web`, `packages/agent`, `packages/nextdoctor-cli`.
2. THE `README.md` SHALL não referenciar `apps/api`, `apps/marketing` nem `packages/shared` (que não existem).
3. WHERE o ficheiro `DOCTOR.md` existe, THE `DOCTOR.md` SHALL refletir a mesma estrutura correta que o `README.md`.

---

### Requisito 12 — Corrigir comentário enganoso no schema (T15)

**User Story:** Como developer que lê o schema da base de dados, quero que os comentários descrevam corretamente o algoritmo de hash usado, para que não implemente código incorreto baseado em documentação errada.

#### Critérios de Aceitação

1. THE comentário na coluna `tokenHash` da tabela `project_tokens` em `apps/collector/src/db/schema.ts` SHALL indicar `sha256 hash of the raw token` (e não `bcrypt hash`).

---

### Requisito 13 — Resolver singleton DetectionEngine para multi-tenant (T16)

**User Story:** Como operador de uma instância self-hosted com múltiplos projetos, quero que a deduplicação de issues seja isolada por projeto, para que issues de um projeto não suprimam incorretamente issues de outro projeto.

#### Critérios de Aceitação

1. THE chave de deduplicação usada pelo `DetectionEngine` SHALL incluir um identificador de projeto (`projectId`) para além de `id` e `route`.
2. QUANDO dois projetos diferentes geram o mesmo issue na mesma rota, O DetectionEngine SHALL reportar o issue para ambos os projetos sem supressão cruzada.
3. THE interface `IssueDeduplicationKey` em `packages/agent/src/detectors/types.ts` SHALL incluir o campo `projectId?: string`.
4. THE `DetectorContext` SHALL aceitar um campo opcional `projectId: string` que é incluído na chave de deduplicação quando presente.

---

### Requisito 14 — Tornar modelo do AI Doctor configurável (T17)

**User Story:** Como operador do Collector, quero poder configurar o modelo de IA usado pelo AI Doctor via variável de ambiente, para que possa controlar custos e usar modelos mais recentes sem alterar código.

#### Critérios de Aceitação

1. QUANDO a variável de ambiente `AI_DOCTOR_MODEL` está definida, O AI Doctor SHALL usar esse valor como modelo para as chamadas à API da Anthropic.
2. QUANDO `AI_DOCTOR_MODEL` não está definida, O AI Doctor SHALL usar `claude-sonnet-4-5` como modelo por defeito.
3. THE modelo usado SHALL ser persistido no campo `model` da tabela `ai_analyses` para rastreabilidade.

---

### Requisito 15 — Validar versão do Next.js no CLI init (T19)

**User Story:** Como developer que executa `npx @codebaz/nextdoctor init`, quero receber um aviso se a versão do Next.js instalada não suportar o Instrumentation Hook, para que não perca tempo a depurar uma funcionalidade que não está disponível.

#### Critérios de Aceitação

1. QUANDO `runInit` é executado, O CLI SHALL ler a versão do `next` a partir do `package.json` do projeto alvo.
2. IF a versão do `next` é inferior a `13.4.0`, THEN O CLI SHALL emitir um aviso indicando que o Instrumentation Hook não é suportado e que a versão mínima é `13.4.0`.
3. QUANDO a versão do `next` é `13.4.0` ou superior, O CLI SHALL prosseguir sem aviso.
4. IF a versão do `next` não puder ser determinada, THEN O CLI SHALL emitir um aviso genérico e prosseguir.

---

### Requisito 16 — Configurar `next.config.ts` no CLI init para Next.js < 15 (T20)

**User Story:** Como developer com Next.js 13 ou 14, quero que o CLI configure automaticamente `experimental.instrumentationHook: true` no `next.config.js`, para que o Instrumentation Hook seja ativado sem configuração manual.

#### Critérios de Aceitação

1. QUANDO `runInit` deteta que a versão do `next` é inferior a `15.0.0`, O CLI SHALL criar ou modificar `next.config.js` (ou `next.config.ts`) para incluir `experimental: { instrumentationHook: true }`.
2. QUANDO a versão do `next` é `15.0.0` ou superior, O CLI SHALL não modificar o `next.config.js` (a flag não é necessária).
3. IF o ficheiro `next.config.js` já existe e já contém `instrumentationHook: true`, THEN O CLI SHALL não modificar o ficheiro e SHALL registar uma mensagem de skip.
4. QUANDO o ficheiro `next.config.js` é criado ou modificado, O CLI SHALL registar a ação no output do terminal.
