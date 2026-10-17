import { type DynamicModule, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ModuleConfiguration } from "../../configuration/module/module-configuration.module.js";
import { ModuleConfigurationService } from "../../configuration/module/module-configuration.service.js";
import { ConfigStaticAuthType } from "../../configuration/config.type.js";
import { StaticAuthService } from "./static-auth.service.js";

@Module({})
export class StaticAuthModule {
  /**
   * `JwtModule.registerAsync()` is `global: true` in the default
   * (no-`serviceId`) case so existing standalone behavior is unchanged. When
   * `serviceId` is set, it's scoped to this module instead — a global
   * registration would mean the *last* mounted service's secret wins for
   * every mount in the process, since `JwtModule`'s own global registration
   * is itself a singleton-per-process mechanism, exactly the thing
   * `serviceId` isolation exists to avoid.
   */
  static register(serviceId?: string): DynamicModule {
    return {
      module: StaticAuthModule,
      imports: [
        JwtModule.registerAsync({
          global: !serviceId,
          imports: [
            ModuleConfiguration.register("AUTH_CONFIG", {
              name: "auth",
              serviceId,
            }),
          ],
          useFactory: async (
            authConfigService: ModuleConfigurationService<ConfigStaticAuthType>,
          ) => ({
            secret: authConfigService.get("secret"),
            signOptions: {
              expiresIn: "2h",
            },
          }),
          inject: ["AUTH_CONFIG"],
        }),
        ModuleConfiguration.register("AUTH_CONFIG", {
          name: "auth",
          serviceId,
        }),
      ],
      providers: [StaticAuthService],
      exports: [StaticAuthService],
    };
  }
}
