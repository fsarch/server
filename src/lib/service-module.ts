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
    register(registerOptions: ServiceModuleRegisterOptions = {}): DynamicModule {
      if (registerOptions.guards?.length && options.controllers?.length) {
        for (const controller of options.controllers) {
          UseGuards(...registerOptions.guards)(controller);
        }
      }

      @Module({})
      class GeneratedServiceModule {}

      const staticImports =
        typeof options.imports === "function"
          ? options.imports(registerOptions.connectionName)
          : options.imports ?? [];

      // See the class-level doc comment for why named connections can't
      // just use `TypeOrmModule.forFeature(entities, connectionName)`
      // directly: unqualified `@InjectRepository(Entity)` call sites would
      // never match the connection-qualified token it registers under.
      const repositoryProviders: Array<Provider> = registerOptions.connectionName
        ? options.entities.map((entity) => ({
            provide: getRepositoryToken(entity),
            useFactory: (dataSource: DataSource) =>
              dataSource.getRepository(entity as any),
            inject: [getDataSourceToken(registerOptions.connectionName)],
          }))
        : [];

      return {
        module: GeneratedServiceModule,
        imports: [
          TypeOrmModule.forFeature(
            options.entities,
            registerOptions.connectionName,
          ),
          ...staticImports,
          ...(registerOptions.imports ?? []),
        ],
        controllers: options.controllers ?? [],
        providers: [...(options.providers ?? []), ...repositoryProviders],
        exports: options.exports ?? [],
      };
    },
  };
}
