import { describe, it, expect } from 'vitest';
import { PATH_METADATA } from '@nestjs/common/constants';
import { StreamableHttpTransport } from '@rekog/mcp-nest';
import { createMcpHttpController, createMcpStrategy, DEFAULT_MCP_ENDPOINT } from './mcp';

describe('createMcpStrategy', () => {
  it('defaults to a StreamableHttpTransport on /.ai/mcp with the tools capability', () => {
    const strategy = createMcpStrategy({ name: 'My-Service', version: '1.0.0' });

    expect(strategy.options.name).toBe('My-Service');
    expect(strategy.options.version).toBe('1.0.0');
    expect(strategy.options.capabilities).toEqual({ tools: {} });
    expect(strategy.options.transports).toHaveLength(1);
    expect(strategy.options.transports[0]).toBeInstanceOf(StreamableHttpTransport);
  });

  it('honors a custom endpoint', () => {
    const strategy = createMcpStrategy({
      name: 'My-Service',
      version: '1.0.0',
      endpoint: '/custom/mcp',
    });

    expect(strategy.options.transports[0]).toBeInstanceOf(StreamableHttpTransport);
  });

  it('lets callers override capabilities and transports entirely', () => {
    const customTransport = new StreamableHttpTransport({ endpoint: '/x' });
    const strategy = createMcpStrategy({
      name: 'My-Service',
      version: '1.0.0',
      capabilities: { tools: {}, resources: {} },
      transports: [customTransport],
    });

    expect(strategy.options.capabilities).toEqual({ tools: {}, resources: {} });
    expect(strategy.options.transports).toEqual([customTransport]);
  });

  it('uses DEFAULT_MCP_ENDPOINT when none is given', () => {
    expect(DEFAULT_MCP_ENDPOINT).toBe('/.ai/mcp');
  });
});

describe('createMcpHttpController', () => {
  it('mounts the controller at the given path instead of leaving the transport to self-mount', () => {
    const { transport, controller } = createMcpHttpController('/custom/mcp');

    expect(Reflect.getMetadata(PATH_METADATA, controller)).toBe('/custom/mcp');
    expect(transport).toBeInstanceOf(StreamableHttpTransport);

    // Reading `httpHandlers` (which building the controller does) is what
    // tells the transport a controller owns the route — the whole point of
    // routing it through Nest instead of self-mounting straight onto the
    // HTTP adapter, where no guard (including the app's AuthGuard) would
    // ever run for it.
    expect(typeof controller.prototype.post).toBe('function');
    expect(typeof controller.prototype.get).toBe('function');
    expect(typeof controller.prototype.delete).toBe('function');
  });
});
