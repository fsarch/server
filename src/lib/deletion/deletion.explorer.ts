import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { METADATA_KEY, DELETION_EVENT } from './constants.js';
import { HardDeleteContext, HardDeleteEvent } from './interfaces/deletion-event.interface.js';

interface DeletionHandlerMetadata {
  entity: string;
}

@Injectable()
export class DeletionExplorer implements OnApplicationBootstrap {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onApplicationBootstrap() {
    try {
      const providers = this.discoveryService.getProviders();

      for (const wrapper of providers) {
        // Safely get instance - skip if not available
        let instance: object | null = null;
        try {
          instance = wrapper.instance ?? null;
        } catch {
          // Some providers may throw when accessing instance (e.g., DataSource)
          continue;
        }

        if (!instance) continue;

        // Skip if instance is not an object
        if (typeof instance !== 'object') continue;

        // Get prototype safely
        let prototype: object | null = null;
        try {
          prototype = Object.getPrototypeOf(instance);
        } catch {
          continue;
        }

        if (!prototype) continue;

        // Get all method names safely
        let methodNames: string[] = [];
        try {
          methodNames = Object.getOwnPropertyNames(prototype);
        } catch {
          continue;
        }

        for (const methodName of methodNames) {
          let methodRef: Function | undefined;
          try {
            methodRef = (instance as Record<string, unknown>)[methodName] as Function | undefined;
          } catch {
            continue;
          }

          if (typeof methodRef !== 'function') continue;

          let metadata: DeletionHandlerMetadata | undefined;
          try {
            metadata = this.reflector.get<DeletionHandlerMetadata>(
              METADATA_KEY.ON_DELETION,
              methodRef,
            );
          } catch {
            continue;
          }

          if (!metadata) continue;

          // Register the method to be called with the typed DeletionEventPayload
          this.eventEmitter.on(
            DELETION_EVENT,
            async (payload: HardDeleteEvent) => {
              try {
                const context: HardDeleteContext = {
                  cutOffDate: payload.getCutOffDate(metadata.entity),
                }

                await Promise.resolve(methodRef.call(instance, context));
              } catch (handlerError) {
                console.error(
                  `Error in @OnHardDeletion('${metadata.entity}') handler:`,
                  handlerError instanceof Error ? handlerError.message : String(handlerError),
                );
              }
            },
          );
        }
      }
    } catch (error) {
      // Log error but don't crash the application
      console.error(
        'Failed to scan for @OnHardDeletion handlers:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
