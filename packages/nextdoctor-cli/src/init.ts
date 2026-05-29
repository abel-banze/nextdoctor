import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import semver from 'semver';

type PackageManager = 'pnpm' | 'npm' | 'yarn';
type HostProvider = 'vercel' | 'self-host';

function detectPackageManager(cwd: string): PackageManager {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) {
    return 'npm';
  }
  return 'pnpm';
}

function runCommand(cmd: string, args: string[], cwd: string): void {
  const child = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (child.error) {
    throw child.error;
  }
  if (child.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function safeWriteFile(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    console.log(`skip: ${path.relative(process.cwd(), filePath)} already exists`);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`created: ${path.relative(process.cwd(), filePath)}`);
}

function assertNextPresent(pkgJson: any): boolean {
  const deps = Object.assign({}, pkgJson.dependencies, pkgJson.devDependencies, pkgJson.peerDependencies);
  return !!deps?.next;
}

function getNextVersion(pkgJson: Record<string, unknown>): string | null {
  const deps = Object.assign(
    {},
    pkgJson.dependencies as Record<string, string> | undefined,
    pkgJson.devDependencies as Record<string, string> | undefined,
    pkgJson.peerDependencies as Record<string, string> | undefined,
  );
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

function configureNextConfig(target: string, pkgJson: Record<string, unknown>): void {
  const version = getNextVersion(pkgJson);
  if (!version || !semver.lt(version, '15.0.0')) return;

  const configTsPath = path.join(target, 'next.config.ts');
  const configJsPath = path.join(target, 'next.config.js');

  const existingPath = fs.existsSync(configTsPath) ? configTsPath
    : fs.existsSync(configJsPath) ? configJsPath
    : null;

  if (existingPath) {
    const content = fs.readFileSync(existingPath, 'utf8');
    if (content.includes('instrumentationHook')) {
      console.log(`skip: instrumentationHook já configurado em ${path.basename(existingPath)}`);
      return;
    }
    // Try to add to existing experimental block
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

  // Create minimal next.config.js
  safeWriteFile(configJsPath, `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
`);
}

function generateInstrumentation(endpoint: string): string {
  return `import { initNextDoctor } from '@codebaz/nextdoctor-agent';

export default async function instrumentation() {
  if (process.env.NODE_ENV === 'development') return;

  await initNextDoctor({
    endpoint: process.env.NEXTDOCTOR_ENDPOINT || '${endpoint}',
    projectToken: process.env.NEXTDOCTOR_PROJECT_TOKEN || 'REPLACE_ME',
  });
}
`;
}

function generateConfig(endpoint: string): string {
  return `import type { NextDoctorConfig } from '@codebaz/nextdoctor-agent';

const config: NextDoctorConfig = {
  projectToken: process.env.NEXTDOCTOR_PROJECT_TOKEN || 'REPLACE_ME',
  endpoint: process.env.NEXTDOCTOR_ENDPOINT || '${endpoint}',
};

export default config;
`;
}

export async function runInit(args: string[]): Promise<void> {
  const target = args[0] ? path.resolve(args[0]) : process.cwd();

  const pkgJsonPath = path.join(target, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    throw new Error(`No package.json found in ${target}. Run this command from a Next.js project root.`);
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  if (!assertNextPresent(pkgJson)) {
    console.warn('warning: next dependency not found. Are you sure this is a Next.js project?');
  }

  const { hosting } = await inquirer.prompt<{ hosting: HostProvider }>([
    {
      type: 'list',
      name: 'hosting',
      message: 'Where will you deploy this Next.js app?',
      choices: [
        { name: 'Vercel (recommended)', value: 'vercel' },
        { name: 'Self-host / custom endpoint', value: 'self-host' },
      ],
      default: 'vercel',
    },
  ]);

  let endpoint = 'https://api-nextdoctor.codebaz.cloud';

  if (hosting === 'self-host') {
    const result = await inquirer.prompt<{ endpoint: string }>([
      {
        type: 'input',
        name: 'endpoint',
        message: 'Self-host ingest endpoint (include https://):',
        default: 'http://localhost:3000/ingest',
        validate(value: string) {
          if (!value || !value.trim()) {
            return 'Please provide a valid endpoint URL.';
          }
          return true;
        },
      },
    ]);

    endpoint = result.endpoint.trim();
  }

  const { installBeta } = await inquirer.prompt<{ installBeta: boolean }>([
    {
      type: 'confirm',
      name: 'installBeta',
      message: 'The nextdoctor-agent is currently in beta. Install the beta version?',
      default: true,
    },
  ]);

  const packageName = installBeta ? '@codebaz/nextdoctor-agent@beta' : '@codebaz/nextdoctor-agent';

  const packageManager = detectPackageManager(target);
  console.log(`Using package manager: ${packageManager}`);

  assertNextVersion(pkgJson);
  configureNextConfig(target, pkgJson);

  const depCommand = packageManager === 'pnpm' 
    ? ['add', packageName] 
    : packageManager === 'yarn' 
      ? ['add', packageName] 
      : ['install', '--save', packageName];
      
  runCommand(packageManager, depCommand, target);

  const instrumentationPath = path.join(target, 'instrumentation.ts');
  safeWriteFile(instrumentationPath, generateInstrumentation(endpoint));

  const configPath = path.join(target, 'nextdoctor.config.ts');
  safeWriteFile(configPath, generateConfig(endpoint));

  console.log('\nNextDoctor initialization complete!');
  console.log('1. Set NEXTDOCTOR_PROJECT_TOKEN in your environment (or replace REPLACE_ME in nextdoctor.config.ts).');
  console.log('2. Deploy your Next.js app and verify instrumentation by checking your ingest endpoint logs.');
}
