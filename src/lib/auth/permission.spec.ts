import { describe, expect, it } from 'vitest';
import { Permission } from './permission.js';

describe('Permission', () => {
  it('notGranted() is not granted and has no resources', () => {
    const permission = Permission.notGranted('write_calendar');
    expect(permission.getName()).toBe('write_calendar');
    expect(permission.isGranted()).toBe(false);
    expect(permission.getResources()).toEqual([]);
    expect(permission.hasResource('cal-1')).toBe(false);
  });

  it('granted() with null resources is unscoped and matches any resource', () => {
    const permission = Permission.granted('read_calendar', null);
    expect(permission.isGranted()).toBe(true);
    expect(permission.getResources()).toBeNull();
    expect(permission.hasResource('cal-1')).toBe(true);
    expect(permission.hasResource('cal-2')).toBe(true);
  });

  it('granted() with a resource list only matches those resources', () => {
    const permission = Permission.granted('write_calendar', ['cal-1']);
    expect(permission.isGranted()).toBe(true);
    expect(permission.getResources()).toEqual(['cal-1']);
    expect(permission.hasResource('cal-1')).toBe(true);
    expect(permission.hasResource('cal-2')).toBe(false);
  });
});
