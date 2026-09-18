import { ExecutionContext } from '@nestjs/common';

/**
 * `AuthGuard`/`RolesGuard` need the underlying Express request regardless of which
 * transport Nest dispatched the call through. HTTP routes give us that directly via
 * `context.switchToHttp()`, but an MCP tool call (`@fsarch/server/mcp`) is dispatched as
 * an RPC-typed execution context — `context.switchToHttp().getRequest()` there returns the
 * tool's call arguments, not a request, because `switchToHttp()` blindly reads `args[0]`
 * regardless of what the transport actually put there. The real Express request (the one
 * `.enableMcp()`'s HTTP controller already ran `AuthGuard` against, with `.user` set) is
 * reachable from the RPC context via `McpContext#getRawRequest()` (a duck-typed method,
 * checked rather than imported, so this stays agnostic of `@rekog/mcp-nest`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRequestFromContext(context: ExecutionContext): any {
  if (context.getType() !== 'rpc') {
    return context.switchToHttp().getRequest();
  }

  const rpcContext = context.switchToRpc().getContext<{ getRawRequest?: () => unknown }>();
  return rpcContext?.getRawRequest?.();
}
