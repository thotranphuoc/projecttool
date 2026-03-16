import { ApplicationRef, ChangeDetectionStrategy, Component, computed, effect, inject, signal, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { AuthService } from './core/auth/auth.service';
import { NotificationService } from './services/notification.service';
import { TimerService } from './services/timer.service';
import { TaskService } from './services/task.service';
import { Notification } from './shared/models';
import { ProjectService } from './services/project.service';
import { AppSettingsService } from './services/app-settings.service';
import { MatDialog } from '@angular/material/dialog';
import { filter } from 'rxjs';
import { APP_SLOGAN, NAV_ITEMS, type NavItem } from './app.constants';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatMenuModule,
    MatBadgeModule, MatTooltipModule, MatDividerModule
  ],
  template: `
    @if (auth.isLoading()) {
      <div class="loading-screen">
        <mat-icon class="spin">sync</mat-icon>
      </div>
    } @else if (!auth.isAuthenticated()) {
      <router-outlet />
    } @else {
      <mat-sidenav-container class="app-container">
        <mat-sidenav #sidenav [mode]="isMobile() ? 'over' : 'side'" [opened]="!isMobile()" class="sidenav">
          <!-- Logo -->
          <div class="sidenav-logo">
            <mat-icon class="logo-icon">sync_alt</mat-icon>
            <div class="logo-block">
              <span class="logo-text">Sync2Scale</span>
              <span class="logo-slogan">{{ slogan }}</span>
            </div>
          </div>
          <mat-divider />

          <!-- Navigation -->
          <mat-nav-list>
            @for (item of visibleNavItems(); track item.route) {
              <a mat-list-item
                 [routerLink]="item.route"
                 routerLinkActive="active-nav"
                 [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }">
                <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                <span matListItemTitle>{{ item.label }}</span>
              </a>
            }
          </mat-nav-list>

          <!-- Bottom: user info -->
          <div class="sidenav-bottom">
            <mat-divider />
            <div class="user-info" [matMenuTriggerFor]="userMenu">
              @if (auth.profile()?.photo_url) {
                <img [src]="auth.profile()!.photo_url!" class="user-avatar" alt="avatar"
                     (error)="avatarError = true" />
              } @else {
                <div class="user-avatar user-avatar-initial" [style.background]="avatarColor()">
                  {{ userInitial() }}
                </div>
              }
              <div class="user-details">
                <span class="user-name">{{ auth.profile()?.display_name || 'User' }}</span>
                <span class="user-role">{{ roleLabel() }}</span>
              </div>
              <mat-icon class="expand-icon">expand_more</mat-icon>
            </div>
          </div>
        </mat-sidenav>

        <mat-sidenav-content class="main-content">
          <!-- Top toolbar -->
          <mat-toolbar class="app-toolbar">
            <button mat-icon-button (click)="sidenav.toggle()" matTooltip="Toggle menu">
              <mat-icon>menu</mat-icon>
            </button>
            <span class="toolbar-spacer"></span>

            <!-- Notifications -->
            <button mat-icon-button
                    [matMenuTriggerFor]="notifMenu"
                    matTooltip="Thông báo"
                    [matBadge]="notifSvc.unreadCount() || null"
                    matBadgeColor="warn"
                    matBadgeSize="small">
              <mat-icon>notifications</mat-icon>
            </button>
          </mat-toolbar>

          <!-- Page content -->
          <div class="page-content">
            <router-outlet />
          </div>
        </mat-sidenav-content>
      </mat-sidenav-container>

      <!-- Global timer bar (always visible when running) -->
      @if (timerSvc.isRunning()) {
        <div class="timer-bar">
          <mat-icon>timer</mat-icon>
          <span>{{ timerSvc.formatTime(timerSvc.elapsed()) }}</span>
          <button type="button" class="timer-task-link" (click)="openTimerTaskDialog()" [matTooltip]="timerSvc.activeTimer()?.subtaskId ? 'Xem subtask' : 'Xem task'">
            @if (timerSvc.activeTimer()?.subtaskId && timerSvc.activeTimer()?.subtaskTitle) {
              <span>{{ timerSvc.activeTimer()?.taskTitle ?? 'Task' }} · {{ timerSvc.activeTimer()?.subtaskTitle }}</span>
            } @else {
              <span>{{ timerSvc.activeTimer()?.taskTitle ?? 'Task' }}</span>
            }
            @if (timerSvc.activeTimer()?.projectName) {
              <span class="timer-project"> — {{ timerSvc.activeTimer()?.projectName }}</span>
            }
          </button>
          <button mat-stroked-button color="warn" (click)="timerSvc.stop()">
            <mat-icon>stop</mat-icon> Dừng
          </button>
        </div>
      }

      <!-- User menu -->
      <mat-menu #userMenu="matMenu">
        <button mat-menu-item [routerLink]="'/profile'">
          <mat-icon>person</mat-icon> Profile
        </button>
        @if (auth.isAdmin()) {
          <button mat-menu-item [routerLink]="'/admin/users'">
            <mat-icon>admin_panel_settings</mat-icon> Quản lý Users
          </button>
          <button mat-menu-item [routerLink]="'/admin/settings'">
            <mat-icon>chat</mat-icon> Cài đặt Chat
          </button>
          <button mat-menu-item [routerLink]="'/admin/menu-settings'">
            <mat-icon>menu</mat-icon> Hiển thị menu
          </button>
          <button mat-menu-item [routerLink]="'/admin/export'">
            <mat-icon>download</mat-icon> Xuất dữ liệu
          </button>
          <button mat-menu-item [routerLink]="'/admin/data-management'">
            <mat-icon>delete_forever</mat-icon> Xóa Project / Task / Subtask
          </button>
        }
        @if (auth.isAdmin() || auth.isDirector()) {
          <button mat-menu-item [routerLink]="'/admin/error-logs'">
            <mat-icon>bug_report</mat-icon> Error Logs
          </button>
        }
        <mat-divider />
        <button mat-menu-item (click)="auth.signOut()">
          <mat-icon>logout</mat-icon> Đăng xuất
        </button>
      </mat-menu>

      <!-- Notifications menu -->
      <mat-menu #notifMenu="matMenu" class="notif-menu">
        <div class="notif-header" (click)="$event.stopPropagation()">
          <span>Thông báo</span>
          @if (notifSvc.unreadCount() > 0) {
            <button mat-button color="primary" (click)="notifSvc.markAllRead()">
              Đánh dấu đã đọc
            </button>
          }
        </div>
        <mat-divider />
        @if (notifSvc.notifications().length === 0) {
          <div class="notif-empty">Không có thông báo</div>
        }
        @for (notif of notifSvc.notifications().slice(0, 10); track notif.id) {
          <button mat-menu-item
                  [class.unread]="!notif.is_read"
                  (click)="onNotifClick(notif)">
            <mat-icon matListItemIcon>{{ notifIcon(notif.type) }}</mat-icon>
            <span class="notif-content">
              <strong>{{ notif.title }}</strong>
              <small>{{ notif.body }}</small>
            </span>
          </button>
        }
      </mat-menu>
    }
  `,
  styles: [`
    .loading-screen {
      display: flex; align-items: center; justify-content: center;
      height: 100vh; background: #f5f5f5;
    }
    .spin { animation: spin 1s linear infinite; font-size: 48px; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    .app-container { height: 100vh; }
    .sidenav { width: 240px; background: #1e293b; color: white; display: flex; flex-direction: column; }
    .sidenav-logo {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 16px; background: #0f172a;
    }
    .logo-icon { font-size: 28px; width: 28px; height: 28px; color: #60a5fa; }
    .logo-block { display: flex; flex-direction: column; gap: 2px; }
    .logo-text { font-size: 18px; font-weight: 700; color: white; letter-spacing: 0.5px; }
    .logo-slogan { font-size: 11px; color: #94a3b8; font-weight: 500; letter-spacing: 0.2px; }

    mat-nav-list { padding-top: 8px; flex: 1; }
    :host ::ng-deep .sidenav mat-nav-list .mat-mdc-list-item,
    :host ::ng-deep .sidenav mat-nav-list a.mat-mdc-list-item {
      color: #ffffff !important;
      border-radius: 8px;
      margin: 2px 8px;
    }
    :host ::ng-deep .sidenav mat-nav-list .mat-mdc-list-item .mdc-list-item__primary-text,
    :host ::ng-deep .sidenav mat-nav-list .mat-mdc-list-item .mdc-list-item__start,
    :host ::ng-deep .sidenav mat-nav-list .mat-mdc-list-item .mat-icon,
    :host ::ng-deep .sidenav mat-nav-list a.mat-mdc-list-item .mdc-list-item__primary-text,
    :host ::ng-deep .sidenav mat-nav-list a.mat-mdc-list-item .mdc-list-item__start,
    :host ::ng-deep .sidenav mat-nav-list a.mat-mdc-list-item .mat-icon {
      color: #ffffff !important;
    }
    :host ::ng-deep .sidenav mat-nav-list .mat-mdc-list-item:hover,
    :host ::ng-deep .sidenav mat-nav-list a.mat-mdc-list-item:hover {
      background: rgba(255,255,255,0.08) !important;
      color: white !important;
    }
    :host ::ng-deep .sidenav mat-nav-list .mat-mdc-list-item:hover .mdc-list-item__primary-text,
    :host ::ng-deep .sidenav mat-nav-list .mat-mdc-list-item:hover .mdc-list-item__start,
    :host ::ng-deep .sidenav mat-nav-list .mat-mdc-list-item:hover .mat-icon,
    :host ::ng-deep .sidenav mat-nav-list a.mat-mdc-list-item:hover .mdc-list-item__primary-text,
    :host ::ng-deep .sidenav mat-nav-list a.mat-mdc-list-item:hover .mdc-list-item__start,
    :host ::ng-deep .sidenav mat-nav-list a.mat-mdc-list-item:hover .mat-icon {
      color: white !important;
    }
    :host ::ng-deep .sidenav mat-nav-list a.active-nav.mat-mdc-list-item {
      background: #3b82f6 !important;
      color: white !important;
    }
    :host ::ng-deep .sidenav mat-nav-list a.active-nav.mat-mdc-list-item .mdc-list-item__primary-text,
    :host ::ng-deep .sidenav mat-nav-list a.active-nav.mat-mdc-list-item .mdc-list-item__start,
    :host ::ng-deep .sidenav mat-nav-list a.active-nav.mat-mdc-list-item .mat-icon {
      color: white !important;
    }

    .sidenav-bottom { padding: 8px; }
    .user-info {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 8px; border-radius: 8px; cursor: pointer;
      transition: background 0.2s;
    }
    .user-info:hover { background: rgba(255,255,255,0.08); }
    .user-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .user-avatar-initial { display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: white; }
    .user-details { flex: 1; min-width: 0; }
    .user-name { display: block; font-size: 13px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { display: block; font-size: 11px; color: #94a3b8; }
    .expand-icon { color: #94a3b8; font-size: 18px; width: 18px; height: 18px; }

    .main-content { display: flex; flex-direction: column; background: #f8fafc; }
    .app-toolbar { background: white; border-bottom: 1px solid #e2e8f0; box-shadow: none; position: sticky; top: 0; z-index: 10; }
    .toolbar-spacer { flex: 1; }
    .page-content { flex: 1; overflow: auto; padding: 24px; }

    .notif-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; font-weight: 600; }
    .notif-empty { padding: 24px 16px; text-align: center; color: #94a3b8; font-size: 14px; }
    .notif-content { display: flex; flex-direction: column; }
    .notif-content small { color: #64748b; font-size: 12px; }
    button.unread { background: #eff6ff; }

    .timer-bar {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: #0f172a; color: white;
      display: flex; align-items: center; gap: 12px; padding: 10px 24px;
      z-index: 100;
    }
    .timer-task-link {
      flex: 1; text-align: left; background: none; border: none; color: #94a3b8;
      font-size: 14px; cursor: pointer; padding: 4px 0;
      transition: color 0.2s; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .timer-task-link:hover { color: white; text-decoration: underline; }
    .timer-project { color: #64748b; font-size: 13px; }

    @media (max-width: 768px) {
      .sidenav { width: 240px; }
      .page-content { padding: 12px; }
      .timer-bar { padding: 8px 12px; gap: 8px; }
      .timer-bar mat-icon { display: none; }
    }
  `]
})
export class AppComponent {
  @ViewChild('sidenav') private sidenav?: MatSidenav;

  readonly slogan = APP_SLOGAN;
  readonly auth      = inject(AuthService);
  readonly notifSvc  = inject(NotificationService);
  readonly timerSvc  = inject(TimerService);
  private dialog     = inject(MatDialog);
  private taskSvc    = inject(TaskService);
  private projectSvc = inject(ProjectService);
  private appSettingsSvc = inject(AppSettingsService);
  private router     = inject(Router);
  private appRef     = inject(ApplicationRef);
  private bp         = inject(BreakpointObserver);

  /** True when viewport ≤ 768 px */
  readonly isMobile = signal(false);

  avatarError = false;

  async openTimerTaskDialog(): Promise<void> {
    const timer = this.timerSvc.activeTimer();
    if (!timer?.projectId || !timer?.taskId) return;
    const task = await this.taskSvc.getTask(timer.projectId, timer.taskId);
    if (!task) return;
    if (timer.subtaskId) {
      const subtasks = await this.taskSvc.getSubtasks(timer.taskId);
      const subtask = subtasks.find(s => s.id === timer.subtaskId);
      if (!subtask) return;
      const membersRaw = await this.projectSvc.getMembers(timer.projectId);
      const members = (membersRaw as any[]).map((m: any) => {
        const p = m.profiles ?? m.profile;
        return {
          user_id: m.user_id,
          display_name: p?.display_name ?? p?.email ?? 'User',
          email: p?.email
        };
      });
      const { SubtaskEditDialogComponent } = await import('./features/project/subtask-edit-dialog.component');
      this.dialog.open(SubtaskEditDialogComponent, {
        width: '400px', maxWidth: '95vw',
        data: { task, projectId: timer.projectId, subtask, members }
      });
    } else {
      const { TaskDialogComponent } = await import('./features/project/task-dialog.component');
      this.dialog.open(TaskDialogComponent, {
        width: '560px', maxWidth: '95vw',
        data: { projectId: timer.projectId, task }
      });
    }
  }

  readonly userInitial = computed(() => {
    const name = this.auth.profile()?.display_name ?? this.auth.profile()?.email ?? '?';
    return name.charAt(0).toUpperCase();
  });

  readonly avatarColor = computed(() => {
    const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];
    const name   = this.auth.profile()?.email ?? 'A';
    return colors[name.charCodeAt(0) % colors.length];
  });

  constructor() {
    effect(() => {
      if (this.auth.userId()) {
        this.projectSvc.loadProjects();
        this.appSettingsSvc.loadAppSettings();
      }
    });

    // Track mobile breakpoint
    this.bp.observe([Breakpoints.XSmall, '(max-width: 768px)'])
      .subscribe(state => { this.isMobile.set(state.matches); this.appRef.tick(); });

    // Zoneless: trigger change detection after navigation so routed components render
    // On mobile: also close the drawer after navigation
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isMobile()) this.sidenav?.close();
        this.appRef.tick();
      });
  }

  readonly isManagerOfAnyProject = computed(() => {
    const uid = this.auth.userId();
    if (!uid) return false;
    return this.projectSvc.projects().some(
      (p: any) => (p.project_members as any[])?.some((m: any) => m.user_id === uid && m.project_role === 'manager')
    );
  });

  readonly visibleNavItems = computed(() => {
    const role = this.auth.systemRole();
    const showManager = role === 'user' && this.isManagerOfAnyProject();
    const menuVis = this.appSettingsSvc.menuVisibility();
    return NAV_ITEMS.filter(item => {
      if (menuVis[item.route] === false) return false;
      if (!item.roles) return true;
      return item.roles.includes(role) || (showManager && item.roles.includes('manager'));
    });
  });

  readonly roleLabel = computed(() => {
    const r = this.auth.systemRole();
    return r === 'admin' ? 'Admin' : r === 'director' ? 'Director' : 'User';
  });

  notifIcon(type: string): string {
    const map: Record<string, string> = {
      task_assigned: 'assignment_ind',
      task_deadline: 'schedule',
      task_status_changed: 'swap_horiz',
      mention: 'alternate_email',
      new_message: 'message',
      added_to_project: 'folder_shared',
      objective_status_changed: 'track_changes',
    };
    return map[type] ?? 'notifications';
  }

  async onNotifClick(notif: Notification): Promise<void> {
    await this.notifSvc.markRead(notif.id);
    const eid = notif.entity_id;
    const etype = notif.entity_type;
    if (!eid || !etype) return;
    switch (etype) {
      case 'project':
        this.router.navigate(['/project', eid]);
        break;
      case 'objective':
        this.router.navigate(['/objectives']);
        break;
      case 'message':
        this.router.navigate(['/chat']);
        break;
      case 'task': {
        const projectId = await this.taskSvc.getTaskProjectId(eid);
        if (projectId) this.router.navigate(['/project', projectId], { queryParams: { openTask: eid } });
        break;
      }
      default:
        break;
    }
  }
}
