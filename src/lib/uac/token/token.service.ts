import { Inject, Injectable, Logger } from '@nestjs/common';
import { IUacService } from '../interfaces/uac-service.interface.js';
import { ModuleConfigurationService } from '../../configuration/module/module-configuration.service.js';
import {
  ConfigTokenUacMapping,
  ConfigTokenUacType,
  ConfigUacComparisonOperator,
} from '../../configuration/config.type.js';

type TJwtPayload = Record<string, unknown>;

function decodeJwtPayload(accessToken: string): TJwtPayload | null {
  const parts = accessToken.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    return payload as TJwtPayload;
  } catch {
    return null;
  }
}

function getValueByPath(payload: TJwtPayload, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((currentValue, key) => {
      if (currentValue === null || typeof currentValue !== 'object') {
        return undefined;
      }

      return (currentValue as Record<string, unknown>)[key];
    }, payload);
}

function evaluateOperator(
  pathValue: unknown,
  expectedValue: string,
  operator: ConfigUacComparisonOperator,
): boolean {
  if (operator === 'includes') {
    if (Array.isArray(pathValue)) {
      return pathValue.some((value) => `${value}` === expectedValue);
    }

    if (typeof pathValue === 'string') {
      return pathValue.includes(expectedValue);
    }

    return false;
  }

  if (operator === 'equals') {
    return `${pathValue}` === expectedValue;
  }

  return false;
}

function getMapPathTokens(pathValue: unknown): Array<string> {
  if (Array.isArray(pathValue)) {
    return pathValue.map((value) => `${value}`);
  }

  if (typeof pathValue === 'string' || typeof pathValue === 'number' || typeof pathValue === 'boolean') {
    return [`${pathValue}`];
  }

  if (pathValue && typeof pathValue === 'object') {
    return Object.keys(pathValue as Record<string, unknown>);
  }

  return [];
}

function resolvePermissionsFromMapping(payload: TJwtPayload, mapping: ConfigTokenUacMapping): Array<string> {
  const pathValue = getValueByPath(payload, mapping.path);

  if (mapping.operator === 'map') {
    const mapKeys = new Set(getMapPathTokens(pathValue));

    const permissions: Array<string> = [];
    for (const entry of mapping.mappings) {
      if (mapKeys.has(entry.key)) {
        permissions.push(...entry.permissions);
      }
    }

    return permissions;
  }

  if (evaluateOperator(pathValue, mapping.value, mapping.operator)) {
    return mapping.permissions;
  }

  return [];
}

/**
 * Derives permissions from claims found directly in the caller's (already
 * verified) access token, instead of a static per-user permission list. Each
 * configured mapping is checked against the decoded JWT payload and, when it
 * matches, contributes its `permissions` to the subject's granted roles.
 */
@Injectable()
export class TokenUacService implements IUacService {
  private readonly logger = new Logger(TokenUacService.name);

  constructor(
    @Inject('UAC_CONFIG')
    private readonly uacConfigService: ModuleConfigurationService<ConfigTokenUacType>,
  ) {}

  async hasGrant(subjectId: string, roles: Array<string>, accessToken?: string): Promise<boolean> {
    const grantedRoles = await this.getRoles(subjectId, accessToken);
    this.logger.debug(`Roles found for user "${subjectId}": [${grantedRoles.join(', ')}]`);

    return roles.some((role) => grantedRoles.includes(role));
  }

  async getRoles(subjectId: string, accessToken?: string): Promise<Array<string>> {
    if (!accessToken) {
      return [];
    }

    const payload = decodeJwtPayload(accessToken);
    if (!payload) {
      return [];
    }

    const permissions = new Set<string>();
    for (const mapping of this.uacConfigService.get('mappings')) {
      for (const permission of resolvePermissionsFromMapping(payload, mapping)) {
        permissions.add(permission);
      }
    }

    return [...permissions];
  }
}
