import { Routes } from '@angular/router';
import { authGuard } from './helpers/auth.guard';
import { AuthCallbackComponent } from './pages/auth/auth-callback.component';
import { LoginPageComponent } from './pages/auth/login-page.component';
import { DashboardComponent } from './pages/private/dashboard.component';
import { DashboardHomeComponent } from './pages/private/dashboard-home.component';
import { PrivatePlaceholderComponent } from './pages/private/private-placeholder.component';
import { SettingsComponent } from './pages/private/settings/settings.component';
import { StudentDetailComponent } from './pages/private/students/student-detail.component';
import { StudentFormComponent } from './pages/private/students/student-form.component';
import { Students } from './pages/private/students/students';

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
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'overview'
      },
      {
        path: 'overview',
        component: DashboardHomeComponent
      },
      {
        path: 'students',
        component: Students
      },
      {
        path: 'students/new',
        component: StudentFormComponent
      },
      {
        path: 'students/:id',
        component: StudentDetailComponent
      },
      {
        path: 'students/:id/edit',
        component: StudentFormComponent
      },
      {
        path: 'attendance',
        component: PrivatePlaceholderComponent,
        data: {
          title: 'Présences',
          description: 'Cette section accueillera les présences, retards, absences et les vues par cours ou par date.'
        }
      },
      {
        path: 'follow-up',
        component: PrivatePlaceholderComponent,
        data: {
          title: 'Suivis',
          description: 'Cette section accueillera les remarques, observations, actions et le suivi pédagogique des élèves.'
        }
      },
      {
        path: 'settings',
        component: SettingsComponent
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
