import { Test, TestingModule } from '@nestjs/testing';
import { TokenUacService } from './token.service';
import { vi } from 'vitest';
import { ConfigTokenUacMapping } from '../../configuration/config.type';

function encodeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }), 'utf8').toString('base64url');
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${header}.${body}.sig`;
}

describe('TokenUacService', () => {
  let service: TokenUacService;

  const buildModule = async (mappings: Array<ConfigTokenUacMapping>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenUacService,
        {
          provide: 'UAC_CONFIG',
          useValue: {
            get: vi.fn((key: string) => (key === 'mappings' ? mappings : {})),
          },
        },
      ],
    }).compile();

    return module.get<TokenUacService>(TokenUacService);
  };

  it('should be defined', async () => {
    service = await buildModule([]);
    expect(service).toBeDefined();
  });

  it('should return no roles without an access token', async () => {
    service = await buildModule([]);
    expect(await service.getRoles('user1')).toEqual([]);
    expect(await service.hasGrant('user1', ['role1'])).toBe(false);
  });

  it('should return no roles for a malformed access token', async () => {
    service = await buildModule([]);
    expect(await service.getRoles('user1', 'not-a-jwt')).toEqual([]);
  });

  it('should grant permissions via an "includes" comparison mapping', async () => {
    service = await buildModule([
      {
        path: 'realm_access.roles',
        value: 'server:dev',
        operator: 'includes',
        permissions: ['dev'],
      },
    ]);

    const token = encodeToken({ realm_access: { roles: ['server:dev'] } });

    expect(await service.getRoles('user1', token)).toEqual(['dev']);
    expect(await service.hasGrant('user1', ['dev'], token)).toBe(true);
    expect(await service.hasGrant('user1', ['other'], token)).toBe(false);
  });

  it('should not grant permissions when the "equals" comparison does not match', async () => {
    service = await buildModule([
      {
        path: 'scope',
        value: 'admin',
        operator: 'equals',
        permissions: ['manage_claims'],
      },
    ]);

    const token = encodeToken({ scope: 'user' });

    expect(await service.getRoles('user1', token)).toEqual([]);
  });

  it('should grant permissions via a "map" mapping', async () => {
    service = await buildModule([
      {
        path: 'realm_access.roles',
        operator: 'map',
        mappings: [
          { key: 'server:dev', permissions: ['dev'] },
          { key: 'server:admin', permissions: ['manage_claims', 'dev'] },
        ],
      },
    ]);

    const token = encodeToken({ realm_access: { roles: ['server:admin'] } });

    const roles = await service.getRoles('user1', token);
    expect(roles.sort()).toEqual(['dev', 'manage_claims']);
  });

  it('should deduplicate permissions granted by multiple mappings', async () => {
    service = await buildModule([
      {
        path: 'realm_access.roles',
        value: 'server:dev',
        operator: 'includes',
        permissions: ['dev'],
      },
      {
        path: 'scope',
        value: 'dev',
        operator: 'equals',
        permissions: ['dev'],
      },
    ]);

    const token = encodeToken({ realm_access: { roles: ['server:dev'] }, scope: 'dev' });

    expect(await service.getRoles('user1', token)).toEqual(['dev']);
  });
});
