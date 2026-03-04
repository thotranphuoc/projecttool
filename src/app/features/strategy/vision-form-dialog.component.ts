import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Vision } from '../../shared/models';

@Component({
  selector: 'app-vision-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.vision ? 'Sửa Tầm nhìn' : 'Thêm Tầm nhìn' }}</h2>
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
        <mat-form-field appearance="outline">
          <mat-label>Thứ tự</mat-label>
          <input matInput type="number" [(ngModel)]="form.sort_order" />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Hủy</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="!form.title.trim() || saving()">
        {{ saving() ? 'Đang lưu...' : 'Lưu' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form-col { display: flex; flex-direction: column; gap: 14px; min-width: 360px; }
    mat-form-field { width: 100%; }
  `]
})
export class VisionFormDialogComponent {
  readonly data = inject(MAT_DIALOG_DATA) as { vision: Vision | null };
  private ref = inject(MatDialogRef<VisionFormDialogComponent>);

  saving = signal(false);
  form = { title: '', description: '' as string | null, sort_order: 0 };

  constructor() {
    if (this.data.vision) {
      const v = this.data.vision;
      this.form = { title: v.title, description: v.description ?? '', sort_order: v.sort_order };
    }
  }

  async save(): Promise<void> {
    if (!this.form.title.trim()) return;
    this.saving.set(true);
    this.ref.close(this.form);
    this.saving.set(false);
  }
}
