import { Routes } from '@angular/router';
import { authGuard, adminGuard, directorGuard, pmOrDirectorOrAdminGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },

  {
    path: 'project/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/project/project.component').then(m => m.ProjectComponent)
  },

  {
    path: 'objectives',
    canActivate: [authGuard],
    loadComponent: () => import('./features/objectives/objectives.component').then(m => m.ObjectivesComponent)
  },

  {
    path: 'strategy',
    canActivate: [authGuard],
    loadComponent: () => import('./features/strategy/strategy.component').then(m => m.StrategyComponent)
  },

  {
    path: 'big-picture',
    canActivate: [authGuard],
    loadComponent: () => import('./features/strategy/big-picture.component').then(m => m.BigPictureComponent)
  },

  {
    path: 'team-activity',
    canActivate: [authGuard],
    loadComponent: () => import('./features/team-activity/team-activity.component').then(m => m.TeamActivityComponent)
  },

  {
    path: 'user-subtasks',
    canActivate: [authGuard, pmOrDirectorOrAdminGuard],
    loadComponent: () => import('./features/team-activity/user-subtasks.component').then(m => m.UserSubtasksComponent)
  },

  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () => import('./features/chat/chat.component').then(m => m.ChatComponent)
  },

  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
  },

  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      {
        path: 'users',
        loadComponent: () => import('./features/admin/admin-users.component').then(m => m.AdminUsersComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/admin/admin-settings.component').then(m => m.AdminSettingsComponent)
      },
      {
        path: 'menu-settings',
        loadComponent: () => import('./features/admin/admin-menu-settings.component').then(m => m.AdminMenuSettingsComponent)
      }
    ]
  },

  { path: '**', redirectTo: '/dashboard' }
];
