import { Controller, Type } from '@nestjs/common';
import {
  McpHttpControllerFor,
  McpStrategy,
  StreamableHttpTransport,
} from '@rekog/mcp-nest';
import { CreateMcpStrategyOptions } from './mcp.types.js';

export const DEFAULT_MCP_ENDPOINT = '/.ai/mcp';

export function createMcpStrategy(
  options: CreateMcpStrategyOptions,
): McpStrategy {
  const { name, version, endpoint, capabilities, transports, ...rest } =
    options;

  return new McpStrategy({
    name,
    version,
    capabilities: capabilities ?? { tools: {} },
    transports: transports ?? [
      new StreamableHttpTransport({ endpoint: endpoint ?? DEFAULT_MCP_ENDPOINT }),
    ],
    ...rest,
  });
}

/**
 * Build a `StreamableHttpTransport` plus a real NestJS `@Controller` bound to
 * it at `endpoint`, instead of letting the transport self-mount.
 *
 * Left alone, `StreamableHttpTransport` mounts its `POST`/`GET`/`DELETE`
 * routes straight onto the HTTP adapter — OUTSIDE Nest's routing pipeline, so
 * no guard (including the app-wide `AuthGuard` `.enableAuth()` registers via
 * `APP_GUARD`) ever runs for it, regardless of any `@ToolScopes()`/
 * `@ToolRoles()` on individual tools. Routing the transport through an
 * ordinary controller instead puts the MCP endpoint back inside Nest's
 * pipeline, so it is protected the same way every other route is.
 * `FsArchAppBuilder.build()` uses this so `.enableMcp()` requires a login
 * whenever `.enableAuth()` is also on.
 *
 * The returned `transport` must be handed back to `createMcpStrategy` (as
 * `transports: [transport]`) so the strategy serves the exact instance the
 * controller delegates to, and `controller` must be registered in the module
 * graph *before* `NestFactory.create()` — that's what makes Nest apply its
 * guards to the route in the first place.
 */
export function createMcpHttpController(endpoint: string): {
  transport: StreamableHttpTransport;
  controller: Type<object>;
} {
  // No `endpoint` option here: the path lives on `@Controller(endpoint)`
  // below. Passing it to the transport too would just trigger its "ignored
  // because a controller owns the route" warning.
  const transport = new StreamableHttpTransport({});

  @Controller(endpoint)
  class McpHttpController extends McpHttpControllerFor(transport) {}

  return { transport, controller: McpHttpController };
}
