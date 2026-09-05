import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../auth/role.enum.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { UacService } from '../uac.service.js';
import { IUser } from "../../auth/types/auth-service.type.js";

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly uacService: UacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const user = context.switchToHttp().getRequest().user as IUser | undefined;
    const userId = user?.getId?.();

    if (!userId) {
      return false;
    }

    const accessToken = user?.getAccessToken?.();

    for (const role of requiredRoles) {
      if (await this.uacService.hasGrant(userId, [role], accessToken)) {
        return true;
      }
    }

    this.logger.warn(
      `Access denied for user "${userId}": missing required role(s) [${requiredRoles.join(', ')}]`,
    );

    return false;
  }
}
