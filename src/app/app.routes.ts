import { Routes } from '@angular/router';
import { AuthCallbackComponent } from './auth-callback.component';
import { authGuard } from './auth.guard';
import { DashboardComponent } from './dashboard.component';
import { LoginPageComponent } from './login-page.component';

export const routes: Routes = [
  {
    path: '',
    component: LoginPageComponent
  },
  {
    path: 'auth/callback',
    component: AuthCallbackComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
