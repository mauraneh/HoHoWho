import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HohowhoBackend } from './backend/hohowho-backend';

/** Requires a signed-in user; otherwise redirects to sign-in and comes back afterwards. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const backend = inject(HohowhoBackend);
  const router = inject(Router);
  await backend.whenReady();
  return backend.currentUser()
    ? true
    : router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};

/** Only organisers may open the "new Secret Santa" page. */
export const organizerGuard: CanActivateFn = async () => {
  const backend = inject(HohowhoBackend);
  const router = inject(Router);
  return (await backend.canOrganize().catch(() => false))
    ? true
    : router.createUrlTree(['/events']);
};

/** Keeps signed-in users away from the sign-in page. */
export const guestGuard: CanActivateFn = async () => {
  const backend = inject(HohowhoBackend);
  const router = inject(Router);
  await backend.whenReady();
  return backend.currentUser() ? router.createUrlTree(['/events']) : true;
};
