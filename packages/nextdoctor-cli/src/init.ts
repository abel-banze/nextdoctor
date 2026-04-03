import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';

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

  let endpoint = 'https://ingest.nextdoctor.dev';

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
