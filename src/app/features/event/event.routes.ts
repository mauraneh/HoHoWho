import { Routes } from '@angular/router';

export const eventRoutes: Routes = [
  {
    path: '',
    title: 'Secret Santa · HoHoWho',
    loadComponent: () => import('./overview-page').then((m) => m.OverviewPage),
  },
  {
    path: 'wishes',
    title: 'Mes envies · HoHoWho',
    loadComponent: () => import('./wishes-page').then((m) => m.WishesPage),
  },
  {
    path: 'exclusions',
    title: 'Exclusions · HoHoWho',
    loadComponent: () => import('./exclusions-page').then((m) => m.ExclusionsPage),
  },
  {
    path: 'giftee',
    title: 'Mon tirage · HoHoWho',
    loadComponent: () => import('./giftee-page').then((m) => m.GifteePage),
  },
  {
    path: 'messages',
    title: 'Messages · HoHoWho',
    loadComponent: () => import('./messages-page').then((m) => m.MessagesPage),
  },
];
