import { ConfigUacPermissionType } from '../configuration/config.type.js';
import { Permission } from '../auth/permission.js';

/**
 * Maps a permission name to the resource ids it's granted for, or `null`
 * when it's granted without any resource restriction (all resources).
 */
export type TGrantMap = Map<string, Array<string> | null>;

export function buildGrantMap(entries: Array<ConfigUacPermissionType>): TGrantMap {
  const grantMap: TGrantMap = new Map();

  for (const entry of entries) {
    if (typeof entry === 'string') {
      grantMap.set(entry, null);
      continue;
    }

    const existing = grantMap.get(entry.name);
    if (existing === null) {
      continue;
    }

    const resources = Array.isArray(entry.resource) ? entry.resource : [entry.resource];
    grantMap.set(entry.name, [...new Set([...(existing ?? []), ...resources])]);
  }

  return grantMap;
}

export function grantMapHasGrant(grantMap: TGrantMap, name: string, resource?: string): boolean {
  if (!grantMap.has(name)) {
    return false;
  }

  if (resource === undefined) {
    return true;
  }

  const resources = grantMap.get(name) ?? null;
  return resources === null || resources.includes(resource);
}

export function grantMapToRoles(grantMap: TGrantMap): Array<string> {
  return [...grantMap.keys()];
}

export function toPermission(grantMap: TGrantMap, name: string): Permission {
  if (!grantMap.has(name)) {
    return Permission.notGranted(name);
  }

  return Permission.granted(name, grantMap.get(name) ?? null);
}
