import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { TaskService } from '../../services/task.service';
import { ConfirmService } from '../../services/confirm.service';
import { Task, Subtask, SubtaskStatus, SUBTASK_STATUS_OPTIONS } from '../../shared/models';
import { CompletionNoteDialogComponent, CompletionNoteDialogData, CompletionNoteDialogResult } from './completion-note-dialog.component';

export interface SubtaskEditDialogData {
  task: Task;
  projectId: string;
  subtask: Subtask;
  members: { user_id: string; display_name: string; email?: string }[];
  /** False khi subtask đã Done và user không phải PM/Director/Admin → chỉ xem, disable Xóa/Lưu */
  canEdit?: boolean;
}

@Component({
  selector: 'app-subtask-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>Sửa subtask</h2>
      <mat-dialog-content>
        <div class="form-col">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Tiêu đề</mat-label>
            <input matInput [(ngModel)]="form.title" required />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Mô tả</mat-label>
            <textarea matInput [(ngModel)]="form.description" rows="2"></textarea>
          </mat-form-field>
          <div class="row-2">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Người phụ trách</mat-label>
              <mat-select [(ngModel)]="form.assignees" multiple>
                @for (m of data.members; track m.user_id) {
                  <mat-option [value]="m.user_id">{{ m.display_name || m.email }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Trạng thái</mat-label>
              <mat-select [(ngModel)]="form.status">
                @for (opt of statusOptions; track opt.status) {
                  <mat-option [value]="opt.status">{{ opt.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="est-width">
            <mat-label>Estimate (phút)</mat-label>
            <input matInput type="number" [(ngModel)]="form.estimateMin" min="0" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button color="warn" (click)="deleteSubtask()" [disabled]="deleting || !canEdit()">Xóa</button>
        <span class="spacer"></span>
        <button mat-button mat-dialog-close>Hủy</button>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="!form.title.trim() || saving || !canEdit()">Lưu</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { width: min(420px, 92vw); max-width: 420px; min-width: 0; box-sizing: border-box; }
    mat-dialog-content {
      padding: 12px 24px 16px 24px;
      max-height: 70vh;
      overflow-y: auto;
      box-sizing: border-box;
    }
    .form-col {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 0;
      min-width: 0;
    }
    .row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      min-width: 0;
    }
    .full-width, .est-width { width: 100%; min-width: 0; }
    .est-width { max-width: 120px; }
    mat-form-field { display: block; }
    .spacer { flex: 1; }
    @media (max-width: 480px) { .row-2 { grid-template-columns: 1fr; } }
  `]
})
export class SubtaskEditDialogComponent {
  readonly data = inject(MAT_DIALOG_DATA) as SubtaskEditDialogData;
  private dialogRef = inject(MatDialogRef<SubtaskEditDialogComponent>);
  private dialog = inject(MatDialog);
  private taskSvc = inject(TaskService);
  private snackBar = inject(MatSnackBar);
  private confirmSvc = inject(ConfirmService);

  /** False khi subtask Done và user không phải PM/Director/Admin → chỉ xem. */
  canEdit = (): boolean => this.data.canEdit !== false;

  saving = false;
  deleting = false;
  statusOptions = SUBTASK_STATUS_OPTIONS;
  form = {
    title: '',
    description: '' as string | null,
    assignees: [] as string[],
    estimateMin: 0,
    status: 'todo' as SubtaskStatus
  };

  constructor() {
    const s = this.data.subtask;
    this.form.title = s.title;
    this.form.description = s.description ?? '';
    this.form.assignees = [...(s.assignees ?? [])];
    this.form.estimateMin = Math.round((s.estimate_seconds || 0) / 60);
    this.form.status = s.status;
  }

  async save(): Promise<void> {
    if (!this.form.title.trim()) return;
    let completionNote: string | null = null;
    if (this.form.status === 'done') {
      const dialogData: CompletionNoteDialogData = {
        type: 'subtask',
        title: this.form.title || this.data.subtask.title,
        initialNote: this.data.subtask.completion_note ?? undefined
      };
      const dialogRef = this.dialog.open(CompletionNoteDialogComponent, { width: '420px', data: dialogData });
      const res = await firstValueFrom(dialogRef.afterClosed()) as CompletionNoteDialogResult | undefined;
      if (res === undefined) return;
      completionNote = res.note ?? null;
    }
    this.saving = true;
    try {
      const s = this.data.subtask;
      const payload = {
        title: this.form.title.trim(),
        description: this.form.description || null,
        assignees: [...this.form.assignees],
        estimate_seconds: this.form.estimateMin * 60,
        status: this.form.status,
        completion_note: this.form.status === 'done' ? completionNote : null
      };
      const result = await this.taskSvc.updateSubtask(s.id, payload);
      if (result?.error) {
        this.snackBar.open('Không thể lưu thay đổi subtask', 'Đóng', { duration: 3000 });
        return;
      }
      const updated: Subtask = { ...s, ...payload };
      this.dialogRef.close({ updated: true, subtask: updated });
    } finally {
      this.saving = false;
    }
  }

  async deleteSubtask(): Promise<void> {
    if (!(await this.confirmSvc.open({ title: 'Xóa subtask', message: `Xóa subtask "${this.form.title || this.data.subtask.title}"?`, confirmText: 'Xóa', confirmWarn: true }))) return;
    this.deleting = true;
    try {
      const result = await this.taskSvc.deleteSubtask(this.data.subtask.id);
      if (result?.error) {
        this.snackBar.open('Không thể xóa subtask', 'Đóng', { duration: 3000 });
        return;
      }
      this.dialogRef.close({ deleted: true, subtask: this.data.subtask });
    } finally {
      this.deleting = false;
    }
  }
}
