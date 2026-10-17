import { type DynamicModule, Module } from "@nestjs/common";
import { ModuleConfiguration } from "../../configuration/module/module-configuration.module.js";
import { OidcAuthService } from "./oidc-auth.service.js";

@Module({})
export class OidcAuthModule {
  static register(serviceId?: string): DynamicModule {
    return {
      module: OidcAuthModule,
      imports: [
        ModuleConfiguration.register("AUTH_CONFIG", {
          name: "auth",
          serviceId,
        }),
      ],
      providers: [OidcAuthService],
      exports: [OidcAuthService],
    };
  }
}
