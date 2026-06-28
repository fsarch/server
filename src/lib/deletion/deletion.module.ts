import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { DeletionService } from './deletion.service.js';
import { DeletionExplorer } from './deletion.explorer.js';
import { DeletionConfig, ProcessedDeletionConfig } from './interfaces/deletion-config.interface.js';
import { normalizeDeletionConfig } from './deletion.config.js';

@Module({
  imports: [
    DiscoveryModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  providers: [DeletionService, SchedulerRegistry, DeletionExplorer],
  exports: [DeletionService],
})
export class DeletionModule implements OnModuleInit {
  constructor(
    private readonly deletionService: DeletionService,
    private readonly configService: ConfigService,
  ) {}

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
