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
  .addCustomResource({
    id: 'part_attachment',
    name: 'Part Attachment',
    description: 'Attachments of a part',
    apiRoutes: {
      list: {
        request: {
          path: '/parts/{{id}}/attachments',
          method: 'GET',
          auth: { type: 'credential-propagation' },
        },
        enablePagination: true,
      },
      get: {
        request: {
          path: '/parts/{{id}}/attachments/{{id}}',
          method: 'GET',
          auth: { type: 'credential-propagation' },
        },
      },
    },
  })
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
guard and validates `config.yaml`'s `uac` section against the given `roles` list.
Without it, `@Roles(...)` has no runtime effect.

Supported types:

- `static`
- `token-based`

#### `static`

Permissions are assigned per user id in `config.yaml`:

```yaml
uac:
  type: static
  users:
    - user_id: abcdef
      permissions:
        - manage_claims
```

#### `token-based`

Permissions are derived from claims in the caller's (already verified) access
token instead of a static per-user list. Each entry in `mappings` is checked
against the decoded JWT payload and, when it matches, grants its
`permissions` — a plain array of strings, no user list required:

```yaml
uac:
  type: token-based
  mappings:
    # "includes"/"equals" compare the value at `path` against `value`.
    # `path` supports dot notation (e.g. realm_access.roles) and `includes`
    # matches an array element or a substring of a string value.
    - path: realm_access.roles
      operator: includes
      value: 'server:dev'
      permissions:
        - dev
    # "map" grants the permissions of every entry whose `key` is found among
    # the tokens at `path` (array elements, object keys, or the stringified
    # value).
    - path: realm_access.roles
      operator: map
      mappings:
        - key: 'server:admin'
          permissions:
            - manage_claims
            - dev
```

#### Resource-scoped permissions

A permission entry can also be an object naming one or more resource ids it's
scoped to, instead of a plain string. This works the same way under `static`
users and under `token-based` mappings (both the `map` and comparison
shapes):

```yaml
uac:
  type: static
  users:
    - user_id: "7fe12e4a-3763-4930-9234-17bb7ab95613"
      permissions:
        - read_calendar # unscoped — granted for every resource
        - name: write_calendar
          resource:
            - 'calendar-id-1'
            - 'calendar-id-2'
```

A subject can hold the same permission name multiple times with different
resources (they union), and an unscoped occurrence of a name always wins over
scoped ones — the subject then holds that permission for every resource.

`@Roles(...)` can require a specific resource by passing an object whose
`resource` is a resolver evaluated against the current request — see the
controller example under Exports & Usage → UAC below. When the decorator
requirement doesn't specify a resource, any grant of that name — scoped or
not — satisfies it; when it does, only an unscoped grant or one whose
resource list includes the resolved value satisfies it.

Granted resources are read through a `Permission` object, never as a flat
array, obtained either via `user.getPermission(name)` (on the `IUser`/`User`
object, e.g. from `@UserData()`) or via `UacService.getPermission(subjectId,
name, accessToken)` injected directly into your own services (`UacService`
is exported once `.enableUac(...)` is used):

```ts
const permission = await user.getPermission('write_calendar');
permission.isGranted(); // boolean
permission.getResources(); // string[] | null — null means "all resources"
permission.hasResource('calendar-id-1'); // boolean
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
import { Roles, UacService, Permission } from '@fsarch/server/uac';
```

### Tracing

```ts
import { getTracer } from '@fsarch/server/tracing';
```

### MCP

```ts
import { McpController, Tool } from '@fsarch/server/mcp';
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

A resource-scoped requirement mixes freely with plain string ones in the same
`@Roles(...)` call — the `resource` resolver receives the current request:

```ts
@Put(':calendarId')
@UseGuards(AuthGuard)
@Roles({ name: 'write_calendar', resource: (request) => request.params.calendarId })
async updateCalendar(@Param('calendarId') calendarId: string): Promise<void> {
  // only reachable when the caller holds `write_calendar` unscoped, or
  // scoped to this specific `calendarId`
}
```

`UacService` (once `.enableUac(...)` is used) is injectable directly, and
`user.getPermission(name)` is available on the `IUser`/`User` object obtained
via `@UserData()` — both return the same `Permission`:

```ts
@Get()
@UseGuards(AuthGuard)
async listWritableCalendars(@UserData() user: User): Promise<string[]> {
  const permission = await user.getPermission('write_calendar');
  return permission.getResources() ?? []; // null (all resources) → [] here
}
```

### Custom Resource

Registers a `GET /.meta/custom-resources` endpoint that advertises resource types a client can list/fetch via a generic API, without hardcoding their routes. Add one resource at a time via the builder, the same way `addSwagger()` works:

```ts
new FsArchAppBuilder(AppModule, { name: 'My-Service', version: '1.0.0' })
  .addCustomResource({
    id: 'part_attachment',
    name: 'Part Attachment',
    description: 'Attachments of a part',
    apiRoutes: {
      list: {
        request: {
          path: '/parts/{{id}}/attachments',
          method: 'GET',
          auth: { type: 'credential-propagation' },
          queryParams: { type: 'image' },
        },
        enablePagination: true,
      },
      get: {
        request: {
          path: '/parts/{{id}}/attachments/{{id}}',
          method: 'GET',
          auth: { type: 'credential-propagation' },
        },
      },
      search: {
        request: {
          path: '/parts/{{id}}/attachments/search',
          method: 'GET',
          auth: { type: 'credential-propagation' },
          queryParams: { q: '{{query}}' },
        },
        enablePagination: true,
      },
    },
  })
  .build();
```

Each `id` is validated with Joi at bootstrap — it must match `^[a-z0-9_]+$` and be unique across all added resources, otherwise the app fails to start. `path` and `queryParams` values may contain `{{id}}` (the resource instance's own id), `{{$system.crd.[<service-name>].[<custom-resource-id>].id}}` (a reference to another custom resource's id, optionally on another service), or — only within `apiRoutes.search` — `{{query}}` (the caller's search term). These placeholders are served as-is and resolved by the consumer, not by this module. `apiRoutes.search` is optional and, when present, has the same shape as `apiRoutes.list` (`request` + `enablePagination`); `queryParams` (`Record<string, string | string[]>`) is optional on any request and lets you declare structured query parameters instead of hardcoding a query string into `path`.

Without `FsArchAppBuilder`, import `CustomResourceModule` directly from `@fsarch/server/custom-resource` and register it with `CustomResourceModule.forRoot({ resources: [...] })`. See [`src/lib/custom-resource/README.md`](./src/lib/custom-resource/README.md) for the full field reference.

### MCP

Exposes an [MCP](https://modelcontextprotocol.io/) server (tools/resources/prompts) on the same HTTP server, via [`@rekog/mcp-nest`](https://github.com/rekog-labs/MCP-Nest). Enable it with `.enableMcp()`:

```ts
import { FsArchAppBuilder } from '@fsarch/server';

const app = await new FsArchAppBuilder(AppModule, {
  name: 'My-Service',
  version: '1.0.0',
})
  .enableMcp()
  .build();
```

This serves a Streamable HTTP transport at `/.ai/mcp` by default and advertises the `tools` capability; pass `{ endpoint, capabilities, transports }` to override. Define tools on `@McpController()` classes registered as `controllers` in your own modules, using decorators re-exported from `@fsarch/server/mcp` — no need to add `@rekog/mcp-nest` as a direct dependency:

```ts
import { McpController, Tool } from '@fsarch/server/mcp';
import { z } from 'zod';

@McpController()
export class GreetingToolProvider {
  @Tool({
    name: 'greeting-tool',
    description: 'Returns a greeting',
    parameters: z.object({ name: z.string().default('World') }),
  })
  async sayHello({ name }: { name: string }) {
    return { content: [{ type: 'text' as const, text: `Hello, ${name}!` }] };
  }
}
```

See [`src/lib/mcp/README.md`](./src/lib/mcp/README.md) for the full list of re-exported decorators/types and design notes.

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
