export const METADATA_KEY = {
  ON_DELETION: "fsarch.onDeletion",
};

export const DELETION_EVENT = "fsarch.deletion";

/**
 * DI token for this registration's `{ serviceId?, scopeModule? }` - see
 * `DeletionModule.register()`'s doc comment for why both are needed to make
 * a mono-service mount's purge job safe.
 */
export const DELETION_SCOPE = "FSARCH_DELETION_SCOPE";

/**
 * Namespaces the internal deletion event per mount so one mount's purge job
 * can never trigger a handler that `DeletionExplorer` discovered for a
 * *different* mount. `serviceId` omitted (the default, single-service-per-
 * process case) keeps today's unnamespaced event name unchanged.
 */
export const getDeletionEventName = (serviceId?: string): string =>
  serviceId ? `${DELETION_EVENT}:${serviceId}` : DELETION_EVENT;

/**
 * Namespaces the `SchedulerRegistry` cron job name per mount - two mounted
 * services both calling `addCronJob()` under the same unscoped name would
 * throw ("cron job ... already exists") the second time. `serviceId`
 * omitted keeps today's hardcoded `"metric-purge"` name unchanged.
 */
export const getDeletionCronJobName = (serviceId?: string): string =>
  serviceId ? `deletion-purge:${serviceId}` : "metric-purge";
