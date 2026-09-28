import { Inject, Injectable, NotImplementedException } from "@nestjs/common";
import { Request } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ConfigJwtJwkAuthType } from "../../configuration/config.type.js";
import { ModuleConfigurationService } from "../../configuration/module/module-configuration.service.js";
import { AuthUnauthorizedException } from "../errors/AuthUnauthorizedException.js";
import { IAuthService } from "../types/auth-service.type.js";
import { User } from "../user.js";

@Injectable()
export class JwtJwkAuthService implements IAuthService {
  private jwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    @Inject("AUTH_CONFIG")
    private readonly authConfigService: ModuleConfigurationService<ConfigJwtJwkAuthType>,
  ) {}

  public async signIn(
    _username: string,
    _password: string,
  ): Promise<{ accessToken: string }> {
    throw new NotImplementedException();
  }

  private async getJwkSet() {
    if (!this.jwkSet) {
      const jwkUrl = this.authConfigService.get("jwkUrl");

      this.jwkSet = createRemoteJWKSet(new URL(jwkUrl));
    }

    return this.jwkSet;
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
}
