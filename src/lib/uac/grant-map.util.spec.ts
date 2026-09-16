import { describe, expect, it } from 'vitest';
import { buildGrantMap, grantMapHasGrant, grantMapToRoles, toPermission } from './grant-map.util.js';

describe('buildGrantMap', () => {
  it('records a plain string entry as unscoped', () => {
    const grantMap = buildGrantMap(['read_calendar']);
    expect(grantMap.get('read_calendar')).toBeNull();
  });

  it('records a scoped object entry with a single resource', () => {
    const grantMap = buildGrantMap([{ name: 'write_calendar', resource: 'cal-1' }]);
    expect(grantMap.get('write_calendar')).toEqual(['cal-1']);
  });

  it('unions resources across duplicate scoped entries for the same name', () => {
    const grantMap = buildGrantMap([
      { name: 'write_calendar', resource: 'cal-1' },
      { name: 'write_calendar', resource: ['cal-2', 'cal-1'] },
    ]);
    expect(grantMap.get('write_calendar')?.sort()).toEqual(['cal-1', 'cal-2']);
  });

  it('makes a name fully unscoped once a plain string entry is present, regardless of order', () => {
    const before = buildGrantMap(['write_calendar', { name: 'write_calendar', resource: 'cal-1' }]);
    expect(before.get('write_calendar')).toBeNull();

    const after = buildGrantMap([{ name: 'write_calendar', resource: 'cal-1' }, 'write_calendar']);
    expect(after.get('write_calendar')).toBeNull();
  });
});

describe('grantMapHasGrant', () => {
  it('returns false for a name that is not granted at all', () => {
    const grantMap = buildGrantMap(['read_calendar']);
    expect(grantMapHasGrant(grantMap, 'write_calendar')).toBe(false);
  });

  it('matches on name alone when no resource is requested, even for a scoped grant', () => {
    const grantMap = buildGrantMap([{ name: 'write_calendar', resource: 'cal-1' }]);
    expect(grantMapHasGrant(grantMap, 'write_calendar')).toBe(true);
  });

  it('matches a scoped grant only when the requested resource is included', () => {
    const grantMap = buildGrantMap([{ name: 'write_calendar', resource: 'cal-1' }]);
    expect(grantMapHasGrant(grantMap, 'write_calendar', 'cal-1')).toBe(true);
    expect(grantMapHasGrant(grantMap, 'write_calendar', 'cal-2')).toBe(false);
  });

  it('matches any resource when the grant is unscoped', () => {
    const grantMap = buildGrantMap(['read_calendar']);
    expect(grantMapHasGrant(grantMap, 'read_calendar', 'cal-1')).toBe(true);
  });
});

describe('grantMapToRoles', () => {
  it('returns the granted permission names', () => {
    const grantMap = buildGrantMap(['read_calendar', { name: 'write_calendar', resource: 'cal-1' }]);
    expect(grantMapToRoles(grantMap).sort()).toEqual(['read_calendar', 'write_calendar']);
  });
});

describe('toPermission', () => {
  it('returns a not-granted Permission for an absent name', () => {
    const permission = toPermission(buildGrantMap([]), 'write_calendar');
    expect(permission.isGranted()).toBe(false);
    expect(permission.getResources()).toEqual([]);
  });

  it('returns a granted Permission with null resources for an unscoped grant', () => {
    const permission = toPermission(buildGrantMap(['read_calendar']), 'read_calendar');
    expect(permission.isGranted()).toBe(true);
    expect(permission.getResources()).toBeNull();
  });

  it('returns a granted Permission with the resource list for a scoped grant', () => {
    const permission = toPermission(buildGrantMap([{ name: 'write_calendar', resource: ['cal-1', 'cal-2'] }]), 'write_calendar');
    expect(permission.isGranted()).toBe(true);
    expect(permission.getResources()).toEqual(['cal-1', 'cal-2']);
  });
});
