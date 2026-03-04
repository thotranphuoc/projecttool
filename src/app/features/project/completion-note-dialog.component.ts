import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export interface CompletionNoteDialogData {
  type: 'task' | 'subtask';
  title: string;
  /** Pre-fill when re-opening (e.g. editing done subtask). */
  initialNote?: string | null;
}

export interface CompletionNoteDialogResult {
  skipped: boolean;
  note: string | null;
}

@Component({
  selector: 'app-completion-note-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>Kết quả / ghi chú</h2>
      <mat-dialog-content>
        <p class="hint">Bạn có thể bổ sung outcome, link file (Google Drive, Notion...) cho {{ data.type === 'task' ? 'task' : 'subtask' }} khi chuyển sang Done.</p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Kết quả / link file</mat-label>
          <textarea matInput [(ngModel)]="note" rows="3"
                    placeholder="Mô tả outcome hoặc paste link file..."></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button (click)="skip()">Bỏ qua</button>
        <button mat-flat-button color="primary" (click)="save()">Lưu</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { min-width: 360px; max-width: 480px; box-sizing: border-box; }
    .hint { color: #64748b; font-size: 13px; margin: 0 0 12px 0; }
    mat-dialog-content { padding: 0 24px 16px 24px; }
    .full-width { width: 100%; min-width: 0; }
  `]
})
export class CompletionNoteDialogComponent {
  readonly data = inject(MAT_DIALOG_DATA) as CompletionNoteDialogData;
  private dialogRef = inject(MatDialogRef<CompletionNoteDialogComponent>);

  note = this.data.initialNote ?? '';

  skip(): void {
    this.dialogRef.close({ skipped: true, note: null } as CompletionNoteDialogResult);
  }

  save(): void {
    const trimmed = this.note?.trim() || null;
    this.dialogRef.close({ skipped: false, note: trimmed } as CompletionNoteDialogResult);
  }
}
