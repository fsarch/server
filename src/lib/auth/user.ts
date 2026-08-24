import type { IUser } from './types/auth-service.type.js';

export class User implements IUser {
  private readonly accessToken: string;
  private readonly id?: string;

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
}
