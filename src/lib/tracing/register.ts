/**
 * Node preload entry point for OpenTelemetry auto-instrumentation.
 *
 * Auto-instrumentation works by hooking `require`/`import` so it can patch a
 * module (`http`, `express`, `pg`, `@nestjs/core`, ...) the first time it is
 * loaded anywhere in the process. That hook has to be installed *before* any
 * of those modules are first loaded — once a module has been loaded
 * unpatched, patching it later has no effect on the already-cached instance.
 *
 * Calling `initializeTracing()` from inside application code (e.g. from
 * `FsArchAppBuilder.build()`) is too late for this: by the time `build()`
 * runs, the app's own static `import` graph — its entry file's
 * `import { AppModule } from './app.module.js'`, its database module, etc. —
 * has already pulled in `@nestjs/core`/`express`/`pg` unpatched, because ESM
 * resolves a file's *entire* static import graph before running any of its
 * top-level code. `FsArchAppBuilder`'s own module does the same thing by
 * importing `NestFactory` from `@nestjs/core` at its top, before `build()`'s
 * body executes.
 *
 * This module has no purpose other than starting tracing as early as
 * possible, so import it *before* the application's own entry point via
 * Node's `--import` flag — that runs it, and only it, before the entry
 * point's module graph loads at all:
 *
 *   node --import @fsarch/server/register dist/main.js
 *
 * or via `NODE_OPTIONS` (e.g. in a Dockerfile `CMD`/`ENTRYPOINT`):
 *
 *   NODE_OPTIONS="--import @fsarch/server/register" node dist/main.js
 *
 * Because this runs before `FsArchAppBuilder` is even constructed, it has no
 * access to the `name`/`version` passed there — set `tracing.serviceName` in
 * `config.yaml`, or the `OTEL_SERVICE_NAME` env var, to name the service.
 *
 * No-op (does not start the NodeSDK) unless `tracing.enabled: true` is set in
 * `config.yaml`, same as calling `initializeTracing()` directly.
 *
 * ## ESM modules (Express, pg, ...)
 *
 * The above only covers modules loaded via CommonJS `require()` — that's
 * what NodeSDK's auto-instrumentation hooks (`require-in-the-middle`) patch.
 * `@nestjs/core` and `@nestjs/platform-express` ship as native ESM
 * (`"type": "module"`), so they load `express` via Node's ESM `import`
 * mechanism instead, which the CommonJS hook never sees — without more,
 * `ExpressInstrumentation` (and `PgInstrumentation`, if the app imports its
 * driver the same way) silently patches nothing, even though tracing starts
 * up fine and HTTP-level spans still show up. Node's ESM equivalent
 * (`import-in-the-middle`) needs to be registered separately via
 * `module.register()`, and — same as the require hook — only affects modules
 * imported *after* it's installed, so it has to happen here, before the
 * app's own module graph (which pulls in `@nestjs/platform-express` /
 * `express`) loads at all.
 */
import { register } from 'node:module';
import { loadConfigFile } from '../configuration/configuration.js';
import { initializeTracing } from './tracing.js';

if (loadConfigFile()?.tracing?.enabled) {
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
}

initializeTracing();
