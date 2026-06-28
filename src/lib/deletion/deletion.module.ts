import { DynamicModule, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DeletionService } from './deletion.service.js';
import { DeletionExplorer } from './deletion.explorer.js';
import { DeletionConfig } from './interfaces/deletion-config.interface.js';
import { normalizeDeletionConfig } from './deletion.config.js';

type DeletionModuleConfig = {

};

@Module({})
export class DeletionModule implements OnModuleInit {
  constructor(
    private readonly deletionService: DeletionService,
    private readonly configService: ConfigService,
  ) {}

  static register(config: DeletionModuleConfig): DynamicModule {
    return {
      module: DeletionModule,
      imports: [
        DiscoveryModule,
      ],
      providers: [DeletionService, SchedulerRegistry, DeletionExplorer],
      exports: [DeletionService],
    }
  }

  async onModuleInit(): Promise<void> {
    // Get raw config from YAML (snake_case)
    const rawConfig = this.configService.get<DeletionConfig>('deletion');

    // Normalize to camelCase for use in the service
    const config = normalizeDeletionConfig(rawConfig);

    if (config) {
      this.deletionService.setupDeletionJob(config);
    }
  }
}
