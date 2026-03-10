import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task.service';
import { ConfirmService } from '../../services/confirm.service';
import { Project } from '../../shared/models';

interface TaskRow {
  id: string;
  title: string;
  status: string;
  project_id: string;
  project_name: string;
}

interface SubtaskRow {
  id: string;
  title: string;
  status: string;
  task_id: string;
  task_title: string;
  project_name: string;
}

@Component({
  selector: 'app-admin-data-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatTabsModule, MatTableModule, MatButtonModule, MatIconModule, MatTooltipModule
  ],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <h1 class="page-title">Xóa Project / Task / Subtask</h1>
        <p class="text-muted text-sm">Admin có thể xóa project, task hoặc subtask. Xóa project sẽ xóa toàn bộ tasks và subtasks trong project.</p>
      </div>

      <mat-tab-group class="data-tabs" (selectedTabChange)="onTabChange($event)">
        <mat-tab label="Projects">
          <div class="tab-content">
            <button mat-stroked-button (click)="loadProjects()" [disabled]="loadingProjects()">
              <mat-icon>refresh</mat-icon> Tải lại
            </button>
            <table mat-table [dataSource]="projects()" class="data-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Project</th>
                <td mat-cell *matCellDef="let p">{{ p.name }}</td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Trạng thái</th>
                <td mat-cell *matCellDef="let p">{{ p.status }}</td>
              </ng-container>
              <ng-container matColumnDef="created_at">
                <th mat-header-cell *matHeaderCellDef>Ngày tạo</th>
                <td mat-cell *matCellDef="let p">{{ p.created_at | date:'dd/MM/yyyy' }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let p">
                  <button mat-icon-button color="warn" (click)="deleteProject(p)" matTooltip="Xóa project">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="projectColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: projectColumns;"></tr>
            </table>
            @if (loadingProjects()) {
              <div class="loading-hint">Đang tải...</div>
            } @else if (projects().length === 0) {
              <div class="empty-hint">Không có project nào</div>
            }
          </div>
        </mat-tab>

        <mat-tab label="Tasks">
          <div class="tab-content">
            <button mat-stroked-button (click)="loadTasks()" [disabled]="loadingTasks()">
              <mat-icon>refresh</mat-icon> Tải lại
            </button>
            <table mat-table [dataSource]="tasks()" class="data-table">
              <ng-container matColumnDef="project">
                <th mat-header-cell *matHeaderCellDef>Project</th>
                <td mat-cell *matCellDef="let t">{{ t.project_name }}</td>
              </ng-container>
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Task</th>
                <td mat-cell *matCellDef="let t">{{ t.title }}</td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Trạng thái</th>
                <td mat-cell *matCellDef="let t">{{ t.status }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let t">
                  <button mat-icon-button color="warn" (click)="deleteTask(t)" matTooltip="Xóa task">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="taskColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: taskColumns;"></tr>
            </table>
            @if (loadingTasks()) {
              <div class="loading-hint">Đang tải...</div>
            } @else if (tasks().length === 0) {
              <div class="empty-hint">Không có task nào</div>
            }
          </div>
        </mat-tab>

        <mat-tab label="Subtasks">
          <div class="tab-content">
            <button mat-stroked-button (click)="loadSubtasks()" [disabled]="loadingSubtasks()">
              <mat-icon>refresh</mat-icon> Tải lại
            </button>
            <table mat-table [dataSource]="subtasks()" class="data-table">
              <ng-container matColumnDef="project">
                <th mat-header-cell *matHeaderCellDef>Project</th>
                <td mat-cell *matCellDef="let s">{{ s.project_name }}</td>
              </ng-container>
              <ng-container matColumnDef="task">
                <th mat-header-cell *matHeaderCellDef>Task</th>
                <td mat-cell *matCellDef="let s">{{ s.task_title }}</td>
              </ng-container>
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Subtask</th>
                <td mat-cell *matCellDef="let s">{{ s.title }}</td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Trạng thái</th>
                <td mat-cell *matCellDef="let s">{{ s.status }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let s">
                  <button mat-icon-button color="warn" (click)="deleteSubtask(s)" matTooltip="Xóa subtask">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="subtaskColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: subtaskColumns;"></tr>
            </table>
            @if (loadingSubtasks()) {
              <div class="loading-hint">Đang tải...</div>
            } @else if (subtasks().length === 0) {
              <div class="empty-hint">Không có subtask nào</div>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .admin-page { max-width: 1000px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 8px; font-size: 24px; font-weight: 700; }
    .text-muted { color: #64748b; }
    .text-sm { font-size: 14px; }
    .data-tabs { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .tab-content { padding: 16px; }
    .tab-content button { margin-bottom: 16px; }
    .data-table { width: 100%; }
    .loading-hint, .empty-hint { padding: 24px; text-align: center; color: #94a3b8; font-size: 14px; }
  `]
})
export class AdminDataManagementComponent implements OnInit {
  readonly projectSvc = inject(ProjectService);
  readonly taskSvc = inject(TaskService);
  private confirm = inject(ConfirmService);
  private snackBar = inject(MatSnackBar);

  projects = signal<Project[]>([]);
  tasks = signal<TaskRow[]>([]);
  subtasks = signal<SubtaskRow[]>([]);
  loadingProjects = signal(false);
  loadingTasks = signal(false);
  loadingSubtasks = signal(false);

  projectColumns = ['name', 'status', 'created_at', 'actions'];
  taskColumns = ['project', 'title', 'status', 'actions'];
  subtaskColumns = ['project', 'task', 'title', 'status', 'actions'];

  ngOnInit(): void {
    this.loadProjects();
  }

  onTabChange(ev: MatTabChangeEvent): void {
    if (ev.index === 1 && this.tasks().length === 0 && !this.loadingTasks()) this.loadTasks();
    if (ev.index === 2 && this.subtasks().length === 0 && !this.loadingSubtasks()) this.loadSubtasks();
  }

  async loadProjects(): Promise<void> {
    this.loadingProjects.set(true);
    try {
      await this.projectSvc.loadProjects();
      this.projects.set(this.projectSvc.projects());
    } finally {
      this.loadingProjects.set(false);
    }
  }

  async loadTasks(): Promise<void> {
    this.loadingTasks.set(true);
    try {
      const rows = await this.taskSvc.loadAllTasksForAdmin();
      this.tasks.set(rows);
    } finally {
      this.loadingTasks.set(false);
    }
  }

  async loadSubtasks(): Promise<void> {
    this.loadingSubtasks.set(true);
    try {
      const rows = await this.taskSvc.loadAllSubtasksForAdmin();
      this.subtasks.set(rows);
    } finally {
      this.loadingSubtasks.set(false);
    }
  }

  async deleteProject(p: Project): Promise<void> {
    const ok = await this.confirm.open({
      title: 'Xóa project',
      message: `Xóa project "${p.name}"? Toàn bộ tasks và subtasks trong project sẽ bị xóa.`,
      confirmText: 'Xóa',
      confirmWarn: true
    });
    if (!ok) return;
    try {
      await this.projectSvc.deleteProject(p.id);
      this.projects.update(list => list.filter(x => x.id !== p.id));
      this.snackBar.open('Đã xóa project', '', { duration: 2000 });
    } catch (e) {
      this.snackBar.open('Lỗi khi xóa project', '', { duration: 3000 });
    }
  }

  async deleteTask(t: TaskRow): Promise<void> {
    const ok = await this.confirm.open({
      title: 'Xóa task',
      message: `Xóa task "${t.title}"? Subtasks và comments sẽ bị xóa theo.`,
      confirmText: 'Xóa',
      confirmWarn: true
    });
    if (!ok) return;
    try {
      await this.taskSvc.deleteTask(t.id);
      this.tasks.update(list => list.filter(x => x.id !== t.id));
      this.snackBar.open('Đã xóa task', '', { duration: 2000 });
    } catch (e) {
      this.snackBar.open('Lỗi khi xóa task', '', { duration: 3000 });
    }
  }

  async deleteSubtask(s: SubtaskRow): Promise<void> {
    const ok = await this.confirm.open({
      title: 'Xóa subtask',
      message: `Xóa subtask "${s.title}"?`,
      confirmText: 'Xóa',
      confirmWarn: true
    });
    if (!ok) return;
    try {
      const result = await this.taskSvc.deleteSubtask(s.id);
      if (result?.error) throw result.error;
      this.subtasks.update(list => list.filter(x => x.id !== s.id));
      this.snackBar.open('Đã xóa subtask', '', { duration: 2000 });
    } catch (e) {
      this.snackBar.open('Lỗi khi xóa subtask', '', { duration: 3000 });
    }
  }
}
