/**
 * Payload emitted by the deletion event
 */
export interface HardDeleteContext {
  /**
   * cutoff date for hard deletion
   * Entries with deletionTime < cutOffDate will be hard deleted
   */
  cutOffDate: Date;
}

export interface HardDeleteEvent {
  getCutOffDate(entity: string): Date;
}
