import { Controller, Get, NotFoundException, Req } from "@nestjs/common";
import { Public } from "./decorators/public.decorator.js";
import type { Request } from "express";
import { AuthService } from "./auth.service.js";

@Controller('.well-known')
export class WellKnownController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get('oauth-protected-resource')
  async getOAuthProtectedResource(@Req() req: Request) {
    const metadata = await this.authService.getOidcMetadata?.();
    if (!metadata) {
      throw new NotFoundException();
    }

    const proto = this.getRequestProtocol(req);
    const host = this.getRequestHost(req);
    const resource = `${proto}://${host}`;

    const jwksUri = metadata?.jwks_uri;
    const authorizationServers = metadata?.authorization_endpoint
      ? [new URL(metadata.authorization_endpoint).origin]
      : undefined;

    return {
      resource,
      authorization_servers: authorizationServers,
      jwks_uri: jwksUri,
      bearer_methods_supported: ['header'],
      // Deliberately not `metadata.scopes_supported`: that's the *authorization
      // server's* full scope catalog (Keycloak realms typically include
      // internal scopes like `web-origins`, `acr`, `service_account`, ...).
      // Advertising it here means OAuth clients doing Dynamic Client
      // Registration (RFC 7591) against the AS - e.g. an MCP client following
      // this resource's `authorization_servers` link - request that entire
      // set as the new client's `scope`, which Keycloak's "Allowed Client
      // Scopes" registration policy then rejects (403 insufficient_scope) if
      // it doesn't allow all of them for anonymous registration. `openid` is
      // the only scope this resource's guard actually depends on (it just
      // verifies the JWT signature/claims), so that's the baseline we
      // advertise here. `offline_access` (refresh tokens, so MCP clients
      // don't need the user to re-authorize every ~5 min) is added on top
      // only if the authorization server itself lists it as supported -
      // some realms don't enable it, and requesting an unsupported scope
      // during Dynamic Client Registration would just trade one 403 for
      // another.
      scopes_supported: [
        'openid',
        ...(metadata.scopes_supported?.includes('offline_access') ? ['offline_access'] : []),
      ],
    };
  }

  private getRequestProtocol(req: Request): string {
    const forwardedProtoHeader = req.headers['x-forwarded-proto'] as string | undefined;
    if (forwardedProtoHeader && forwardedProtoHeader.length > 0) {
      const first = forwardedProtoHeader.split(',')[0].trim();
      if (first.length > 0) return first;
    }

    if (req.protocol && typeof req.protocol === 'string' && req.protocol.length > 0) {
      return req.protocol;
    }

    if (typeof req.secure === 'boolean' && req.secure) {
      return 'https';
    }

    return 'http';
  }

  private getRequestHost(req: Request): string {
    const forwardedHostHeader = req.headers['x-forwarded-host'] as string | undefined;
    if (forwardedHostHeader && forwardedHostHeader.length > 0) {
      const first = forwardedHostHeader.split(',')[0].trim();
      if (first.length > 0) return first;
    }

    const hostHeader = req.headers['host'] as string | undefined;
    if (hostHeader && hostHeader.length > 0) {
      return hostHeader;
    }

    return 'localhost:8080';
  }
}

