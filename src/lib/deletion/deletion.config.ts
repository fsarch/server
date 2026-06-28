import { DeletionConfig, ProcessedDeletionConfig } from './interfaces/deletion-config.interface.js';

/**
 * Converts YAML config (snake_case) to processed config (camelCase)
 */
export function normalizeDeletionConfig(
  config?: DeletionConfig,
): ProcessedDeletionConfig | null {
  if (!config) {
    return null;
  }

  return {
    hardDeleteAfterDays: config.hard_delete_after_days,
    purgeSchedule: {
      cron: config.purge_schedule.cron,
      timezone: config.purge_schedule.timezone,
    },
  };
}
