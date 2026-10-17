import { type DynamicModule, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import Joi from "joi";
import { ModuleConfiguration } from "../configuration/module/module-configuration.module.js";
import { RolesGuard } from "./guards/roles.guard.js";
import { StaticUacModule } from "./static/static.module.js";
import { CREATE_STATIC_UAC_CONFIG_VALIDATOR } from "./static/static-uac-config.validator.js";
import { TokenUacModule } from "./token/token.module.js";
import { CREATE_TOKEN_UAC_CONFIG_VALIDATOR } from "./token/token-uac-config.validator.js";
import { UacService } from "./uac.service.js";

@Module({})
export class UacModule {
  /**
   * `serviceId`, when set, scopes the `uac` config section to that entry of
   * the top-level `services` array and registers `RolesGuard` as a plain,
   * module-local provider instead of a process-wide `APP_GUARD` — same
   * rationale as `AuthModule.register()`. Omitted (the default), behavior is
   * unchanged: `RolesGuard` applies to every route in the process.
   */
  static register(
    options: { roles: Array<string> },
    serviceId?: string,
  ): DynamicModule {
    return {
      module: UacModule,
      imports: [
        StaticUacModule.register(serviceId),
        TokenUacModule.register(serviceId),
        ModuleConfiguration.register("UAC_CONFIG", {
          validationSchema: Joi.alternatives(
            CREATE_STATIC_UAC_CONFIG_VALIDATOR(options.roles),
            CREATE_TOKEN_UAC_CONFIG_VALIDATOR(options.roles),
          ),
          name: "uac",
          serviceId,
        }),
      ],
      providers: [
        UacService,
        ...(serviceId
          ? [RolesGuard]
          : [{ provide: APP_GUARD, useClass: RolesGuard }]),
      ],
      // Same reasoning as `AuthModule.register()`: `RolesGuard` is only its
      // own exportable provider token in the `serviceId` branch.
      exports: serviceId ? [UacService, RolesGuard] : [UacService],
    };
  }
}
