import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// End-to-end sanity check, deliberately without mocking `loadConfigFile`:
// reads a real config.yaml (like `FsArchAppBuilder.build()` does) that has
// no `tracing` section at all, to make sure that case doesn't accidentally
// start tracing regardless of how the config object happens to be shaped
// after `js-yaml` parses it.
describe('initializeTracing (real config file, no tracing section)', () => {
  let dir: string | undefined;
  let previousConfigFilePath: string | undefined;

  afterEach(async () => {
    if (previousConfigFilePath === undefined) {
      delete process.env.CONFIG_FILE_PATH;
    } else {
      process.env.CONFIG_FILE_PATH = previousConfigFilePath;
    }

    if (dir) {
      rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    }

    const { shutdownTracing } = await import('./tracing.js');
    await shutdownTracing();
  });

  it('does not start tracing when config.yaml has no tracing section at all', async () => {
    dir = mkdtempSync(join(tmpdir(), 'fsarch-tracing-'));
    const configPath = join(dir, 'config.yaml');
    writeFileSync(
      configPath,
      [
        'auth:',
        '  type: static',
        '  secret: test',
        '  users: []',
        'database:',
        '  type: sqlite',
        '  database: ":memory:"',
        'uac:',
        '  type: static',
        '  users: []',
        '',
      ].join('\n'),
    );

    previousConfigFilePath = process.env.CONFIG_FILE_PATH;
    process.env.CONFIG_FILE_PATH = configPath;

    const { initializeTracing } = await import('./tracing.js');

    const started = initializeTracing({ serviceName: 'integration-test' });

    expect(started).toBe(false);
  });
});
