import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar } from '@angular/material/snack-bar';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../core/auth/auth.service';
import { ProjectService } from '../../services/project.service';
import { ObjectiveService } from '../../services/objective.service';
import { ConfirmService } from '../../services/confirm.service';
import { Task, TaskStatus, TaskPriority, Profile, KeyResult } from '../../shared/models';

interface KrOption { id: string; label: string; objectiveTitle: string; bsc_type: string; }
const BSC_LABEL: Record<string, string> = {
  financial: 'Tài chính', customer: 'Khách hàng', internal: 'Quy trình nội bộ', learning: 'Học hỏi'
};
const BSC_SHORT: Record<string, string> = {
  financial: 'TC', customer: 'KH', internal: 'NB', learning: 'HH'
};

@Component({
  selector: 'app-task-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule,
    MatButtonModule, MatIconModule, MatChipsModule, MatDatepickerModule, MatNativeDateModule,
    MatTooltipModule, MatExpansionModule
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>{{ data.task ? 'Sửa task' : 'Tạo task mới' }}</h2>
      <mat-dialog-content>
        <mat-expansion-panel class="guide-panel">
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon class="guide-icon">lightbulb</mat-icon>
              Hướng dẫn tạo Task & Subtask
            </mat-panel-title>
          </mat-expansion-panel-header>
          <div class="guide-content">
            <p class="guide-intro">Chia task và subtask đúng cách giúp đo tiến độ (Est/Act) và báo cáo chính xác.</p>

            <h4>Task nên</h4>
            <ul>
              <li>Mô tả <strong>một deliverable rõ ràng</strong>, có thể kiểm chứng khi xong.</li>
              <li>Có <strong>thời hạn</strong> (ngày hết hạn) và <strong>gán người</strong> khi cần.</li>
              <li>Hoàn thành trong khoảng <strong>1–2 tuần</strong>; nếu lớn hơn nên tách thành nhiều task.</li>
            </ul>
            <p class="guide-examples"><strong>Ví dụ task tốt:</strong></p>
            <ul class="examples-list good">
              <li>Triển khai API đăng nhập (email + mật khẩu)</li>
              <li>Thiết kế và đưa lên Figma màn hình Dashboard</li>
              <li>Viết tài liệu hướng dẫn sử dụng cho module Chat</li>
              <li>Hoàn thành báo cáo tháng 3 gửi khách hàng A</li>
            </ul>

            <p class="guide-examples"><strong>Ví dụ task không nên:</strong></p>
            <ul class="examples-list bad">
              <li>Làm backend (quá chung chung, không đo được)</li>
              <li>Fix bug (không rõ bug nào, không deliverable)</li>
              <li>Hỗ trợ dự án X (không có kết quả cụ thể)</li>
              <li>Hoàn thành toàn bộ hệ thống thanh toán (quá lớn, cần tách nhiều task)</li>
            </ul>

            <h4>Subtask nên</h4>
            <ul>
              <li>Mỗi subtask là <strong>một đầu việc</strong> có thể xong trong <strong>vài giờ đến 1–2 ngày</strong>.</li>
              <li>Có <strong>ước lượng giờ (Estimate)</strong> và gán người để đo Actual và báo cáo.</li>
              <li>Kết quả <strong>kiểm tra được</strong>: xong là Done, không mơ hồ.</li>
            </ul>
            <p class="guide-examples"><strong>Ví dụ subtask tốt (cho task "Triển khai form đăng ký"):</strong></p>
            <ul class="examples-list good">
              <li>Thiết kế UI form (Est: 2h)</li>
              <li>API validation + lưu DB (Est: 3h)</li>
              <li>Gửi email xác nhận (Est: 1h)</li>
              <li>Test E2E đăng ký (Est: 2h)</li>
            </ul>
            <p class="guide-examples"><strong>Ví dụ subtask tốt (cho task "Tài liệu hướng dẫn Chat"):</strong></p>
            <ul class="examples-list good">
              <li>Mục Task & Subtask (Est: 1h)</li>
              <li>Mục Chat & Nhóm (Est: 1h)</li>
              <li>Mục Dashboard (Est: 0.5h)</li>
              <li>Review và chỉnh sửa (Est: 1h)</li>
            </ul>

            <p class="guide-examples"><strong>Ví dụ subtask không nên:</strong></p>
            <ul class="examples-list bad">
              <li>Làm tiếp (không rõ làm gì)</li>
              <li>Fix bug (không cụ thể)</li>
              <li>Hoàn thành tính năng đăng ký (quá lớn, nên tách 4–5 subtask như trên)</li>
              <li>Meeting (nếu không có output cụ thể; nếu có thì ghi rõ: "Ghi biên bản meeting kick-off")</li>
            </ul>

            <p class="guide-tip">Sau khi tạo task, hãy thêm các subtask ngay và điền <strong>Estimate</strong> để tiến độ (Est/Act) và báo cáo có ý nghĩa.</p>
          </div>
        </mat-expansion-panel>

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
            <mat-form-field appearance="outline" class="kr-search-field">
              <mat-label>Tìm Key Result...</mat-label>
              <mat-icon matPrefix class="kr-search-prefix-icon">search</mat-icon>
              <input matInput
                     [(ngModel)]="krSearchText"
                     [matAutocomplete]="krAuto"
                     (ngModelChange)="onKrSearchChange($event)"
                     placeholder="Gõ tên KR hoặc Objective..." />
              @if (form.linked_kr_id) {
                <button matSuffix mat-icon-button (click)="clearKr()" matTooltip="Bỏ liên kết">
                  <mat-icon>close</mat-icon>
                </button>
              }
              @if (selectedKrLabel()) {
                <mat-hint class="kr-selected-hint">
                  <mat-icon class="hint-icon">check_circle</mat-icon>
                  {{ selectedKrLabel() }}
                </mat-hint>
              }
              <mat-autocomplete #krAuto autoActiveFirstOption
                                (optionSelected)="onKrSelected($event.option.value)">
                <mat-option [value]="'__clear__'" class="kr-clear-option">
                  <mat-icon>link_off</mat-icon> Không liên kết
                </mat-option>
                @for (kr of filteredKrOptions(); track kr.id) {
                  <mat-option [value]="kr.id">
                    <div class="kr-option-row">
                      <span class="kr-option-badge kr-{{ kr.bsc_type }}">{{ bscShort(kr.bsc_type) }}</span>
                      <div class="kr-option-text">
                        <span class="kr-option-obj">{{ kr.objectiveTitle }}</span>
                        <span class="kr-option-kr">{{ kr.label }}</span>
                      </div>
                    </div>
                  </mat-option>
                }
                @if (filteredKrOptions().length === 0) {
                  <mat-option disabled>Không tìm thấy KR phù hợp</mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
            @if (form.linked_kr_id) {
              <mat-form-field appearance="outline" class="kr-weight-field">
                <mat-label>Trọng số đóng góp</mat-label>
                <input matInput type="number" min="1" [(ngModel)]="form.contribution_weight" />
                <mat-hint>Mặc định 1. Tăng nếu task này quan trọng hơn.</mat-hint>
              </mat-form-field>
            }
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
    .dialog-container { width: min(560px, 92vw); min-width: 0; box-sizing: border-box; }
    mat-dialog-content { max-height: 70vh; }
    .form-col { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; min-width: 0; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 600px) { .row-2 { grid-template-columns: 1fr; } }
    mat-form-field { width: 100%; }
    mat-dialog-actions .spacer { flex: 1; }
    mat-dialog-actions .delete-left { margin-right: auto; }
    .kr-section { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 12px 8px; background: #f8fafc; display: flex; flex-direction: column; gap: 8px; }
    .kr-section-header { display: flex; align-items: center; gap: 6px; color: #3b82f6; font-weight: 600; font-size: 13px; }
    .kr-icon { font-size: 18px; width: 18px; height: 18px; }
    .kr-search-field { width: 100%; }
    .kr-search-prefix-icon { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; margin-right: 4px; }
    .kr-weight-field { width: 220px; }
    .kr-selected-hint { display: flex; align-items: center; gap: 4px; color: #16a34a !important; font-size: 11px; }
    .hint-icon { font-size: 13px; width: 13px; height: 13px; }
    .kr-clear-option { color: #64748b; font-size: 13px; display: flex; align-items: center; gap: 6px; }
    .kr-option-row { display: flex; align-items: flex-start; gap: 8px; padding: 2px 0; min-height: 36px; }
    .kr-option-badge { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; min-width: 24px; margin-top: 2px; }
    .kr-option-text { display: flex; flex-direction: column; min-width: 0; }
    .kr-option-obj { font-size: 11px; color: #94a3b8; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .kr-option-kr  { font-size: 13px; color: #1e293b; font-weight: 500; line-height: 1.4; white-space: normal; }
    .kr-financial { background: #dcfce7; color: #166534; }
    .kr-customer  { background: #dbeafe; color: #1e40af; }
    .kr-internal  { background: #f3e8ff; color: #6b21a8; }
    .kr-learning  { background: #ffedd5; color: #9a3412; }
    .guide-panel { margin-bottom: 16px; }
    .guide-panel .mat-mdc-expansion-panel-header-title { align-items: center; gap: 8px; }
    .guide-icon { color: #f59e0b; font-size: 20px; width: 20px; height: 20px; }
    .guide-content { font-size: 13px; line-height: 1.55; color: #334155; }
    .guide-intro { margin: 0 0 12px; }
    .guide-content h4 { margin: 14px 0 6px; font-size: 13px; font-weight: 700; color: #1e293b; }
    .guide-content ul { margin: 0; padding-left: 18px; }
    .guide-content li { margin-bottom: 4px; }
    .guide-examples { margin: 10px 0 4px; font-size: 12px; font-weight: 600; color: #475569; }
    .examples-list.good { border-left: 3px solid #22c55e; padding-left: 14px; margin-bottom: 8px; }
    .examples-list.bad { border-left: 3px solid #ef4444; padding-left: 14px; margin-bottom: 8px; }
    .guide-tip { margin: 12px 0 0; padding: 8px 10px; background: #eff6ff; border-radius: 6px; font-size: 12px; color: #1e40af; }
  `]
})
export class TaskDialogComponent implements OnInit {
  readonly data     = inject(MAT_DIALOG_DATA) as { task: Task | null; projectId: string; defaultStatus?: TaskStatus };
  private dialogRef = inject(MatDialogRef<TaskDialogComponent>);
  private taskSvc   = inject(TaskService);
  private auth      = inject(AuthService);
  private projectSvc = inject(ProjectService);
  private objectiveSvc = inject(ObjectiveService);
  private snackBar  = inject(MatSnackBar);
  private confirmSvc = inject(ConfirmService);

  users        = signal<Profile[]>([]);
  isSaving     = signal(false);
  krOptions    = signal<KrOption[]>([]);
  krSearchText = '';
  krQuery      = signal('');
  separatorKeys = [ENTER, COMMA];

  filteredKrOptions = computed(() => {
    const q = this.krQuery().toLowerCase().trim();
    if (!q) return this.krOptions();
    return this.krOptions().filter(kr =>
      kr.label.toLowerCase().includes(q) ||
      kr.objectiveTitle.toLowerCase().includes(q) ||
      BSC_LABEL[kr.bsc_type]?.toLowerCase().includes(q)
    );
  });

  selectedKrLabel = computed(() => {
    if (!this.form.linked_kr_id) return null;
    const kr = this.krOptions().find(k => k.id === this.form.linked_kr_id);
    return kr ? `${kr.objectiveTitle} → ${kr.label}` : null;
  });

  form = {
    title: '', description: '', status: (this.data.defaultStatus ?? 'todo') as TaskStatus,
    priority: 'medium' as TaskPriority, assignees_preview: [] as string[],
    start_date: null as any, due_date: null as any, labels: [] as string[],
    linked_kr_id: null as string | null, contribution_weight: 1
  };

  bscShort(type: string): string { return BSC_SHORT[type] ?? type.slice(0, 2).toUpperCase(); }

  onKrSearchChange(val: string): void { this.krQuery.set(val); }

  onKrSelected(value: string | null): void {
    if (value === '__clear__') { this.clearKr(); return; }
    this.form.linked_kr_id = value;
    const kr = this.krOptions().find(k => k.id === value);
    this.krSearchText = kr ? kr.label : '';
    this.krQuery.set('');
  }

  clearKr(): void {
    this.form.linked_kr_id = null;
    this.krSearchText = '';
    this.krQuery.set('');
  }

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
    const proj = this.projectSvc.projects().find(p => p.id === this.data.projectId);
    const membersRaw = (proj as any)?.project_members as Array<{ user_id: string; profiles?: any }> ?? [];
    this.users.set(
      membersRaw
        .filter((m: any) => m.profiles)
        .map((m: any) => ({
          id: m.user_id,
          email: m.profiles?.email ?? null,
          display_name: m.profiles?.display_name ?? null,
          photo_url: m.profiles?.photo_url ?? null,
          system_role: m.profiles?.system_role ?? 'user',
          active_timer: null,
          created_at: '',
          updated_at: ''
        } as Profile))
        .sort((a, b) => (a.display_name || a.email || '').localeCompare(b.display_name || b.email || ''))
    );
    this.objectiveSvc.loadAllKeyResults().then(() => {
      const krs = this.objectiveSvc.allKeyResults() as any[];
      this.krOptions.set(krs.map(kr => ({
        id: kr.id,
        label: kr.title,
        objectiveTitle: kr.objectives?.title ?? '',
        bsc_type: kr.objectives?.type ?? ''
      })));
      // Pre-fill search text if task already has a linked KR
      if (this.form.linked_kr_id) {
        const matched = this.krOptions().find(k => k.id === this.form.linked_kr_id);
        if (matched) this.krSearchText = matched.label;
      }
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
