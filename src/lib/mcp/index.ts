// `@Ctx()`/`@Payload()` are how a tool method reads the call arguments and
// MCP context — re-exported so a tool provider only needs `@fsarch/server/mcp`.
export { Ctx, Payload } from "@nestjs/microservices";
export type {
  AccessMatchMode,
  McpControllerOptions,
  McpServerOptions,
  McpTransport,
  PromptMetadata,
  PromptOptions,
  ResourceMetadata,
  ResourceOptions,
  ResourceTemplateMetadata,
  ResourceTemplateOptions,
  SecurityScheme,
  ToolAnnotations,
  ToolInputSchema,
  ToolMetadata,
  ToolOptions,
  ToolRolesOptions,
  ToolScopesOptions,
} from "@rekog/mcp-nest";
// Decorators used to declare MCP tools/resources/prompts, re-exported so
// consumers never need to depend on `@rekog/mcp-nest` directly.
// The strategy/transport primitives, for consumers who need lower-level
// access than `FsArchAppBuilder.enableMcp()` (e.g. a custom transport list).
export {
  MCP_STRATEGY,
  McpContext,
  McpController,
  McpRawRequest,
  McpStrategy,
  Prompt,
  PublicTool,
  Resource,
  ResourceTemplate,
  StdioTransport,
  StreamableHttpTransport,
  Tool,
  ToolRoles,
  ToolScopes,
} from "@rekog/mcp-nest";
export {
  createMcpHttpController,
  createMcpStrategy,
  DEFAULT_MCP_ENDPOINT,
} from "./mcp.js";
export type {
  CreateMcpStrategyOptions,
  McpModuleOptions,
} from "./mcp.types.js";
