import { type DynamicModule, Inject, Module, type OnModuleInit, type Type } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DiscoveryModule } from "@nestjs/core";
import { SchedulerRegistry } from "@nestjs/schedule";
import { DELETION_SCOPE } from "./constants.js";
import { normalizeDeletionConfig } from "./deletion.config.js";
import { DeletionExplorer } from "./deletion.explorer.js";
import { DeletionService } from "./deletion.service.js";
import { DeletionConfig } from "./interfaces/deletion-config.interface.js";

type DeletionModuleConfig = {};

export type DeletionScope = {
  serviceId?: string;
  scopeModule?: Type<any>;
};

@Module({})
export class DeletionModule implements OnModuleInit {
  constructor(
    private readonly deletionService: DeletionService,
    private readonly configService: ConfigService,
    @Inject(DELETION_SCOPE) private readonly scope: DeletionScope,
  ) {}

  /**
   * `serviceId`, when set, resolves this registration's `deletion` config
   * section from that entry of the top-level `services` array instead of
   * the flat root config (same `services[].config.<name>` lookup
   * `ModuleConfigurationService` uses for Database/Auth/UAC), and
   * namespaces the purge cron job's name and internal event so this
   * mount's purge job can never trigger another mount's `@OnHardDelete`
   * handlers (see `DeletionService`/`DeletionExplorer`).
   *
   * `scopeModule`, when set, restricts `DeletionExplorer`'s provider
   * discovery to that exact module instead of the whole process -
   * `DiscoveryService.getProviders()` is process-wide by default, so
   * without this, two mounted services' purge jobs would each discover
   * (and register) every `@OnHardDelete` handler in the entire app, not
   * just their own. `createServiceModule()` passes its own freshly-created
   * per-mount module class here when wiring this up.
   *
   * Both omitted (the default, used by `FsarchModule.register()` for
   * today's single-service-per-process case), behavior is identical to
   * before these parameters existed: flat `deletion` config section,
   * unscoped `"metric-purge"` cron job name, process-wide discovery.
   */
  static register(
    _config: DeletionModuleConfig,
    serviceId?: string,
    scopeModule?: Type<any>,
  ): DynamicModule {
    return {
      module: DeletionModule,
      imports: [DiscoveryModule],
      providers: [
        DeletionService,
        SchedulerRegistry,
        DeletionExplorer,
        { provide: DELETION_SCOPE, useValue: { serviceId, scopeModule } },
      ],
      exports: [DeletionService],
    };
  }

  async onModuleInit(): Promise<void> {
    // Get raw config from YAML (snake_case)
    const rawConfig = this.scope.serviceId
      ? this.resolveFromServicesArray(this.scope.serviceId)
      : this.configService.get<DeletionConfig>("deletion");

    // Normalize to camelCase for use in the service
    const config = normalizeDeletionConfig(rawConfig);

    if (config) {
      this.deletionService.setupDeletionJob(config);
    }
  }

  /**
   * Mirrors `ModuleConfigurationService.resolveFromServicesArray()`, but
   * tolerates a missing `deletion` section (returns `undefined` instead of
   * throwing) - deletion is optional even in the standalone, non-scoped
   * case (see the `if (config)` no-op above), so the mounted case must
   * stay equally lenient instead of forcing every mounted service to
   * configure a `deletion:` section it might not need.
   */
  private resolveFromServicesArray(serviceId: string): DeletionConfig | undefined {
    const services =
      this.configService.get<
        Array<{ id: string; config?: Record<string, any> }>
      >("services") ?? [];
    const entry = services.find((service) => service.id === serviceId);
    return entry?.config?.deletion;
  }
}
