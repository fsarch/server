export interface PurgeSchedule {
  cron: string;
  timezone: string;
}

export interface DeletionConfig {
  hard_delete_after_days: number;
  purge_schedule: PurgeSchedule;
}

export interface AppConfig {
  deletion?: DeletionConfig;
}

// Type for the processed/configurable values
export interface ProcessedDeletionConfig {
  hardDeleteAfterDays: number;
  purgeSchedule: PurgeSchedule;
}
