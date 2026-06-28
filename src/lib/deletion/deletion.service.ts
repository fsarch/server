import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ProcessedDeletionConfig } from './interfaces/deletion-config.interface.js';
import { HardDeleteEvent } from './interfaces/deletion-event.interface.js';
import { DELETION_EVENT } from './constants.js';

@Injectable()
export class DeletionService {
  private readonly logger = new Logger(DeletionService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Setup the deletion cron job with the given configuration
   * @param config Processed deletion configuration
   */
  setupDeletionJob(config: ProcessedDeletionConfig): void {
    const { cron, timezone } = config.purgeSchedule;

    const job = new CronJob(
      cron,
      async () => {
        await this.handleDeletionJob(config);
      },
      null,
      false,
      timezone,
    );

    this.schedulerRegistry.addCronJob('metric-purge', job);
    job.start();

    this.logger.log(
      `Deletion cron job registered with schedule: ${cron} (timezone: ${timezone})`,
    );
  }

  /**
   * Handle the deletion job - emit typed event with cutoff date
   */
  private async handleDeletionJob(config: ProcessedDeletionConfig): Promise<void> {
    this.logger.debug('Running deletion job...');

    const hardDeleteAfterDays = config.hardDeleteAfterDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - hardDeleteAfterDays);

    // Emit typed event for subscribers
    const payload: HardDeleteEvent = {
      getCutOffDate: (entity: string) => cutoffDate,
    };

    this.eventEmitter.emit(DELETION_EVENT, payload);

    this.logger.log(`Deletion event emitted with cutoff date: ${cutoffDate.toISOString()}`);
  }
}
