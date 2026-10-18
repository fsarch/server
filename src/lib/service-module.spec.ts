import { Test } from "@nestjs/testing";
import {
  getDataSourceToken,
  getRepositoryToken,
  TypeOrmModule,
} from "@nestjs/typeorm";
import { describe, expect, it } from "vitest";
import { Widget } from "./__fixtures__/widget.entity.js";
import { WidgetService } from "./__fixtures__/widget.service.js";
import { createServiceModule } from "./service-module.js";

function sqliteConnection(connectionName?: string) {
  return TypeOrmModule.forRoot({
    ...(connectionName ? { name: connectionName } : {}),
    type: "better-sqlite3",
    database: ":memory:",
    entities: [Widget],
    synchronize: true,
  });
}

describe("createServiceModule", () => {
  it("resolves @InjectRepository()/@InjectDataSource() against the default connection when no connectionName is given", async () => {
    const WidgetModule = createServiceModule({
      entities: [Widget],
      providers: [WidgetService],
      exports: [WidgetService],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [sqliteConnection(), WidgetModule.register()],
    }).compile();

    const service = moduleRef.get(WidgetService);
    expect(service.repository).toBeDefined();
    expect(service.dataSource).toBeDefined();
    expect(service.dataSource.isInitialized).toBe(true);

    await moduleRef.close();
  });

  it("resolves @InjectRepository()/@InjectDataSource() against the named connection when connectionName is given", async () => {
    const connectionName = "widget-mount-a";
    const WidgetModule = createServiceModule({
      entities: [Widget],
      providers: [WidgetService],
      exports: [WidgetService],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        sqliteConnection(connectionName),
        WidgetModule.register({ connectionName }),
      ],
    }).compile();

    const service = moduleRef.get(WidgetService);
    expect(service.dataSource).toBe(
      moduleRef.get(getDataSourceToken(connectionName)),
    );
    // The point of this fix: the module-local, unqualified token must
    // resolve to the *named* connection, not throw "DataSource not found" —
    // there is no default connection registered at all in this test.
    expect(moduleRef.get(getDataSourceToken())).toBe(service.dataSource);

    await service.repository.save({ id: "1", name: "a widget" });
    const found = await service.dataSource
      .getRepository(Widget)
      .findOneBy({ id: "1" });
    expect(found?.name).toBe("a widget");

    await moduleRef.close();
  });

  it("does not register a default-token DataSource/repository provider when no connectionName is given (no redundant/circular provider)", () => {
    const WidgetModule = createServiceModule({
      entities: [Widget],
      providers: [WidgetService],
      exports: [WidgetService],
    });

    const registered = WidgetModule.register();
    const providedTokens = (registered.providers ?? []).map((provider) =>
      typeof provider === "object" && "provide" in provider
        ? provider.provide
        : provider,
    );

    expect(providedTokens).not.toContain(getRepositoryToken(Widget));
    expect(providedTokens).not.toContain(getDataSourceToken());
  });

  it("creates a fresh module class on every register() call", () => {
    const WidgetModule = createServiceModule({ entities: [Widget] });
    const a = WidgetModule.register();
    const b = WidgetModule.register();
    expect(a.module).not.toBe(b.module);
  });
});
