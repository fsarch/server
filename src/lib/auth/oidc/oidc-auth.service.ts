import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotImplementedException,
} from "@nestjs/common";
import { Request } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ConfigOidcAuthType } from "../../configuration/config.type.js";
import { ModuleConfigurationService } from "../../configuration/module/module-configuration.service.js";
import { AuthUnauthorizedException } from "../errors/AuthUnauthorizedException.js";
import { IAuthService, TOidcMetadata } from "../types/auth-service.type.js";
import { User } from "../user.js";

@Injectable()
export class OidcAuthService implements IAuthService {
  private oidcConfiguration: {
    authorization_endpoint: string;
    jwks_uri: string;
    scopes_supported: Array<string>;
  } | null = null;
  private jwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    @Inject("AUTH_CONFIG")
    private readonly authConfigService: ModuleConfigurationService<ConfigOidcAuthType>,
  ) {}

  private async getOidcConfiguration(): Promise<TOidcMetadata> {
    if (!this.oidcConfiguration) {
      const response = await fetch(this.authConfigService.get("discovery_url"));
      if (!response.ok) {
        throw new HttpException(
          "Failed to fetch OIDC configuration",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      this.oidcConfiguration = (await response.json()) as TOidcMetadata;
    }

    return this.oidcConfiguration;
  }

  private async getJwkSet() {
    if (!this.jwkSet) {
      const configuration = await this.getOidcConfiguration();

      this.jwkSet = createRemoteJWKSet(new URL(configuration.jwks_uri));
    }

    return this.jwkSet;
  }

  public async signIn(
    _username: string,
    _password: string,
  ): Promise<{ accessToken: string }> {
    throw new NotImplementedException();
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }

  public async validateRequest(request: any): Promise<User> {
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new AuthUnauthorizedException();
    }

    const jwkSet = await this.getJwkSet();

    let userId: string | undefined;

    try {
      const jwtData = await jwtVerify(token, jwkSet);

      userId = jwtData.payload.sub;

      request.user = {
        id: userId,
      };
    } catch (error) {
      throw new AuthUnauthorizedException(error);
    }

    return new User({
      id: userId,
      accessToken: token,
    });
  }

  public async getWwwAuthenticateValue() {
    return `Bearer resource_metadata="/.well-known/oauth-protected-resource"`;
  }

  public async getOidcMetadata(): Promise<TOidcMetadata | null> {
    try {
      return await this.getOidcConfiguration();
    } catch (_err) {
      return null;
    }
  }
}
