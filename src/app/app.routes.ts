import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'events' },
  {
    path: 'sign-in',
    canActivate: [guestGuard],
    title: 'Sign in · HoHoWho',
    loadComponent: () => import('./features/auth/sign-in-page').then((m) => m.SignInPage),
  },
  {
    path: 'join/:token',
    canActivate: [authGuard],
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
