#!/usr/bin/env node

import { Command } from 'commander';
import { ASTWorker } from '../auto-fixer/ast-worker.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('nextdoctor-agent')
  .description('NextDoctor Agent CLI - Automate performance fixes for Next.js')
  .version('0.1.1-beta.1');

program
  .command('fix')
  .description('Scan and automatically fix common Next.js performance anti-patterns')
  .option('-c, --config <path>', 'Path to tsconfig.json', './tsconfig.json')
  .option('--dry-run', 'Scan for issues without applying fixes')
  .action(async (options) => {
    console.log(chalk.blue('🩺 NextDoctor Agent: Starting automatic fix cycle...'));
    
    try {
      const worker = new ASTWorker(options.config);
      console.log(chalk.gray(`Analyzing project using ${options.config}...`));
      
      const results = await worker.fixAll();
      
      if (results.length === 0) {
        console.log(chalk.green('✅ No typical anti-patterns found to fix. Codebase looks healthy!'));
        return;
      }

      console.log(chalk.yellow(`\nFound and resolved issues in ${results.length} files:`));
      
      results.forEach(res => {
        console.log(`${chalk.green('✔')} ${res.filePath} (${res.fixesApplied} fixes)`);
      });

      console.log(chalk.blue('\n🚀 All fixes applied. Run your tests to verify!'));
    } catch (err) {
      console.error(chalk.red('Unexpected error during fix cycle:'), err);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check the status of the local agent configuration')
  .action(() => {
    console.log(chalk.blue('NextDoctor Agent Status:'));
    console.log(chalk.gray('Version: 0.1.1-beta.1'));
    console.log(chalk.gray('Status: Active'));
  });

program
  .command('setup')
  .description('Interactive wizard to configure the NextDoctor Agent modules')
  .action(async () => {
    const enquirer = await import('enquirer');
    const { MultiSelect, Input } = enquirer.default as any;

    console.log(chalk.blue('\n🩺 NextDoctor Agent: Configuration Wizard\n'));

    try {
      const projectToken = await new Input({
        name: 'token',
        message: 'Qual é o seu Project Token?',
        initial: process.env.NEXTDOCTOR_PROJECT_TOKEN || ''
      }).run();

      const modules = await new MultiSelect({
        name: 'modules',
        message: 'Quais os módulos que deseja ativar?',
        choices: [
          { name: 'db', message: 'Deep Database Tracking (Prisma/Drizzle)', hint: 'N+1 & Slow Queries' },
          { name: 'profiling', message: 'V8 Memory Rescue', hint: 'Auto Heap Snapshots' },
          { name: 'rsc', message: 'RSC Introspection', hint: 'Payload Bloat & Metadata' },
          { name: 'client', message: 'NextDoctorProvider (Client Vitals)', hint: 'Browser Performance' }
        ],
        result(names: string[]) {
          return this.map(names);
        }
      }).run();

      const config = {
        projectToken,
        modules: {
          db: !!modules.db,
          profiling: !!modules.profiling,
          rsc: !!modules.rsc,
          client: !!modules.client
        }
      };

      console.log(chalk.green('\n✅ Configuração gerada com sucesso!'));
      console.log(chalk.gray('Sugestão: Adicione isto ao seu instrumentation.ts:\n'));
      console.log(chalk.white(`await initNextDoctor(${JSON.stringify(config, null, 2)});`));

    } catch (err) {
      console.error(chalk.red('\nSetup cancelado.'));
    }
  });

program.parse();
