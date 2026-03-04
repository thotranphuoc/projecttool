import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ProjectService } from '../../services/project.service';
import { SupabaseService } from '../../core/supabase.service';
import { SecondsToHmsPipe } from '../../shared/pipes/seconds-to-hms.pipe';
import { Subtask, SUBTASK_STATUS_OPTIONS } from '../../shared/models';

export interface UserSubtaskRow {
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  subtask: Subtask;
  needsSupport: boolean;
  assigneeDisplay: string;
}

@Component({
  selector: 'app-user-subtasks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatSortModule,
    MatTooltipModule,
    SecondsToHmsPipe,
    DatePipe
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">Subtask theo user</h1>
        <div class="filters">
          <mat-form-field appearance="outline">
            <mat-label>Dự án</mat-label>
            <mat-select [ngModel]="selectedProjectId()" (ngModelChange)="selectedProjectId.set($event); onProjectChange()">
              <mat-option value="">Tất cả dự án</mat-option>
              @for (p of accessibleProjects(); track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Thành viên</mat-label>
            <mat-select [ngModel]="selectedUserId()" (ngModelChange)="selectedUserId.set($event); load()">
              <mat-option value="">-- Chọn user --</mat-option>
              <mat-option value="__all__">Tất cả thành viên</mat-option>
              @for (u of memberOptions(); track u.id) {
                <mat-option [value]="u.id">{{ u.display_name || u.email }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Trạng thái</mat-label>
            <mat-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); applyFilter()">
              <mat-option value="">Tất cả</mat-option>
              @for (opt of statusOptions; track opt.status) {
                <mat-option [value]="opt.status">{{ opt.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-stroked-button (click)="exportCsv()" [disabled]="rows().length === 0">
            <mat-icon>download</mat-icon> Xuất CSV
          </button>
        </div>
      </div>

      <div class="table-card card">
        <table mat-table [dataSource]="dataSource()" matSort (matSortChange)="onSort($event)" class="data-table">
          <ng-container matColumnDef="project">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Dự án</th>
            <td mat-cell *matCellDef="let row">{{ row.projectName }}</td>
          </ng-container>
          <ng-container matColumnDef="member">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Thành viên</th>
            <td mat-cell *matCellDef="let row">{{ row.assigneeDisplay }}</td>
          </ng-container>
          <ng-container matColumnDef="task">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Task</th>
            <td mat-cell *matCellDef="let row">{{ row.taskTitle }}</td>
          </ng-container>
          <ng-container matColumnDef="subtask">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Subtask</th>
            <td mat-cell *matCellDef="let row">{{ row.subtask.title }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Trạng thái</th>
            <td mat-cell *matCellDef="let row">
              {{ statusLabel(row.subtask.status) }}
            </td>
          </ng-container>
          <ng-container matColumnDef="est">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Est</th>
            <td mat-cell *matCellDef="let row">{{ row.subtask.estimate_seconds | secondsToHms }}</td>
          </ng-container>
          <ng-container matColumnDef="act">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Act</th>
            <td mat-cell *matCellDef="let row">{{ row.subtask.actual_seconds | secondsToHms }}</td>
          </ng-container>
          <ng-container matColumnDef="created_at">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Ngày tạo</th>
            <td mat-cell *matCellDef="let row">{{ row.subtask.created_at | date:'dd/MM/yyyy' }}</td>
          </ng-container>
          <ng-container matColumnDef="done_at">
            <th mat-header-cell *matHeaderCellDef>Ngày done</th>
            <td mat-cell *matCellDef="let row">
              {{ row.subtask.status === 'done' ? (row.subtask.updated_at | date:'dd/MM/yyyy') : '—' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="needsSupport">
            <th mat-header-cell *matHeaderCellDef>Cần hỗ trợ</th>
            <td mat-cell *matCellDef="let row">
              @if (row.needsSupport) {
                <span class="support-badge" matTooltip="Act vượt Est, chưa Done"><mat-icon>warning</mat-icon></span>
              } @else {
                —
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="link">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button (click)="goToProject(row.projectId, row.taskId, row.subtask.id)" matTooltip="Mở project">
                <mat-icon>open_in_new</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>

        @if (isLoading()) {
          <div class="table-loading">Đang tải...</div>
        } @else if (rows().length === 0) {
          <div class="table-empty">Chọn thành viên để xem subtask. Không có dữ liệu.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-bottom: 16px; }
    .page-title { margin: 0; font-size: 1.5rem; }
    .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .filters mat-form-field { width: 180px; }
    .table-card { overflow: auto; }
    .data-table { width: 100%; }
    .support-badge { display: inline-flex; align-items: center; color: #f59e0b; }
    .support-badge mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .table-loading, .table-empty { padding: 32px; text-align: center; color: #64748b; }
    th.mat-header-cell { font-weight: 700; font-size: 13px; }
  `]
})
export class UserSubtasksComponent implements OnInit {
  private supabase = inject(SupabaseService).client;
  readonly auth = inject(AuthService);
  readonly projectSvc = inject(ProjectService);
  private router = inject(Router);

  selectedProjectId = signal('');
  selectedUserId = signal('');
  statusFilter = signal('');
  isLoading = signal(false);
  rows = signal<UserSubtaskRow[]>([]);
  displayedColumns = ['project', 'member', 'task', 'subtask', 'status', 'est', 'act', 'created_at', 'done_at', 'needsSupport', 'link'];
  statusOptions = SUBTASK_STATUS_OPTIONS;

  readonly accessibleProjects = computed(() => {
    if (this.auth.isDirector()) return this.projectSvc.projects();
    const uid = this.auth.userId();
    return this.projectSvc.projects().filter((p: any) =>
      (p.project_members as any[])?.some((m: any) => m.user_id === uid)
    );
  });

  memberOptions = signal<{ id: string; display_name: string | null; email: string }[]>([]);

  dataSource = signal(new MatTableDataSource<UserSubtaskRow>([]));

  ngOnInit(): void {
    this.projectSvc.loadProjects().then(() => {
      if (this.accessibleProjects().length > 0 && !this.selectedProjectId()) {
        this.selectedProjectId.set(this.accessibleProjects()[0].id);
      }
      this.loadMemberOptions();
    });
  }

  onProjectChange(): void {
    this.loadMemberOptions();
    this.selectedUserId.set('');
    this.rows.set([]);
  }

  async loadMemberOptions(): Promise<void> {
    if (this.selectedProjectId()) {
      const members = await this.projectSvc.getMembers(this.selectedProjectId());
      const list = (members as any[]).map((m: any) => {
        const p = m.profiles ?? m;
        return { id: m.user_id, display_name: p?.display_name ?? null, email: p?.email ?? '' };
      });
      this.memberOptions.set(list);
    } else {
      const projectIds = this.accessibleProjects().map((p: any) => p.id);
      const seen = new Set<string>();
      const list: { id: string; display_name: string | null; email: string }[] = [];
      for (const pid of projectIds) {
        const members = await this.projectSvc.getMembers(pid);
        for (const m of members as any[]) {
          const id = m.user_id;
          if (seen.has(id)) continue;
          seen.add(id);
          const p = m.profiles ?? m;
          list.push({ id, display_name: p?.display_name ?? null, email: p?.email ?? '' });
        }
      }
      this.memberOptions.set(list);
    }
  }

  applyFilter(): void {
    const r = this.rows();
    const ds = this.dataSource();
    const filter = this.statusFilter();
    ds.data = !filter ? r : r.filter(row => row.subtask.status === filter);
  }

  onSort(_event: any): void {
    const ds = this.dataSource();
    const r = [...ds.data];
    r.sort((a, b) => b.subtask.actual_seconds - a.subtask.actual_seconds);
    ds.data = r;
  }

  async load(): Promise<void> {
    const uid = this.selectedUserId();
    if (!uid) {
      this.rows.set([]);
      return;
    }
    this.isLoading.set(true);
    try {
      let q;
      if (uid === '__all__') {
        const memberIds = this.memberOptions().map(u => u.id);
        if (memberIds.length === 0) {
          this.rows.set([]);
          this.isLoading.set(false);
          return;
        }
        q = this.supabase
          .from('subtasks')
          .select('*')
          .overlaps('assignees', memberIds);
      } else {
        q = this.supabase
          .from('subtasks')
          .select('*')
          .contains('assignees', [uid]);
      }
      if (this.selectedProjectId()) {
        q = q.eq('project_id', this.selectedProjectId());
      }
      const { data: subtasks } = await q.order('actual_seconds', { ascending: false });

      const list = (subtasks ?? []) as any[];
      const taskIds = [...new Set(list.map((s: any) => s.parent_id))];
      const projectIds = [...new Set(list.map((s: any) => s.project_id))];
      const assigneeIds = [...new Set(list.flatMap((s: any) => (Array.isArray(s.assignees) ? s.assignees.map((id: unknown) => String(id)) : [])))];

      let taskMap: Record<string, { title: string }> = {};
      let projectMap: Record<string, { name: string }> = {};
      let assigneeNameMap: Record<string, string> = {};

      if (taskIds.length > 0) {
        const { data: tasks } = await this.supabase.from('tasks').select('id, title').in('id', taskIds);
        taskMap = (tasks ?? []).reduce((acc: any, t: any) => ({ ...acc, [t.id]: { title: t.title } }), {});
      }
      if (projectIds.length > 0) {
        const { data: projects } = await this.supabase.from('projects').select('id, name').in('id', projectIds);
        projectMap = (projects ?? []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: { name: p.name } }), {});
      }
      if (assigneeIds.length > 0) {
        const { data: profiles } = await this.supabase.from('profiles').select('id, display_name, email').in('id', assigneeIds);
        assigneeNameMap = (profiles ?? []).reduce((acc: any, p: any) => {
          acc[p.id] = p.display_name?.trim() || p.email || p.id;
          return acc;
        }, {} as Record<string, string>);
      }

      const rows: UserSubtaskRow[] = list.map((s: any) => {
        const st: Subtask = {
          ...s,
          assignees: Array.isArray(s.assignees) ? s.assignees.map((id: unknown) => String(id)) : []
        };
        const needsSupport = st.status !== 'done' && st.actual_seconds > 0 && st.actual_seconds >= (st.estimate_seconds || 0);
        const assigneeDisplay = st.assignees.length
          ? st.assignees.map(id => assigneeNameMap[id] ?? id).join(', ')
          : '—';
        return {
          projectId: s.project_id,
          projectName: projectMap[s.project_id]?.name ?? '—',
          taskId: s.parent_id,
          taskTitle: taskMap[s.parent_id]?.title ?? '—',
          subtask: st,
          needsSupport,
          assigneeDisplay
        };
      });

      this.rows.set(rows);
      const ds = this.dataSource();
      const filter = this.statusFilter();
      ds.data = filter ? rows.filter(row => row.subtask.status === filter) : rows;
    } finally {
      this.isLoading.set(false);
    }
  }

  statusLabel(status: string): string {
    return this.statusOptions.find(o => o.status === status)?.label ?? status;
  }

  goToProject(projectId: string, _taskId: string, _subtaskId: string): void {
    this.router.navigate(['/project', projectId]);
  }

  exportCsv(): void {
    const r = this.rows();
    if (r.length === 0) return;
    const headers = ['Dự án', 'Thành viên', 'Task', 'Subtask', 'Trạng thái', 'Est (s)', 'Act (s)', 'Ngày tạo', 'Ngày done', 'Cần hỗ trợ'];
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(',')];
    for (const row of r) {
      const doneAt = row.subtask.status === 'done' ? row.subtask.updated_at : '';
      lines.push([
        escape(row.projectName),
        escape(row.assigneeDisplay),
        escape(row.taskTitle),
        escape(row.subtask.title),
        escape(this.statusLabel(row.subtask.status)),
        row.subtask.estimate_seconds,
        row.subtask.actual_seconds,
        row.subtask.created_at,
        doneAt,
        row.needsSupport ? 'Có' : ''
      ].join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `user-subtasks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
