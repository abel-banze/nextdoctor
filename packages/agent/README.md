# `@codebaz/nextdoctor-agent`

NextDoctor agent for OpenTelemetry tracing and performance monitoring in Next.js applications.

## Installation

```bash
npm install @codebaz/nextdoctor-agent
# or
pnpm add @codebaz/nextdoctor-agent
# or
yarn add @codebaz/nextdoctor-agent
```

## Usage

### Via Next.js Instrumentation Hook

Create `instrumentation.ts` in your Next.js project root:

```typescript
import { initNextDoctor } from '@codebaz/nextdoctor-agent';

export default async function instrumentation() {
  if (process.env.NODE_ENV === 'development') return;

  await initNextDoctor({
    endpoint: process.env.NEXTDOCTOR_ENDPOINT || 'https://ingest.nextdoctor.dev',
    projectToken: process.env.NEXTDOCTOR_PROJECT_TOKEN || 'your-project-token',
  });
}
```

### Configuration

```typescript
interface NextDoctorConfig {
  projectToken: string;  // Your project token
  endpoint: string;      // Ingest endpoint URL
}
```

## Environment Variables

```bash
NEXTDOCTOR_PROJECT_TOKEN=your-project-token
NEXTDOCTOR_ENDPOINT=https://ingest.nextdoctor.dev
```

## What it does

- Automatically instruments your Next.js application with OpenTelemetry
- Captures performance traces and metrics
- Detects Next.js-specific anti-patterns
- Sends data to NextDoctor for analysis

## Requirements

- Next.js 14+
- Node.js 18+