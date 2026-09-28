import { Module } from "@nestjs/common";
import { ModuleConfiguration } from "../../configuration/module/module-configuration.module.js";
import { JwtJwkAuthService } from "./jwt-jwk-auth.service.js";

@Module({
  imports: [
    ModuleConfiguration.register("AUTH_CONFIG", {
      name: "auth",
    }),
  ],
  providers: [JwtJwkAuthService],
  exports: [JwtJwkAuthService],
})
export class JwtJwkAuthModule {}
