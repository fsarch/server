import { Inject, Injectable } from "@nestjs/common";
import { ConfigAuthType } from "../configuration/config.type.js";
import { ModuleConfigurationService } from "../configuration/module/module-configuration.service.js";
import { JwtJwkAuthService } from "./jwt-jwk/jwt-jwk-auth.service.js";
import { OidcAuthService } from "./oidc/oidc-auth.service.js";
import { StaticAuthService } from "./static/static-auth.service.js";
import { IAuthService, IUser } from "./types/auth-service.type.js";

@Injectable()
export class AuthService implements IAuthService {
  private readonly authService: IAuthService;

  constructor(
    @Inject("AUTH_CONFIG")
    readonly authConfigService: ModuleConfigurationService<ConfigAuthType>,
    readonly staticAuthService: StaticAuthService,
    readonly jwtJwkAuthService: JwtJwkAuthService,
    readonly oidcAuthService: OidcAuthService,
  ) {
    // Reads via the (possibly `serviceId`-scoped) `AUTH_CONFIG` token rather
    // than the global `ConfigService` directly, so this resolves the right
    // mounted service's `auth.type` in a mono-service process instead of
    // always the flat root config.
    const authType = authConfigService.get("type") as ConfigAuthType["type"];

    if (authType === "static") {
      this.authService = staticAuthService;
    } else if (authType === "jwt-jwk") {
      this.authService = jwtJwkAuthService;
    } else if (authType === "oidc") {
      this.authService = oidcAuthService;
    } else {
      throw new Error(`Unsupported auth type: ${authType}`);
    }
  }

  validateRequest(request: any): Promise<IUser> {
    return this.authService.validateRequest(request);
  }

  signIn(username: string, password: string): Promise<{ accessToken: string }> {
    return this.authService.signIn(username, password);
  }

  get getWwwAuthenticateValue() {
    return this.authService.getWwwAuthenticateValue?.bind(this.authService);
  }

  get getOidcMetadata() {
    return this.authService.getOidcMetadata?.bind(this.authService);
  }
}
