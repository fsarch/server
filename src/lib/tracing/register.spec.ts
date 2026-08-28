import { describe, it, expect, vi } from 'vitest';

// `register.ts` is a preload entry point: importing it is the whole API, so
// the only thing worth asserting is that doing so calls `initializeTracing()`
// with no arguments (there's no `FsArchAppBuilder` info to pass at preload
// time — see the module doc in register.ts).
vi.mock('./tracing.js', () => ({
  initializeTracing: vi.fn(),
}));

describe('register', () => {
  it('calls initializeTracing() with no arguments on import', async () => {
    const { initializeTracing } = await import('./tracing.js');

    await import('./register.js');

    expect(initializeTracing).toHaveBeenCalledTimes(1);
    expect(initializeTracing).toHaveBeenCalledWith();
  });
});
