import { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { getRequestFromContext } from './get-request-from-context.util.js';

describe('getRequestFromContext', () => {
  it('reads the request straight off the HTTP arguments host for an http context', () => {
    const request = { headers: {} };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    expect(getRequestFromContext(context)).toBe(request);
  });

  it('reads the raw request off the RPC context for an rpc (MCP tool call) context', () => {
    const rawRequest = { headers: {}, user: { id: 'user1' } };
    const getRawRequest = vi.fn().mockReturnValue(rawRequest);
    const context = {
      getType: () => 'rpc',
      switchToRpc: () => ({ getContext: () => ({ getRawRequest }) }),
    } as unknown as ExecutionContext;

    expect(getRequestFromContext(context)).toBe(rawRequest);
    expect(getRawRequest).toHaveBeenCalled();
  });

  it('returns undefined for an rpc context whose context has no raw request (e.g. stdio)', () => {
    const context = {
      getType: () => 'rpc',
      switchToRpc: () => ({ getContext: () => ({}) }),
    } as unknown as ExecutionContext;

    expect(getRequestFromContext(context)).toBeUndefined();
  });
});
