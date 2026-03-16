import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { ProjectService } from '../../services/project.service';
import { SupabaseService } from '../../core/supabase.service';
import { RouterLink } from '@angular/router';
import { Profile, ActiveTimer } from '../../shared/models';
import { SecondsToHmsPipe } from '../../shared/pipes/seconds-to-hms.pipe';

interface CurrentWork {
  projectId: string;
  projectName: string | null;
  taskId: string;
  taskTitle: string | null;
  subtaskId: string | null;
  subtaskTitle: string | null;
}

interface UserActivity {
  profile: Profile;
  totalTasks: number;
  doneTasks: number;
  doneSubtasks: number;
  totalSubtasks: number;
  totalSeconds: number;
  todaySeconds: number;
  isRunning: boolean;
  currentWork: CurrentWork | null;
}

@Component({
  selector: 'app-team-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    MatFormFieldModule, MatSelectModule, MatIconModule,
    MatButtonModule, MatTableModule, MatChipsModule, MatTooltipModule, SecondsToHmsPipe
  ],
  template: `
    <div class="team-page">
      <div class="page-header">
        <h1 class="page-title">Team Activity</h1>
        <mat-form-field appearance="outline" class="project-filter-field">
          <mat-label>Project</mat-label>
          <mat-select [ngModel]="selectedProjectId()" (ngModelChange)="selectedProjectId.set($event); load()">
            <mat-option value="">Tất cả</mat-option>
            @for (p of accessibleProjects(); track p.id) {
              <mat-option [value]="p.id">{{ p.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="table-card card">
        <table mat-table [dataSource]="activities()" class="activity-table">
          <ng-container matColumnDef="user">
            <th mat-header-cell *matHeaderCellDef>Thành viên</th>
            <td mat-cell *matCellDef="let row">
              <div class="user-cell">
                @if (row.profile.photo_url && !avatarError(row.profile.id)) {
                  <img [src]="row.profile.photo_url" class="row-avatar" alt=""
                       (error)="setAvatarError(row.profile.id)" />
                } @else {
                  <span class="row-avatar row-avatar-initial">{{ rowInitial(row) }}</span>
                }
                <div>
                  <div class="font-semibold text-sm">{{ row.profile.display_name }}</div>
                  <div class="text-xs text-muted">{{ row.profile.email }}</div>
                </div>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Trạng thái</th>
            <td mat-cell *matCellDef="let row">
              @if (row.isRunning) {
                <span class="running-badge"><mat-icon>radio_button_checked</mat-icon> Đang làm</span>
              } @else {
                <span class="idle-badge">Rảnh</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="currentWork">
            <th mat-header-cell *matHeaderCellDef>Đang làm</th>
            <td mat-cell *matCellDef="let row">
              @if (row.currentWork) {
                <div class="current-work-cell">
                  <a [routerLink]="['/project', row.currentWork.projectId]" class="current-work-link">
                    {{ row.currentWork.projectName || 'Dự án' }}
                  </a>
                  <div class="current-work-detail text-xs text-muted">
                    Task: {{ row.currentWork.taskTitle || 'Task' }}
                    @if (row.currentWork.subtaskTitle) {
                      <span> · Subtask: {{ row.currentWork.subtaskTitle }}</span>
                    }
                  </div>
                </div>
              } @else {
                —
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="tasks">
            <th mat-header-cell *matHeaderCellDef class="hide-mobile">Tasks</th>
            <td mat-cell *matCellDef="let row" class="hide-mobile">
              <span class="font-semibold">{{ row.doneTasks }}</span>
              <span class="text-muted">/{{ row.totalTasks }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="subtasks">
            <th mat-header-cell *matHeaderCellDef class="hide-mobile">Subtasks</th>
            <td mat-cell *matCellDef="let row" class="hide-mobile">
              <span class="font-semibold">{{ row.doneSubtasks }}</span>
              <span class="text-muted">/{{ row.totalSubtasks }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="totalTime">
            <th mat-header-cell *matHeaderCellDef class="hide-mobile">Tổng thời gian</th>
            <td mat-cell *matCellDef="let row" class="hide-mobile">{{ row.totalSeconds | secondsToHms }}</td>
          </ng-container>

          <ng-container matColumnDef="todayTime">
            <th mat-header-cell *matHeaderCellDef>Hôm nay</th>
            <td mat-cell *matCellDef="let row">{{ row.todaySeconds | secondsToHms }}</td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        
        </table>

        @if (isLoading()) {
          <div class="table-loading">Đang tải...</div>
        } @else if (activities().length === 0) {
          <div class="table-empty">Không có dữ liệu</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .team-page { max-width: 1100px; margin: 0 auto; }
    .table-card { overflow-x: auto; }
    .activity-table { width: 100%; min-width: 640px; }
    .user-cell { display: flex; align-items: center; gap: 10px; }
    .row-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .row-avatar-initial { display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 14px; font-weight: 600; }
    .running-badge { display: flex; align-items: center; gap: 4px; color: #16a34a; font-size: 13px; font-weight: 600; }
    .running-badge mat-icon { font-size: 14px; width: 14px; height: 14px; animation: pulse 1.5s ease-in-out infinite; }
    .idle-badge { color: #94a3b8; font-size: 13px; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .table-loading, .table-empty { text-align: center; padding: 32px; color: #94a3b8; }
    th.mat-header-cell { font-weight: 700; font-size: 13px; color: #374151; }
    .current-work-cell { display: flex; flex-direction: column; gap: 2px; }
    .current-work-link { color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 13px; }
    .current-work-link:hover { text-decoration: underline; }
    .current-work-detail { font-size: 12px; color: #64748b; }
    .project-filter-field { width: 220px; }
    @media (max-width: 768px) {
      .project-filter-field { width: 100%; }
      .hide-mobile { display: none !important; }
      .activity-table { min-width: 360px; }
    }
  `]
})
export class TeamActivityComponent implements OnInit, OnDestroy {
  readonly auth       = inject(AuthService);
  readonly projectSvc = inject(ProjectService);
  private supabase    = inject(SupabaseService).client;

  selectedProjectId = signal('');
  isLoading         = signal(false);
  activities        = signal<UserActivity[]>([]);
  displayedColumns  = ['user', 'status', 'currentWork', 'tasks', 'subtasks', 'totalTime', 'todayTime'];
  private avatarErrorIds = signal<Set<string>>(new Set());
  private channel: ReturnType<typeof this.supabase.channel> | null = null;

  rowInitial(row: UserActivity): string {
    return (row.profile.display_name || row.profile.email || '?').charAt(0).toUpperCase();
  }
  avatarError(profileId: string): boolean { return this.avatarErrorIds().has(profileId); }
  setAvatarError(profileId: string): void {
    this.avatarErrorIds.update(s => { const n = new Set(s); n.add(profileId); return n; });
  }

  private currentWorkFromTimer(timer: ActiveTimer | null): CurrentWork | null {
    if (!timer?.isRunning || !timer) return null;
    return {
      projectId: timer.projectId,
      projectName: timer.projectName ?? null,
      taskId: timer.taskId,
      taskTitle: timer.taskTitle ?? null,
      subtaskId: timer.subtaskId ?? null,
      subtaskTitle: timer.subtaskTitle ?? null
    };
  }

  readonly accessibleProjects = computed(() => {
    if (this.auth.isDirector()) return this.projectSvc.projects();
    const uid = this.auth.userId();
    return this.projectSvc.projects().filter(p =>
      (p as any).project_members?.some((m: any) => m.user_id === uid)
    );
  });

  ngOnInit(): void {
    this.projectSvc.loadProjects().then(() => {
      if (this.accessibleProjects().length > 0) {
        this.selectedProjectId.set(this.accessibleProjects()[0].id);
        this.load();
      }
    });
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    const today = new Date().toISOString().split('T')[0];

    // Get members (when "Tất cả": one row per user; when one project: one row per membership)
    let membersQuery = this.supabase.from('project_members').select('user_id, profiles(*)');
    if (this.selectedProjectId()) membersQuery = membersQuery.eq('project_id', this.selectedProjectId());
    const { data: members } = await membersQuery;

    // Dedupe by user_id so each user appears once (avoids duplicates when filter is "Tất cả")
    const seenUserIds = new Set<string>();
    const uniqueMembers = (members ?? []).filter((m: any) => {
      const uid = m.user_id;
      if (seenUserIds.has(uid)) return false;
      seenUserIds.add(uid);
      return true;
    });

    const userActivities: UserActivity[] = [];
    for (const m of uniqueMembers) {
      const profile = (m as any).profiles as Profile;
      if (!profile) continue;

      // Tasks count
      let tasksQuery = this.supabase.from('tasks').select('id, status, assignees_preview').contains('assignees_preview', [profile.id]);
      if (this.selectedProjectId()) tasksQuery = tasksQuery.eq('project_id', this.selectedProjectId());
      const { data: tasks } = await tasksQuery;

      // Time logs
      let logsQuery = this.supabase.from('time_logs').select('seconds, created_at').eq('user_id', profile.id);
      if (this.selectedProjectId()) {
        const taskIds = (tasks ?? []).map((t: any) => t.id);
        if (taskIds.length) logsQuery = logsQuery.in('task_id', taskIds);
      }
      const { data: logs } = await logsQuery;

      const totalSeconds = (logs ?? []).reduce((s: number, l: any) => s + l.seconds, 0);
      const todaySeconds = (logs ?? []).filter((l: any) => l.created_at.startsWith(today)).reduce((s: number, l: any) => s + l.seconds, 0);

      // Subtasks: assignees chứa user, đếm done/total (giống Tasks)
      let subtasksQuery = this.supabase.from('subtasks').select('id, status').contains('assignees', [profile.id]);
      if (this.selectedProjectId()) subtasksQuery = subtasksQuery.eq('project_id', this.selectedProjectId());
      const { data: subtasks } = await subtasksQuery;
      const totalSubtasks = (subtasks ?? []).length;
      const doneSubtasks = (subtasks ?? []).filter((s: any) => s.status === 'done').length;

      userActivities.push({
        profile,
        totalTasks: (tasks ?? []).length,
        doneTasks:  (tasks ?? []).filter((t: any) => t.status === 'done').length,
        doneSubtasks,
        totalSubtasks,
        totalSeconds, todaySeconds,
        isRunning: !!profile.active_timer?.isRunning,
        currentWork: this.currentWorkFromTimer(profile.active_timer ?? null)
      });
    }
    this.activities.set(userActivities);
    this.isLoading.set(false);
    this.subscribeProfilesRealtime();
  }

  /** Realtime for status column only; few events (timer start/stop) so low performance/cost impact. */
  private subscribeProfilesRealtime(): void {
    if (this.channel) return;
    this.channel = this.supabase
      .channel('team-activity:profiles')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles'
      }, (payload: { new: Record<string, unknown> }) => {
        const raw = payload.new;
        if (!raw) return;
        const idVal = raw['id'];
        const id = typeof idVal === 'string' ? idVal : (idVal as unknown as { toString?: () => string })?.toString?.();
        if (!id) return;
        let activeTimer = raw['active_timer'];
        if (typeof activeTimer === 'string') {
          try { activeTimer = JSON.parse(activeTimer) as ActiveTimer; } catch { activeTimer = null; }
        }
        const timer = (activeTimer as ActiveTimer | null | undefined) ?? null;
        this.activities.update(list =>
          list.map(row =>
            String(row.profile.id) === String(id)
              ? {
                  ...row,
                  isRunning: !!timer?.isRunning,
                  profile: { ...row.profile, active_timer: timer },
                  currentWork: this.currentWorkFromTimer(timer)
                }
              : row
          )
        );
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' && err) console.warn('[Team Activity] Realtime profiles channel error:', err);
      });
  }

  ngOnDestroy(): void {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
