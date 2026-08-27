import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../configuration/configuration.js', () => ({
  loadConfigFile: vi.fn(),
}));

// `tracing.ts` keeps whether the SDK was started in module-level state, so
// each test gets a fresh module instance (and thus a fresh mock of
// `loadConfigFile`, re-imported alongside it) to stay isolated from the others.
async function freshTracingModule(rawConfig: Record<string, unknown>) {
  vi.resetModules();
  const { loadConfigFile } = await import('../configuration/configuration.js');
  vi.mocked(loadConfigFile).mockReturnValue(rawConfig as never);
  return import('./tracing.js');
}

describe('tracing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not start tracing when there is no tracing config section', async () => {
    const { initializeTracing } = await freshTracingModule({});

    const started = initializeTracing({ serviceName: 'test-service' });

    expect(started).toBe(false);
  });

  it('does not start tracing when disabled', async () => {
    const { initializeTracing } = await freshTracingModule({
      tracing: { enabled: false },
    });

    const started = initializeTracing({ serviceName: 'test-service' });

    expect(started).toBe(false);
  });

  it('throws on an invalid tracing config', async () => {
    const { initializeTracing } = await freshTracingModule({
      tracing: { enabled: true },
    });

    expect(() =>
      initializeTracing({ serviceName: 'test-service' }),
    ).toThrow('invalid config');
  });

  it('starts tracing with a console exporter', async () => {
    const { initializeTracing, shutdownTracing } = await freshTracingModule({
      tracing: {
        enabled: true,
        exporter: { type: 'console' },
      },
    });

    const started = initializeTracing({ serviceName: 'test-service' });

    expect(started).toBe(true);

    await shutdownTracing();
  });

  it('is idempotent once started', async () => {
    const { initializeTracing, shutdownTracing } = await freshTracingModule({
      tracing: {
        enabled: true,
        exporter: { type: 'console' },
      },
    });
    const { loadConfigFile } = await import('../configuration/configuration.js');

    expect(initializeTracing({ serviceName: 'test-service' })).toBe(true);
    expect(initializeTracing({ serviceName: 'test-service' })).toBe(true);
    // loadConfigFile is only consulted on the first call.
    expect(loadConfigFile).toHaveBeenCalledTimes(1);

    await shutdownTracing();
  });

  it('getTracer returns a usable tracer even when tracing is disabled', async () => {
    const { getTracer } = await freshTracingModule({});

    const tracer = getTracer();

    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe('function');
  });
});
