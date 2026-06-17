import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage)
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/auth-callback/auth-callback.page').then((m) => m.AuthCallbackPage)
  },
  {
    path: '',
    loadComponent: () => import('./pages/tabs/tabs.page').then((m) => m.TabsPage),
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage)
      },
      {
        path: 'students',
        loadComponent: () => import('./pages/students/students.page').then((m) => m.StudentsPage)
      },
      {
        path: 'journal',
        loadComponent: () => import('./pages/journal/journal.page').then((m) => m.JournalPage)
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
