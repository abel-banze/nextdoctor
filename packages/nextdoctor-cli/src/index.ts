#!/usr/bin/env node

import { runInit } from './init.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'init') {
    const initArgs = args[0] === 'init' ? args.slice(1) : [];
    await runInit(initArgs);
    return;
  }

  console.log('NextDoctor CLI');
  console.log('Usage: npx nextdoctor init [projectRoot]');
  process.exit(0);
}

main().catch((error) => {
  console.error('nextdoctor: fatal error', error instanceof Error ? error.message : error);
  process.exit(1);
});
