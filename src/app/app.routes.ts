import { Routes } from '@angular/router';
import { authGuard } from './helpers/auth.guard';
import { permissionGuard } from './helpers/permission.guard';
import { AuthCallbackComponent } from './pages/auth/auth-callback.component';
import { LoginPageComponent } from './pages/auth/login-page.component';
import { DashboardComponent } from './pages/private/dashboard.component';
import { DashboardHomeComponent } from './pages/private/dashboard-home.component';
import { ClassJournalComponent } from './pages/private/class-journal/class-journal.component';
import { PrivatePlaceholderComponent } from './pages/private/private-placeholder.component';
import { SettingsComponent } from './pages/private/settings/settings.component';
import { SettingsProgramPageComponent } from './pages/private/settings/settings-program-page.component';
import { StudentFormComponent } from './pages/private/students/student-form.component';
import { Students } from './pages/private/students/students';
import { TeacherProfileComponent } from './pages/private/teacher-profile.component';

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
        component: Students,
        canActivate: [permissionGuard],
        data: { permission: 'students.read' }
      },
      {
        path: 'students/new',
        component: StudentFormComponent,
        canActivate: [permissionGuard],
        data: { permission: 'students.manage' }
      },
      {
        path: 'students/:id/assessment',
        loadComponent: () =>
          import('./pages/private/students/student-assessment.component').then(
            (module) => module.StudentAssessmentComponent
          ),
        canActivate: [permissionGuard],
        data: { permission: 'teaching.manage' }
      },
      {
        path: 'students/:id',
        loadComponent: () =>
          import('./pages/private/students/student-detail.component').then(
            (module) => module.StudentDetailComponent
          ),
        canActivate: [permissionGuard],
        data: { permission: 'students.read' }
      },
      {
        path: 'students/:id/edit',
        component: StudentFormComponent,
        canActivate: [permissionGuard],
        data: { permission: 'students.manage' }
      },
      {
        path: 'class-journal',
        component: ClassJournalComponent,
        canActivate: [permissionGuard],
        data: { permission: 'teaching.manage' }
      },
      {
        path: 'teacher-profile',
        component: TeacherProfileComponent
      },
      {
        path: 'attendance',
        component: PrivatePlaceholderComponent,
        canActivate: [permissionGuard],
        data: {
          permission: 'teaching.manage',
          title: 'Présences',
          description: 'Cette section accueillera les présences, retards, absences et les vues par cours ou par date.'
        }
      },
      {
        path: 'follow-up',
        component: PrivatePlaceholderComponent,
        canActivate: [permissionGuard],
        data: {
          permission: 'teaching.manage',
          title: 'Suivis',
          description: 'Cette section accueillera les remarques, observations, actions et le suivi pédagogique des élèves.'
        }
      },
      {
        path: 'settings/program',
        component: SettingsProgramPageComponent,
        canActivate: [permissionGuard],
        data: { permissions: ['programs.manage', 'programs.personal_manage'] }
      },
      {
        path: 'settings',
        component: SettingsComponent,
        canActivate: [permissionGuard],
        data: { permissions: ['directory.manage', 'programs.manage', 'schedules.manage'] }
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/private/users/users.component').then((module) => module.UsersComponent),
        canActivate: [permissionGuard],
        data: { permission: 'users.manage' }
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
