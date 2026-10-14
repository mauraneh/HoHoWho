import { Routes } from '@angular/router';
import { authGuard, guestGuard, organizerGuard } from './core/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'events' },
  {
    path: 'sign-in',
    canActivate: [guestGuard],
    title: 'Connexion · HoHoWho',
    loadComponent: () => import('./features/auth/sign-in-page').then((m) => m.SignInPage),
  },
  {
    path: 'k/:key',
    title: 'Connexion · HoHoWho',
    loadComponent: () => import('./features/auth/access-page').then((m) => m.AccessPage),
  },
  {
    path: 'mon-lien',
    canActivate: [authGuard],
    title: 'Mon lien · HoHoWho',
    loadComponent: () => import('./features/auth/my-link-page').then((m) => m.MyLinkPage),
  },
  {
    path: 'join/:token',
    title: 'Invitation · HoHoWho',
    loadComponent: () => import('./features/join/join-page').then((m) => m.JoinPage),
  },
  {
    path: 'events',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Mes Secret Santa · HoHoWho',
        loadComponent: () =>
          import('./features/events/event-list-page').then((m) => m.EventListPage),
      },
      {
        path: 'new',
        canActivate: [organizerGuard],
        title: 'Nouveau Secret Santa · HoHoWho',
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
    title: 'Page introuvable · HoHoWho',
    loadComponent: () => import('./features/not-found-page').then((m) => m.NotFoundPage),
  },
];
