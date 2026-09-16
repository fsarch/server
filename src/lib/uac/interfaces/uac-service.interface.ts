import { Permission } from '../../auth/permission.js';

export interface IUacService {
  hasGrant(subjectId: string, roles: Array<string>, accessToken?: string, resource?: string): Promise<boolean>;
  getRoles(subjectId: string, accessToken?: string): Promise<Array<string>>;
  getPermission(subjectId: string, name: string, accessToken?: string): Promise<Permission>;
}
