import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';

// Mock child_process module BEFORE importing cli
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock process.exit to prevent test termination
vi.spyOn(process, 'exit').mockImplementation(() => {
  return undefined as never;
});

// Mock console
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Get the mocked spawn function with proper typing
const spawnMock = vi.mocked(spawn);

describe('CLI Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spawnMock.mockReturnValue({
      on: vi.fn(),
      stdio: 'inherit',
    } as unknown as ChildProcess);
  });

  describe('executeBuild', () => {
    it('should spawn node with build command', async () => {
      const cliModule = await import('./cli.js');
      cliModule.executeBuild('/test/cwd');

      expect(spawnMock).toHaveBeenCalledTimes(1);
      
      const call = spawnMock.mock.calls[0];
      const command = call[0] as string;
      const args = call[1] as string[];
      const options = call[2] as SpawnOptions;
      
      expect(command).toBe('node');
      expect(Array.isArray(args)).toBe(true);
      expect(args[args.length - 1]).toBe('build');
      expect(options).toEqual({
        stdio: 'inherit',
        cwd: '/test/cwd',
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Building NestJS application...');
    });

    it('should use provided cwd', async () => {
      const cliModule = await import('./cli.js');
      cliModule.executeBuild('/custom/cwd');

      const call = spawnMock.mock.calls[0];
      const options = call[2] as SpawnOptions;
      expect(options.cwd).toBe('/custom/cwd');
    });

    it('should handle error event', async () => {
      const mockError = new Error('Build failed');
      const mockProcess = {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'error') {
            callback(mockError);
          }
          return mockProcess;
        }),
      };
      spawnMock.mockReturnValue(mockProcess as unknown as ChildProcess);

      const cliModule = await import('./cli.js');
      cliModule.executeBuild('/test/cwd');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error building NestJS application:',
        'Build failed'
      );
    });

    it('should handle close event with success', async () => {
      const mockProcess = {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            callback(0);
          }
          return mockProcess;
        }),
      };
      spawnMock.mockReturnValue(mockProcess as unknown as ChildProcess);

      const cliModule = await import('./cli.js');
      cliModule.executeBuild('/test/cwd');

      expect(mockConsoleLog).toHaveBeenCalledWith('Build completed successfully');
    });

    it('should handle close event with error', async () => {
      const mockProcess = {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            callback(1);
          }
          return mockProcess;
        }),
      };
      spawnMock.mockReturnValue(mockProcess as unknown as ChildProcess);

      const cliModule = await import('./cli.js');
      cliModule.executeBuild('/test/cwd');

      expect(mockConsoleError).toHaveBeenCalledWith('Build failed with code 1');
    });
  });

  describe('executeStart', () => {
    it('should spawn node with start and --watch command', async () => {
      const cliModule = await import('./cli.js');
      cliModule.executeStart('/test/cwd');

      expect(spawnMock).toHaveBeenCalledTimes(1);
      
      const call = spawnMock.mock.calls[0];
      const command = call[0] as string;
      const args = call[1] as string[];
      const options = call[2] as SpawnOptions;
      
      expect(command).toBe('node');
      expect(Array.isArray(args)).toBe(true);
      expect(args).toContain('start');
      expect(args).toContain('--watch');
      expect(options).toEqual({
        stdio: 'inherit',
        cwd: '/test/cwd',
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Starting NestJS application...');
    });

    it('should use provided cwd', async () => {
      const cliModule = await import('./cli.js');
      cliModule.executeStart('/custom/cwd');

      const call = spawnMock.mock.calls[0];
      const options = call[2] as SpawnOptions;
      expect(options.cwd).toBe('/custom/cwd');
    });

    it('should handle error event', async () => {
      const mockError = new Error('Start failed');
      const mockProcess = {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'error') {
            callback(mockError);
          }
          return mockProcess;
        }),
      };
      spawnMock.mockReturnValue(mockProcess as unknown as ChildProcess);

      const cliModule = await import('./cli.js');
      cliModule.executeStart('/test/cwd');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error starting NestJS application:',
        'Start failed'
      );
    });

    it('should handle close event with error', async () => {
      const mockProcess = {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            callback(127);
          }
          return mockProcess;
        }),
      };
      spawnMock.mockReturnValue(mockProcess as unknown as ChildProcess);

      const cliModule = await import('./cli.js');
      cliModule.executeStart('/test/cwd');

      expect(mockConsoleError).toHaveBeenCalledWith('NestJS application exited with code 127');
    });
  });
});
