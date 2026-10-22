import { ServerCapabilities } from "@modelcontextprotocol/server";
import { McpTransport } from "@rekog/mcp-nest";

export type McpModuleOptions = {
  /** Defaults to the `name` passed to `FsArchAppBuilder`. */
  name?: string;
  /** Defaults to the `version` passed to `FsArchAppBuilder`. */
  version?: string;
  endpoint?: string;
  capabilities?: ServerCapabilities;
  transports?: McpTransport[];
  instructions?: string;
  title?: string;
  description?: string;
};

export type CreateMcpStrategyOptions = McpModuleOptions & {
  name: string;
  version: string;
  /**
   * Named MCP server this strategy serves (`@rekog/mcp-nest`'s `server`
   * option) - only tools bound to the same name are picked up. Used for
   * per-mount MCP endpoints, see `bindMcpControllerToServer()`.
   */
  server?: string;
};

/**
 * Per-mount equivalent of `.enableMcp()` for `ServiceMountDescriptor.mcp`.
 * No `transports`: a mounted service's MCP endpoint is always the guarded
 * Streamable HTTP controller under its own route prefix.
 */
export type ServiceMcpOptions = Omit<McpModuleOptions, "transports">;
