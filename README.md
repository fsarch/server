# @fsarch/server

NestJS building blocks for FSArch services: app bootstrap, auth, UAC/roles, pagination DTOs, and configuration loading.

## Installation

```bash
npm install @fsarch/server
```

## Requirements

- Node.js >= 18
- `config.yaml` in the project root (or set a custom path via `CONFIG_FILE_PATH`)

## Quick Start (as used in `bot-protection`)

```ts
import { AppModule } from './app.module.js';
import { FsArchAppBuilder } from '@fsarch/server';
import { DATABASE_OPTIONS } from './database/index.js';

const app = await new FsArchAppBuilder(AppModule, {
  name: 'My-Service',
  version: '1.0.0',
})
  .addSwagger({
    title: 'My-Service',
    description: 'API description',
    version: '1.0.0',
  })
  .enableAuth()
  .enableUac(['manage_claims'])
  .setDatabase(DATABASE_OPTIONS)
  .build();

await app.listen(process.env.PORT ?? 3000);
```

A runnable, minimal version of this is in [`example/`](example/README.md) —
a small REST API consuming this package as a local link (`file:..`).

## Configuration (`config.yaml`)

The library loads configuration from `./config.yaml` by default.
You can provide a different file via `CONFIG_FILE_PATH`.

### Auth

Supported types:

- `static`
- `jwt-jwk`
- `oidc`

Example:

```yaml
auth:
  type: oidc
  discovery_url: https://issuer.example/.well-known/openid-configuration
```

### UAC (roles / permissions)

`@Roles(...)` decorators are only enforced once `.enableUac(roles)` is called on the
`FsArchAppBuilder` (see Quick Start above) — it registers the `RolesGuard` as a global
guard and validates `config.yaml`'s `uac.users[].permissions` against the given `roles`
list. Without it, `@Roles(...)` has no runtime effect.

Currently supported as static UAC configuration:

```yaml
uac:
  type: static
  users:
    - user_id: abcdef
      permissions:
        - manage_claims
```

### Database

Supported types:

- `sqlite`
- `postgres`
- `cockroachdb`

Example:

```yaml
database:
  type: postgres
  host: db-01
  port: 5432
  username: dev
  password: secret
  database: my_service
  ssl:
    rejectUnauthorized: false
```

### Tracing (OpenTelemetry)

Distributed tracing is off by default. Enable it via the `tracing` section of
`config.yaml` — no code changes required.

**You must launch the process with the `@fsarch/server/register` preload for
auto-instrumentation (HTTP, Express, Postgres, Nest guards/interceptors/handlers)
to actually take effect:**

> **Note:** `@opentelemetry/instrumentation-nestjs-core@0.67.0` only supports
> `@nestjs/core` `>=4.0.0 <12`, so it silently no-ops against the `^12` used
> here — no Nest-specific guard/interceptor/handler spans until an upstream
> release adds Nest 12 support. `ExpressInstrumentation` is unaffected and
> still produces router/middleware spans for incoming requests in the
> meantime.

```bash
node --import @fsarch/server/register dist/main.js
```

or via `NODE_OPTIONS` (e.g. in a Dockerfile `CMD`):

```bash
NODE_OPTIONS="--import @fsarch/server/register" node dist/main.js
```

Why this is required: auto-instrumentation patches `http`/`express`/`pg`/
`@nestjs/core` by hooking `require`/`import` the first time each module is
loaded — it has to be in place *before* any of those modules load anywhere in
the process, or the already-loaded, unpatched module stays unpatched. Calling
`initializeTracing()` from your own bootstrap code (which is what
`FsArchAppBuilder.build()` does internally) is too late: ESM resolves a
file's entire static `import` graph before running any of its top-level code,
so by the time `build()` runs, your `main.ts`'s own
`import { AppModule } from './app.module.js'` (and everything that pulls in)
has already loaded those modules unpatched. `--import` runs the preload
before your entry point's module graph loads at all, which is the only point
where patching still works.

Without the preload, tracing still "works" in the sense that `config.yaml`
validates and the SDK starts, but only manual spans
(`getTracer()`/`@Span()`/`withSpan()`) will actually produce data — the auto-
instrumentations won't have patched anything.

Because the preload runs before `FsArchAppBuilder` is constructed, it has no
access to the `name`/`version` you pass there — set `tracing.serviceName` in
`config.yaml` explicitly (or the `OTEL_SERVICE_NAME` env var) when using it.

Supported exporters:

- `console` — prints spans to stdout, useful for local debugging
- `otlp-http` — sends spans to an OTLP/HTTP collector (e.g. an OTel Collector, Grafana Tempo, Honeycomb)
- `otlp-grpc` — sends spans to an OTLP/gRPC collector

Example:

```yaml
tracing:
  enabled: true
  serviceName: my-service # required when using the --import preload; otherwise defaults to the `name` passed to FsArchAppBuilder
  sampler: parentbased_traceidratio # default; see below for the other options
  sampleRatio: 1.0 # 0.0 - 1.0, defaults to 1.0 (trace everything)
  exporter:
    type: otlp-http
    url: http://localhost:4318/v1/traces
    headers:
      Authorization: Bearer secret
```

Supported `sampler` values (mirrors the standard `OTEL_TRACES_SAMPLER` values):

- `parentbased_traceidratio` **(default)** — if the incoming request already
  has a sampling decision (e.g. a `traceparent` header from an upstream
  service), that decision is kept; root spans are sampled at `sampleRatio`
- `parentbased_always_on` / `parentbased_always_off` — same parent-respecting
  behavior, but root spans are always/never sampled
- `traceidratio` — samples every span at `sampleRatio`, **ignoring the parent's
  decision**. Rarely what you want: it can tear a distributed trace apart when
  an upstream service's sampled span has unsampled children here
- `always_on` / `always_off` — trace everything / nothing, ignoring the parent

Stick with a `parentbased_*` sampler unless you have a specific reason not
to — it's what keeps traces intact across service boundaries.

`FsArchAppBuilder.build()` calls `app.enableShutdownHooks()` automatically
when tracing is enabled, so spans are flushed on `SIGTERM`/`SIGINT`.

Manual/custom spans in application code:

```ts
import { getTracer } from '@fsarch/server/tracing';

const tracer = getTracer('my-service');

await tracer.startActiveSpan('do-something', async (span) => {
  try {
    // ...
  } finally {
    span.end();
  }
});
```

For the common case — wrap a whole method in its own span — use `@Span()`
instead. It works on controllers, services, repositories or plain helper
classes, handles sync and async methods, and records thrown/rejected errors
on the span automatically (status + exception event):

```ts
import { Span } from '@fsarch/server/tracing';

@Injectable()
export class ClaimsService {
  @Span() // span name defaults to "ClaimsService.listClaims"
  async listClaims() { ... }

  @Span({ name: 'claims.enrich', attributes: { component: 'claims' } })
  enrich(claim: Claim) { ... }
}
```

To trace an arbitrary block of code that isn't a whole method (e.g. inside a
plain function or a specific branch of a method), use `withSpan()` — it's the
helper `@Span()` is built on:

```ts
import { withSpan } from '@fsarch/server/tracing';

const claims = await withSpan('claims.fetch-from-provider', () => provider.fetch());
```

Both are safe to use even when tracing is disabled: spans are simply no-ops.

## Exports & Usage

### Core

```ts
import { FsArchAppBuilder } from '@fsarch/server';
```

### Auth

```ts
import { AuthGuard, Public, UserData } from '@fsarch/server/auth';
```

### UAC

```ts
import { Roles } from '@fsarch/server/uac';
```

### Tracing

```ts
import { getTracer } from '@fsarch/server/tracing';
```

### Pagination (Swagger + DTO)

```ts
import {
  ApiOkPaginatedResponse,
  PaginationResultDto,
} from '@fsarch/server/pagination';
```

Controller example:

```ts
@Get()
@UseGuards(AuthGuard)
@Roles(Role.manage_claims)
@ApiOkPaginatedResponse(ClaimDto)
async listClaims(): Promise<PaginationResultDto<ClaimDto>> {
  return {
    data: [],
    metadata: {
      currentPage: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
    },
  };
}
```

## CLI

`@fsarch/server` liefert ein CLI-Binary `fsarch-server` mit:
`@fsarch/server` ships a `fsarch-server` CLI binary with:

```bash
fsarch-server build
fsarch-server start
```

Typical scripts:

```json
{
  "scripts": {
    "build": "fsarch-server build",
    "start": "fsarch-server start"
  }
}
```

`fsarch-server start` runs `nest start --watch` for local development and
does not load the tracing preload. For production, run the built output
directly with the preload (see [Tracing](#tracing-opentelemetry)):

```bash
node --import @fsarch/server/register dist/main.js
```

## License

MIT
