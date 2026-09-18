export {
  createMcpStrategy,
  createMcpHttpController,
  DEFAULT_MCP_ENDPOINT,
} from './mcp.js';
export type { McpModuleOptions, CreateMcpStrategyOptions } from './mcp.types.js';

// Decorators used to declare MCP tools/resources/prompts, re-exported so
// consumers never need to depend on `@rekog/mcp-nest` directly.
export {
  McpController,
  Tool,
  Resource,
  ResourceTemplate,
  Prompt,
  PublicTool,
  ToolScopes,
  ToolRoles,
  McpRawRequest,
} from '@rekog/mcp-nest';

export type {
  McpControllerOptions,
  ToolOptions,
  ToolMetadata,
  ToolAnnotations,
  ToolInputSchema,
  SecurityScheme,
  AccessMatchMode,
  ResourceOptions,
  ResourceMetadata,
  ResourceTemplateOptions,
  ResourceTemplateMetadata,
  PromptOptions,
  PromptMetadata,
  ToolScopesOptions,
  ToolRolesOptions,
} from '@rekog/mcp-nest';

// The strategy/transport primitives, for consumers who need lower-level
// access than `FsArchAppBuilder.enableMcp()` (e.g. a custom transport list).
export { McpStrategy, MCP_STRATEGY, McpContext, StreamableHttpTransport, StdioTransport } from '@rekog/mcp-nest';
export type { McpServerOptions, McpTransport } from '@rekog/mcp-nest';

// `@Ctx()`/`@Payload()` are how a tool method reads the call arguments and
// MCP context — re-exported so a tool provider only needs `@fsarch/server/mcp`.
export { Ctx, Payload } from '@nestjs/microservices';
