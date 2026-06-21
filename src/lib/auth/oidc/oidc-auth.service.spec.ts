import { Test, TestingModule } from '@nestjs/testing';
import { OidcAuthService } from './oidc-auth.service';
import { vi } from 'vitest';

// Mock global fetch
global.fetch = vi.fn();

describe('OidcAuthService', () => {
  let service: OidcAuthService;

  beforeEach(async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        jwks_uri: 'http://localhost/.well-known/jwks.json',
        authorization_endpoint: 'http://localhost/auth',
        scopes_supported: ['openid'],
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OidcAuthService,
        {
          provide: 'AUTH_CONFIG',
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'discovery_url') return 'http://localhost/.well-known/openid-configuration';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OidcAuthService>(OidcAuthService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotImplementedException on signIn', async () => {
    await expect(service.signIn('user', 'pass')).rejects.toThrow();
  });

  it('should return www authenticate value', async () => {
    const result = await service.getWwwAuthenticateValue();
    expect(result).toContain('Bearer');
  });
});
