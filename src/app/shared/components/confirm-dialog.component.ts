import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmWarn?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="confirm-message">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ data.cancelText ?? 'Hủy' }}</button>
      <button mat-flat-button [color]="data.confirmWarn ? 'warn' : 'primary'" [mat-dialog-close]="true">
        {{ data.confirmText ?? 'Xác nhận' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .confirm-message { margin: 0; white-space: pre-wrap; }
    mat-dialog-content { min-width: 280px; }
  `]
})
export class ConfirmDialogComponent {
  readonly data = inject(MAT_DIALOG_DATA) as ConfirmDialogData;
  readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
}
