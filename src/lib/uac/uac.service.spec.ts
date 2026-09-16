import { Test, TestingModule } from '@nestjs/testing';
import { UacService } from './uac.service';
import { StaticUacService } from './static/static.service';
import { TokenUacService } from './token/token.service';
import { vi } from 'vitest';

describe('UacService', () => {
  let service: UacService;
  let staticUacService: { hasGrant: ReturnType<typeof vi.fn>; getRoles: ReturnType<typeof vi.fn>; getPermission: ReturnType<typeof vi.fn> };
  let tokenUacService: { hasGrant: ReturnType<typeof vi.fn>; getRoles: ReturnType<typeof vi.fn>; getPermission: ReturnType<typeof vi.fn> };
  let uacConfig: { get: ReturnType<typeof vi.fn> };

  const buildModule = async (type: string) => {
    staticUacService = {
      hasGrant: vi.fn().mockResolvedValue(true),
      getRoles: vi.fn().mockResolvedValue([]),
      getPermission: vi.fn(),
    };
    tokenUacService = {
      hasGrant: vi.fn().mockResolvedValue(true),
      getRoles: vi.fn().mockResolvedValue([]),
      getPermission: vi.fn(),
    };
    uacConfig = {
      get: vi.fn((key: string) => (key === 'type' ? type : undefined)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UacService,
        {
          provide: 'UAC_CONFIG',
          useValue: uacConfig,
        },
        {
          provide: StaticUacService,
          useValue: staticUacService,
        },
        {
          provide: TokenUacService,
          useValue: tokenUacService,
        },
      ],
    }).compile();

    return module.get<UacService>(UacService);
  };

  beforeEach(async () => {
    service = await buildModule('static');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return false when hasGrant returns false', async () => {
    staticUacService.hasGrant.mockResolvedValueOnce(false);
    const result = await service.hasGrant('user1', ['role1']);
    expect(result).toBe(false);
  });

  it('should delegate to the static uac service by default', async () => {
    await service.hasGrant('user1', ['role1'], 'token');
    expect(staticUacService.hasGrant).toHaveBeenCalledWith('user1', ['role1'], 'token', undefined);
    expect(tokenUacService.hasGrant).not.toHaveBeenCalled();
  });

  it('should pass the resource through to the delegate', async () => {
    await service.hasGrant('user1', ['role1'], 'token', 'resource1');
    expect(staticUacService.hasGrant).toHaveBeenCalledWith('user1', ['role1'], 'token', 'resource1');
  });

  it('should delegate to the token uac service when configured as token-based', async () => {
    service = await buildModule('token-based');

    await service.hasGrant('user1', ['role1'], 'token');
    expect(tokenUacService.hasGrant).toHaveBeenCalledWith('user1', ['role1'], 'token', undefined);
    expect(staticUacService.hasGrant).not.toHaveBeenCalled();

    await service.getRoles('user1', 'token');
    expect(tokenUacService.getRoles).toHaveBeenCalledWith('user1', 'token');
  });

  it('should delegate getPermission to the active uac service', async () => {
    const permission = { getName: () => 'role1' };
    staticUacService.getPermission.mockResolvedValueOnce(permission);

    const result = await service.getPermission('user1', 'role1', 'token');
    expect(staticUacService.getPermission).toHaveBeenCalledWith('user1', 'role1', 'token');
    expect(result).toBe(permission);
  });
});
