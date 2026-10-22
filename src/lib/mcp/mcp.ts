import { Controller, type Type } from "@nestjs/common";
import {
  MCP_CONTROLLER_METADATA_KEY,
  McpHttpControllerFor,
  McpStrategy,
  mcpTransportFor,
  StreamableHttpTransport,
} from "@rekog/mcp-nest";
import { CreateMcpStrategyOptions } from "./mcp.types.js";

export const DEFAULT_MCP_ENDPOINT = "/.ai/mcp";

// `@nestjs/microservices`' own metadata keys (same literals `@rekog/mcp-nest`
// uses in its `@McpController({ server })` retagging).
const TRANSPORT_METADATA = "microservices:transport";
const PATTERN_EXTRAS_METADATA = "microservices:pattern_extras";

export function isMcpController(controller: Type<any>): boolean {
  return Reflect.getMetadata(MCP_CONTROLLER_METADATA_KEY, controller) === true;
}

/**
 * Returns a fresh subclass of an `@McpController()` class whose tool/
 * resource/prompt methods are bound to the named MCP server `server` instead
 * of whichever one the class itself was declared for (usually the default,
 * unnamed one).
 *
 * Used by `FsArchAppBuilder.addService()` to give every mounted service its
 * own MCP endpoint: Nest hands each microservice strategy only the handlers
 * whose `microservices:transport` metadata matches that strategy's
 * `transportId` (see `@nestjs/microservices`' `ListenersController`), and
 * `@rekog/mcp-nest` derives that id from the server name. That metadata
 * lives on the *method function* itself, which a plain subclass would still
 * share with its parent (and with every other mount of the same service) -
 * so each MCP method gets its own thin wrapper on the subclass prototype,
 * carrying a copy of the original method's metadata with only the transport
 * swapped. The original class is left untouched, so standalone usage and
 * other mounts are unaffected.
 */
export function bindMcpControllerToServer<T extends Type<any>>(
  controller: T,
  server: string,
): T {
  const transportId = mcpTransportFor(server);

  const Bound = class extends (controller as Type<any>) {};
  Object.defineProperty(Bound, "name", {
    value: `${controller.name}__${server}`,
  });

  let proto = controller.prototype;
  const seen = new Set<string>();
  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === "constructor" || seen.has(key)) {
        continue;
      }
      seen.add(key);

      const original = proto[key];
      if (
        typeof original !== "function" ||
        !Reflect.getMetadata(PATTERN_EXTRAS_METADATA, original)?.mcpType
      ) {
        continue;
      }

      const wrapper = function (this: unknown, ...args: Array<unknown>) {
        return original.apply(this, args);
      };
      for (const metadataKey of Reflect.getOwnMetadataKeys(original)) {
        Reflect.defineMetadata(
          metadataKey,
          Reflect.getOwnMetadata(metadataKey, original),
          wrapper,
        );
      }
      Reflect.defineMetadata(TRANSPORT_METADATA, transportId, wrapper);
      Object.defineProperty(Bound.prototype, key, {
        value: wrapper,
        writable: true,
        configurable: true,
      });
    }
    proto = Object.getPrototypeOf(proto);
  }

  return Bound as T;
}

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
      new StreamableHttpTransport({
        endpoint: endpoint ?? DEFAULT_MCP_ENDPOINT,
      }),
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
