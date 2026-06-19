import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppPermission } from '../models/Auth';
import { CurrentUserService } from '../services/current-user.service';

export const permissionGuard: CanActivateFn = async (route) => {
  const currentUserService = inject(CurrentUserService);
  const router = inject(Router);
  const permission = route.data?.['permission'] as AppPermission | undefined;
  const permissions = route.data?.['permissions'] as AppPermission[] | undefined;

  if (!permission && !permissions?.length) return true;

  try {
    const user = currentUserService.user ?? await currentUserService.load();
    const allowed = permission
      ? user.permissions.includes(permission)
      : permissions?.some((item) => user.permissions.includes(item)) === true;
    return allowed
      ? true
      : router.createUrlTree(['/dashboard/overview']);
  } catch {
    return router.createUrlTree(['/']);
  }
};
