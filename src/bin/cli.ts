#!/usr/bin/env node

import { spawn } from 'child_process';
import { program } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamisch den Pfad zur nest CLI aus den node_modules dieses Pakets finden
// Da @nestjs/cli eine dependency ist, können wir den Pfad zur Binärdatei auflösen
const require = createRequire(import.meta.url);
let nestCliPath: string;

try {
  // Versuche, den Pfad zur @nestjs/cli Binärdatei aufzulösen
  const cliPkgPath = require.resolve('@nestjs/cli/package.json');
  const cliDir = dirname(cliPkgPath);
  // Die nest.js Binärdatei ist normalerweise in ../@nestjs/cli/bin/nest.js
  // von der package.json aus
  nestCliPath = resolve(cliDir, 'bin', 'nest.js');
} catch {
  // Fallback: Versuche den Standardpfad
  nestCliPath = resolve(__dirname, '../../../../node_modules/.bin/nest');
}

program
  .name('fsarch-server')
  .description('CLI to build and start NestJS applications')
  .version('0.1.0');

program
  .command('start')
  .description('Start a NestJS application in the current directory')
  .action(() => {
    console.log('Starting NestJS application...');

    const startProcess = spawn('node', [nestCliPath, 'start', '--watch'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    startProcess.on('error', (error) => {
      console.error('Error starting NestJS application:', error.message);
      process.exit(1);
    });

    startProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`NestJS application exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  });

program
  .command('build')
  .description('Build a NestJS application in the current directory')
  .action(() => {
    console.log('Building NestJS application...');

    const buildProcess = spawn('node', [nestCliPath, 'build'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    buildProcess.on('error', (error) => {
      console.error('Error building NestJS application:', error.message);
      process.exit(1);
    });

    buildProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Build failed with code ${code}`);
        process.exit(code || 1);
      }
      console.log('Build completed successfully');
    });
  });

program.parse(process.argv);
