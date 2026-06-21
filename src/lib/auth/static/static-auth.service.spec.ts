import { Test, TestingModule } from '@nestjs/testing';
import { StaticAuthService } from './static-auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';

describe('StaticAuthService', () => {
  let service: StaticAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaticAuthService,
        {
          provide: 'AUTH_CONFIG',
          useValue: {
            get: vi.fn(() => ({
              users: [{ id: '1', username: 'test', password: 'pass' }],
            })),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: vi.fn().mockResolvedValue({ sub: '1' }),
            signAsync: vi.fn().mockResolvedValue('token'),
          },
        },
      ],
    }).compile();

    service = module.get<StaticAuthService>(StaticAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
