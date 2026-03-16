import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../core/auth/auth.service';
import { ProjectService } from '../../services/project.service';
import { ConfirmService } from '../../services/confirm.service';
import { Project } from '../../shared/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, FormsModule, DatePipe,
    MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatProgressBarModule, MatTooltipModule,
    MatMenuModule, MatBadgeModule
  ],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="text-muted text-sm">Xin chào, {{ auth.profile()?.display_name || 'User' }}</p>
        </div>
        @if (auth.isAdmin()) {
          <button mat-flat-button color="primary" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon> Tạo project
          </button>
        }
      </div>

      <!-- Search & filter -->
      <div class="search-bar mb-4">
        <mat-icon class="search-icon">search</mat-icon>
        <input [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Tìm project..." class="search-input" />
      </div>

      <!-- Projects grid -->
      @if (projectSvc.isLoading()) {
        <div class="loading-grid">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="skeleton-card"></div>
          }
        </div>
      } @else if (filteredProjects().length === 0) {
        <div class="empty-state">
          <mat-icon>folder_open</mat-icon>
          <h3>Chưa có project nào</h3>
          <p>{{ auth.isAdmin() ? 'Tạo project mới để bắt đầu.' : 'Liên hệ admin để được thêm vào project.' }}</p>
        </div>
      } @else {
        <div class="projects-grid">
          @for (project of filteredProjects(); track project.id) {
            <div class="project-card card">
              <!-- Card header -->
              <div class="project-card-header">
                <div class="project-icon" [style.background]="projectColor(project.id)">
                  {{ project.name.charAt(0).toUpperCase() }}
                </div>
                <div class="project-info flex-1">
                  <h3 class="project-name truncate">{{ project.name }}</h3>
                  <span class="text-muted text-xs">{{ project.client_name || 'No client' }}</span>
                </div>
                <div class="project-actions">
                  <span class="status-chip" [class]="'status-' + project.status">
                    {{ statusLabel(project.status) }}
                  </span>
                  @if (projectSvc.isManager(project.id)) {
                    <button mat-icon-button [matMenuTriggerFor]="projectMenu" (click)="$event.preventDefault()">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #projectMenu="matMenu">
                      <button mat-menu-item (click)="openEditDialog(project)">
                        <mat-icon>edit</mat-icon> Sửa
                      </button>
                      <button mat-menu-item (click)="openMembersDialog(project)">
                        <mat-icon>group</mat-icon> Thành viên
                      </button>
                      @if (auth.isAdmin()) {
                        <button mat-menu-item class="delete-item" (click)="deleteProject(project)">
                          <mat-icon color="warn">delete</mat-icon> Xóa
                        </button>
                      }
                    </mat-menu>
                  }
                </div>
              </div>

              <!-- Progress -->
              <div class="project-progress">
                <div class="progress-info">
                  <span class="text-xs text-muted">Tiến độ</span>
                  <span class="text-xs font-semibold">{{ progressPct(project) }}%</span>
                </div>
                <mat-progress-bar mode="determinate" [value]="progressPct(project)" class="progress-bar" />
              </div>

              <!-- Stats -->
              <div class="project-stats">
                <div class="stat-item">
                  <mat-icon class="stat-icon">task_alt</mat-icon>
                  <span>{{ project.stats_completed_tasks }}/{{ project.stats_total_tasks }} tasks</span>
                </div>
                <div class="stat-item">
                  <mat-icon class="stat-icon">people</mat-icon>
                  <span>{{ memberCount(project) }} thành viên</span>
                </div>
                @if (project.end_date) {
                  <div class="stat-item" [class.overdue]="isOverdue(project.end_date)">
                    <mat-icon class="stat-icon">calendar_today</mat-icon>
                    <span>{{ project.end_date | date:'dd/MM/yy' }}</span>
                  </div>
                }
              </div>

              <!-- Navigate button -->
              <a [routerLink]="['/project', project.id]" class="open-btn">
                <span>Mở project</span>
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1400px; margin: 0 auto; }
    .search-bar {
      display: flex; align-items: center; gap: 8px;
      background: white; border: 1px solid #e2e8f0;
      border-radius: 10px; padding: 10px 16px;
    }
    .search-icon { color: #94a3b8; }
    .search-input { border: none; outline: none; flex: 1; font-size: 14px; background: transparent; }
    .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 20px; }
    .loading-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 20px; }
    .skeleton-card { height: 200px; border-radius: 12px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); animation: shimmer 1.5s infinite; }
    @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
    .project-card { padding: 20px; display: flex; flex-direction: column; gap: 16px; transition: transform 0.2s, box-shadow 0.2s; }
    .project-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
    .project-card-header { display: flex; align-items: center; gap: 12px; }
    .project-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 700; flex-shrink: 0; }
    .project-name { margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; }
    .project-actions { display: flex; align-items: center; gap: 4px; }
    .status-chip { padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .status-planning     { background: #f1f5f9; color: #64748b; }
    .status-in_progress  { background: #dbeafe; color: #2563eb; }
    .status-on_hold      { background: #fef9c3; color: #ca8a04; }
    .status-completed    { background: #dcfce7; color: #16a34a; }
    .status-cancelled    { background: #fee2e2; color: #dc2626; }
    .progress-info { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .progress-bar { border-radius: 4px; height: 6px; }
    .project-stats { display: flex; gap: 16px; flex-wrap: wrap; }
    .stat-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .stat-item.overdue { color: #dc2626; }
    .stat-icon { font-size: 15px; width: 15px; height: 15px; }
    .open-btn { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border-radius: 8px; text-decoration: none; color: #3b82f6; font-weight: 600; font-size: 14px; border: 1px solid #e2e8f0; transition: background 0.2s; margin-top: auto; }
    .open-btn:hover { background: #eff6ff; }
    .empty-state { text-align: center; padding: 80px 24px; }
    .empty-state mat-icon { font-size: 64px; width: 64px; height: 64px; color: #cbd5e1; }
    .empty-state h3 { color: #475569; margin: 16px 0 8px; }
    .empty-state p  { color: #94a3b8; }
  `]
})
export class DashboardComponent implements OnInit {
  readonly auth       = inject(AuthService);
  readonly projectSvc = inject(ProjectService);
  private dialog = inject(MatDialog);
  private confirmSvc = inject(ConfirmService);
  searchQuery    = signal('');

  readonly filteredProjects = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.projectSvc.projects().filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.client_name ?? '').toLowerCase().includes(q)
    );
  });

  ngOnInit(): void { this.projectSvc.loadProjects(); }

  progressPct(p: Project): number {
    if (!p.stats_total_tasks) return 0;
    return Math.round((p.stats_completed_tasks / p.stats_total_tasks) * 100);
  }

  memberCount(p: Project): number {
    return (p as any).project_members?.length ?? 0;
  }

  isOverdue(date: string): boolean {
    return new Date(date) < new Date();
  }

  projectColor(id: string): string {
    const colors = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];
    return colors[id.charCodeAt(0) % colors.length];
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      planning: 'Lên kế hoạch', in_progress: 'Đang thực hiện',
      on_hold: 'Tạm dừng', completed: 'Hoàn thành', cancelled: 'Đã hủy'
    };
    return map[status] ?? status;
  }

  async openCreateDialog(): Promise<void> {
    const { ProjectDialogComponent } = await import('./project-dialog.component');
    const ref = this.dialog.open(ProjectDialogComponent, { width: '600px', maxWidth: '95vw', data: { project: null } });
    ref.afterClosed().subscribe(result => { if (result) this.projectSvc.loadProjects(); });
  }

  async openEditDialog(project: Project): Promise<void> {
    const { ProjectDialogComponent } = await import('./project-dialog.component');
    const ref = this.dialog.open(ProjectDialogComponent, { width: '600px', maxWidth: '95vw', data: { project } });
    ref.afterClosed().subscribe(result => { if (result) this.projectSvc.loadProjects(); });
  }

  async openMembersDialog(project: Project): Promise<void> {
    const { ProjectMembersDialogComponent } = await import('./project-members-dialog.component');
    this.dialog.open(ProjectMembersDialogComponent, { width: '500px', maxWidth: '95vw', data: { project } });
  }

  async deleteProject(project: Project): Promise<void> {
    if (!(await this.confirmSvc.open({ title: 'Xóa project', message: `Xóa project "${project.name}"? Hành động này không thể hoàn tác.`, confirmText: 'Xóa', confirmWarn: true }))) return;
    await this.projectSvc.deleteProject(project.id);
  }
}
