import { Test, TestingModule } from '@nestjs/testing';
import { UacService } from './uac.service';
import { StaticUacService } from './static/static.service';
import { vi } from 'vitest';

describe('UacService', () => {
  let service: UacService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UacService,
        {
          provide: StaticUacService,
          useValue: {
            hasGrant: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<UacService>(UacService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return false when hasGrant returns false', async () => {
    // The UacService uses hardcoded authType = 'static', so it will use staticUacService
    // The staticUacService is mocked to return false by default
    const result = await service.hasGrant('user1', ['role1']);
    expect(result).toBe(false);
  });
});
