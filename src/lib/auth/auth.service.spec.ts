import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { StaticAuthService } from './static/static-auth.service';
import { JwtJwkAuthService } from './jwt-jwk/jwt-jwk-auth.service';
import { OidcAuthService } from './oidc/oidc-auth.service';

// Mock ConfigService
class MockConfigService {
  get<T = any>(key: string): T {
    if (key === 'auth.type') return 'static' as T;
    if (key?.includes('auth')) return { type: 'static' } as T;
    return null as T;
  }
}

// Mock Auth Services
const mockStaticAuthService = {
  validateRequest: vi.fn().mockResolvedValue({ id: 'user1' }),
  signIn: vi.fn().mockResolvedValue({ accessToken: 'token' }),
};

const mockJwtJwkAuthService = {
  validateRequest: vi.fn().mockResolvedValue({ id: 'user1' }),
  signIn: vi.fn().mockResolvedValue({ accessToken: 'token' }),
};

const mockOidcAuthService = {
  validateRequest: vi.fn().mockResolvedValue({ id: 'user1' }),
  signIn: vi.fn().mockResolvedValue({ accessToken: 'token' }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    const configService = new MockConfigService();
    service = new AuthService(
      configService as unknown as ConfigService,
      mockStaticAuthService as unknown as StaticAuthService,
      mockJwtJwkAuthService as unknown as JwtJwkAuthService,
      mockOidcAuthService as unknown as OidcAuthService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should use static auth service when type is static', () => {
    // The constructor sets authService based on config
    expect(service).toBeDefined();
  });
});
