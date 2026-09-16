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

  it('should grant a resource-scoped permission only for its resources when a resource is requested', async () => {
    const mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'users') {
          return [
            {
              user_id: 'user1',
              permissions: [{ name: 'write_calendar', resource: ['cal-1', 'cal-2'] }],
            },
          ];
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

    expect(await service.hasGrant('user1', ['write_calendar'])).toBe(true);
    expect(await service.hasGrant('user1', ['write_calendar'], undefined, 'cal-1')).toBe(true);
    expect(await service.hasGrant('user1', ['write_calendar'], undefined, 'cal-3')).toBe(false);
  });

  it('should expose granted resources via getPermission', async () => {
    const mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'users') {
          return [
            {
              user_id: 'user1',
              permissions: ['read_calendar', { name: 'write_calendar', resource: 'cal-1' }],
            },
          ];
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

    const unscoped = await service.getPermission('user1', 'read_calendar');
    expect(unscoped.isGranted()).toBe(true);
    expect(unscoped.getResources()).toBeNull();

    const scoped = await service.getPermission('user1', 'write_calendar');
    expect(scoped.isGranted()).toBe(true);
    expect(scoped.getResources()).toEqual(['cal-1']);

    const notGranted = await service.getPermission('user1', 'unknown');
    expect(notGranted.isGranted()).toBe(false);
  });
});
