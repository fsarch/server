import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import * as websocketsInternal from "@nestjs/websockets/internal";
import { describe, expect, it } from "vitest";
import { Widget } from "./__fixtures__/widget.entity.js";
import {
  OwnPortGateway,
  RootGateway,
  UsesGateway,
  WorkersGateway,
} from "./__fixtures__/workers.gateway.js";
import {
  GATEWAY_METADATA,
  GATEWAY_OPTIONS,
  PORT_METADATA,
  prefixGatewayProvider,
} from "./gateway-mount.js";
import { createServiceModule } from "./service-module.js";

function gatewayOptions(metatype: Function) {
  return Reflect.getMetadata(GATEWAY_OPTIONS, metatype);
}

describe("prefixGatewayProvider", () => {
  it("uses the same metadata keys as @nestjs/websockets", () => {
    expect(websocketsInternal.GATEWAY_METADATA).toBe(GATEWAY_METADATA);
    expect(websocketsInternal.GATEWAY_OPTIONS).toBe(GATEWAY_OPTIONS);
    expect(websocketsInternal.PORT_METADATA).toBe(PORT_METADATA);
  });

  it("moves a gateway's path under the prefix and keeps its other options", () => {
    const provider = prefixGatewayProvider(WorkersGateway, "frontier") as {
      provide: Function;
      useClass: Function;
    };

    expect(provider.provide).toBe(WorkersGateway);
    expect(gatewayOptions(provider.useClass)).toEqual({
      path: "/frontier/api/workers/websocket",
      transports: "websocket",
    });
    expect(Reflect.getMetadata(GATEWAY_METADATA, provider.useClass)).toBe(true);
    expect(gatewayOptions(WorkersGateway).path).toBe("/api/workers/websocket");
  });

  it("gives each mount its own path", () => {
    const a = prefixGatewayProvider(WorkersGateway, "a") as {
      useClass: Function;
    };
    const b = prefixGatewayProvider(WorkersGateway, "b") as {
      useClass: Function;
    };

    expect(gatewayOptions(a.useClass).path).toBe("/a/api/workers/websocket");
    expect(gatewayOptions(b.useClass).path).toBe("/b/api/workers/websocket");
  });

  it("mounts a gateway without a path at the prefix itself", () => {
    const provider = prefixGatewayProvider(RootGateway, "frontier") as {
      useClass: Function;
    };
    expect(gatewayOptions(provider.useClass).path).toBe("/frontier");
  });

  it("leaves gateways on their own port and non-gateways alone", () => {
    expect(prefixGatewayProvider(OwnPortGateway, "frontier")).toBe(
      OwnPortGateway,
    );
    expect(prefixGatewayProvider(UsesGateway, "frontier")).toBe(UsesGateway);
    const valueProvider = { provide: "X", useValue: 1 };
    expect(prefixGatewayProvider(valueProvider, "frontier")).toBe(
      valueProvider,
    );
  });
});

describe("createServiceModule with routePrefix", () => {
  const GatewayModule = createServiceModule({
    entities: [Widget],
    providers: [WorkersGateway, UsesGateway],
  });

  async function compile(routePrefix?: string) {
    return Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "better-sqlite3",
          database: ":memory:",
          entities: [Widget],
          synchronize: true,
        }),
        GatewayModule.register({ routePrefix }),
      ],
    }).compile();
  }

  it("serves the mounted gateway under the original token with the prefixed path", async () => {
    const moduleRef = await compile("frontier");

    const gateway = moduleRef.get(WorkersGateway);
    expect(gateway).toBeInstanceOf(WorkersGateway);
    expect(gatewayOptions(gateway.constructor).path).toBe(
      "/frontier/api/workers/websocket",
    );
    expect(gateway.ping()).toBe("pong");
    expect(moduleRef.get(UsesGateway).gateway).toBe(gateway);

    await moduleRef.close();
  });

  it("keeps the declared path without a routePrefix", async () => {
    const moduleRef = await compile();

    const gateway = moduleRef.get(WorkersGateway);
    expect(gateway.constructor).toBe(WorkersGateway);

    await moduleRef.close();
  });
});
