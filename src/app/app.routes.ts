import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guards';
import { HohowhoBackend } from './core/backend/hohowho-backend';
import { takeNext } from './core/pending-navigation';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    // Landing after an e-mailed sign-in link: continue where the user was going (e.g. a join link).
    redirectTo: () => (inject(HohowhoBackend).currentUser() && takeNext()) || '/events',
  },
  {
    path: 'sign-in',
    canActivate: [guestGuard],
    title: 'Sign in · HoHoWho',
    loadComponent: () => import('./features/auth/sign-in-page').then((m) => m.SignInPage),
  },
  {
    path: 'join/:token',
    title: 'Join an event · HoHoWho',
    loadComponent: () => import('./features/join/join-page').then((m) => m.JoinPage),
  },
  {
    path: 'events',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'My events · HoHoWho',
        loadComponent: () =>
          import('./features/events/event-list-page').then((m) => m.EventListPage),
      },
      {
        path: 'new',
        title: 'New event · HoHoWho',
        loadComponent: () =>
          import('./features/events/event-create-page').then((m) => m.EventCreatePage),
      },
      {
        path: ':id',
        loadComponent: () => import('./features/event/event-shell').then((m) => m.EventShell),
        loadChildren: () => import('./features/event/event.routes').then((m) => m.eventRoutes),
      },
    ],
  },
  {
    path: '**',
    title: 'Not found · HoHoWho',
    loadComponent: () => import('./features/not-found-page').then((m) => m.NotFoundPage),
  },
];
