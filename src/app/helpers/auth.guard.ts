import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getActiveSession } from './auth-session';

export const authGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const session = await getActiveSession();

  if (session) {
    return true;
  }

  return router.createUrlTree(['/'], {
    queryParams: { redirectTo: state.url }
  });
};
