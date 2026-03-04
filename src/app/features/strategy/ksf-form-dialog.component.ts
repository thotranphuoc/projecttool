import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Ksf } from '../../shared/models';

@Component({
  selector: 'app-ksf-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.ksf ? 'Sửa KSF' : 'Thêm KSF' }}</h2>
    <mat-dialog-content>
      <div class="form-col">
        <mat-form-field appearance="outline">
          <mat-label>Code (không trùng)</mat-label>
          <input matInput [(ngModel)]="form.code" placeholder="vd: content_quality" [readonly]="!!data.ksf" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Tên hiển thị *</mat-label>
          <input matInput [(ngModel)]="form.label" required placeholder="vd: Chất lượng nội dung" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Mô tả</mat-label>
          <textarea matInput [(ngModel)]="form.description" rows="3" placeholder="Mô tả ngắn về yếu tố thành công then chốt"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Thứ tự</mat-label>
          <input matInput type="number" [(ngModel)]="form.sort_order" min="0" />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Hủy</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="!form.label.trim() || !form.code.trim()">
        Lưu
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form-col { display: flex; flex-direction: column; gap: 14px; min-width: 360px; }
    mat-form-field { width: 100%; }
  `]
})
export class KsfFormDialogComponent {
  readonly data = inject(MAT_DIALOG_DATA) as { ksf: Ksf | null };
  private ref = inject(MatDialogRef<KsfFormDialogComponent>);

  form = { code: '', label: '', description: '' as string | null, sort_order: 0 };

  constructor() {
    if (this.data.ksf) {
      const k = this.data.ksf;
      this.form = { code: k.code, label: k.label, description: k.description ?? '', sort_order: k.sort_order };
    }
  }

  save(): void {
    if (!this.form.label?.trim() || !this.form.code?.trim()) return;
    this.ref.close(this.form);
  }
}
