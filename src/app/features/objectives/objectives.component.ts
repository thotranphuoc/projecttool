import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { ObjectiveService } from '../../services/objective.service';
import { ProjectService } from '../../services/project.service';
import { Objective, KeyResult, BSC_TYPES, ObjectiveType } from '../../shared/models';

@Component({
  selector: 'app-objectives',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, DecimalPipe,
    MatButtonModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatInputModule, MatProgressBarModule,
    MatChipsModule, MatTooltipModule, MatMenuModule
  ],
  template: `
    <div class="objectives-page">
      <div class="page-header">
        <h1 class="page-title">Objectives (BSC/OKR)</h1>
        <div class="flex items-center gap-2">
          <mat-form-field appearance="outline" style="width:200px">
            <mat-label>Project</mat-label>
            <mat-select [(ngModel)]="selectedProject" (ngModelChange)="onProjectChange()">
              <mat-option [value]="null">Global</mat-option>
              @for (p of projectSvc.projects(); track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (canCreate()) {
            <button mat-flat-button color="primary" (click)="openDialog()">
              <mat-icon>add</mat-icon> Thêm Objective
            </button>
          }
        </div>
      </div>

      <!-- BSC quadrants -->
      <div class="bsc-grid">
        @for (bsc of bscTypes; track bsc.type) {
          <div class="bsc-quadrant">
            <div class="quadrant-header">
              <mat-icon class="bsc-icon">{{ bsc.icon }}</mat-icon>
              <span>{{ bsc.label }}</span>
              <span class="quadrant-count">{{ getByType(bsc.type).length }}</span>
            </div>

            <div class="objectives-list">
              @if (getByType(bsc.type).length === 0) {
                <div class="empty-quadrant">Chưa có objective</div>
              }
              @for (obj of getByType(bsc.type); track obj.id) {
                <div class="objective-card">
                  <div class="obj-header">
                    <span class="obj-title">{{ obj.title }}</span>
                    <span class="status-badge status-{{ obj.status }}">{{ statusLabel(obj.status) }}</span>
                    @if (canCreate()) {
                      <button mat-icon-button [matMenuTriggerFor]="objMenu">
                        <mat-icon>more_vert</mat-icon>
                      </button>
                      <mat-menu #objMenu="matMenu">
                        <button mat-menu-item (click)="openDialog(obj)"><mat-icon>edit</mat-icon> Sửa</button>
                        <button mat-menu-item (click)="deleteObjective(obj)"><mat-icon color="warn">delete</mat-icon> Xóa</button>
                      </mat-menu>
                    }
                  </div>

                  <div class="progress-section">
                    <div class="progress-info">
                      <span class="text-xs text-muted">Tiến độ</span>
                      <span class="text-xs font-bold">{{ obj.progress_percent | number:'1.0-0' }}%</span>
                    </div>
                    <mat-progress-bar mode="determinate" [value]="obj.progress_percent" [color]="progressColor(obj)" />
                  </div>

                  <!-- Key results -->
                  @if (obj.key_results && obj.key_results.length > 0) {
                    <div class="key-results">
                      @for (kr of obj.key_results; track kr.id) {
                        <div class="kr-item">
                          <span class="kr-title text-xs">{{ kr.title }}</span>
                          @if (kr.type === 'metric') {
                            <div class="kr-metric-edit">
                              @if (editingKrId() === kr.id) {
                                <input
                                  class="kr-inline-input"
                                  type="number"
                                  [min]="0"
                                  [max]="kr.target_value"
                                  [(ngModel)]="editingValue"
                                  (keydown.enter)="saveKrValue(kr)"
                                  (keydown.escape)="cancelEdit()"
                                  (blur)="saveKrValue(kr)"
                                  autofocus
                                />
                                <span class="kr-unit text-xs text-muted">/ {{ kr.target_value }} {{ kr.unit }}</span>
                              } @else {
                                <span
                                  class="kr-value text-xs font-semibold kr-clickable"
                                  [matTooltip]="canCreate() ? 'Click để cập nhật giá trị' : ''"
                                  (click)="canCreate() && startEdit(kr)"
                                >
                                  {{ kr.current_value | number:'1.0-1' }} / {{ kr.target_value | number:'1.0-1' }} {{ kr.unit }}
                                </span>
                              }
                            </div>
                          } @else {
                            <span class="kr-value text-xs font-semibold">{{ kr.progress_percent | number:'1.0-0' }}%</span>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .objectives-page { max-width: 1400px; margin: 0 auto; }
    .bsc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .bsc-quadrant { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .quadrant-header { display: flex; align-items: center; gap: 8px; padding: 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-size: 14px; }
    .bsc-icon { color: #3b82f6; font-size: 20px; }
    .quadrant-count { margin-left: auto; background: #e2e8f0; padding: 1px 8px; border-radius: 999px; font-size: 12px; }
    .objectives-list { padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 100px; }
    .empty-quadrant { text-align: center; color: #94a3b8; padding: 24px; font-size: 13px; }
    .objective-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .obj-header { display: flex; align-items: center; gap: 8px; }
    .obj-title { font-weight: 600; font-size: 14px; flex: 1; }
    .progress-section { display: flex; flex-direction: column; gap: 4px; }
    .progress-info { display: flex; justify-content: space-between; }
    .key-results { display: flex; flex-direction: column; gap: 4px; }
    .kr-item { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: #f8fafc; border-radius: 6px; gap: 8px; }
    .kr-title { color: #475569; flex: 1; min-width: 0; }
    .kr-value { color: #0f172a; }
    .kr-metric-edit { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .kr-clickable { cursor: pointer; text-decoration: underline dotted #94a3b8; }
    .kr-clickable:hover { color: #3b82f6; }
    .kr-inline-input {
      width: 90px; padding: 2px 6px; border: 1.5px solid #3b82f6; border-radius: 4px;
      font-size: 12px; font-weight: 600; outline: none; background: white;
      -moz-appearance: textfield;
    }
    .kr-inline-input::-webkit-outer-spin-button,
    .kr-inline-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .kr-unit { color: #64748b; white-space: nowrap; }
    .kr-edit-btn { width: 20px; height: 20px; line-height: 20px; color: #94a3b8; }
    .kr-edit-btn:hover { color: #3b82f6; }
    @media (max-width: 900px) { .bsc-grid { grid-template-columns: 1fr; } }
  `]
})
export class ObjectivesComponent implements OnInit {
  readonly auth         = inject(AuthService);
  readonly objectiveSvc = inject(ObjectiveService);
  readonly projectSvc   = inject(ProjectService);
  private dialog        = inject(MatDialog);
  private confirmSvc    = inject(ConfirmService);
  private snackbar      = inject(MatSnackBar);

  bscTypes        = BSC_TYPES;
  selectedProject = signal<string | null>(null);
  editingKrId     = signal<string | null>(null);
  editingValue    = 0;

  readonly canCreate = computed(() => {
    if (this.auth.isDirector()) return true;
    if (!this.selectedProject()) return false;
    return this.projectSvc.isManager(this.selectedProject()!);
  });

  ngOnInit(): void {
    this.projectSvc.loadProjects();
    this.objectiveSvc.loadObjectives(null);
  }

  onProjectChange(): void {
    this.objectiveSvc.loadObjectives(this.selectedProject());
  }

  getByType(type: ObjectiveType): Objective[] {
    return this.objectiveSvc.objectives().filter(o => o.type === type);
  }

  statusLabel(status: string): string {
    return { on_track: 'Đúng tiến độ', at_risk: 'Có rủi ro', behind: 'Chậm tiến độ' }[status] ?? status;
  }

  progressColor(obj: Objective): 'primary' | 'accent' | 'warn' {
    return obj.status === 'on_track' ? 'primary' : obj.status === 'at_risk' ? 'accent' : 'warn';
  }

  startEdit(kr: KeyResult): void {
    this.editingKrId.set(kr.id);
    this.editingValue = kr.current_value ?? 0;
  }

  cancelEdit(): void {
    this.editingKrId.set(null);
  }

  async saveKrValue(kr: KeyResult): Promise<void> {
    if (this.editingKrId() !== kr.id) return;
    this.editingKrId.set(null);

    const newValue = Number(this.editingValue);
    if (newValue === kr.current_value) return;

    const progress = kr.target_value
      ? Math.min(Math.round((newValue / kr.target_value) * 100), 100)
      : 0;

    await this.objectiveSvc.updateKeyResult(kr.id, {
      current_value:    newValue,
      progress_percent: progress,
    });

    // Reload để lấy progress_percent của Objective sau khi trigger server tính lại
    await this.objectiveSvc.loadObjectives(this.selectedProject());

    this.snackbar.open(
      `Đã cập nhật: ${newValue.toLocaleString('vi')} / ${kr.target_value?.toLocaleString('vi')} ${kr.unit ?? ''}`,
      'Đóng',
      { duration: 3000 }
    );
  }

  async openDialog(objective?: Objective): Promise<void> {
    const { ObjectiveDialogComponent } = await import('./objective-dialog.component');
    const ref = this.dialog.open(ObjectiveDialogComponent, {
      width: '600px',
      data: { objective: objective ?? null, projectId: this.selectedProject() }
    });
    ref.afterClosed().subscribe(() => this.objectiveSvc.loadObjectives(this.selectedProject()));
  }

  async deleteObjective(obj: Objective): Promise<void> {
    if (!(await this.confirmSvc.open({ title: 'Xóa objective', message: `Xóa objective "${obj.title}"?`, confirmText: 'Xóa', confirmWarn: true }))) return;
    await this.objectiveSvc.deleteObjective(obj.id);
  }
}
