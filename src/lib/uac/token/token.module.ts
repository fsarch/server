import { Module } from "@nestjs/common";
import { ModuleConfiguration } from "../../configuration/module/module-configuration.module.js";
import { TokenUacService } from "./token.service.js";

@Module({
  providers: [TokenUacService],
  imports: [
    ModuleConfiguration.register("UAC_CONFIG", {
      name: "uac",
    }),
  ],
  exports: [TokenUacService],
})
export class TokenUacModule {}
