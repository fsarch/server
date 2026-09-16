import { describe, expect, it } from 'vitest';
import { CREATE_STATIC_UAC_CONFIG_VALIDATOR } from './static/static-uac-config.validator.js';
import { CREATE_TOKEN_UAC_CONFIG_VALIDATOR } from './token/token-uac-config.validator.js';

describe('CREATE_UAC_PERMISSION_VALIDATOR (via static config)', () => {
  const validator = CREATE_STATIC_UAC_CONFIG_VALIDATOR(['read_calendar', 'write_calendar']);

  it('accepts a plain string permission', () => {
    const { error } = validator.validate({
      type: 'static',
      users: [{ user_id: 'u1', permissions: ['read_calendar'] }],
    });
    expect(error).toBeUndefined();
  });

  it('accepts an object permission with a single resource', () => {
    const { error } = validator.validate({
      type: 'static',
      users: [
        {
          user_id: 'u1',
          permissions: [{ name: 'write_calendar', resource: 'cal-1' }],
        },
      ],
    });
    expect(error).toBeUndefined();
  });

  it('accepts an object permission with an array of resources', () => {
    const { error } = validator.validate({
      type: 'static',
      users: [
        {
          user_id: 'u1',
          permissions: [{ name: 'write_calendar', resource: ['cal-1', 'cal-2'] }],
        },
      ],
    });
    expect(error).toBeUndefined();
  });

  it('rejects an unknown role name in string form', () => {
    const { error } = validator.validate({
      type: 'static',
      users: [{ user_id: 'u1', permissions: ['unknown'] }],
    });
    expect(error).toBeDefined();
  });

  it('rejects an unknown role name in object form', () => {
    const { error } = validator.validate({
      type: 'static',
      users: [{ user_id: 'u1', permissions: [{ name: 'unknown', resource: 'cal-1' }] }],
    });
    expect(error).toBeDefined();
  });

  it('rejects an object permission missing resource', () => {
    const { error } = validator.validate({
      type: 'static',
      users: [{ user_id: 'u1', permissions: [{ name: 'write_calendar' }] }],
    });
    expect(error).toBeDefined();
  });

  it('rejects an object permission with an empty resource array', () => {
    const { error } = validator.validate({
      type: 'static',
      users: [{ user_id: 'u1', permissions: [{ name: 'write_calendar', resource: [] }] }],
    });
    expect(error).toBeDefined();
  });
});

describe('CREATE_UAC_PERMISSION_VALIDATOR (via token-based config)', () => {
  const validator = CREATE_TOKEN_UAC_CONFIG_VALIDATOR(['read_calendar', 'write_calendar']);

  it('accepts object permissions in a comparison mapping', () => {
    const { error } = validator.validate({
      type: 'token-based',
      mappings: [
        {
          path: 'realm_access.roles',
          operator: 'includes',
          value: 'server:dev',
          permissions: [{ name: 'write_calendar', resource: ['cal-1'] }],
        },
      ],
    });
    expect(error).toBeUndefined();
  });

  it('accepts object permissions in a map mapping', () => {
    const { error } = validator.validate({
      type: 'token-based',
      mappings: [
        {
          path: 'realm_access.roles',
          operator: 'map',
          mappings: [
            {
              key: 'server:admin',
              permissions: ['read_calendar', { name: 'write_calendar', resource: 'cal-1' }],
            },
          ],
        },
      ],
    });
    expect(error).toBeUndefined();
  });

  it('rejects an unknown role name inside a map mapping object permission', () => {
    const { error } = validator.validate({
      type: 'token-based',
      mappings: [
        {
          path: 'realm_access.roles',
          operator: 'map',
          mappings: [
            {
              key: 'server:admin',
              permissions: [{ name: 'unknown', resource: 'cal-1' }],
            },
          ],
        },
      ],
    });
    expect(error).toBeDefined();
  });
});
