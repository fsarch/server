import { Module } from '@nestjs/common';
import { TokenUacService } from './token.service.js';
import { ModuleConfiguration } from '../../configuration/module/module-configuration.module.js';

@Module({
  providers: [TokenUacService],
  imports: [
    ModuleConfiguration.register('UAC_CONFIG', {
      name: 'uac',
    }),
  ],
  exports: [TokenUacService],
})
export class TokenUacModule {}
