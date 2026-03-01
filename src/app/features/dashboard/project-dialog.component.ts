import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProjectService } from '../../services/project.service';
import { UserService } from '../../services/user.service';
import { ObjectiveService } from '../../services/objective.service';
import { Project, Profile } from '../../shared/models';

interface KrOption { id: string; label: string; bsc_type: string; }
const BSC_LABEL: Record<string, string> = {
  financial: 'Tài chính', customer: 'Khách hàng', internal: 'Quy trình nội bộ', learning: 'Học hỏi'
};

@Component({
  selector: 'app-project-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, SlicePipe,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatDatepickerModule, MatNativeDateModule, MatIconModule, MatDividerModule
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>{{ data.project ? 'Sửa project' : 'Tạo project mới' }}</h2>

      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Tên project *</mat-label>
            <input matInput [(ngModel)]="form.name" required />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Client</mat-label>
            <input matInput [(ngModel)]="form.client_name" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Liên hệ client</mat-label>
            <input matInput [(ngModel)]="form.client_contact" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Project Manager</mat-label>
            <mat-select [(ngModel)]="form.pm_id">
              @for (u of users(); track u.id) {
                <mat-option [value]="u.id">{{ u.display_name || u.email }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Trạng thái</mat-label>
            <mat-select [(ngModel)]="form.status">
              <mat-option value="planning">Lên kế hoạch</mat-option>
              <mat-option value="in_progress">Đang thực hiện</mat-option>
              <mat-option value="on_hold">Tạm dừng</mat-option>
              <mat-option value="completed">Hoàn thành</mat-option>
              <mat-option value="cancelled">Đã hủy</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Ngân sách</mat-label>
            <input matInput type="number" [(ngModel)]="form.budget" />
            <mat-select matSuffix [(ngModel)]="form.currency" style="width:70px">
              <mat-option value="VND">VND</mat-option>
              <mat-option value="USD">USD</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Ngày bắt đầu</mat-label>
            <input matInput [matDatepicker]="startPicker" [(ngModel)]="form.start_date" />
            <mat-datepicker-toggle matIconSuffix [for]="startPicker" />
            <mat-datepicker #startPicker />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Ngày kết thúc</mat-label>
            <input matInput [matDatepicker]="endPicker" [(ngModel)]="form.end_date" />
            <mat-datepicker-toggle matIconSuffix [for]="endPicker" />
            <mat-datepicker #endPicker />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Mô tả</mat-label>
            <textarea matInput [(ngModel)]="form.description" rows="3"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Phạm vi (Scope)</mat-label>
            <textarea matInput [(ngModel)]="form.scope" rows="2"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Deliverables</mat-label>
            <textarea matInput [(ngModel)]="form.deliverables" rows="2"></textarea>
          </mat-form-field>

          <!-- Strategy Alignment -->
          <div class="full-width">
            <mat-divider style="margin: 4px 0 12px" />
            <div class="kr-section-header">
              <mat-icon class="kr-icon">track_changes</mat-icon>
              <span>Liên kết Key Result (BSC/OKR)</span>
            </div>
            <mat-form-field appearance="outline" style="width: 100%; margin-top: 6px">
              <mat-label>Key Result (tuỳ chọn)</mat-label>
              <mat-select [(ngModel)]="form.linked_kr_id">
                <mat-option [value]="null">— Không liên kết —</mat-option>
                @for (kr of krOptions(); track kr.id) {
                  <mat-option [value]="kr.id">
                    <span class="kr-option-badge kr-{{ kr.bsc_type }}">{{ kr.bsc_type | slice:0:3 }}</span>
                    {{ kr.label }}
                  </mat-option>
                }
              </mat-select>
              <mat-hint>Metadata: project hỗ trợ KR này. Tasks phải tự liên kết riêng.</mat-hint>
            </mat-form-field>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Hủy</button>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="isSaving()">
          {{ data.project ? 'Lưu' : 'Tạo project' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { min-width: 560px; }
    mat-dialog-content { max-height: 70vh; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 8px 0; }
    .full-width { grid-column: 1 / -1; }
    .kr-section-header { display: flex; align-items: center; gap: 6px; color: #3b82f6; font-weight: 600; font-size: 13px; }
    .kr-icon { font-size: 18px; width: 18px; height: 18px; }
    .kr-option-badge { display: inline-block; padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 6px; text-transform: uppercase; }
    .kr-financial { background: #dcfce7; color: #166534; }
    .kr-customer  { background: #dbeafe; color: #1e40af; }
    .kr-internal  { background: #f3e8ff; color: #6b21a8; }
    .kr-learning  { background: #ffedd5; color: #9a3412; }
  `]
})
export class ProjectDialogComponent implements OnInit {
  readonly data        = inject(MAT_DIALOG_DATA) as { project: Project | null };
  private dialogRef    = inject(MatDialogRef<ProjectDialogComponent>);
  private projectSvc   = inject(ProjectService);
  private userSvc      = inject(UserService);
  private objectiveSvc = inject(ObjectiveService);
  private snackBar     = inject(MatSnackBar);

  users     = signal<Profile[]>([]);
  isSaving  = signal(false);
  krOptions = signal<KrOption[]>([]);

  form = {
    name: '', client_name: '', client_contact: '', pm_id: '',
    status: 'planning' as any, budget: null as number | null, currency: 'VND',
    start_date: null as any, end_date: null as any,
    description: '', scope: '', deliverables: '',
    linked_kr_id: null as string | null
  };

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
    if (this.data.project) {
      const p = this.data.project;
      this.form = {
        name: p.name, client_name: p.client_name ?? '', client_contact: p.client_contact ?? '',
        pm_id: p.pm_id ?? '', status: p.status, budget: p.budget, currency: p.currency ?? 'VND',
        start_date: p.start_date ? new Date(p.start_date) : null,
        end_date:   p.end_date   ? new Date(p.end_date)   : null,
        description: p.description ?? '', scope: p.scope ?? '', deliverables: p.deliverables ?? '',
        linked_kr_id: p.linked_kr_id ?? null
      };
    }
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
    if (!this.form.name.trim()) { this.snackBar.open('Tên project không được trống', 'Đóng', { duration: 2000 }); return; }
    this.isSaving.set(true);
    const dto = {
      name:           this.form.name,
      client_name:    this.form.client_name || undefined,
      client_contact: this.form.client_contact || undefined,
      pm_id:          this.form.pm_id || undefined,
      status:         this.form.status,
      budget:         this.form.budget ?? undefined,
      currency:       this.form.currency,
      description:    this.form.description || undefined,
      scope:          this.form.scope || undefined,
      deliverables:   this.form.deliverables || undefined,
      start_date:     this.toLocalDateStr(this.form.start_date) || undefined,
      end_date:       this.toLocalDateStr(this.form.end_date)   || undefined,
      linked_kr_id:   this.form.linked_kr_id || null,
    };
    try {
      if (this.data.project) {
        await this.projectSvc.updateProject(this.data.project.id, dto);
      } else {
        await this.projectSvc.createProject(dto);
      }
      this.dialogRef.close(true);
    } catch (e: any) {
      this.snackBar.open(e.message, 'Đóng', { duration: 3000 });
    } finally {
      this.isSaving.set(false);
    }
  }
}
