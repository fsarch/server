import { describe, expect, it } from 'vitest';
import { User } from './user.js';
import { Permission } from './permission.js';

describe('User', () => {
  it('exposes id and access token', () => {
    const user = new User({ id: 'u1', accessToken: 'token' });
    expect(user.getId()).toBe('u1');
    expect(user.getAccessToken()).toBe('token');
  });

  it('getPermission() returns a not-granted Permission when no resolver is wired', async () => {
    const user = new User({ accessToken: 'token' });
    const permission = await user.getPermission('write_calendar');
    expect(permission.isGranted()).toBe(false);
  });

  it('getPermission() delegates to the wired resolver', async () => {
    const user = new User({ accessToken: 'token' });
    const granted = Permission.granted('write_calendar', ['cal-1']);
    user.setPermissionResolver(async (name) => {
      expect(name).toBe('write_calendar');
      return granted;
    });

    const permission = await user.getPermission('write_calendar');
    expect(permission).toBe(granted);
  });
});
