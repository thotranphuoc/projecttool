import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { Strategy } from '../../shared/models';
import { VisionStrategyService } from '../../services/vision-strategy.service';
import { ProjectService } from '../../services/project.service';

@Component({
  selector: 'app-strategy-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.strategy ? 'Sửa Chiến lược' : 'Thêm Chiến lược' }}</h2>
    <mat-dialog-content>
      <div class="form-col">
        <mat-form-field appearance="outline">
          <mat-label>Tầm nhìn *</mat-label>
          <mat-select [(ngModel)]="form.vision_id" required>
            @for (v of visionStrategySvc.visions(); track v.id) {
              <mat-option [value]="v.id">{{ v.title }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Project (tùy chọn)</mat-label>
          <mat-select [(ngModel)]="form.project_id">
            <mat-option [value]="null">Toàn công ty</mat-option>
            @for (p of projectSvc.projects(); track p.id) {
              <mat-option [value]="p.id">{{ p.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Tiêu đề *</mat-label>
          <input matInput [(ngModel)]="form.title" required />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Mô tả</mat-label>
          <textarea matInput [(ngModel)]="form.description" rows="2"></textarea>
        </mat-form-field>
        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>Năm</mat-label>
            <input matInput type="number" [(ngModel)]="form.period_year" min="2000" max="2100" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Quý (1-4, tùy chọn)</mat-label>
            <mat-select [(ngModel)]="form.period_quarter">
              <mat-option [value]="null">Không chọn</mat-option>
              <mat-option [value]="1">Q1</mat-option>
              <mat-option [value]="2">Q2</mat-option>
              <mat-option [value]="3">Q3</mat-option>
              <mat-option [value]="4">Q4</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Thứ tự</mat-label>
          <input matInput type="number" [(ngModel)]="form.sort_order" />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Hủy</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="!form.title.trim() || !form.vision_id || saving()">
        {{ saving() ? 'Đang lưu...' : 'Lưu' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form-col { display: flex; flex-direction: column; gap: 14px; min-width: 400px; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    mat-form-field { width: 100%; }
  `]
})
export class StrategyFormDialogComponent implements OnInit {
  readonly data = inject(MAT_DIALOG_DATA) as { strategy: Strategy | null; visionId?: string };
  private ref = inject(MatDialogRef<StrategyFormDialogComponent>);
  readonly visionStrategySvc = inject(VisionStrategyService);
  readonly projectSvc = inject(ProjectService);

  saving = signal(false);
  form = {
    vision_id: '' as string,
    project_id: null as string | null,
    title: '',
    description: '' as string | null,
    period_year: new Date().getFullYear(),
    period_quarter: null as number | null,
    sort_order: 0,
  };

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.visionStrategySvc.loadVisions(),
      this.projectSvc.loadProjects(),
    ]);
    if (this.data.strategy) {
      const s = this.data.strategy;
      this.form = {
        vision_id: s.vision_id,
        project_id: s.project_id ?? null,
        title: s.title,
        description: s.description ?? '',
        period_year: s.period_year,
        period_quarter: s.period_quarter ?? null,
        sort_order: s.sort_order,
      };
    } else if (this.data.visionId) {
      this.form.vision_id = this.data.visionId;
    } else {
      const vs = this.visionStrategySvc.visions();
      if (vs.length) this.form.vision_id = vs[0].id;
    }
  }

  save(): void {
    if (!this.form.title.trim() || !this.form.vision_id) return;
    this.saving.set(true);
    this.ref.close(this.form);
    this.saving.set(false);
  }
}
