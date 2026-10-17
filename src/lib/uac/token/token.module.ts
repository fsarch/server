import { type DynamicModule, Module } from "@nestjs/common";
import { ModuleConfiguration } from "../../configuration/module/module-configuration.module.js";
import { TokenUacService } from "./token.service.js";

@Module({})
export class TokenUacModule {
  static register(serviceId?: string): DynamicModule {
    return {
      module: TokenUacModule,
      providers: [TokenUacService],
      imports: [
        ModuleConfiguration.register("UAC_CONFIG", {
          name: "uac",
          serviceId,
        }),
      ],
      exports: [TokenUacService],
    };
  }
}
