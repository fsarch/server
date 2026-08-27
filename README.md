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
`config.yaml` — no code changes required. It instruments HTTP, Express,
Postgres and Nest (guards/interceptors/handlers) and starts before the app is
built, so spans cover the whole request lifecycle.

Supported exporters:

- `console` — prints spans to stdout, useful for local debugging
- `otlp-http` — sends spans to an OTLP/HTTP collector (e.g. an OTel Collector, Grafana Tempo, Honeycomb)
- `otlp-grpc` — sends spans to an OTLP/gRPC collector

Example:

```yaml
tracing:
  enabled: true
  serviceName: my-service # defaults to the `name` passed to FsArchAppBuilder
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

## License

MIT
