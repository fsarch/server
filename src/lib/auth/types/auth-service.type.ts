import type { Request } from "express";
import type { Permission } from '../permission.js';

export interface IUser {
  getId(): string | undefined;
  getAccessToken(): string;
  getPermission(name: string): Promise<Permission>;
  setPermissionResolver?(resolver: (name: string) => Promise<Permission>): void;
}

export type TOidcMetadata = {
  scopes_supported: Array<string>;
  authorization_endpoint: string;
  jwks_uri: string
}

export interface IAuthService {
  signIn(username: string, password: string): Promise<{ accessToken: string }>;

  validateRequest(request: Request): Promise<IUser>;

  getWwwAuthenticateValue?(): Promise<string>;

  getOidcMetadata?(): Promise<TOidcMetadata | null>;
}
