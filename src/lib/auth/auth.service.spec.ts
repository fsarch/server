import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { StaticAuthService } from './static/static-auth.service.js';
import { JwtJwkAuthService } from './jwt-jwk/jwt-jwk-auth.service.js';
import { OidcAuthService } from './oidc/oidc-auth.service.js';
import { vi } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn(() => 'static'),
          },
        },
        {
          provide: StaticAuthService,
          useValue: {
            validateRequest: vi.fn(),
            signIn: vi.fn(),
          },
        },
        {
          provide: JwtJwkAuthService,
          useValue: {
            validateRequest: vi.fn(),
            signIn: vi.fn(),
          },
        },
        {
          provide: OidcAuthService,
          useValue: {
            validateRequest: vi.fn(),
            signIn: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
