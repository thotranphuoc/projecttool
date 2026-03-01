import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { TaskService } from '../../services/task.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../core/auth/auth.service';
import { ProjectService } from '../../services/project.service';
import { ObjectiveService } from '../../services/objective.service';
import { ConfirmService } from '../../services/confirm.service';
import { Task, TaskStatus, TaskPriority, Profile, KeyResult } from '../../shared/models';

interface KrOption { id: string; label: string; bsc_type: string; }
const BSC_LABEL: Record<string, string> = {
  financial: 'Tài chính', customer: 'Khách hàng', internal: 'Quy trình nội bộ', learning: 'Học hỏi'
};

@Component({
  selector: 'app-task-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, SlicePipe,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule, MatDatepickerModule, MatNativeDateModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>{{ data.task ? 'Sửa task' : 'Tạo task mới' }}</h2>
      <mat-dialog-content>
        <div class="form-col">
          <mat-form-field appearance="outline">
            <mat-label>Tiêu đề *</mat-label>
            <input matInput [(ngModel)]="form.title" required />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Mô tả</mat-label>
            <textarea matInput [(ngModel)]="form.description" rows="3"></textarea>
          </mat-form-field>

          <div class="row-2">
            <mat-form-field appearance="outline">
              <mat-label>Trạng thái</mat-label>
              <mat-select [(ngModel)]="form.status">
                <mat-option value="todo">To Do</mat-option>
                <mat-option value="in_progress">In Progress</mat-option>
                <mat-option value="review">Review</mat-option>
                <mat-option value="done">Done</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Priority</mat-label>
              <mat-select [(ngModel)]="form.priority">
                <mat-option value="low">Low</mat-option>
                <mat-option value="medium">Medium</mat-option>
                <mat-option value="high">High</mat-option>
                <mat-option value="critical">Critical</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Assignees</mat-label>
            <mat-select [(ngModel)]="form.assignees_preview" multiple>
              @for (u of users(); track u.id) {
                <mat-option [value]="u.id">{{ u.display_name || u.email }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="row-2">
            <mat-form-field appearance="outline">
              <mat-label>Ngày bắt đầu</mat-label>
              <input matInput [matDatepicker]="startPicker" [(ngModel)]="form.start_date" />
              <mat-datepicker-toggle matIconSuffix [for]="startPicker" />
              <mat-datepicker #startPicker />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Ngày hết hạn</mat-label>
              <input matInput [matDatepicker]="duePicker" [(ngModel)]="form.due_date" />
              <mat-datepicker-toggle matIconSuffix [for]="duePicker" />
              <mat-datepicker #duePicker />
            </mat-form-field>
          </div>

          <!-- Strategy Alignment: KR link + weight -->
          <div class="kr-section">
            <div class="kr-section-header">
              <mat-icon class="kr-icon">track_changes</mat-icon>
              <span class="kr-section-title">Liên kết Key Result (BSC/OKR)</span>
            </div>
            <div class="row-2">
              <mat-form-field appearance="outline" style="grid-column: 1 / -1">
                <mat-label>Key Result</mat-label>
                <mat-select [(ngModel)]="form.linked_kr_id">
                  <mat-option [value]="null">— Không liên kết —</mat-option>
                  @for (kr of krOptions(); track kr.id) {
                    <mat-option [value]="kr.id">
                      <span class="kr-option-badge kr-{{ kr.bsc_type }}">{{ kr.bsc_type | slice:0:3 }}</span>
                      {{ kr.label }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
              @if (form.linked_kr_id) {
                <mat-form-field appearance="outline">
                  <mat-label>Trọng số đóng góp</mat-label>
                  <input matInput type="number" min="1" [(ngModel)]="form.contribution_weight" />
                  <mat-hint>Mặc định 1. Tăng nếu task này quan trọng hơn.</mat-hint>
                </mat-form-field>
              }
            </div>
          </div>

          <!-- Labels -->
          <mat-form-field appearance="outline">
            <mat-label>Labels (nhấn Enter để thêm)</mat-label>
            <mat-chip-grid #chipGrid>
              @for (label of form.labels; track label) {
                <mat-chip-row (removed)="removeLabel(label)">
                  {{ label }}
                  <button matChipRemove><mat-icon>cancel</mat-icon></button>
                </mat-chip-row>
              }
            </mat-chip-grid>
            <input [matChipInputFor]="chipGrid"
                   [matChipInputSeparatorKeyCodes]="separatorKeys"
                   (matChipInputTokenEnd)="addLabel($event)"
                   placeholder="Thêm label..." />
          </mat-form-field>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        @if (data.task && canDelete()) {
          <button mat-button color="warn" (click)="deleteTask()" [disabled]="isSaving()" class="delete-left">
            Xóa task
          </button>
        }
        <span class="spacer"></span>
        <button mat-button mat-dialog-close>Hủy</button>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="isSaving()">
          {{ data.task ? 'Lưu' : 'Tạo task' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { min-width: 520px; }
    mat-dialog-content { max-height: 70vh; }
    .form-col { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    mat-form-field { width: 100%; }
    mat-dialog-actions .spacer { flex: 1; }
    mat-dialog-actions .delete-left { margin-right: auto; }
    .kr-section { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
    .kr-section-header { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; color: #3b82f6; font-weight: 600; font-size: 13px; }
    .kr-icon { font-size: 18px; width: 18px; height: 18px; }
    .kr-option-badge { display: inline-block; padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 6px; text-transform: uppercase; }
    .kr-financial { background: #dcfce7; color: #166534; }
    .kr-customer  { background: #dbeafe; color: #1e40af; }
    .kr-internal  { background: #f3e8ff; color: #6b21a8; }
    .kr-learning  { background: #ffedd5; color: #9a3412; }
  `]
})
export class TaskDialogComponent implements OnInit {
  readonly data     = inject(MAT_DIALOG_DATA) as { task: Task | null; projectId: string; defaultStatus?: TaskStatus };
  private dialogRef = inject(MatDialogRef<TaskDialogComponent>);
  private taskSvc   = inject(TaskService);
  private userSvc   = inject(UserService);
  private auth      = inject(AuthService);
  private projectSvc = inject(ProjectService);
  private objectiveSvc = inject(ObjectiveService);
  private snackBar  = inject(MatSnackBar);
  private confirmSvc = inject(ConfirmService);

  users        = signal<Profile[]>([]);
  isSaving     = signal(false);
  krOptions    = signal<KrOption[]>([]);
  separatorKeys = [ENTER, COMMA];

  form = {
    title: '', description: '', status: (this.data.defaultStatus ?? 'todo') as TaskStatus,
    priority: 'medium' as TaskPriority, assignees_preview: [] as string[],
    start_date: null as any, due_date: null as any, labels: [] as string[],
    linked_kr_id: null as string | null, contribution_weight: 1
  };

  canDelete(): boolean {
    return this.auth.isAdmin() || this.projectSvc.isManager(this.data.projectId);
  }

  async deleteTask(): Promise<void> {
    if (!this.data.task || !(await this.confirmSvc.open({ title: 'Xóa task', message: `Xóa task "${this.data.task.title}"?`, confirmText: 'Xóa', confirmWarn: true }))) return;
    this.isSaving.set(true);
    try {
      await this.taskSvc.deleteTask(this.data.task.id);
      this.dialogRef.close(true);
    } catch (e: any) {
      this.snackBar.open(e?.message ?? 'Không thể xóa', 'Đóng', { duration: 3000 });
    } finally {
      this.isSaving.set(false);
    }
  }

  ngOnInit(): void {
    this.userSvc.loadAll().then(() => this.users.set(this.userSvc.users()));
    this.objectiveSvc.loadAllKeyResults().then(() => {
      const krs = this.objectiveSvc.allKeyResults() as any[];
      this.krOptions.set(krs.map(kr => ({
        id: kr.id,
        label: `[${BSC_LABEL[kr.objectives?.type ?? ''] ?? kr.objectives?.type ?? ''}] ${kr.objectives?.title ?? ''} → ${kr.title}`,
        bsc_type: kr.objectives?.type ?? ''
      })));
    });
    if (this.data.task) {
      const t = this.data.task;
      this.form = {
        title: t.title, description: t.description ?? '', status: t.status,
        priority: t.priority, assignees_preview: [...t.assignees_preview],
        start_date: t.start_date ? new Date(t.start_date) : null,
        due_date: t.due_date ? new Date(t.due_date) : null,
        labels: [...t.labels],
        linked_kr_id: t.linked_kr_id ?? null,
        contribution_weight: t.contribution_weight ?? 1
      };
    }
  }

  addLabel(event: MatChipInputEvent): void {
    const val = (event.value ?? '').trim();
    if (val) this.form.labels.push(val);
    event.chipInput?.clear();
  }

  removeLabel(label: string): void {
    this.form.labels = this.form.labels.filter(l => l !== label);
  }

  private toLocalDateStr(d: Date | null | string): string | null {
    if (!d) return null;
    if (typeof d === 'string') return d;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async save(): Promise<void> {
    if (!this.form.title.trim()) return;
    this.isSaving.set(true);
    const dto = {
      ...this.form,
      project_id: this.data.projectId,
      start_date: this.toLocalDateStr(this.form.start_date),
      due_date:   this.toLocalDateStr(this.form.due_date),
      linked_kr_id: this.form.linked_kr_id || null,
      contribution_weight: this.form.linked_kr_id ? (this.form.contribution_weight || 1) : 1
    };
    try {
      if (this.data.task) {
        await this.taskSvc.updateTask(this.data.task.id, dto);
      } else {
        await this.taskSvc.createTask(dto);
      }
      this.dialogRef.close(true);
    } catch (e: any) {
      this.snackBar.open(e.message, 'Đóng', { duration: 3000 });
    } finally {
      this.isSaving.set(false);
    }
  }
}
