import { Module } from "@nestjs/common";
import { ModuleConfiguration } from "../../configuration/module/module-configuration.module.js";
import { StaticUacService } from "./static.service.js";

@Module({
  providers: [StaticUacService],
  imports: [
    ModuleConfiguration.register("UAC_CONFIG", {
      name: "uac",
    }),
  ],
  exports: [StaticUacService],
})
export class StaticUacModule {}
