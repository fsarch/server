import { type DynamicModule, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import Joi from "joi";
import { ModuleConfiguration } from "../configuration/module/module-configuration.module.js";
import { AuthService } from "./auth.service.js";
import { AuthGuard } from "./guards/auth.guard.js";
import { JwtJwkAuthModule } from "./jwt-jwk/jwt-jwk-auth.module.js";
import { JWT_JWK_AUTH_CONFIG_VALIDATOR } from "./jwt-jwk/jwt-jwk-auth-config.validator.js";
import { OidcAuthModule } from "./oidc/oidc-auth.module.js";
import { OIDC_AUTH_CONFIG_VALIDATOR } from "./oidc/oidc-auth-config.validator.js";
import { StaticAuthModule } from "./static/static.module.js";
import { STATIC_AUTH_CONFIG_VALIDATOR } from "./static/static-auth-config.validator.js";
import { WellKnownController } from "./well-known.controller.js";

@Module({})
export class AuthModule {
  /**
   * `serviceId`, when set, scopes this registration's `auth` config section
   * to that entry of the top-level `services` array (see
   * `ModuleConfigurationService`) and registers `AuthGuard` as a plain,
   * module-local provider instead of a process-wide `APP_GUARD` — so a
   * mono-service harness can mount several services, each with its own auth
   * strategy, without one guard/config section winning globally for the
   * whole process. Omitted (the default, used by `FsarchModule.register()`
   * for today's single-service-per-process case), behavior is identical to
   * before this parameter existed: `AuthGuard` applies to every route in the
   * process via `APP_GUARD`.
   */
  static register(serviceId?: string): DynamicModule {
    return {
      module: AuthModule,
      controllers: [WellKnownController],
      providers: [
        AuthService,
        ...(serviceId
          ? [AuthGuard]
          : [{ provide: APP_GUARD, useClass: AuthGuard }]),
      ],
      imports: [
        StaticAuthModule.register(serviceId),
        ModuleConfiguration.register("AUTH_CONFIG", {
          validationSchema: Joi.alternatives(
            STATIC_AUTH_CONFIG_VALIDATOR,
            JWT_JWK_AUTH_CONFIG_VALIDATOR,
            OIDC_AUTH_CONFIG_VALIDATOR,
          ),
          name: "auth",
          serviceId,
        }),
        JwtJwkAuthModule.register(serviceId),
        OidcAuthModule.register(serviceId),
      ],
      // `AuthGuard` is only its own exportable provider token in the
      // `serviceId` branch above — in the default branch it's registered
      // under `APP_GUARD`, not under its own class token, so exporting it
      // by class reference here would fail with "cannot export a
      // provider/module that is not part of the currently processed
      // module."
      exports: serviceId ? [AuthService, AuthGuard] : [AuthService],
    };
  }
}
