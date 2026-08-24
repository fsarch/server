export interface IUacService {
  hasGrant(subjectId: string, roles: Array<string>): Promise<boolean>;
  getRoles(subjectId: string): Promise<Array<string>>;
}
