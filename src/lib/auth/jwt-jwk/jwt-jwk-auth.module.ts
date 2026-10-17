import { type DynamicModule, Module } from "@nestjs/common";
import { ModuleConfiguration } from "../../configuration/module/module-configuration.module.js";
import { JwtJwkAuthService } from "./jwt-jwk-auth.service.js";

@Module({})
export class JwtJwkAuthModule {
  static register(serviceId?: string): DynamicModule {
    return {
      module: JwtJwkAuthModule,
      imports: [
        ModuleConfiguration.register("AUTH_CONFIG", {
          name: "auth",
          serviceId,
        }),
      ],
      providers: [JwtJwkAuthService],
      exports: [JwtJwkAuthService],
    };
  }
}
