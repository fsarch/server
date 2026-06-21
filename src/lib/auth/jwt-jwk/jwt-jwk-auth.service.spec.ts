import { Test, TestingModule } from '@nestjs/testing';
import { JwtJwkAuthService } from './jwt-jwk-auth.service';
import { vi } from 'vitest';

describe('JwtJwkAuthService', () => {
  let service: JwtJwkAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtJwkAuthService,
        {
          provide: 'AUTH_CONFIG',
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'jwkUrl') return 'http://localhost/.well-known/jwks.json';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JwtJwkAuthService>(JwtJwkAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotImplementedException on signIn', async () => {
    await expect(service.signIn('user', 'pass')).rejects.toThrow();
  });
});
