import { type DynamicModule, Module } from "@nestjs/common";
import { ModuleConfiguration } from "../../configuration/module/module-configuration.module.js";
import { StaticUacService } from "./static.service.js";

@Module({})
export class StaticUacModule {
  static register(serviceId?: string): DynamicModule {
    return {
      module: StaticUacModule,
      providers: [StaticUacService],
      imports: [
        ModuleConfiguration.register("UAC_CONFIG", {
          name: "uac",
          serviceId,
        }),
      ],
      exports: [StaticUacService],
    };
  }
}
