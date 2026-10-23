import type { Provider, Type } from "@nestjs/common";
import { prefixRoutePath } from "./custom-resource/custom-resource.module.js";

// Metadata keys `@WebSocketGateway()` writes (`@nestjs/websockets`'
// `GATEWAY_METADATA`/`GATEWAY_OPTIONS`/`PORT_METADATA`). Spelled out here
// instead of imported so this package doesn't need `@nestjs/websockets` at
// runtime - only services that actually declare gateways depend on it.
// `gateway-mount.spec.ts` asserts they still match Nest's constants.
export const GATEWAY_METADATA = "websockets:is_gateway";
export const GATEWAY_OPTIONS = "websockets:gateway_options";
export const PORT_METADATA = "port";

function isClassProvider(provider: Provider): provider is Type<any> {
  return typeof provider === "function";
}

/**
 * Moves a `@WebSocketGateway({ path })` provider under a mount's route
 * prefix: `/api/ws` becomes `/<prefix>/api/ws` - the same rule
 * (`prefixRoutePath()`) a harness uses to rewrite a mount's own port onto
 * its prefixed routes, so both doors lead to the same gateway. Nest's
 * `RouterModule` only prefixes controllers, gateway paths are static
 * decorator metadata.
 *
 * Returns `{ provide: Gateway, useClass: <fresh subclass> }`: the subclass
 * carries this mount's own gateway options (the original class stays
 * untouched for other mounts/standalone use), message handlers are
 * inherited, and anything injecting the original class still resolves it.
 * Nest reads gateway options from the provider's `metatype`, which for
 * `useClass` is the subclass.
 *
 * Anything else - non-gateways, non-class providers, gateways on their own
 * port (not served by the app's HTTP server, so not reachable through a
 * mount) - is returned unchanged.
 */
export function prefixGatewayProvider(
  provider: Provider,
  prefix: string,
): Provider {
  if (
    !isClassProvider(provider) ||
    !Reflect.getMetadata(GATEWAY_METADATA, provider) ||
    Reflect.getMetadata(PORT_METADATA, provider)
  ) {
    return provider;
  }

  const options: { path?: string } =
    Reflect.getMetadata(GATEWAY_OPTIONS, provider) ?? {};

  const MountGateway = class extends (provider as Type<any>) {};
  Object.defineProperty(MountGateway, "name", {
    value: `${provider.name}__${prefix}`,
  });
  Reflect.defineMetadata(
    GATEWAY_OPTIONS,
    { ...options, path: prefixRoutePath(options.path ?? "/", prefix) },
    MountGateway,
  );

  return { provide: provider, useClass: MountGateway };
}
