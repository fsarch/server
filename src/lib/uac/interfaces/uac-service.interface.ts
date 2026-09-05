export interface IUacService {
  hasGrant(subjectId: string, roles: Array<string>, accessToken?: string): Promise<boolean>;
  getRoles(subjectId: string, accessToken?: string): Promise<Array<string>>;
}
