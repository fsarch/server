import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Joi from "joi";

@Injectable()
export class ModuleConfigurationService<T extends Record<string, any>> {
  private readonly envConfig: T;

  constructor(
    @Inject("CONFIG_OPTIONS") options: Record<string, any>,
    private readonly configService: ConfigService,
  ) {
    const config = options.serviceId
      ? this.resolveFromServicesArray(options.serviceId, options.name)
      : this.configService.get(options.name);
    if (!config) {
      throw new Error(`missing configuration section: ${options.name}`);
    }

    this.envConfig = config;

    const schema = options.validationSchema as Joi.Schema | undefined;

    if (schema) {
      const valid = schema.validate(this.envConfig, {
        abortEarly: false,
      });
      if (valid.error) {
        throw new Error("invalid config");
      }
    }
  }

  get(): T;
  get<TKey extends keyof T>(key: TKey): T[TKey];
  get<TKey extends keyof T>(key?: TKey): T | T[TKey] {
    if (!key) {
      return this.envConfig;
    }

    return this.envConfig[key];
  }

  /**
   * Mono-service support: resolves `sectionName` from the matching entry of
   * the top-level `services` array (`{ id, type, config }`) instead of the
   * flat root config, so N mounted service instances can each keep their own
   * `database`/`auth`/`uac`/... section under one shared `config.yaml`.
   */
  private resolveFromServicesArray(
    serviceId: string,
    sectionName: string,
  ): any {
    const services =
      this.configService.get<
        Array<{ id: string; type?: string; config?: Record<string, any> }>
      >("services") ?? [];
    const entry = services.find((service) => service.id === serviceId);
    if (!entry) {
      throw new Error(
        `missing service entry in "services" config for serviceId: ${serviceId}`,
      );
    }

    // `sectionName` can itself be a dot-path (e.g. an app-level
    // `ModuleConfiguration.register(TOKEN, { name: "storage.data" })` call
    // for a section nested below the standard `database`/`auth`/`uac`
    // ones), matching what `ConfigService.get()` already supports for the
    // non-`serviceId` case — so this traverses `entry.config` the same way
    // instead of a single flat property lookup.
    return sectionName
      .split(".")
      .reduce<any>(
        (value, key) => (value == null ? undefined : value[key]),
        entry.config,
      );
  }
}
