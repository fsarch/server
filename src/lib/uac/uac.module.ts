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

@Module({
  imports: [
    StaticUacModule,
    TokenUacModule,
    ModuleConfiguration.register("UAC_CONFIG", {
      name: "uac",
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    UacService,
  ],
  exports: [UacService],
})
export class UacModule {
  static register(options: { roles: Array<string> }): DynamicModule {
    return {
      module: UacModule,
      imports: [
        ModuleConfiguration.register("UAC_CONFIG", {
          validationSchema: Joi.alternatives(
            CREATE_STATIC_UAC_CONFIG_VALIDATOR(options.roles),
            CREATE_TOKEN_UAC_CONFIG_VALIDATOR(options.roles),
          ),
          name: "uac",
        }),
      ],
    };
  }
}
