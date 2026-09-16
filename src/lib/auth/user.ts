import type { IUser } from './types/auth-service.type.js';
import { Permission } from './permission.js';

export class User implements IUser {
  private readonly accessToken: string;
  private readonly id?: string;
  private permissionResolver?: (name: string) => Promise<Permission>;

  constructor(data: { accessToken: string; id?: string; }) {
    this.id = data.id;
    this.accessToken = data.accessToken;
  }

  getAccessToken() {
    return this.accessToken;
  }

  getId() {
    return this.id;
  }

  setPermissionResolver(resolver: (name: string) => Promise<Permission>): void {
    this.permissionResolver = resolver;
  }

  async getPermission(name: string): Promise<Permission> {
    if (!this.permissionResolver) {
      return Permission.notGranted(name);
    }

    return this.permissionResolver(name);
  }
}
