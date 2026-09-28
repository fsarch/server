import { Module } from "@nestjs/common";
import { ModuleConfiguration } from "../../configuration/module/module-configuration.module.js";
import { OidcAuthService } from "./oidc-auth.service.js";

@Module({
  imports: [
    ModuleConfiguration.register("AUTH_CONFIG", {
      name: "auth",
    }),
  ],
  providers: [OidcAuthService],
  exports: [OidcAuthService],
})
export class OidcAuthModule {}
