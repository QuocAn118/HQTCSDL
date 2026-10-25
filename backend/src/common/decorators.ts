import {
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';

export type Role = 'ADMIN' | 'OWNER';
export interface AuthUser {
  userId: number;
  role: Role;
  username: string;
  exp: number;
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const SKIP_DB = 'skipDb';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
export const SkipDbCheck = () => SetMetadata(SKIP_DB, true);
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
