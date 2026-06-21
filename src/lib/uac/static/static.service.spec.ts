import { Test, TestingModule } from '@nestjs/testing';
import { StaticUacService } from './static.service';
import { vi } from 'vitest';

describe('StaticUacService', () => {
  let service: StaticUacService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaticUacService,
        {
          provide: 'UAC_CONFIG',
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'users') return [];
              return {};
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StaticUacService>(StaticUacService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return false when user not found', async () => {
    const result = await service.hasGrant('unknown', ['role1']);
    expect(result).toBe(false);
  });

  it('should return true when user has role', async () => {
    // Mock the config service to return users with the correct structure
    const mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'users') {
          return [{ user_id: 'user1', permissions: ['role1', 'role2'] }];
        }
        return {};
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaticUacService,
        {
          provide: 'UAC_CONFIG',
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<StaticUacService>(StaticUacService);
    const result = await service.hasGrant('user1', ['role1']);
    expect(result).toBe(true);
  });

  it('should return false when user does not have role', async () => {
    const mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'users') {
          return [{ user_id: 'user1', permissions: ['role1'] }];
        }
        return {};
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaticUacService,
        {
          provide: 'UAC_CONFIG',
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<StaticUacService>(StaticUacService);
    const result = await service.hasGrant('user1', ['role2']);
    expect(result).toBe(false);
  });
});
