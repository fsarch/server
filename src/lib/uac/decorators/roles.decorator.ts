import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const ROLES_KEY = 'roles';

export type TRoleRequirement =
  | string
  | {
      name: string;
      resource: (request: Request) => string | undefined;
    };

export const Roles = (...roles: Array<TRoleRequirement>) => SetMetadata(ROLES_KEY, roles);
