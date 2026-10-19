import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { Span } from "../tracing/index.js";
import { DELETION_SCOPE, getDeletionCronJobName, getDeletionEventName } from "./constants.js";
import { DeletionScope } from "./deletion.module.js";
import { ProcessedDeletionConfig } from "./interfaces/deletion-config.interface.js";
import { HardDeleteEvent } from "./interfaces/deletion-event.interface.js";

@Injectable()
export class DeletionService {
  private readonly logger = new Logger(DeletionService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly eventEmitter: EventEmitter2,
    @Inject(DELETION_SCOPE) private readonly scope: DeletionScope,
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

    this.schedulerRegistry.addCronJob(
      getDeletionCronJobName(this.scope.serviceId),
      job,
    );
    job.start();

    this.logger.log(
      `Deletion cron job registered with schedule: ${cron} (timezone: ${timezone})`,
    );
  }

  /**
   * Handle the deletion job - emit typed event with cutoff date
   */
  @Span({
    name: "fsarch.deletion.handleDeletionJob",
  })
  private async handleDeletionJob(
    config: ProcessedDeletionConfig,
  ): Promise<void> {
    this.logger.debug("Running deletion job...");

    const hardDeleteAfterDays = config.hardDeleteAfterDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - hardDeleteAfterDays);

    // Emit typed event for subscribers
    const payload: HardDeleteEvent = {
      getCutOffDate: (_entity: string) => cutoffDate,
    };

    this.eventEmitter.emit(getDeletionEventName(this.scope.serviceId), payload);

    this.logger.log(
      `Deletion event emitted with cutoff date: ${cutoffDate.toISOString()}`,
    );
  }
}
