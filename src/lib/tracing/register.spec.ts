import { describe, it, expect, vi, beforeEach } from 'vitest';

// `register.ts` is a preload entry point: importing it is the whole API, so
// there's nothing to assert beyond "it calls initializeTracing() with no
// arguments" (there's no `FsArchAppBuilder` info to pass at preload time —
// see the module doc in register.ts) and "it registers the ESM
// import-in-the-middle hook iff tracing is enabled" (see the module doc's
// "ESM modules" section for why that's needed at all).
vi.mock('./tracing.js', () => ({
  initializeTracing: vi.fn(),
}));
vi.mock('../configuration/configuration.js', () => ({
  loadConfigFile: vi.fn(),
}));
vi.mock('node:module', () => ({
  register: vi.fn(),
}));

describe('register', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('calls initializeTracing() with no arguments on import', async () => {
    const { loadConfigFile } = await import('../configuration/configuration.js');
    vi.mocked(loadConfigFile).mockReturnValue({} as never);
    const { initializeTracing } = await import('./tracing.js');

    await import('./register.js');

    expect(initializeTracing).toHaveBeenCalledTimes(1);
    expect(initializeTracing).toHaveBeenCalledWith();
  });

  it('registers the ESM instrumentation hook when tracing is enabled', async () => {
    const { loadConfigFile } = await import('../configuration/configuration.js');
    vi.mocked(loadConfigFile).mockReturnValue({
      tracing: { enabled: true },
    } as never);
    const { register } = await import('node:module');

    await import('./register.js');

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      '@opentelemetry/instrumentation/hook.mjs',
      expect.anything(),
    );
  });

  it.each([undefined, {}, { tracing: { enabled: false } }])(
    'does not register the ESM instrumentation hook when tracing is not enabled (config: %j)',
    async (rawConfig) => {
      const { loadConfigFile } = await import('../configuration/configuration.js');
      vi.mocked(loadConfigFile).mockReturnValue(rawConfig as never);
      const { register } = await import('node:module');

      await import('./register.js');

      expect(register).not.toHaveBeenCalled();
    },
  );
});
