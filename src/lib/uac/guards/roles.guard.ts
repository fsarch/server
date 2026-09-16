import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, TRoleRequirement } from '../decorators/roles.decorator.js';
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
    const request = context.switchToHttp().getRequest();
    const user = request.user as IUser | undefined;
    const userId = user?.getId?.();
    const accessToken = user?.getAccessToken?.();

    if (user && userId) {
      user.setPermissionResolver?.((name) => this.uacService.getPermission(userId, name, accessToken));
    }

    const requiredRoles = this.reflector.getAllAndOverride<Array<TRoleRequirement>>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }

    if (!userId) {
      return false;
    }

    for (const requirement of requiredRoles) {
      const name = typeof requirement === 'string' ? requirement : requirement.name;
      const resource = typeof requirement === 'string' ? undefined : requirement.resource(request);

      if (await this.uacService.hasGrant(userId, [name], accessToken, resource)) {
        return true;
      }
    }

    this.logger.warn(
      `Access denied for user "${userId}": missing required role(s) [${requiredRoles
        .map((requirement) => (typeof requirement === 'string' ? requirement : requirement.name))
        .join(', ')}]`,
    );

    return false;
  }
}
