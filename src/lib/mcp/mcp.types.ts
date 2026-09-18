import type { ServerCapabilities } from '@modelcontextprotocol/server';
import type { McpTransport } from '@rekog/mcp-nest';

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
};
