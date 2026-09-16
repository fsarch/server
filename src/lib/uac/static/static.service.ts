import { Inject, Injectable, Logger } from '@nestjs/common';
import { IUacService } from '../interfaces/uac-service.interface.js';
import { ModuleConfigurationService } from '../../configuration/module/module-configuration.service.js';
import { ConfigStaticUacType } from '../../configuration/config.type.js';
import { Permission } from '../../auth/permission.js';
import { buildGrantMap, grantMapHasGrant, grantMapToRoles, toPermission, TGrantMap } from '../grant-map.util.js';

@Injectable()
export class StaticUacService implements IUacService {
  private readonly logger = new Logger(StaticUacService.name);

  constructor(
    @Inject('UAC_CONFIG')
    private readonly uacConfigService: ModuleConfigurationService<ConfigStaticUacType>,
  ) {}

  private getGrantMap(subjectId: string): TGrantMap {
    const user = this.uacConfigService
      .get('users')
      .find((user) => user.user_id === subjectId);

    return buildGrantMap(user?.permissions ?? []);
  }

  async hasGrant(subjectId: string, roles: Array<string>, accessToken?: string, resource?: string): Promise<boolean> {
    const grantMap = this.getGrantMap(subjectId);
    this.logger.debug(`Roles found for user "${subjectId}": [${grantMapToRoles(grantMap).join(', ')}]`);

    return roles.some((role) => grantMapHasGrant(grantMap, role, resource));
  }

  async getRoles(subjectId: string, accessToken?: string): Promise<Array<string>> {
    return grantMapToRoles(this.getGrantMap(subjectId));
  }

  async getPermission(subjectId: string, name: string, accessToken?: string): Promise<Permission> {
    return toPermission(this.getGrantMap(subjectId), name);
  }
}
