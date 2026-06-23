import { Test, TestingModule } from '@nestjs/testing';
import { UacService } from './uac.service';
import { StaticUacService } from './static/static.service';
import { vi } from 'vitest';

describe('UacService', () => {
  let service: UacService;
  let staticUacService: { hasGrant: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    staticUacService = {
      hasGrant: vi.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UacService,
        {
          provide: StaticUacService,
          useValue: staticUacService,
        },
      ],
    }).compile();

    service = module.get<UacService>(UacService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return false when hasGrant returns false', async () => {
    staticUacService.hasGrant.mockResolvedValueOnce(false);
    const result = await service.hasGrant('user1', ['role1']);
    expect(result).toBe(false);
  });
});
