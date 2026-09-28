#!/usr/bin/env node

import { type ChildProcess, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { program } from "commander";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamisch den Pfad zur nest CLI aus den node_modules dieses Pakets finden
// Da @nestjs/cli eine dependency ist, können wir den Pfad zur Binärdatei auflösen
const require = createRequire(import.meta.url);
let nestCliPath: string;

try {
  // Versuche, den Pfad zur @nestjs/cli Binärdatei aufzulösen
  const cliPkgPath = require.resolve("@nestjs/cli/package.json");
  const cliDir = dirname(cliPkgPath);
  // Die nest.js Binärdatei ist normalerweise in bin/nest.js
  // von der package.json aus
  nestCliPath = resolve(cliDir, "bin", "nest.js");
} catch {
  // Fallback: Versuche den Standardpfad
  nestCliPath = resolve(__dirname, "../../../../node_modules/.bin/nest");
}

// Exportierbare Funktion zum Testen
export const executeBuild = (cwd?: string): ChildProcess => {
  const buildProcess = spawn("node", [nestCliPath, "build"], {
    stdio: "inherit",
    cwd: cwd || process.cwd(),
  });

  buildProcess.on("error", (_error) => {
    process.exit(1);
  });

  buildProcess.on("close", (code) => {
    if (code !== 0) {
      process.exit(code || 1);
    }
  });

  return buildProcess;
};

// Exportierbare Funktion zum Testen
export const executeStart = (cwd?: string): ChildProcess => {
  const startProcess = spawn("node", [nestCliPath, "start", "--watch"], {
    stdio: "inherit",
    cwd: cwd || process.cwd(),
  });

  startProcess.on("error", (_error) => {
    process.exit(1);
  });

  startProcess.on("close", (code) => {
    if (code !== 0) {
      process.exit(code || 1);
    }
  });

  return startProcess;
};

// Export nestCliPath für Tests
export { nestCliPath };

// CLI-Setup - nur ausführen wenn direkt aufgerufen
program
  .name("fsarch-server")
  .description("CLI to build and start NestJS applications")
  .version("0.1.0");

program
  .command("start")
  .description("Start a NestJS application in the current directory")
  .action(() => {
    executeStart();
  });

program
  .command("build")
  .description("Build a NestJS application in the current directory")
  .action(() => {
    executeBuild();
  });

program.parse(process.argv);
