import type { Request } from "express";

export interface IUser {
  getAccessToken(): string;
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
