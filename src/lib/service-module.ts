import {
  type DynamicModule,
  Module,
  type Provider,
  type Type,
  UseGuards,
} from "@nestjs/common";
import {
  getDataSourceToken,
  getRepositoryToken,
  TypeOrmModule,
} from "@nestjs/typeorm";
import { DataSource, EntitySchema } from "typeorm";
import { CustomResourceController } from "./custom-resource/custom-resource.controller.js";
import { validateCustomResources } from "./custom-resource/custom-resource.module.js";
import {
  CUSTOM_RESOURCE,
  CustomResourceService,
} from "./custom-resource/custom-resource.service.js";
import type { TCustomResourceDefinition } from "./custom-resource/custom-resource.types.js";
import { DeletionModule } from "./deletion/deletion.module.js";
import { bindMcpControllerToServer, isMcpController } from "./mcp/mcp.js";

export type ServiceModuleOptions = {
  entities: Array<Function | EntitySchema>;
  controllers?: Array<Type<any>>;
  providers?: Array<Provider>;
  /**
   * Static imports, or a factory keyed by this registration's
   * `connectionName` for imports that themselves need to be mount-aware
   * (e.g. `(connectionName) => [StorageModule.register(connectionName)]` —
   * a sub-module with its own `serviceId`-scoped config section). Standalone
   * callers that never pass `connectionName` still get a correct result:
   * the factory is called with `undefined`, matching that sub-module's own
   * default (unscoped) behavior.
   */
  imports?:
    | NonNullable<DynamicModule["imports"]>
    | ((connectionName?: string) => NonNullable<DynamicModule["imports"]>);
  exports?: NonNullable<DynamicModule["exports"]>;
};

export type ServiceModuleRegisterOptions = {
  /**
   * Named TypeORM connection this module's entities should bind to. Omitted
   * (the default), behavior is identical to a hand-written
   * `TypeOrmModule.forFeature(entities)` against the default connection.
   */
  connectionName?: string;
  /**
   * Guard classes (e.g. `AuthGuard`/`RolesGuard`) to apply to this module's
   * own `controllers`. Only used by a mono-service harness's `.addService()`
   * path — standalone apps rely on the process-wide `APP_GUARD` instead and
   * never pass this. Applying `@UseGuards()` imperatively here (rather than
   * on the controller source itself) is what lets the same controller class
   * work unguarded-by-default standalone and explicitly-guarded when mounted.
   */
  guards?: Array<Type<any>>;
  /**
   * Extra module imports (e.g. `AuthModule.register(serviceId)`) to merge
   * in alongside this module's own `imports` for this particular
   * `register()` call. Guards resolve their own dependencies (e.g.
   * `AuthGuard` needs `AuthService`) from the same module that declares the
   * guarded controller — Nest does *not* look at sibling modules in a
   * parent's import tree — so whichever `AuthModule.register(serviceId)`
   * instance should back a given mount's `guards` must be imported *here*,
   * not just alongside this module in some wrapper module.
   */
  imports?: NonNullable<DynamicModule["imports"]>;
  /**
   * Mirrors `.enableSoftDeletion()` for this particular mount: wires up
   * `DeletionModule.register({}, connectionName, <this module's freshly
   * generated class>)` as one of this module's own imports. Must happen
   * *here*, inside `register()`, rather than being passed in via the
   * `imports` option above — `DeletionExplorer`'s module-scoped discovery
   * (see `DeletionModule.register()`'s doc comment) needs a reference to
   * the exact `GeneratedServiceModule` class this call creates, which
   * doesn't exist yet at the point a caller would otherwise have to build
   * that imports array. Omitted (the default), no `DeletionModule` is
   * added - identical to today.
   */
  deletion?: boolean;
  /**
   * Extra controllers to declare in this particular registration on top of
   * the module's own `controllers` - e.g. the per-mount MCP HTTP controller
   * from `createMcpHttpController()`. Declared in the generated module
   * itself (not in a wrapper) so `RouterModule`'s mount prefix and the
   * `guards` above apply to them too.
   */
  controllers?: Array<Type<any>>;
  /**
   * Binds this module's `@McpController()` classes to the named MCP server
   * `mcpServer` (see `bindMcpControllerToServer()`), so a per-mount MCP
   * strategy created with that same `server` name serves exactly this
   * mount's tools. Omitted (the default), MCP controllers are declared as-is
   * and bound to whatever server they were declared for - identical to
   * today.
   */
  mcpServer?: string;
  /**
   * Mirrors `.addCustomResource()` for this particular mount: serves these
   * definitions from this module's own custom-resources controller (so at
   * `/v1/<mount prefix>/.meta/custom-resources` - Nest puts the URI version
   * in front of `RouterModule`'s prefix), behind this mount's `guards`.
   * Served verbatim - rewriting `apiRoutes` paths to the mount's actual
   * routes is the caller's job (see `prefixCustomResourceRoutes()`).
   */
  customResources?: Array<TCustomResourceDefinition>;
};

export type ServiceModule = {
  register(options?: ServiceModuleRegisterOptions): DynamicModule;
};

/**
 * Builds a Nest feature module from data instead of requiring a service
 * package to hand-write its own `@Module()`/`DynamicModule` and import
 * `@nestjs/typeorm` itself. The generated module's `register()` binds
 * `options.entities` to whichever TypeORM connection (`connectionName`) the
 * caller chooses — this is the one piece of boilerplate every fsarch service
 * package would otherwise repeat verbatim.
 *
 * Standalone usage (today's behavior, unchanged): `MyModule.register()` with
 * no arguments binds to the default connection, no guards applied.
 *
 * Mono-service usage: a harness calls
 * `MyModule.register({ connectionName: id, guards: [AuthGuard] })` once per
 * mounted instance.
 *
 * Note on `connectionName`: `@InjectRepository(Entity)` (no second arg, the
 * form used by every existing fsarch service's source code) *always*
 * resolves the *default*-connection repository token — `@nestjs/typeorm`
 * bakes that in at the decorator call site
 * (`InjectRepository = (entity, dataSource = DEFAULT_DATA_SOURCE_NAME) => ...`),
 * regardless of which connection name the surrounding `forFeature()` call
 * used. So `TypeOrmModule.forFeature(entities, connectionName)` alone would
 * register repositories under a *connection-qualified* token that an
 * unqualified `@InjectRepository(Entity)` consumer can never match — a real,
 * empirically-found failure mode ("`Cannot resolve dependency
 * WidgetRepository`"), not a hypothetical one. The fix below sidesteps it:
 * when `connectionName` is set, this registers one custom provider per
 * entity directly under the *default* (unqualified) repository token —
 * exactly what `@InjectRepository(Entity)` looks up — but scoped to *this*
 * module instance only (not global), so each mount's default-token
 * provider resolves its own named `DataSource` without colliding with any
 * other mount's. Existing service source code needs no `connectionName`
 * awareness at all.
 *
 * Each `register()` call creates a *brand-new* module class rather than
 * reusing one shared class across calls. This matters specifically for
 * mounting the *same* service package twice in one process (e.g. two
 * `frontend-server` instances): Nest's `RouterModule` attaches each mount's
 * route-prefix as `Reflect` metadata keyed by the module *class reference*
 * (see `@nestjs/core`'s `router-module.js`), and applies a module's prefix
 * only to controllers declared directly in that exact module — not
 * recursively to children. Two mounts sharing one class would mean the
 * second mount's prefix metadata silently overwrites the first's on the
 * same class, and Nest's lookup for "which container entry does this class
 * belong to" would then resolve ambiguously between the two mounted
 * instances. A fresh class per call sidesteps both problems.
 */
export function createServiceModule(
  options: ServiceModuleOptions,
): ServiceModule {
  return {
    register(
      registerOptions: ServiceModuleRegisterOptions = {},
    ): DynamicModule {
      const { mcpServer } = registerOptions;
      const ownControllers = (options.controllers ?? []).map((controller) =>
        mcpServer && isMcpController(controller)
          ? bindMcpControllerToServer(controller, mcpServer)
          : controller,
      );

      // Fresh subclass for the same reason as `bindMcpControllerToServer()`:
      // the guards below are applied by mutating the class, and
      // `CustomResourceController` itself is shared with every other mount
      // and with standalone `.addCustomResource()` usage.
      const customResourceControllers: Array<Type<any>> = [];
      const customResourceProviders: Array<Provider> = [];
      if (registerOptions.customResources?.length) {
        validateCustomResources(registerOptions.customResources);
        customResourceControllers.push(
          class MountCustomResourceController extends CustomResourceController {},
        );
        customResourceProviders.push(
          {
            provide: CUSTOM_RESOURCE,
            useValue: registerOptions.customResources,
          },
          CustomResourceService,
        );
      }

      const controllers = [
        ...ownControllers,
        ...customResourceControllers,
        ...(registerOptions.controllers ?? []),
      ];

      if (registerOptions.guards?.length) {
        for (const controller of controllers) {
          UseGuards(...registerOptions.guards)(controller);
        }
      }

      @Module({})
      class GeneratedServiceModule {}

      const staticImports =
        typeof options.imports === "function"
          ? options.imports(registerOptions.connectionName)
          : (options.imports ?? []);

      // See the class-level doc comment for why named connections can't
      // just use `TypeOrmModule.forFeature(entities, connectionName)`
      // directly: unqualified `@InjectRepository(Entity)` call sites would
      // never match the connection-qualified token it registers under.
      const repositoryProviders: Array<Provider> =
        registerOptions.connectionName
          ? options.entities.map((entity) => ({
              provide: getRepositoryToken(entity),
              useFactory: (dataSource: DataSource) =>
                dataSource.getRepository(entity as any),
              inject: [getDataSourceToken(registerOptions.connectionName)],
            }))
          : [];

      // Same reasoning as `repositoryProviders` above, but for services that
      // inject the `DataSource` itself via `@InjectDataSource()` (no second
      // arg) instead of going through a repository — that decorator also
      // always resolves the *default*-connection token.
      const dataSourceProviders: Array<Provider> =
        registerOptions.connectionName
          ? [
              {
                provide: getDataSourceToken(),
                useFactory: (dataSource: DataSource) => dataSource,
                inject: [getDataSourceToken(registerOptions.connectionName)],
              },
            ]
          : [];

      const deletionImports: Array<DynamicModule> = registerOptions.deletion
        ? [
            DeletionModule.register(
              {},
              registerOptions.connectionName,
              GeneratedServiceModule,
            ),
          ]
        : [];

      return {
        module: GeneratedServiceModule,
        imports: [
          TypeOrmModule.forFeature(
            options.entities,
            registerOptions.connectionName,
          ),
          ...staticImports,
          ...deletionImports,
          ...(registerOptions.imports ?? []),
        ],
        controllers,
        providers: [
          ...(options.providers ?? []),
          ...repositoryProviders,
          ...dataSourceProviders,
          ...customResourceProviders,
        ],
        exports: options.exports ?? [],
      };
    },
  };
}
