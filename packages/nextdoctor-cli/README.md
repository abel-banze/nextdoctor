# `nextdoctor-cli`

`nextdoctor` CLI scaffolds Next.js instrumentation for the NextDoctor agent.

## Install (for development)

```bash
pnpm --filter nextdoctor-cli install
```

## Usage

```bash
npx nextdoctor init
```

or

```bash
npx nextdoctor init /path/to/your/nextjs/project
```

## What it does

- verifies `package.json` and `next` dependency
- installs `@nextdoctor/agent`
- writes `instrumentation.ts`
- writes `nextdoctor.config.ts`
