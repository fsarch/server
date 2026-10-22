import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EmptyAppModule,
  WhoAmIToolProvider,
} from "./__fixtures__/whoami-tool.provider.js";
import { Widget } from "./__fixtures__/widget.entity.js";
import { WidgetService } from "./__fixtures__/widget.service.js";
import { prefixRoutePath } from "./custom-resource/custom-resource.module.js";
import type { TCustomResourceDefinition } from "./custom-resource/custom-resource.types.js";
import { FsArchAppBuilder } from "./FsArchApp.js";
import { bindMcpControllerToServer } from "./mcp/mcp.js";
import { createServiceModule } from "./service-module.js";

const WidgetServiceModule = createServiceModule({
  entities: [Widget],
  controllers: [WhoAmIToolProvider],
  providers: [WidgetService],
});

const PART_RESOURCE: TCustomResourceDefinition = {
  id: "part",
  name: "Part",
  description: "Parts",
  apiRoutes: {
    list: {
      request: {
        path: "/v1/parts",
        method: "GET",
        auth: { type: "credential-propagation" },
      },
      enablePagination: true,
    },
    get: {
      request: {
        path: "/v1/parts/{{id}}",
        method: "GET",
        auth: { type: "credential-propagation" },
      },
    },
  },
};

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

/** Reads a JSON-RPC response that may come back as plain JSON or as SSE. */
async function readRpcResponse(response: Response): Promise<any> {
  const body = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = body
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .find((line) => line.length > 0);
    return JSON.parse(data ?? "null");
  }
  return JSON.parse(body);
}

async function callMcpTool(baseUrl: string, path: string, tool: string) {
  const initialize = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "service-mount.spec", version: "1.0.0" },
      },
    }),
  });
  expect(initialize.status).toBe(200);
  await readRpcResponse(initialize);
  const sessionId = initialize.headers.get("mcp-session-id");
  const sessionHeaders = {
    ...MCP_HEADERS,
    ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    "mcp-protocol-version": "2025-06-18",
  };

  await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });

  const list = await readRpcResponse(
    await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    }),
  );
  const call = await readRpcResponse(
    await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: tool, arguments: {} },
      }),
    }),
  );

  return {
    tools: (list.result?.tools ?? []).map((t: { name: string }) => t.name),
    text: call.result?.content?.[0]?.text,
  };
}

describe("FsArchAppBuilder.addService() with customResources/mcp", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), "fsarch-service-mount-"));
    const configPath = join(dir, "config.yaml");
    writeFileSync(
      configPath,
      [
        "services:",
        "  - id: mount-a",
        "    config:",
        "      database: { type: sqlite, database: ':memory:' }",
        "  - id: mount-b",
        "    config:",
        "      database: { type: sqlite, database: ':memory:' }",
      ].join("\n"),
    );
    process.env.CONFIG_FILE_PATH = configPath;

    app = await new FsArchAppBuilder(EmptyAppModule, {
      name: "service-mount.spec",
      version: "1.0.0",
    })
      .addService({
        id: "mount-a",
        module: WidgetServiceModule,
        entities: [Widget],
        migrations: [],
        customResources: [PART_RESOURCE],
        mcp: {},
      })
      .addService({
        id: "mount-b",
        module: WidgetServiceModule,
        entities: [Widget],
        migrations: [],
        mcp: {},
      })
      .build();

    await app.listen(0);
    baseUrl = (await app.getUrl()).replace("[::1]", "localhost");
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.CONFIG_FILE_PATH;
  });

  it("serves a mount's custom resources under its own prefix, with apiRoutes paths rewritten to the mounted routes", async () => {
    const response = await fetch(
      `${baseUrl}/v1/mount-a/.meta/custom-resources`,
    );
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].apiRoutes.list.request.path).toBe("/v1/mount-a/parts");
    expect(data[0].apiRoutes.get.request.path).toBe("/v1/mount-a/parts/{{id}}");
    // The descriptor's own definition is left untouched.
    expect(PART_RESOURCE.apiRoutes.list.request.path).toBe("/v1/parts");
  });

  it("serves no custom resources endpoint for a mount that declares none", async () => {
    const response = await fetch(
      `${baseUrl}/v1/mount-b/.meta/custom-resources`,
    );
    expect(response.status).toBe(404);
  });

  it("gives every mount its own MCP endpoint, bound to that mount's instances", async () => {
    const a = await callMcpTool(baseUrl, "/mount-a/.ai/mcp", "whoami");
    const b = await callMcpTool(baseUrl, "/mount-b/.ai/mcp", "whoami");

    expect(a.tools).toEqual(["whoami"]);
    expect(b.tools).toEqual(["whoami"]);
    expect(a.text).toBe("mount-a");
    expect(b.text).toBe("mount-b");
  });

  it("serves no process-wide MCP endpoint when only mounts enable MCP", async () => {
    const response = await fetch(`${baseUrl}/.ai/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: "{}",
    });
    expect(response.status).toBe(404);
  });
});

describe("prefixRoutePath", () => {
  it("inserts the prefix after a leading URI version segment", () => {
    expect(prefixRoutePath("/v1/parts/{{id}}", "mt")).toBe(
      "/v1/mt/parts/{{id}}",
    );
    expect(prefixRoutePath("/v12", "mt")).toBe("/v12/mt");
  });

  it("prefixes unversioned paths", () => {
    expect(prefixRoutePath("/health", "mt")).toBe("/mt/health");
    expect(prefixRoutePath("health", "mt")).toBe("/mt/health");
    expect(prefixRoutePath("/", "mt")).toBe("/mt");
    expect(prefixRoutePath("/version/1", "mt")).toBe("/mt/version/1");
  });
});

describe("bindMcpControllerToServer", () => {
  it("leaves the original class's MCP methods bound to their original transport", () => {
    const transportBefore = Reflect.getMetadata(
      "microservices:transport",
      WhoAmIToolProvider.prototype.whoami,
    );

    const Bound = bindMcpControllerToServer(WhoAmIToolProvider, "some-server");

    expect(Bound.prototype.whoami).not.toBe(
      WhoAmIToolProvider.prototype.whoami,
    );
    expect(
      Reflect.getMetadata(
        "microservices:transport",
        WhoAmIToolProvider.prototype.whoami,
      ),
    ).toBe(transportBefore);
    expect(
      Reflect.getMetadata("microservices:transport", Bound.prototype.whoami),
    ).toBe(Symbol.for("@rekog/mcp-nest:transport:some-server"));
  });
});
