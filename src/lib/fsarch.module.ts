import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigurationModule } from './configuration/configuration.module.js';
import { UacModule } from './uac/uac.module.js';
import {
  DatabaseModule,
  DatabaseModuleOptions,
} from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { DeletionModule } from "./deletion/deletion.module.js";

type FSArchOptions = {
  auth?: {};
  uac?: {
    roles: Array<string>;
  };
  database?: DatabaseModuleOptions;
  deletion?: {};
};

@Global()
@Module({
  imports: [
    ConfigurationModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
})
export class FsarchModule {
  static register(options: FSArchOptions): DynamicModule {
    const exports: DynamicModule['exports'] = [];
    const imports: DynamicModule['imports'] = [ConfigurationModule];
    if (options.auth) {
      imports.push(AuthModule);
      exports.push(AuthModule);
    }

    if (options.uac) {
      imports.push(UacModule.register(options.uac));
    }

    if (options.database) {
      imports.push(DatabaseModule.register(options.database));
    }

    if (options.deletion) {
      imports.push(DeletionModule.register(options.deletion));
    }

    return {
      module: FsarchModule,
      imports,
      exports,
    };
  }
}
