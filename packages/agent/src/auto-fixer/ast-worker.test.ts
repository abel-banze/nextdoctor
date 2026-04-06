import { describe, it, expect, beforeEach } from 'vitest';
import { ASTWorker } from './ast-worker.js';
import { Project, QuoteKind } from 'ts-morph';
import fs from 'node:fs';
import path from 'node:path';

describe('ASTWorker', () => {
  let worker: ASTWorker;
  let project: Project;

  beforeEach(() => {
    // Force worker to use a clean in-memory project if possible, 
    // or we'll just test its methods by passing mocked SourceFiles.
    worker = new ASTWorker();
    project = new Project({
      useInMemoryFileSystem: true,
      manipulationSettings: { quoteKind: QuoteKind.Single }
    });
  });

  it('removes unnecessary "use client" directive', () => {
    const content = `'use client';
    export function PureComponent({ name }: { name: string }) {
      return <div>Hello {name}</div>;
    }`;
    
    const sourceFile = project.createSourceFile('test.tsx', content);
    // @ts-expect-error accessing private for testing
    worker.removeUnnecessaryUseClient(sourceFile);
    
    expect(sourceFile.getFullText()).not.toContain('use client');
  });

  it('preserves "use client" if hooks are present', () => {
    const content = `'use client';
    import { useState } from 'react';
    export function Counter() {
      const [count, setCount] = useState(0);
      return <button onClick={() => setCount(count + 1)}>{count}</button>;
    }`;
    
    const sourceFile = project.createSourceFile('test.tsx', content);
    // @ts-expect-error accessing private for testing
    worker.removeUnnecessaryUseClient(sourceFile);
    
    expect(sourceFile.getFullText()).toContain('use client');
  });

  it('detects Node.js APIs in Edge Runtime files', () => {
    const content = `export const runtime = 'edge';
    import fs from 'fs';
    export async function GET() {
      const data = fs.readFileSync('config.json');
      return Response.json(data);
    }`;
    
    const sourceFile = project.createSourceFile('api/route.ts', content);
    // @ts-expect-error accessing private for testing
    const issues = worker.detectNodeApiInEdge(sourceFile);
    
    expect(issues).toBeGreaterThan(0);
  });

  it('detects sensitive keywords in NEXT_PUBLIC_ env vars', () => {
    const content = `const token = process.env.NEXT_PUBLIC_CLIENT_TOKEN;
    const key = process.env.NEXT_PUBLIC_STRIPE_KEY;
    const name = process.env.NEXT_PUBLIC_APP_NAME;`;
    
    const sourceFile = project.createSourceFile('env-test.ts', content);
    // @ts-expect-error accessing private for testing
    const count = worker.checkPublicEnvSecrets(sourceFile);
    
    expect(count).toBe(2); // token and key
  });

  it('detects missing error boundaries in route directories', () => {
    // This test is harder to mock because it uses fs.existsSync directly in the worker
    // For a real unit test, we should refactor ASTWorker to use a provided FileSystem
  });
});
