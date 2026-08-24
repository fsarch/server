import { Inject, Injectable, Logger } from '@nestjs/common';
import { IUacService } from '../interfaces/uac-service.interface.js';
import { ModuleConfigurationService } from '../../configuration/module/module-configuration.service.js';
import { ConfigUacType } from '../../configuration/config.type.js';

@Injectable()
export class StaticUacService implements IUacService {
  private readonly logger = new Logger(StaticUacService.name);

  constructor(
    @Inject('UAC_CONFIG')
    private readonly uacConfigService: ModuleConfigurationService<ConfigUacType>,
  ) {}

  async hasGrant(subjectId: string, roles: Array<string>): Promise<boolean> {
    const grantedRoles = await this.getRoles(subjectId);
    this.logger.debug(`Roles found for user "${subjectId}": [${grantedRoles.join(', ')}]`);

    return roles.some((role) => {
      return grantedRoles.includes(role);
    });
  }

  async getRoles(subjectId: string): Promise<Array<string>> {
    const user = this.uacConfigService
      .get('users')
      .find((user) => user.user_id === subjectId);

    return user?.permissions ?? [];
  }
}
