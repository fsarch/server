import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModuleConfigurationService } from './module-configuration.service';
import { ConfigService } from '@nestjs/config';

// Mock ConfigService
class MockConfigService {
  get<T = any>(key: string): T {
    if (key === 'testConfig') {
      return { testKey: 'testValue' } as T;
    }
    return null as T;
  }
}

describe('ModuleConfigurationService', () => {
  let service: ModuleConfigurationService<any>;

  beforeEach(() => {
    const configService = new MockConfigService() as unknown as ConfigService;
    service = new ModuleConfigurationService(
      { name: 'testConfig', validationSchema: undefined },
      configService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return full config when no key provided', () => {
    const result = service.get();
    expect(result).toEqual({ testKey: 'testValue' });
  });

  it('should return specific config value when key provided', () => {
    const result = service.get('testKey');
    expect(result).toBe('testValue');
  });
});
