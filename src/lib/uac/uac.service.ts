import { Inject, Injectable } from '@nestjs/common';
import { IUacService } from './interfaces/uac-service.interface.js';
import { StaticUacService } from './static/static.service.js';
import { TokenUacService } from './token/token.service.js';
import { ModuleConfigurationService } from '../configuration/module/module-configuration.service.js';
import { ConfigUacType } from '../configuration/config.type.js';
import { Permission } from '../auth/permission.js';

@Injectable()
export class UacService implements IUacService {
  constructor(
    @Inject('UAC_CONFIG')
    private readonly uacConfigService: ModuleConfigurationService<ConfigUacType>,
    private readonly staticUacService: StaticUacService,
    private readonly tokenUacService: TokenUacService,
  ) {}

  private getUacService(): IUacService {
    return this.uacConfigService.get('type') === 'token-based'
      ? this.tokenUacService
      : this.staticUacService;
  }

  async hasGrant(subjectId: string, roles: Array<string>, accessToken?: string, resource?: string): Promise<boolean> {
    return await this.getUacService().hasGrant(subjectId, roles, accessToken, resource) ?? false;
  }

  async getRoles(subjectId: string, accessToken?: string): Promise<Array<string>> {
    return await this.getUacService().getRoles(subjectId, accessToken) ?? [];
  }

  async getPermission(subjectId: string, name: string, accessToken?: string): Promise<Permission> {
    return this.getUacService().getPermission(subjectId, name, accessToken);
  }
}
