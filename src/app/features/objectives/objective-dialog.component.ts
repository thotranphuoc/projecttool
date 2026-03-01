import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ObjectiveService } from '../../services/objective.service';
import { AuthService } from '../../core/auth/auth.service';
import { Objective, KeyResult } from '../../shared/models';

type KrDraft = Partial<KeyResult> & { _localId: number };

@Component({
  selector: 'app-objective-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>{{ data.objective ? 'Sửa Objective' : 'Tạo Objective' }}</h2>
      <mat-dialog-content>
        <div class="form-col">
          <mat-form-field appearance="outline">
            <mat-label>Tiêu đề *</mat-label>
            <input matInput [(ngModel)]="form.title" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Mô tả</mat-label>
            <textarea matInput [(ngModel)]="form.description" rows="2"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>BSC Type</mat-label>
            <mat-select [(ngModel)]="form.type">
              <mat-option value="financial">Tài chính</mat-option>
              <mat-option value="customer">Khách hàng</mat-option>
              <mat-option value="internal">Quy trình nội bộ</mat-option>
              <mat-option value="learning">Học hỏi & phát triển</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Key Results -->
          <div class="kr-section">
            <div class="kr-header">
              <h4>Key Results <span class="kr-count">{{ keyResults().length }}</span></h4>
              <button type="button" mat-stroked-button (click)="addKR()">
                <mat-icon>add</mat-icon> Thêm KR
              </button>
            </div>

            @if (keyResults().length === 0) {
              <div class="kr-empty">Chưa có Key Result nào. Nhấn "+ Thêm KR" để thêm.</div>
            }

            <div class="kr-list">
              @for (kr of keyResults(); track kr._localId; let i = $index) {
                <div class="kr-card">
                  <div class="kr-card-num">KR{{ i + 1 }}</div>
                  <div class="kr-card-fields">
                    <mat-form-field appearance="outline" class="kr-title-field">
                      <mat-label>Tiêu đề</mat-label>
                      <input matInput [(ngModel)]="kr.title" placeholder="Mô tả kết quả cần đạt..." />
                    </mat-form-field>
                    <div class="kr-row-2">
                      <mat-form-field appearance="outline">
                        <mat-label>Loại</mat-label>
                        <mat-select [(ngModel)]="kr.type">
                          <mat-option value="metric">Metric (số liệu)</mat-option>
                          <mat-option value="task_linked">Task linked</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Trọng số</mat-label>
                        <input matInput type="number" min="1" [(ngModel)]="kr.weight" />
                      </mat-form-field>
                    </div>
                    @if (kr.type === 'metric') {
                      <div class="kr-row-2">
                        <mat-form-field appearance="outline">
                          <mat-label>Mục tiêu (target)</mat-label>
                          <input matInput type="number" [(ngModel)]="kr.target_value" />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label>Đơn vị</mat-label>
                          <input matInput [(ngModel)]="kr.unit" placeholder="%, tỷ đồng..." />
                        </mat-form-field>
                      </div>
                    }
                  </div>
                  <button type="button" mat-icon-button color="warn" class="kr-remove-btn"
                          (click)="removeKR(i)" matTooltip="Xóa KR này">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" mat-button mat-dialog-close>Hủy</button>
        <button type="button" mat-flat-button color="primary" (click)="save()" [disabled]="isSaving()">
          {{ isSaving() ? 'Đang lưu...' : 'Lưu' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { min-width: 580px; }
    mat-dialog-content { max-height: 72vh; overflow-y: auto; }
    .form-col { display: flex; flex-direction: column; gap: 14px; padding: 8px 0; }
    mat-form-field { width: 100%; }

    /* KR Section */
    .kr-section { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .kr-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .kr-header h4 { margin: 0; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .kr-count { background: #3b82f6; color: white; border-radius: 999px; padding: 1px 8px; font-size: 12px; font-weight: 600; }
    .kr-empty { padding: 20px; text-align: center; color: #94a3b8; font-size: 13px; }
    .kr-list { max-height: 340px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px; }
    .kr-card { display: flex; align-items: flex-start; gap: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .kr-card-num { min-width: 28px; height: 28px; background: #3b82f6; color: white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 8px; }
    .kr-card-fields { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .kr-title-field { width: 100%; }
    .kr-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .kr-remove-btn { flex-shrink: 0; margin-top: 4px; }
  `]
})
export class ObjectiveDialogComponent implements OnInit {
  readonly data     = inject(MAT_DIALOG_DATA) as { objective: Objective | null; projectId: string | null };
  private dialogRef = inject(MatDialogRef<ObjectiveDialogComponent>);
  private objSvc    = inject(ObjectiveService);
  private auth      = inject(AuthService);
  private snackBar  = inject(MatSnackBar);

  isSaving    = signal(false);
  keyResults  = signal<KrDraft[]>([]);
  private _nextLocalId = 0;

  form = { title: '', description: '', type: 'financial' as any };

  ngOnInit(): void {
    if (this.data.objective) {
      const o = this.data.objective;
      this.form = { title: o.title, description: o.description ?? '', type: o.type };
      this.keyResults.set(
        (o.key_results ?? []).map(kr => ({ ...kr, _localId: this._nextLocalId++ }))
      );
    }
  }

  addKR(): void {
    this.keyResults.update(list => [
      ...list,
      { _localId: this._nextLocalId++, title: '', type: 'metric' as const, target_value: 100, current_value: 0, unit: '%', weight: 1 }
    ]);
  }

  removeKR(i: number): void {
    this.keyResults.update(list => list.filter((_, idx) => idx !== i));
  }

  async save(): Promise<void> {
    if (!this.form.title.trim()) return;
    this.isSaving.set(true);
    try {
      const dto = { ...this.form, project_id: this.data.projectId, created_by: this.auth.userId() };
      if (this.data.objective) {
        await this.objSvc.updateObjective(this.data.objective.id, dto);
        for (const kr of this.keyResults()) {
          const { _localId, ...krData } = kr;
          if (kr.id) await this.objSvc.updateKeyResult(kr.id, krData);
          else if (kr.title?.trim()) await this.objSvc.addKeyResult({ ...krData, objective_id: this.data.objective.id });
        }
      } else {
        const obj = await this.objSvc.createObjective(dto);
        if (obj) {
          for (const kr of this.keyResults()) {
            const { _localId, ...krData } = kr;
            if (kr.title?.trim()) await this.objSvc.addKeyResult({ ...krData, objective_id: obj.id });
          }
        }
      }
      this.dialogRef.close(true);
    } finally {
      this.isSaving.set(false);
    }
  }
}
