import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';
import { UacService } from '../uac.service.js';
import { User } from '../../auth/user.js';
import { Permission } from '../../auth/permission.js';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

// Simulates how @fsarch/server/mcp dispatches a tool call: an 'rpc'-typed execution context
// whose RPC context exposes the raw HTTP request (the same one AuthGuard already authenticated)
// via getRawRequest(), rather than switchToHttp().getRequest().
function buildRpcContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'rpc',
    switchToRpc: () => ({ getContext: () => ({ getRawRequest: () => request }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows the request through when no roles are required', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const uacService = { hasGrant: vi.fn(), getPermission: vi.fn() } as unknown as UacService;
    const guard = new RolesGuard(reflector, uacService);

    const context = buildContext({ user: new User({ id: 'user1', accessToken: 'token' }) });
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('denies the request when no user is present but roles are required', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['role1']) } as unknown as Reflector;
    const uacService = { hasGrant: vi.fn(), getPermission: vi.fn() } as unknown as UacService;
    const guard = new RolesGuard(reflector, uacService);

    const context = buildContext({});
    expect(await guard.canActivate(context)).toBe(false);
  });

  it('grants access for a plain string role requirement', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['manage_claims']) } as unknown as Reflector;
    const hasGrant = vi.fn().mockResolvedValue(true);
    const uacService = { hasGrant, getPermission: vi.fn() } as unknown as UacService;
    const guard = new RolesGuard(reflector, uacService);

    const context = buildContext({ user: new User({ id: 'user1', accessToken: 'token' }) });
    expect(await guard.canActivate(context)).toBe(true);
    expect(hasGrant).toHaveBeenCalledWith('user1', ['manage_claims'], 'token', undefined);
  });

  it('resolves the resource from the request for an object role requirement', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([
        { name: 'write_calendar', resource: (request: { params: { id: string } }) => request.params.id },
      ]),
    } as unknown as Reflector;
    const hasGrant = vi.fn().mockResolvedValue(true);
    const uacService = { hasGrant, getPermission: vi.fn() } as unknown as UacService;
    const guard = new RolesGuard(reflector, uacService);

    const context = buildContext({
      user: new User({ id: 'user1', accessToken: 'token' }),
      params: { id: 'cal-1' },
    });
    expect(await guard.canActivate(context)).toBe(true);
    expect(hasGrant).toHaveBeenCalledWith('user1', ['write_calendar'], 'token', 'cal-1');
  });

  it('denies access when hasGrant returns false for every requirement', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['role1']) } as unknown as Reflector;
    const hasGrant = vi.fn().mockResolvedValue(false);
    const uacService = { hasGrant, getPermission: vi.fn() } as unknown as UacService;
    const guard = new RolesGuard(reflector, uacService);

    const context = buildContext({ user: new User({ id: 'user1', accessToken: 'token' }) });
    expect(await guard.canActivate(context)).toBe(false);
  });

  it('wires a permission resolver onto the user on every authenticated request', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const permission = Permission.granted('write_calendar', ['cal-1']);
    const getPermission = vi.fn().mockResolvedValue(permission);
    const uacService = { hasGrant: vi.fn(), getPermission } as unknown as UacService;
    const guard = new RolesGuard(reflector, uacService);

    const user = new User({ id: 'user1', accessToken: 'token' });
    const context = buildContext({ user });
    await guard.canActivate(context);

    const resolved = await user.getPermission('write_calendar');
    expect(resolved).toBe(permission);
    expect(getPermission).toHaveBeenCalledWith('user1', 'write_calendar', 'token');
  });

  it('enforces required roles for an MCP tool call (rpc context) the same way as an HTTP request', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['render_pdf']) } as unknown as Reflector;
    const hasGrant = vi.fn().mockResolvedValue(true);
    const uacService = { hasGrant, getPermission: vi.fn() } as unknown as UacService;
    const guard = new RolesGuard(reflector, uacService);

    const context = buildRpcContext({ user: new User({ id: 'user1', accessToken: 'token' }) });
    expect(await guard.canActivate(context)).toBe(true);
    expect(hasGrant).toHaveBeenCalledWith('user1', ['render_pdf'], 'token', undefined);
  });

  it('denies an MCP tool call (rpc context) when the caller lacks the required role', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['render_pdf']) } as unknown as Reflector;
    const hasGrant = vi.fn().mockResolvedValue(false);
    const uacService = { hasGrant, getPermission: vi.fn() } as unknown as UacService;
    const guard = new RolesGuard(reflector, uacService);

    const context = buildRpcContext({ user: new User({ id: 'user1', accessToken: 'token' }) });
    expect(await guard.canActivate(context)).toBe(false);
  });
});
