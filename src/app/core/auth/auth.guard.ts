import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ProjectService } from '../../services/project.service';

export const authGuard: CanActivateFn = (route) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoading()) {
    // Session not yet restored — allow, component should handle loading state
    return true;
  }
  if (auth.isAuthenticated()) return true;

  const returnUrl = route.url.map(s => s.path).join('/');
  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
};

export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isAdmin()) return true;
  return router.createUrlTree(['/dashboard']);
};

export const directorGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isDirector()) return true;
  return router.createUrlTree(['/dashboard']);
};

/** PM (manager of any project), Director, or Admin only. */
export const pmOrDirectorOrAdminGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const projectSvc = inject(ProjectService);
  if (auth.isAdmin() || auth.isDirector()) return true;
  await projectSvc.loadProjects();
  const uid = auth.userId();
  const isManager = uid && projectSvc.projects().some(
    (p: any) => (p.project_members as any[])?.some((m: any) => m.user_id === uid && m.project_role === 'manager')
  );
  if (isManager) return true;
  return router.createUrlTree(['/dashboard']);
};
