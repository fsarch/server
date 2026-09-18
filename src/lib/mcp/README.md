# MCP Module

Exposes an [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) server on the same HTTP server as the rest of the app, so AI assistants and other MCP clients can call tools/resources/prompts backed by your existing NestJS services. It is a thin wrapper around [`@rekog/mcp-nest`](https://github.com/rekog-labs/MCP-Nest) — this module wires the strategy into `FsArchAppBuilder` and re-exports the decorators you need, so consumers of `@fsarch/server` never have to add `@rekog/mcp-nest` as a direct dependency themselves.

## Registration

If your app is bootstrapped with `FsArchAppBuilder` (from `@fsarch/server`), use `.enableMcp(options?)` — it wires the strategy in for you, using your service's `name`/`version` from the builder's constructor unless overridden. See the root [README](../../../README.md#mcp) for a full example.

```ts
new FsArchAppBuilder(AppModule, { name: 'My-Service', version: '1.0.0' })
  .enableMcp()
  .build();
```

By default this serves a Streamable HTTP transport at `/.ai/mcp` and advertises the `tools` capability. Both can be overridden:

```ts
.enableMcp({
  endpoint: '/.ai/mcp',
  capabilities: { tools: {}, resources: {} },
})
```

Pass `transports` to fully replace the transport list (e.g. to add a `StdioTransport`, or multiple `StreamableHttpTransport`s).

## Defining tools

Tools (and resources/prompts) live on `@McpController()` classes, the same way HTTP routes live on `@Controller()` classes — register them as `controllers` on any NestJS module that's part of your app's module graph:

```ts
import { McpController, Tool, Ctx, McpContext } from '@fsarch/server/mcp';
import { z } from 'zod';

@McpController()
export class ManufacturerToolProvider {
  constructor(private readonly manufacturerService: ManufacturerService) {}

  @Tool({
    name: 'search_manufacturers',
    description: 'Search manufacturers by name or external ID',
    parameters: z.object({
      search: z.string().optional().describe('Search term'),
    }),
  })
  async searchManufacturers({ search }: { search?: string }) {
    const manufacturers = await this.manufacturerService.ListManufacturers(search);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(manufacturers, null, 2) }],
    };
  }
}
```

`zod` itself is not re-exported (it's a general-purpose schema library, not an MCP-specific decorator) — install it directly if you don't already depend on it.

## Auth & UAC roles on tools

`.enableAuth()`'s `AuthGuard` requires a login for the whole MCP endpoint automatically (see Design
Notes below) — no extra annotation needed for authentication alone.

Per-tool authorization is different: `@fsarch/server/uac`'s `@Roles(...)` (the same decorator used on
`@Post()`/`@Get()` HTTP routes) also works on `@Tool()` methods, but — because `RolesGuard` is
registered globally via `APP_GUARD`, and Nest's global enhancers are not applied to the RPC-typed
execution context MCP tool calls run in — it only takes effect if the `@McpController()` class also
carries an explicit `@UseGuards(AuthGuard, RolesGuard)`, exactly the way HTTP controllers already
spell out `@UseGuards(AuthGuard)` explicitly even though `AuthGuard` is global too:

```ts
import { McpController, Tool } from '@fsarch/server/mcp';
import { AuthGuard } from '@fsarch/server/auth';
import { Roles, RolesGuard } from '@fsarch/server/uac';
import { UseGuards } from '@nestjs/common';
import { z } from 'zod';

@McpController()
@UseGuards(AuthGuard, RolesGuard)
export class ManufacturerToolProvider {
  constructor(private readonly manufacturerService: ManufacturerService) {}

  @Tool({
    name: 'search_manufacturers',
    description: 'Search manufacturers by name or external ID',
    parameters: z.object({ search: z.string().optional() }),
  })
  @Roles('manage_manufacturers')
  async searchManufacturers({ search }: { search?: string }) {
    /* ... */
  }
}
```

Without the explicit `@UseGuards(...)`, `@Roles(...)` on a tool method is silently never enforced —
the tool stays reachable by any authenticated caller regardless of which UAC permissions they hold.

`@rekog/mcp-nest`'s own `@ToolRoles`/`@ToolScopes` are a separate mechanism (they read an
OAuth-scope-shaped `roles`/`scope` claim directly off the authenticated user object, checked
synchronously, no fsarch UAC lookup involved) — prefer fsarch's `@Roles(...)` so tools are governed
by the same `uac:` config as everything else in the service.

## Exports

Everything needed to declare and register MCP tools is available from `@fsarch/server/mcp`, so you never need to import `@rekog/mcp-nest` or `@nestjs/microservices` directly for this:

- Decorators: `McpController`, `Tool`, `Resource`, `ResourceTemplate`, `Prompt`, `PublicTool`, `ToolScopes`, `ToolRoles`, `McpRawRequest`
- Parameter decorators for tool methods: `Ctx`, `Payload` (from `@nestjs/microservices`)
- Types: `ToolOptions`, `ToolMetadata`, `ResourceOptions`, `ResourceMetadata`, `ResourceTemplateOptions`, `ResourceTemplateMetadata`, `PromptOptions`, `PromptMetadata`, `ToolScopesOptions`, `ToolRolesOptions`, `McpControllerOptions`, `SecurityScheme`, `AccessMatchMode`, `ToolInputSchema`, `ToolAnnotations`
- Lower-level primitives, for apps not using `FsArchAppBuilder`: `createMcpStrategy`, `McpStrategy`, `MCP_STRATEGY`, `McpContext`, `StreamableHttpTransport`, `StdioTransport`, and the `McpModuleOptions`/`McpServerOptions`/`McpTransport` types

## Structure

```
src/lib/mcp/
├── mcp.ts        # createMcpStrategy() — builds an @rekog/mcp-nest McpStrategy with fsarch defaults
├── mcp.types.ts  # McpModuleOptions / CreateMcpStrategyOptions
├── index.ts      # public exports (re-exports decorators from @rekog/mcp-nest and @nestjs/microservices)
└── README.md
```

## Design Notes

- There is no NestJS `DynamicModule` here (mirroring `@rekog/mcp-nest` itself, which dropped `McpModule.forRoot()` in favor of a plain `McpStrategy` object): the strategy has to be connected as a microservice on the `INestApplication` instance (`app.connectMicroservice({ strategy })` + `app.startAllMicroservices()`), which `FsArchAppBuilder.build()` does for you when `.enableMcp()` was called. Tool/resource/prompt providers are still registered as ordinary Nest `controllers` in your own modules.
- `.enableMcp()` always uses the builder's `name`/`version` for the MCP server identity, for consistency with tracing (`initializeTracing`) and Swagger, which do the same.
- `AuthGuard`/`RolesGuard` (from `@fsarch/server/auth` and `@fsarch/server/uac`) are transport-aware: on
  an `ExecutionContext` of type `'rpc'` (how `@rekog/mcp-nest` dispatches `@Tool()` calls, since `@Tool()`
  is implemented as a real Nest `@MessagePattern()` handler) they read the request via
  `McpContext#getRawRequest()` instead of `switchToHttp().getRequest()` — the latter would silently
  return the tool's call arguments instead of a request in an RPC context, since `switchToHttp()` just
  reads `args[0]` regardless of what the transport actually put there. `getRawRequest()` returns the
  *same* underlying Express request the outer `McpHttpController` route already ran `AuthGuard` against
  for this call, so `request.user` set there is visible to a guard re-applied explicitly on the tool
  provider. See `getRequestFromContext()` in `src/lib/auth/get-request-from-context.util.ts`.
