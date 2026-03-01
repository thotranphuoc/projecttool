import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TaskService } from '../../services/task.service';
import { TaskImportRow, parseTaskImportJson, toCreateTaskDtos } from '../../shared/utils/task-import';

export interface TaskImportDialogData {
  projectId: string;
}

@Component({
  selector: 'app-task-import-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>Import Task từ JSON</h2>

      <mat-dialog-content>
        <div class="content-grid">
          <div class="left-pane">
            <p class="hint">
              Dán JSON chứa mảng các object với các trường:
              <code>Mã Task</code>, <code>Tên Task</code>, <code>Start Date</code>, <code>End Date</code>.
              Ngày dùng định dạng <code>dd/MM/yyyy</code>.
            </p>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>JSON</mat-label>
              <textarea
                matInput
                [(ngModel)]="jsonText"
                rows="18"
                spellcheck="false"
                class="json-textarea"
              ></textarea>
            </mat-form-field>
            <div class="actions-row">
              <button mat-stroked-button color="primary" (click)="onPreview()" [disabled]="isImporting()">
                <mat-icon>preview</mat-icon>
                Preview
              </button>
            </div>
            <div class="error-box" *ngIf="fatalError()">
              <mat-icon class="error-icon">error_outline</mat-icon>
              <span>{{ fatalError() }}</span>
            </div>
          </div>

          <div class="right-pane" *ngIf="rows().length > 0">
            <div class="summary-row">
              <span>Tổng: <strong>{{ rows().length }}</strong> dòng</span>
              <span>Hợp lệ: <strong>{{ validCount() }}</strong></span>
              <span>Lỗi: <strong>{{ errorCount() }}</strong></span>
            </div>
            <div class="table-wrapper">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Tên Task</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Ngày bắt đầu</th>
                    <th>Ngày kết thúc</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of rows(); trackBy: trackRow">
                    <td>{{ row.code }}</td>
                    <td>{{ row.name }}</td>
                    <td>{{ row.startDateText }}</td>
                    <td>{{ row.endDateText }}</td>
                    <td>{{ row.startDateIso || '—' }}</td>
                    <td>{{ row.endDateIso || '—' }}</td>
                    <td>
                      <span class="error-cell" *ngIf="row.error">{{ row.error }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <span class="spacer"></span>
        <button mat-button mat-dialog-close [disabled]="isImporting()">Đóng</button>
        <button
          mat-flat-button
          color="primary"
          (click)="onImport()"
          [disabled]="!canImport()"
        >
          <mat-icon>upload</mat-icon>
          Tạo Task
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { min-width: 840px; max-width: 960px; box-sizing: border-box; }
    mat-dialog-content {
      padding: 12px 24px 16px 24px;
      max-height: 70vh;
      box-sizing: border-box;
    }
    .content-grid {
      display: grid;
      grid-template-columns: 1.1fr 1.5fr;
      gap: 16px;
      align-items: flex-start;
    }
    .left-pane, .right-pane {
      min-width: 0;
    }
    .full-width { width: 100%; }
    .json-textarea {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      line-height: 1.4;
    }
    .hint {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .hint code {
      background: #e2e8f0;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 11px;
    }
    .actions-row {
      display: flex;
      justify-content: flex-start;
      gap: 8px;
      margin-top: 4px;
      margin-bottom: 4px;
    }
    .error-box {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      background: #fef2f2;
      color: #b91c1c;
      font-size: 12px;
    }
    .error-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .summary-row {
      display: flex;
      gap: 12px;
      align-items: center;
      font-size: 12px;
      margin-bottom: 6px;
      color: #475569;
    }
    .table-wrapper {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: auto;
      max-height: 360px;
    }
    .preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .preview-table thead {
      position: sticky;
      top: 0;
      background: #f1f5f9;
      z-index: 1;
    }
    .preview-table th,
    .preview-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      text-align: left;
      white-space: nowrap;
    }
    .preview-table th {
      font-weight: 600;
      color: #0f172a;
    }
    .preview-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .preview-table tbody tr:hover {
      background: #eff6ff;
    }
    .error-cell {
      color: #b91c1c;
    }
    .spacer {
      flex: 1;
    }
  `]
})
export class TaskImportDialogComponent {
  readonly data = inject(MAT_DIALOG_DATA) as TaskImportDialogData;
  private dialogRef = inject(MatDialogRef<TaskImportDialogComponent>);
  private taskSvc = inject(TaskService);
  private snackBar = inject(MatSnackBar);

  jsonText = '';
  rows = signal<TaskImportRow[]>([]);
  fatalError = signal<string | null>(null);
  isImporting = signal(false);

  trackRow = (_: number, row: TaskImportRow) => row.code + '|' + row.startDateText + '|' + row.endDateText;

  onPreview(): void {
    const { rows, fatalError } = parseTaskImportJson(this.jsonText);
    this.rows.set(rows);
    this.fatalError.set(fatalError ?? null);
  }

  validCount(): number {
    return this.rows().filter(r => !r.error && r.startDateIso && r.endDateIso).length;
  }

  errorCount(): number {
    return this.rows().filter(r => !!r.error).length;
  }

  canImport(): boolean {
    return !this.isImporting() && this.validCount() > 0 && !!this.data.projectId;
  }

  async onImport(): Promise<void> {
    if (!this.canImport()) return;
    const projectId = this.data.projectId;
    const dtos = toCreateTaskDtos(this.rows(), projectId);
    if (dtos.length === 0) {
      this.snackBar.open('Không có dòng hợp lệ để import', 'Đóng', { duration: 2500 });
      return;
    }

    this.isImporting.set(true);
    let success = 0;
    let failed = 0;
    try {
      for (const dto of dtos) {
        try {
          const created = await this.taskSvc.createTask(dto);
          if (created) success++;
          else failed++;
        } catch {
          failed++;
        }
      }
      const message =
        failed === 0
          ? `Đã tạo ${success} task`
          : `Đã tạo ${success} task, ${failed} dòng lỗi`;
      this.snackBar.open(message, 'Đóng', { duration: 4000 });
      this.dialogRef.close({ imported: success, failed });
    } finally {
      this.isImporting.set(false);
    }
  }
}

