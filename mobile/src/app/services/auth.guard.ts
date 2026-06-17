import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MobileAuthService } from './mobile-auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(MobileAuthService);
  const router = inject(Router);

  if (await auth.hasSession()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
