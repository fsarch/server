import { type DynamicModule, Global, Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module.js";
import { ConfigurationModule } from "./configuration/configuration.module.js";
import {
  CustomResourceModule,
  type CustomResourceModuleOptions,
} from "./custom-resource/custom-resource.module.js";
import {
  DatabaseModule,
  type DatabaseModuleOptions,
} from "./database/database.module.js";
import { DeletionModule } from "./deletion/deletion.module.js";
import { TracingModule } from "./tracing/tracing.module.js";
import { UacModule } from "./uac/uac.module.js";

type FSArchOptions = {
  auth?: {};
  uac?: {
    roles: Array<string>;
  };
  database?: DatabaseModuleOptions;
  deletion?: {};
  customResource?: CustomResourceModuleOptions;
};

@Global()
@Module({
  imports: [
    ConfigurationModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TracingModule,
  ],
})
export class FsarchModule {
  static register(options: FSArchOptions): DynamicModule {
    const exports: DynamicModule["exports"] = [];
    const imports: DynamicModule["imports"] = [ConfigurationModule];
    if (options.auth) {
      imports.push(AuthModule);
      exports.push(AuthModule);
    }

    if (options.uac) {
      imports.push(UacModule.register(options.uac));
      exports.push(UacModule);
    }

    if (options.database) {
      imports.push(DatabaseModule.register(options.database));
    }

    if (options.deletion) {
      imports.push(DeletionModule.register(options.deletion));
    }

    if (options.customResource) {
      imports.push(CustomResourceModule.forRoot(options.customResource));
    }

    return {
      module: FsarchModule,
      imports,
      exports,
    };
  }
}
