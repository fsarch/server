import { SetMetadata } from '@nestjs/common';
import { METADATA_KEY } from './constants.js';
import { HardDeleteContext } from './interfaces/deletion-event.interface.js';

/**
 * Method decorator to subscribe to hard deletion events.
 * Enforces that the method receives a DeletionEventPayload parameter.
 * @param entity - The entity type this handler is responsible for
 * @example
 * ```typescript
 * @OnHardDeletion('metric')
 * handleMetricDeletion(payload: DeletionEventPayload) {
 *   const cutoffDate = payload.getCutOffDate();
 *   // Delete metrics with deletionTime < cutoffDate
 * }
 * ```
 */
export function OnHardDelete(entity: string) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<HardDeleteContext>,
  ) {
    SetMetadata(METADATA_KEY.ON_DELETION, { entity })(target, propertyKey, descriptor);
  };
}

/**
 * Type for deletion event handler methods
 */
export type HardDeleteEventHandler = (payload: HardDeleteContext) => void | Promise<void>;
