import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ModuleConfiguration } from "../../configuration/module/module-configuration.module.js";
import { StaticAuthService } from "./static-auth.service.js";

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("auth.secret"),
        signOptions: {
          expiresIn: "2h",
        },
      }),
      inject: [ConfigService],
    }),
    ModuleConfiguration.register("AUTH_CONFIG", {
      name: "auth",
    }),
  ],
  providers: [StaticAuthService],
  exports: [StaticAuthService],
})
export class StaticAuthModule {}
