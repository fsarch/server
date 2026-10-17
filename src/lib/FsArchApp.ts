import {
  type DynamicModule,
  type ForwardReference,
  type INestApplication,
  Module,
  type Type,
  VersioningType,
} from "@nestjs/common";
import { NestFactory, RouterModule } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { EntitySchema } from "typeorm";
import { AuthModule } from "./auth/auth.module.js";
import { AuthService } from "./auth/auth.service.js";
import { AuthExceptionFilter } from "./auth/errors/AuthExceptionFilter.js";
import { AuthGuard } from "./auth/guards/auth.guard.js";
import { TCustomResourceDefinition } from "./custom-resource/custom-resource.types.js";
import { DatabaseModule, DatabaseModuleOptions } from "./database/database.module.js";
import { FsarchModule } from "./fsarch.module.js";
import { PinoLogger } from "./logger/pino-logger.service.js";
import {
  createMcpHttpController,
  createMcpStrategy,
  DEFAULT_MCP_ENDPOINT,
} from "./mcp/mcp.js";
import { McpModuleOptions } from "./mcp/mcp.types.js";
import type { ServiceModule } from "./service-module.js";
import { initializeTracing } from "./tracing/tracing.js";
import { RolesGuard } from "./uac/guards/roles.guard.js";
import { UacModule } from "./uac/uac.module.js";

type SwaggerOptionsType = {
  path?: string;
  title?: string;
  description: string;
  version: string;
  include?: Array<Type<any>>;
};

type IEntryModule = Type<any> | DynamicModule | ForwardReference;

/**
 * What a service package exports for mounting into a mono-service process
 * via `FsArchAppBuilder.addService()` — the frozen equivalent of the
 * `.setDatabase()/.enableAuth()/.enableUac()/.addSwagger()` calls a
 * standalone `main.ts` would make for this same service, now as data so a
 * harness can replay them once per mounted instance instead of once
 * globally for the process. `id` must be unique among mounted services —
 * it's used as the TypeORM connection name, the route prefix, and the
 * `services[].id` config lookup key for this mount.
 */
export type ServiceMountDescriptor = {
  id: string;
  module: ServiceModule;
  entities: Array<Function | EntitySchema>;
  migrations: Array<Function>;
  swagger?: SwaggerOptionsType;
  auth?: boolean;
  uac?: { roles: Array<string> };
};

export class FsArchAppBuilder {
  private swaggerOptions: Array<SwaggerOptionsType> = [];
  private databaseOptions?: DatabaseModuleOptions;
  private authOptions?: {};
  private deletionOptions?: {};
  private uacOptions?: { roles: Array<string> };
  private customResources: Array<TCustomResourceDefinition> = [];
  private mcpOptions?: McpModuleOptions;
  private mountedServices: Array<ServiceMountDescriptor> = [];
  private readonly httpMethods = new Set([
    "get",
    "put",
    "post",
    "delete",
    "options",
    "head",
    "patch",
    "trace",
  ]);

  constructor(
    private readonly baseModule: IEntryModule,
    private readonly info: { name: string; version: string },
  ) {}

  addSwagger(options: SwaggerOptionsType): this {
    this.swaggerOptions.push(options);
    return this;
  }

  setDatabase(databaseOptions: DatabaseModuleOptions) {
    this.databaseOptions = databaseOptions;
    return this;
  }

  enableAuth(): this {
    this.authOptions = {};
    return this;
  }

  enableSoftDeletion(): this {
    this.deletionOptions = {};
    return this;
  }

  enableUac(roles: Array<string>): this {
    this.uacOptions = { roles };
    return this;
  }

  addCustomResource(resource: TCustomResourceDefinition): this {
    this.customResources.push(resource);
    return this;
  }

  enableMcp(options: McpModuleOptions = {}): this {
    this.mcpOptions = options;
    return this;
  }

  /**
   * Mounts another service's package into this process, alongside whatever
   * `baseModule` this builder was constructed with. Each mounted service
   * gets its own named TypeORM connection, its own (optionally isolated)
   * auth/UAC guard, its own route prefix (`descriptor.id`), and its own
   * Swagger doc — see `build()`. Standalone apps that never call this see
   * no behavior change at all.
   */
  addService(descriptor: ServiceMountDescriptor): this {
    this.mountedServices.push(descriptor);
    return this;
  }

  private setUniqueOperationIds(document: {
    paths?: Record<string, Record<string, any>>;
  }) {
    const usedOperationIds = new Set<string>();

    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      for (const [httpMethod, operation] of Object.entries(pathItem ?? {})) {
        if (
          !this.httpMethods.has(httpMethod) ||
          !operation ||
          typeof operation !== "object"
        ) {
          continue;
        }

        const normalizedPath = path
          .replace(/[{}]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

        const baseOperationId = `${httpMethod}_${normalizedPath || "root"}`;
        let operationId = baseOperationId;
        let duplicateCounter = 2;

        while (usedOperationIds.has(operationId)) {
          operationId = `${baseOperationId}_${duplicateCounter}`;
          duplicateCounter += 1;
        }

        operation.operationId = operationId;
        usedOperationIds.add(operationId);
      }
    }
  }

  public async build(): Promise<INestApplication> {
    // NOTE: this is too late to instrument HTTP/Express/Postgres/Nest — by
    // this point the app's own module graph (and this file's own top-level
    // `import { NestFactory } from '@nestjs/core'`) has already loaded those
    // modules unpatched. Real auto-instrumentation requires the
    // `@fsarch/server/register` preload (see src/lib/tracing/register.ts),
    // loaded via `node --import` before the app's entry point. This call
    // still matters for services that skip the preload: it's what makes
    // `getTracer()`/`@Span()`/`withSpan()` and the shutdown-hook wiring below
    // work.
    const tracingEnabled = initializeTracing({
      serviceName: this.info.name,
      serviceVersion: this.info.version,
    });

    const AppModule = this.baseModule;

    // Building the controller here (before `NestFactory.create()`) and
    // registering it below is what puts the MCP route inside Nest's routing
    // pipeline, so the app's global `AuthGuard` (from `.enableAuth()`)
    // actually runs for it — see `createMcpHttpController()`. Skipped only
    // when the caller brought their own `transports` (e.g. stdio-only, or
    // their own auth wiring), in which case behavior is unchanged from
    // before: `createMcpStrategy()` self-mounts whatever was passed.
    const mcpHttp =
      this.mcpOptions && !this.mcpOptions.transports
        ? createMcpHttpController(
            this.mcpOptions.endpoint ?? DEFAULT_MCP_ENDPOINT,
          )
        : undefined;

    // Each mounted service (see `addService()`) gets its own isolated
    // sub-tree: its own named DB connection, and — only if it opts in via
    // `descriptor.auth`/`descriptor.uac` — its own non-global Auth/UAC guard
    // instead of the process-wide `APP_GUARD` that `.enableAuth()`/
    // `.enableUac()` use below. Deliberately NOT routed through
    // `FsarchModule.register()`, which is `@Global()` and designed for
    // exactly one registration per process — composing N of these directly
    // is what keeps them from colliding with each other.
    const mountedServiceModules = this.mountedServices.map((descriptor) => {
      const guards: Array<Type<any>> = [];
      // Imports that must land *inside* `descriptor.module.register()`
      // itself, not just alongside it in `ServiceMountModule` below.
      // `TypeOrmModule.forFeature(entities, connectionName)` (inside
      // `descriptor.module.register()`) needs its *own* module's import
      // tree to resolve the named connection's repository providers from —
      // a sibling import of `DatabaseModule.register()` one level up in
      // `ServiceMountModule` is not visible to it, even though the
      // underlying `TypeOrmCoreModule` is itself `@Global()` (empirically
      // confirmed: moving `DatabaseModule.register()` here, from being a
      // `ServiceMountModule`-level sibling, is what fixed
      // "`ProjectRepository` not available in the `GeneratedServiceModule`
      // module" against the real `frontend-server` package). Same
      // reasoning as `@UseGuards(AuthGuard)` needing `AuthModule.register()`
      // in this same list, just for repositories instead of guards.
      const serviceModuleImports: NonNullable<DynamicModule["imports"]> = [
        DatabaseModule.register(
          {
            entities: descriptor.entities,
            migrations: descriptor.migrations,
          },
          descriptor.id,
        ),
      ];

      if (descriptor.auth) {
        serviceModuleImports.push(AuthModule.register(descriptor.id));
        guards.push(AuthGuard);
      }

      if (descriptor.uac) {
        serviceModuleImports.push(
          UacModule.register(descriptor.uac, descriptor.id),
        );
        guards.push(RolesGuard);
      }

      // `registeredServiceModule.module` is the fresh class
      // `descriptor.module.register()` just created for *this* mount — the
      // one that actually declares the controllers. `RouterModule`'s route
      // prefix and Swagger's `include` scoping both key off this exact
      // class (see `createServiceModule()`'s doc comment for why it must be
      // fresh per mount, not shared), not the wrapper module below.
      const registeredServiceModule = descriptor.module.register({
        connectionName: descriptor.id,
        guards,
        imports: serviceModuleImports,
      });
      const routedModule = registeredServiceModule.module as Type<any>;

      @Module({
        imports: [registeredServiceModule],
      })
      class ServiceMountModule {}

      return { wrapperModule: ServiceMountModule, routedModule };
    });

    @Module({
      imports: [
        AppModule,
        FsarchModule.register({
          auth: this.authOptions,
          database: this.databaseOptions,
          deletion: this.deletionOptions,
          uac: this.uacOptions,
          customResource:
            this.customResources.length > 0
              ? { resources: this.customResources }
              : undefined,
        }),
        ...mountedServiceModules.map(({ wrapperModule }) => wrapperModule),
        ...(mountedServiceModules.length > 0
          ? [
              RouterModule.register(
                this.mountedServices.map((descriptor, index) => ({
                  path: descriptor.id,
                  module: mountedServiceModules[index].routedModule,
                })),
              ),
            ]
          : []),
      ],
      controllers: mcpHttp ? [mcpHttp.controller] : [],
    })
    class FsArchAppModule {}

    const app = await NestFactory.create(FsArchAppModule, {
      logger: PinoLogger.Instance,
    });
    app.enableCors();

    if (tracingEnabled) {
      // Ensures spans are flushed on SIGTERM/SIGINT instead of being dropped
      // when the process exits.
      app.enableShutdownHooks();
    }

    if (this.authOptions) {
      const authService = app.get(AuthService);
      app.useGlobalFilters(new AuthExceptionFilter(authService));
    }

    app.enableVersioning({
      type: VersioningType.URI,
    });

    const swaggerEnabled =
      process.env.NODE_ENV !== "production" ||
      process.env.ENABLE_SWAGGER_DOCS === "true";

    if (swaggerEnabled) {
      for (const {
        path,
        title,
        version,
        description,
        include,
      } of this.swaggerOptions) {
        const config = new DocumentBuilder()
          .setTitle(title ?? this.info.name)
          .setDescription(description)
          .addBearerAuth()
          .setVersion(version)
          .build();
        const document = SwaggerModule.createDocument(
          app,
          config,
          include ? { include } : undefined,
        );
        this.setUniqueOperationIds(document);
        SwaggerModule.setup(path ?? "docs", app, document);
      }

      for (const [index, descriptor] of this.mountedServices.entries()) {
        if (!descriptor.swagger) {
          continue;
        }

        const config = new DocumentBuilder()
          .setTitle(descriptor.swagger.title ?? descriptor.id)
          .setDescription(descriptor.swagger.description ?? "")
          .addBearerAuth()
          .setVersion(descriptor.swagger.version ?? "1.0")
          .build();
        const document = SwaggerModule.createDocument(app, config, {
          include: [mountedServiceModules[index].routedModule],
        });
        this.setUniqueOperationIds(document);
        SwaggerModule.setup(
          descriptor.swagger.path ?? descriptor.id,
          app,
          document,
        );
      }
    }

    if (this.mcpOptions) {
      const mcpStrategy = createMcpStrategy({
        name: this.info.name,
        version: this.info.version,
        ...this.mcpOptions,
        // Serve the exact transport instance the guarded controller
        // delegates to (see above), so the controller isn't left calling
        // into a transport nothing ever started.
        ...(mcpHttp ? { transports: [mcpHttp.transport] } : {}),
      });
      mcpStrategy.setHttpAdapter(app.getHttpAdapter());
      app.connectMicroservice({ strategy: mcpStrategy });
      // Must run before `app.listen()` so the MCP HTTP routes are mounted
      // before the server starts accepting connections.
      await app.startAllMicroservices();
    }

    return app;
  }
}
