import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { ObjectiveService } from '../../services/objective.service';
import { AuthService } from '../../core/auth/auth.service';
import { BigPictureObjective, BigPictureKR, BigPictureTask, BSC_TYPES, ObjectiveType } from '../../shared/models';

const BSC_CONFIG: Record<ObjectiveType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  financial: { label: 'Tài chính',           icon: 'attach_money', color: '#166534', bg: '#dcfce7', border: '#86efac' },
  customer:  { label: 'Khách hàng',          icon: 'people',       color: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
  internal:  { label: 'Quy trình nội bộ',    icon: 'settings',     color: '#6b21a8', bg: '#f3e8ff', border: '#d8b4fe' },
  learning:  { label: 'Học hỏi & phát triển', icon: 'school',      color: '#9a3412', bg: '#ffedd5', border: '#fdba74' },
};

const STATUS_LABEL: Record<string, string> = {
  on_track: 'Đúng tiến độ', at_risk: 'Có rủi ro', behind: 'Chậm tiến độ'
};

@Component({
  selector: 'app-big-picture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, DatePipe, DecimalPipe, RouterLink,
    MatButtonModule, MatIconModule, MatProgressBarModule,
    MatTooltipModule, MatChipsModule, MatSelectModule, MatFormFieldModule
  ],
  template: `
    <div class="bp-page">
      <!-- Header -->
      <div class="bp-header">
        <div>
          <h1 class="page-title">The Big Picture</h1>
          <p class="text-muted text-sm">Chiến lược công ty — BSC/OKR → Key Results → Tasks đang thực hiện & đang review</p>
        </div>
        <div class="bp-header-actions">
          <mat-form-field appearance="outline" style="width:200px">
            <mat-label>Lọc BSC quadrant</mat-label>
            <mat-select [(ngModel)]="filterType" (ngModelChange)="filterType = $event">
              <mat-option [value]="null">Tất cả</mat-option>
              @for (b of bscTypes; track b.type) {
                <mat-option [value]="b.type">
                  <mat-icon style="font-size:16px;vertical-align:middle;margin-right:6px">{{ b.icon }}</mat-icon>
                  {{ b.label }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-stroked-button (click)="load()">
            <mat-icon>refresh</mat-icon> Làm mới
          </button>
        </div>
      </div>

      @if (isLoading()) {
        <div class="bp-loading">
          <mat-icon class="spin">sync</mat-icon>
          <span>Đang tải dữ liệu chiến lược...</span>
        </div>
      } @else if (filteredObjectives().length === 0) {
        <div class="bp-empty">
          <mat-icon>account_tree</mat-icon>
          <h3>Chưa có dữ liệu chiến lược</h3>
          <p>Tạo Objectives và Key Results trong mục <a routerLink="/objectives">Objectives</a>, sau đó liên kết Tasks vào KRs.</p>
        </div>
      } @else {
        <!-- Summary bar -->
        <div class="summary-bar">
          @for (b of bscSummary(); track b.type) {
            <div class="summary-card" [style.border-color]="bscConfig[b.type].border" [style.background]="bscConfig[b.type].bg">
              <mat-icon [style.color]="bscConfig[b.type].color">{{ bscConfig[b.type].icon }}</mat-icon>
              <div class="summary-info">
                <span class="summary-label" [style.color]="bscConfig[b.type].color">{{ bscConfig[b.type].label }}</span>
                <span class="summary-pct" [style.color]="bscConfig[b.type].color">{{ b.avgProgress | number:'1.0-0' }}%</span>
              </div>
              <div class="summary-meta">{{ b.count }} objectives · {{ b.activeTasks }} tasks</div>
            </div>
          }
        </div>

        <!-- Tree: Objective → KR → Tasks -->
        <div class="objectives-tree">
          @for (obj of filteredObjectives(); track obj.id) {
            <div class="obj-block" [style.border-left-color]="bscConfig[obj.type].color">
              <!-- Objective row -->
              <div class="obj-header">
                <div class="obj-title-row">
                  <div class="obj-icon-wrap" [style.background]="bscConfig[obj.type].bg" [style.color]="bscConfig[obj.type].color">
                    <mat-icon>{{ bscConfig[obj.type].icon }}</mat-icon>
                  </div>
                  <div class="obj-title-info">
                    <h3 class="obj-title">{{ obj.title }}</h3>
                    <span class="obj-meta">
                      <span class="status-pill status-{{ obj.status }}">{{ statusLabel(obj.status) }}</span>
                      <span class="text-muted text-xs">{{ bscConfig[obj.type].label }}</span>
                    </span>
                  </div>
                  <div class="obj-progress-info">
                    <span class="obj-pct" [style.color]="bscConfig[obj.type].color">{{ obj.progress_percent | number:'1.0-0' }}%</span>
                    <span class="text-muted text-xs">{{ activeTaskCount(obj) }} tasks đang hoạt động</span>
                  </div>
                </div>
                <mat-progress-bar
                  mode="determinate"
                  [value]="obj.progress_percent"
                  class="obj-progress-bar"
                  [style.--mdc-linear-progress-active-indicator-color]="bscConfig[obj.type].color" />
              </div>

              <!-- Key Results -->
              <div class="krs-list">
                @for (kr of obj.key_results; track kr.id) {
                  <div class="kr-block">
                    <div class="kr-header">
                      <div class="kr-left">
                        <mat-icon class="kr-icon">flag</mat-icon>
                        <span class="kr-title">{{ kr.title }}</span>
                        @if (kr.type === 'metric') {
                          <span class="kr-metric-badge">
                            {{ kr.current_value | number:'1.0-1' }} / {{ kr.target_value | number:'1.0-1' }} {{ kr.unit }}
                          </span>
                        }
                      </div>
                      <div class="kr-right">
                        <span class="kr-pct">{{ kr.progress_percent | number:'1.0-0' }}%</span>
                        <mat-progress-bar mode="determinate" [value]="kr.progress_percent" class="kr-bar" />
                      </div>
                    </div>

                    <!-- Active tasks under this KR -->
                    @if (kr.tasks && kr.tasks.length > 0) {
                      <div class="tasks-list">
                        @for (task of kr.tasks; track task.id) {
                          <div class="task-row" [class.task-review]="task.status === 'review'">
                            <div class="task-row-left">
                              <span class="task-status-dot status-dot-{{ task.status }}" [matTooltip]="task.status === 'in_progress' ? 'In Progress' : 'Review'"></span>
                              <span class="task-row-title">{{ task.title }}</span>
                              <span class="priority-chip priority-{{ task.priority }}">{{ task.priority }}</span>
                            </div>
                            <div class="task-row-right">
                              @if (task.due_date) {
                                <span class="task-due text-xs text-muted">
                                  <mat-icon style="font-size:13px;vertical-align:middle">event</mat-icon>
                                  {{ task.due_date | date:'dd/MM' }}
                                </span>
                              }
                              <span class="task-weight-badge" [matTooltip]="'Trọng số: ' + task.contribution_weight">
                                ×{{ task.contribution_weight }}
                              </span>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="no-tasks">
                        <mat-icon>hourglass_empty</mat-icon>
                        <span>Không có task đang thực hiện hoặc đang review</span>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .bp-page { max-width: 1100px; margin: 0 auto; padding-bottom: 40px; }
    .bp-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .bp-header-actions { display: flex; align-items: center; gap: 12px; }
    .bp-loading { display: flex; align-items: center; gap: 12px; padding: 60px; justify-content: center; color: #64748b; }
    .bp-loading .spin { animation: spin 1s linear infinite; font-size: 32px; width: 32px; height: 32px; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .bp-empty { text-align: center; padding: 80px 24px; }
    .bp-empty mat-icon { font-size: 64px; width: 64px; height: 64px; color: #cbd5e1; margin-bottom: 16px; }
    .bp-empty h3 { color: #475569; margin: 0 0 8px; }
    .bp-empty p { color: #94a3b8; }
    .bp-empty a { color: #3b82f6; }

    /* Summary bar */
    .summary-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .summary-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; border: 1.5px solid; }
    .summary-card mat-icon { font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; }
    .summary-info { display: flex; flex-direction: column; flex: 1; }
    .summary-label { font-size: 12px; font-weight: 600; }
    .summary-pct { font-size: 22px; font-weight: 800; line-height: 1.2; }
    .summary-meta { font-size: 11px; color: #64748b; white-space: nowrap; }

    /* Objective block */
    .objectives-tree { display: flex; flex-direction: column; gap: 20px; }
    .obj-block { background: white; border-radius: 12px; border: 1px solid #e2e8f0; border-left: 4px solid; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .obj-header { padding: 16px 20px 12px; }
    .obj-title-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
    .obj-icon-wrap { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .obj-icon-wrap mat-icon { font-size: 22px; }
    .obj-title-info { flex: 1; }
    .obj-title { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #0f172a; }
    .obj-meta { display: flex; align-items: center; gap: 8px; }
    .obj-progress-info { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
    .obj-pct { font-size: 24px; font-weight: 800; line-height: 1; }
    .obj-progress-bar { height: 8px !important; border-radius: 4px; }
    .status-pill { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .status-on_track { background: #dcfce7; color: #166534; }
    .status-at_risk   { background: #fef9c3; color: #854d0e; }
    .status-behind    { background: #fee2e2; color: #991b1b; }

    /* KR blocks */
    .krs-list { border-top: 1px solid #f1f5f9; }
    .kr-block { padding: 12px 20px; border-bottom: 1px solid #f8fafc; }
    .kr-block:last-child { border-bottom: none; }
    .kr-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
    .kr-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .kr-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; flex-shrink: 0; }
    .kr-title { font-size: 13px; font-weight: 600; color: #334155; flex: 1; min-width: 0; }
    .kr-metric-badge { background: #f1f5f9; color: #475569; padding: 1px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .kr-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .kr-pct { font-size: 14px; font-weight: 700; color: #1e293b; min-width: 36px; text-align: right; }
    .kr-bar { width: 120px; height: 6px !important; border-radius: 3px; }

    /* Task rows */
    .tasks-list { display: flex; flex-direction: column; gap: 6px; margin-left: 24px; padding: 6px 0; }
    .task-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .task-review { background: #fefce8; border-color: #fde68a; }
    .task-row-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .task-row-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .task-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-dot-in_progress { background: #3b82f6; }
    .status-dot-review      { background: #f59e0b; }
    .task-row-title { font-size: 12px; color: #334155; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .priority-chip { padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
    .priority-low      { background: #dcfce7; color: #166534; }
    .priority-medium   { background: #fef9c3; color: #854d0e; }
    .priority-high     { background: #ffedd5; color: #9a3412; }
    .priority-critical { background: #fee2e2; color: #991b1b; }
    .task-due { display: inline-flex; align-items: center; gap: 2px; }
    .task-weight-badge { background: #e0e7ff; color: #3730a3; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 700; }
    .no-tasks { display: flex; align-items: center; gap: 6px; color: #94a3b8; font-size: 12px; padding: 6px 0 6px 24px; }
    .no-tasks mat-icon { font-size: 14px; width: 14px; height: 14px; }

    @media (max-width: 700px) {
      .summary-bar { grid-template-columns: 1fr 1fr; }
      .kr-bar { width: 80px; }
      .obj-pct { font-size: 18px; }
    }
  `]
})
export class BigPictureComponent implements OnInit {
  private objectiveSvc = inject(ObjectiveService);
  readonly auth        = inject(AuthService);

  isLoading  = signal(false);
  objectives = signal<BigPictureObjective[]>([]);
  filterType = signal<ObjectiveType | null>(null);

  readonly bscConfig = BSC_CONFIG;
  readonly bscTypes  = BSC_TYPES;

  readonly filteredObjectives = computed(() => {
    const ft = this.filterType();
    const list = this.objectives();
    return ft ? list.filter(o => o.type === ft) : list;
  });

  readonly bscSummary = computed(() => {
    const all = this.objectives();
    return (['financial', 'customer', 'internal', 'learning'] as ObjectiveType[]).map(type => {
      const objs = all.filter(o => o.type === type);
      const avgProgress = objs.length
        ? objs.reduce((s, o) => s + o.progress_percent, 0) / objs.length
        : 0;
      const activeTasks = objs.reduce((s, o) =>
        s + (o.key_results ?? []).reduce((ks, kr) => ks + (kr.tasks?.length ?? 0), 0), 0);
      return { type, count: objs.length, avgProgress, activeTasks };
    }).filter(b => b.count > 0);
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    const data = await this.objectiveSvc.getBigPicture();
    this.objectives.set(data);
    this.isLoading.set(false);
  }

  statusLabel(status: string): string {
    return STATUS_LABEL[status] ?? status;
  }

  activeTaskCount(obj: BigPictureObjective): number {
    return (obj.key_results ?? []).reduce((s, kr) => s + (kr.tasks?.length ?? 0), 0);
  }
}
