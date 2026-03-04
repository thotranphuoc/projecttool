import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { VisionStrategyService } from '../../services/vision-strategy.service';
import { StrategyService } from '../../services/strategy.service';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../core/auth/auth.service';
import { BigPictureObjectiveWithScores } from '../../services/strategy.service';
import { BigPictureObjective, BigPictureTask, BSC_TYPES, ObjectiveType } from '../../shared/models';
import { Subtask } from '../../shared/models';
import { buildStrategyTree } from './strategy-tree-builder';
import { StrategyTreeNode, hasStrategyTreeChildren } from './strategy-tree.model';

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
    FormsModule, NgTemplateOutlet, DatePipe, DecimalPipe, RouterLink,
    MatButtonModule, MatIconModule, MatProgressBarModule,
    MatTooltipModule, MatChipsModule, MatSelectModule, MatFormFieldModule,
    MatTabsModule, MatMenuModule
  ],
  template: `
    <div class="bp-page">
      <div class="bp-header">
        <div>
          <h1 class="page-title">The Big Picture</h1>
          <p class="text-muted text-sm">Toàn cảnh chiến lược: từ Vision → KSF → Chuỗi giá trị → Objectives &amp; KRs → Tasks</p>
        </div>
        <div class="bp-header-actions">
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
      } @else if (objectives().length === 0) {
        <div class="bp-empty">
          <mat-icon>account_tree</mat-icon>
          <h3>Chưa có dữ liệu chiến lược</h3>
          <p>Tạo Objectives và Key Results trong mục <a routerLink="/objectives">Objectives</a>, sau đó liên kết Tasks vào KRs.</p>
        </div>
      } @else {
        <mat-tab-group class="bp-tabs" [selectedIndex]="0" (selectedIndexChange)="onBpTabIndexChange($event)">
          <!-- Tab 1: Theo BSC -->
          <mat-tab label="Theo BSC">
            <div class="tab-content">
              <div class="bp-header-actions tab-actions">
                <mat-form-field appearance="outline" style="width:200px">
                  <mat-label>Lọc BSC quadrant</mat-label>
                  <mat-select [ngModel]="filterType()" (ngModelChange)="filterType.set($event)">
                    <mat-option [value]="null">Tất cả</mat-option>
                    @for (b of bscTypes; track b.type) {
                      <mat-option [value]="b.type">
                        <mat-icon style="font-size:16px;vertical-align:middle;margin-right:6px">{{ b.icon }}</mat-icon>
                        {{ b.label }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
              @if (filteredObjectives().length === 0) {
                <div class="bp-empty-inline text-muted">Không có objective nào (hoặc thử bỏ lọc BSC).</div>
              } @else {
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
                <div class="objectives-tree">
                  @for (obj of filteredObjectives(); track obj.id) {
                    @let o = obj;
                    <div class="obj-block" [style.border-left-color]="bscConfig[o.type].color">
                      <div class="obj-header">
                        <div class="obj-title-row">
                          <div class="obj-icon-wrap" [style.background]="bscConfig[o.type].bg" [style.color]="bscConfig[o.type].color">
                            <mat-icon>{{ bscConfig[o.type].icon }}</mat-icon>
                          </div>
                          <div class="obj-title-info">
                            <h3 class="obj-title">{{ o.title }}</h3>
                            <span class="obj-meta">
                              <span class="status-pill status-{{ o.status }}">{{ statusLabel(o.status) }}</span>
                              <span class="text-muted text-xs">{{ bscConfig[o.type].label }}</span>
                            </span>
                          </div>
                          <div class="obj-progress-info">
                            <span class="obj-pct" [style.color]="bscConfig[o.type].color">{{ o.progress_percent | number:'1.0-0' }}%</span>
                            <span class="text-muted text-xs">{{ activeTaskCount(o) }} tasks đang hoạt động</span>
                          </div>
                          @if (canEditObjective(o)) {
                            <button mat-icon-button [matMenuTriggerFor]="objMenuBsc" type="button">
                              <mat-icon>more_vert</mat-icon>
                            </button>
                            <mat-menu #objMenuBsc="matMenu">
                              <button mat-menu-item (click)="openObjectiveDialog(o)">
                                <mat-icon>edit</mat-icon> Sửa
                              </button>
                            </mat-menu>
                          }
                        </div>
                        <mat-progress-bar mode="determinate" [value]="o.progress_percent" class="obj-progress-bar"
                          [style.--mdc-linear-progress-active-indicator-color]="bscConfig[o.type].color" />
                      </div>
                      <div class="krs-list">
                        @for (kr of o.key_results; track kr.id) {
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
                                <span class="kr-pct">{{ kr.krScore | number:'1.0-0' }}%</span>
                                <mat-progress-bar mode="determinate" [value]="kr.krScore" class="kr-bar" />
                              </div>
                            </div>
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
                                      <span class="task-weight-badge" [matTooltip]="'Trọng số: ' + task.contribution_weight">×{{ task.contribution_weight }}</span>
                                    </div>
                                  </div>
                                }
                              </div>
                            } @else {
                              <div class="no-tasks">
                                <mat-icon>hourglass_empty</mat-icon>
                                <span>Chưa có task nào</span>
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
          </mat-tab>

          <!-- Tab 2: Theo Chiến lược -->
          <mat-tab label="Theo Chiến lược">
            <div class="tab-content">
              <div class="strategy-tree">
                @for (g of objectivesByStrategy(); track g.key) {
                  <div class="strategy-group">
                    <div class="strategy-group-header">
                      <span class="strategy-vision">{{ g.visionTitle || 'Chưa gắn chiến lược' }}</span>
                      <span class="strategy-strategy">{{ g.strategyTitle }} {{ g.strategyPeriod ? '(' + g.strategyPeriod + ')' : '' }}</span>
                    </div>
                    <div class="objectives-tree">
                      @for (obj of g.objectives; track obj.id) {
                        @let o = obj;
                        <div class="obj-block" [style.border-left-color]="bscConfig[o.type].color">
                          <div class="obj-header">
                            <div class="obj-title-row">
                              <div class="obj-icon-wrap" [style.background]="bscConfig[o.type].bg" [style.color]="bscConfig[o.type].color">
                                <mat-icon>{{ bscConfig[o.type].icon }}</mat-icon>
                              </div>
                              <div class="obj-title-info">
                                <h3 class="obj-title">{{ o.title }}</h3>
                                <span class="obj-meta">
                                  <span class="status-pill status-{{ o.status }}">{{ statusLabel(o.status) }}</span>
                                  <span class="text-muted text-xs">{{ bscConfig[o.type].label }}</span>
                                </span>
                              </div>
                              <div class="obj-progress-info">
                                <span class="obj-pct" [style.color]="bscConfig[o.type].color">{{ o.progress_percent | number:'1.0-0' }}%</span>
                              </div>
                              @if (canEditObjective(o)) {
                                <button mat-icon-button [matMenuTriggerFor]="objMenuStrategy" type="button">
                                  <mat-icon>more_vert</mat-icon>
                                </button>
                                <mat-menu #objMenuStrategy="matMenu">
                                  <button mat-menu-item (click)="openObjectiveDialog(o)">
                                    <mat-icon>edit</mat-icon> Sửa
                                  </button>
                                </mat-menu>
                              }
                            </div>
                            <mat-progress-bar mode="determinate" [value]="o.progress_percent" class="obj-progress-bar"
                              [style.--mdc-linear-progress-active-indicator-color]="bscConfig[o.type].color" />
                          </div>
                          <div class="krs-list">
                            @for (kr of o.key_results; track kr.id) {
                              <div class="kr-block">
                                <div class="kr-header">
                                  <div class="kr-left">
                                    <mat-icon class="kr-icon">flag</mat-icon>
                                    <span class="kr-title">{{ kr.title }}</span>
                                    @if (kr.type === 'metric') {
                                      <span class="kr-metric-badge">{{ kr.current_value | number:'1.0-1' }} / {{ kr.target_value | number:'1.0-1' }} {{ kr.unit }}</span>
                                    }
                                  </div>
                                  <div class="kr-right">
                                    <span class="kr-pct">{{ kr.krScore | number:'1.0-0' }}%</span>
                                    <mat-progress-bar mode="determinate" [value]="kr.krScore" class="kr-bar" />
                                  </div>
                                </div>
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
                                          <span class="task-weight-badge" [matTooltip]="'Trọng số: ' + task.contribution_weight">×{{ task.contribution_weight }}</span>
                                        </div>
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
                }
              </div>
            </div>
          </mat-tab>

          <!-- Tab 3: Theo Chuỗi giá trị -->
          <mat-tab label="Theo Chuỗi giá trị">
            <div class="tab-content">
              <!-- Flow diagram: Giai đoạn 1 > Giai đoạn 2 > ... -->
              <div class="value-chain-flow" role="presentation">
                @for (item of valueChainTabList(); track item.id; let i = $index) {
                  @if (i > 0) {
                    <span class="flow-arrow" aria-hidden="true">&gt;</span>
                  }
                  <button type="button" class="flow-pill"
                    [class.flow-pill-active]="vcSelectedIndex() === i"
                    (click)="vcSelectedIndex.set(i)">
                    {{ item.label }}
                  </button>
                }
              </div>
              @if (valueChainTabList()[vcSelectedIndex()]?.description?.trim(); as desc) {
                <div class="value-chain-stage-description" role="region" aria-label="Mô tả giai đoạn">{{ desc }}</div>
              }
              <!-- Nested tabs: one per stage (header hidden, content only) -->
              <mat-tab-group class="value-chain-tabs" [selectedIndex]="vcSelectedIndex()" (selectedIndexChange)="vcSelectedIndex.set($event)">
                @for (item of valueChainTabList(); track item.id) {
                  <mat-tab [label]="item.label">
                    <div class="tab-content value-chain-tab-content">
                      @if (item.objectives.length === 0) {
                        <div class="bp-empty-inline text-muted">Chưa có objective nào trong giai đoạn này.</div>
                      } @else {
                        <div class="objectives-tree">
                          @for (obj of item.objectives; track obj.id) {
                            @let o = obj;
                            <div class="obj-block" [style.border-left-color]="bscConfig[o.type].color">
                              <div class="obj-header">
                                <div class="obj-title-row">
                                  <div class="obj-icon-wrap" [style.background]="bscConfig[o.type].bg" [style.color]="bscConfig[o.type].color">
                                    <mat-icon>{{ bscConfig[o.type].icon }}</mat-icon>
                                  </div>
                                  <div class="obj-title-info">
                                    <h3 class="obj-title">{{ o.title }}</h3>
                                    <span class="obj-meta">
                                      <span class="status-pill status-{{ o.status }}">{{ statusLabel(o.status) }}</span>
                                      <span class="text-muted text-xs">{{ bscConfig[o.type].label }}</span>
                                    </span>
                                  </div>
                                  <div class="obj-progress-info">
                                    <span class="obj-pct" [style.color]="bscConfig[o.type].color">{{ o.progress_percent | number:'1.0-0' }}%</span>
                                  </div>
                                  @if (canEditObjective(o)) {
                                    <button mat-icon-button [matMenuTriggerFor]="objMenuVc" type="button">
                                      <mat-icon>more_vert</mat-icon>
                                    </button>
                                    <mat-menu #objMenuVc="matMenu">
                                      <button mat-menu-item (click)="openObjectiveDialog(o)">
                                        <mat-icon>edit</mat-icon> Sửa
                                      </button>
                                    </mat-menu>
                                  }
                                </div>
                                <mat-progress-bar mode="determinate" [value]="o.progress_percent" class="obj-progress-bar"
                                  [style.--mdc-linear-progress-active-indicator-color]="bscConfig[o.type].color" />
                              </div>
                              <div class="krs-list">
                                @for (kr of o.key_results; track kr.id) {
                                  <div class="kr-block">
                                    <div class="kr-header">
                                      <div class="kr-left">
                                        <mat-icon class="kr-icon">flag</mat-icon>
                                        <span class="kr-title">{{ kr.title }}</span>
                                        @if (kr.type === 'metric') {
                                          <span class="kr-metric-badge">{{ kr.current_value | number:'1.0-1' }} / {{ kr.target_value | number:'1.0-1' }} {{ kr.unit }}</span>
                                        }
                                      </div>
                                      <div class="kr-right">
                                        <span class="kr-pct">{{ kr.krScore | number:'1.0-0' }}%</span>
                                        <mat-progress-bar mode="determinate" [value]="kr.krScore" class="kr-bar" />
                                      </div>
                                    </div>
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
                                              <span class="task-weight-badge" [matTooltip]="'Trọng số: ' + task.contribution_weight">×{{ task.contribution_weight }}</span>
                                            </div>
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
                      }
                    </div>
                  </mat-tab>
                }
              </mat-tab-group>
            </div>
          </mat-tab>

          <!-- Tab 5: Theo KSF -->
          <mat-tab label="Theo KSF">
            <div class="tab-content">
              <div class="value-chain-tree">
                @for (g of objectivesByKsf(); track g.label) {
                  <div class="strategy-group">
                    <div class="strategy-group-header">
                      <span class="strategy-vision">{{ g.label }}</span>
                    </div>
                    <div class="objectives-tree">
                      @for (obj of g.objectives; track obj.id) {
                        @let o = obj;
                        <div class="obj-block" [style.border-left-color]="bscConfig[o.type].color">
                          <div class="obj-header">
                            <div class="obj-title-row">
                              <div class="obj-icon-wrap" [style.background]="bscConfig[o.type].bg" [style.color]="bscConfig[o.type].color">
                                <mat-icon>{{ bscConfig[o.type].icon }}</mat-icon>
                              </div>
                              <div class="obj-title-info">
                                <h3 class="obj-title">{{ o.title }}</h3>
                                <span class="obj-meta">
                                  <span class="status-pill status-{{ o.status }}">{{ statusLabel(o.status) }}</span>
                                  <span class="text-muted text-xs">{{ bscConfig[o.type].label }}</span>
                                </span>
                              </div>
                              <div class="obj-progress-info">
                                <span class="obj-pct" [style.color]="bscConfig[o.type].color">{{ o.progress_percent | number:'1.0-0' }}%</span>
                              </div>
                              @if (canEditObjective(o)) {
                                <button mat-icon-button [matMenuTriggerFor]="objMenuKsf" type="button">
                                  <mat-icon>more_vert</mat-icon>
                                </button>
                                <mat-menu #objMenuKsf="matMenu">
                                  <button mat-menu-item (click)="openObjectiveDialog(o)">
                                    <mat-icon>edit</mat-icon> Sửa
                                  </button>
                                </mat-menu>
                              }
                            </div>
                            <mat-progress-bar mode="determinate" [value]="o.progress_percent" class="obj-progress-bar"
                              [style.--mdc-linear-progress-active-indicator-color]="bscConfig[o.type].color" />
                          </div>
                          <div class="krs-list">
                            @for (kr of o.key_results; track kr.id) {
                              <div class="kr-block">
                                <div class="kr-header">
                                  <div class="kr-left">
                                    <mat-icon class="kr-icon">flag</mat-icon>
                                    <span class="kr-title">{{ kr.title }}</span>
                                    @if (kr.type === 'metric') {
                                      <span class="kr-metric-badge">{{ kr.current_value | number:'1.0-1' }} / {{ kr.target_value | number:'1.0-1' }} {{ kr.unit }}</span>
                                    }
                                  </div>
                                  <div class="kr-right">
                                    <span class="kr-pct">{{ kr.krScore | number:'1.0-0' }}%</span>
                                    <mat-progress-bar mode="determinate" [value]="kr.krScore" class="kr-bar" />
                                  </div>
                                </div>
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
                                          <span class="task-weight-badge" [matTooltip]="'Trọng số: ' + task.contribution_weight">×{{ task.contribution_weight }}</span>
                                        </div>
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
                }
              </div>
            </div>
          </mat-tab>

          <!-- Tab 5: Cây chiến lược 9 tầng -->
          <mat-tab label="Cây chiến lược (9 tầng)">
            <div class="tab-content tree-tab">
              <p class="tree-desc text-muted">Vision → KSF → Strategy → Value Chain → Objective → KR → Project → Task → SubTask. Mở rộng task để tải subtask.</p>
              @if (treeData().length === 0) {
                <div class="tree-empty">
                  <mat-icon>account_tree</mat-icon>
                  <p>Chưa có dữ liệu cây chiến lược.</p>
                  <p class="text-muted text-sm">Hãy nhấn <strong>Làm mới</strong> ở góc phải để tải Big Picture, hoặc kiểm tra đã có Objective gắn Chiến lược / KSF / Chuỗi giá trị.</p>
                </div>
              } @else {
              <ng-template #treeNodeTpl let-nodes let-depth="depth">
                @for (node of nodes; track nodeKey(node)) {
                  <div class="tree-node" [attr.data-depth]="depth"
                       [style.padding-left.px]="depth * 24"
                       [class.tree-node-task]="node.type === 'task'"
                       [class.tree-node-expandable]="hasStrategyTreeChildren(node)"
                       (click)="handleDivClick(node, $event)">
                    @if (hasStrategyTreeChildren(node)) {
                      <button type="button" mat-icon-button class="tree-toggle-btn"
                              [attr.aria-label]="'Toggle ' + node.label"
                              (click)="handleBtnClick(node, $event)">
                        <mat-icon>{{ isNodeExpanded(node) ? 'expand_more' : 'chevron_right' }}</mat-icon>
                      </button>
                    } @else {
                      <span class="tree-node-padding"></span>
                    }
                    <span class="tree-node-icon" [attr.data-type]="node.type">
                      @switch (node.type) {
                        @case ('vision') { <mat-icon>visibility</mat-icon> }
                        @case ('ksf') { <mat-icon>star</mat-icon> }
                        @case ('strategy') { <mat-icon>account_tree</mat-icon> }
                        @case ('value_chain') { <mat-icon>link</mat-icon> }
                        @case ('objective') { <mat-icon>track_changes</mat-icon> }
                        @case ('kr') { <mat-icon>flag</mat-icon> }
                        @case ('project') { <mat-icon>folder</mat-icon> }
                        @case ('task') { <mat-icon>task_alt</mat-icon> }
                        @case ('subtask') { <mat-icon>subdirectory_arrow_right</mat-icon> }
                        @default { <mat-icon>circle</mat-icon> }
                      }
                    </span>
                    <span class="tree-node-label">{{ node.label }}</span>
                    @if (node.progressPercent != null && node.type !== 'subtask') {
                      <span class="tree-node-pct">{{ node.progressPercent | number:'1.0-0' }}%</span>
                    }
                  </div>
                  @if (hasStrategyTreeChildren(node) && isNodeExpanded(node)) {
                    <ng-container *ngTemplateOutlet="treeNodeTpl; context: { $implicit: node.children, depth: depth + 1 }"></ng-container>
                  }
                }
              </ng-template>
              <div class="strategy-tree">
                <ng-container *ngTemplateOutlet="treeNodeTpl; context: { $implicit: treeData(), depth: 0 }"></ng-container>
              </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
  styles: [`
    .bp-tabs { margin-top: 8px; }
    .tab-content { padding: 16px 0; }
    .tab-actions { margin-bottom: 12px; }
    .bp-empty-inline { padding: 24px; text-align: center; }
    .value-chain-flow {
      display: flex; align-items: center; flex-wrap: wrap; gap: 6px 4px;
      padding: 12px 0 16px; overflow-x: auto;
    }
    .flow-arrow { color: #94a3b8; font-size: 14px; font-weight: 700; flex-shrink: 0; }
    .flow-pill {
      flex-shrink: 0; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0;
      background: #f8fafc; color: #475569; font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }
    .flow-pill:hover { background: #f1f5f9; border-color: #cbd5e1; }
    .flow-pill-active { background: #3b82f6; border-color: #3b82f6; color: white; }
    .flow-pill-active:hover { background: #2563eb; border-color: #2563eb; color: white; }
    .value-chain-stage-description {
      padding: 10px 14px; margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #475569;
      background: #f8fafc; border-radius: 8px; border-left: 3px solid #3b82f6; white-space: pre-wrap;
    }
    :host ::ng-deep .value-chain-tabs .mat-mdc-tab-header { display: none; }
    .value-chain-tabs { margin-top: 0; }
    .value-chain-tab-content { padding-top: 12px; }
    .strategy-tree, .value-chain-tree { display: flex; flex-direction: column; gap: 24px; }
    .strategy-group { background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .strategy-group-header { padding: 12px 16px; background: #e2e8f0; font-weight: 600; display: flex; flex-direction: column; gap: 2px; }
    .strategy-vision { font-size: 14px; color: #0f172a; }
    .strategy-strategy { font-size: 12px; color: #475569; }
    .strategy-group .objectives-tree { padding: 12px; gap: 16px; }
    .strategy-group .obj-block { box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

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

    .summary-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .summary-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; border: 1.5px solid; }
    .summary-card mat-icon { font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; }
    .summary-info { display: flex; flex-direction: column; flex: 1; }
    .summary-label { font-size: 12px; font-weight: 600; }
    .summary-pct { font-size: 22px; font-weight: 800; line-height: 1.2; }
    .summary-meta { font-size: 11px; color: #64748b; white-space: nowrap; }

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

    .krs-list { border-top: 1px solid #e2e8f0; }
    .kr-block { padding: 12px 20px; border-bottom: 1px solid #e8edf2; background: #fafbfd; }
    .kr-block:last-child { border-bottom: none; }
    .kr-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
    .kr-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .kr-icon { font-size: 16px; width: 16px; height: 16px; color: #3b82f6; flex-shrink: 0; }
    .kr-title { font-size: 14px; font-weight: 600; color: #1e293b; flex: 1; min-width: 0; }
    .kr-metric-badge { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .kr-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .kr-pct { font-size: 15px; font-weight: 800; color: #0f172a; min-width: 40px; text-align: right; }
    .kr-bar { width: 120px; height: 7px !important; border-radius: 4px; }

    .tasks-list { display: flex; flex-direction: column; gap: 6px; margin-left: 24px; padding: 8px 0 4px; }
    .task-row { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 7px; background: white; border: 1px solid #dde3ea; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    .task-review { background: #fffbeb; border-color: #fcd34d; }
    .task-row-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .task-row-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .task-status-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .status-dot-in_progress { background: #3b82f6; box-shadow: 0 0 0 2px #bfdbfe; }
    .status-dot-review      { background: #f59e0b; box-shadow: 0 0 0 2px #fde68a; }
    .task-row-title { font-size: 13px; font-weight: 500; color: #1e293b; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .priority-chip { padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 700; text-transform: uppercase; flex-shrink: 0; letter-spacing: 0.3px; }
    .priority-low      { background: #dcfce7; color: #166534; }
    .priority-medium   { background: #fef9c3; color: #854d0e; }
    .priority-high     { background: #ffedd5; color: #9a3412; }
    .priority-critical { background: #fee2e2; color: #991b1b; }
    .task-due { display: inline-flex; align-items: center; gap: 2px; color: #64748b; font-size: 12px; }
    .task-weight-badge { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; }
    .no-tasks { display: flex; align-items: center; gap: 6px; color: #94a3b8; font-size: 12px; padding: 8px 0 4px 24px; }
    .no-tasks mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .tree-tab { padding: 16px 0; }
    .tree-desc { font-size: 12px; margin-bottom: 16px; }
    .strategy-tree { background: #fafafa; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; }
    .tree-node {
      display: flex; align-items: center; gap: 10px; padding: 8px 12px; min-height: 40px;
      border-radius: 8px; margin-bottom: 2px; transition: background 0.15s ease;
    }
    .tree-node:hover { background: #f1f5f9; }
    .tree-node-expandable { cursor: pointer; }
    .tree-node-expandable:hover { background: #e2e8f0; }
    .tree-toggle-btn {
      cursor: pointer; position: relative; z-index: 1; flex-shrink: 0;
      width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
      border-radius: 6px; color: #475569;
    }
    .tree-toggle-btn:hover { background: #e2e8f0; color: #0f172a; }
    .tree-toggle-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .tree-node-icon { display: flex; color: #64748b; flex-shrink: 0; }
    .tree-node-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .tree-node-label { flex: 1; font-size: 14px; line-height: 1.4; color: #1e293b; min-width: 0; }
    .tree-node-pct { font-size: 13px; font-weight: 700; color: #475569; min-width: 44px; text-align: right; }
    .tree-node-padding { width: 36px; flex-shrink: 0; }
    .tree-node-task .tree-node-label { font-weight: 500; }
    .tree-empty { text-align: center; padding: 48px 24px; }
    .tree-empty mat-icon { font-size: 48px; width: 48px; height: 48px; color: #cbd5e1; margin-bottom: 16px; }
    .tree-empty p { margin: 0 0 8px; color: #475569; }
    .tree-empty .text-sm { font-size: 12px; }

    @media (max-width: 700px) {
      .summary-bar { grid-template-columns: 1fr 1fr; }
      .kr-bar { width: 80px; }
      .obj-pct { font-size: 18px; }
    }
  `]
})
export class BigPictureComponent implements OnInit {
  private projectSvc       = inject(ProjectService);
  private visionStrategySvc = inject(VisionStrategyService);
  private strategySvc      = inject(StrategyService);
  private taskSvc         = inject(TaskService);
  private dialog          = inject(MatDialog);
  readonly auth           = inject(AuthService);

  readonly isLoading  = this.strategySvc.isLoading.asReadonly();
  /** Objectives with computed krScore on each KR (reactive from StrategyService) */
  readonly objectives = computed<BigPictureObjectiveWithScores[]>(() => this.strategySvc.bigPictureWithScores());
  filterType = signal<ObjectiveType | null>(null);

  /** Subtasks loaded on demand when expanding a task node in the strategy tree */
  subtasksLoaded = signal<Map<string, Subtask[]>>(new Map());

  /** Strategy tree (9 levels): Vision → KSF → Strategy → VC → Objective → KR → Project → Task → SubTask */
  readonly treeData = computed<StrategyTreeNode[]>(() =>
    buildStrategyTree(
      this.objectives(),
      this.subtasksLoaded(),
      (id) => this.projectSvc.projects().find(p => p.id === id)?.name ?? id.slice(0, 8)
    )
  );

  /** Stable key for each tree node — used for trackBy and expanded state. */
  nodeKey = (node: StrategyTreeNode): string =>
    node.id ?? `${node.type}-${(node.label || '').slice(0, 80)}`;

  /** Signal tracking which node keys are currently expanded. */
  expandedIds = signal<Set<string>>(new Set());

  /** Expose for template */
  readonly hasStrategyTreeChildren = hasStrategyTreeChildren;

  isNodeExpanded(node: StrategyTreeNode): boolean {
    return this.expandedIds().has(this.nodeKey(node));
  }

  constructor() {
    // Load subtasks when a task node is expanded
    effect(() => {
      const ids = this.expandedIds();
      const allNodes = this._flattenTree(this.treeData());
      for (const node of allNodes) {
        if (node.type === 'task' && node.id && ids.has(this.nodeKey(node))) {
          if (!this.subtasksLoaded().has(node.id)) {
            this.loadSubtasksForTask(node.id);
          }
        }
      }
    });
  }

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

  /** Group objectives by vision + strategy for "Theo Chiến lược" tab */
  readonly objectivesByStrategy = computed(() => {
    const list = this.objectives();
    const map = new Map<string, { key: string; visionTitle: string | null; strategyTitle: string; strategyPeriod: string | null; objectives: BigPictureObjectiveWithScores[] }>();
    const noStrategyKey = '__no_strategy__';
    map.set(noStrategyKey, { key: noStrategyKey, visionTitle: null, strategyTitle: 'Chưa gắn chiến lược', strategyPeriod: null, objectives: [] });
    for (const o of list) {
      const sid = o.strategy_id ?? noStrategyKey;
      const key = sid === noStrategyKey ? noStrategyKey : `${o.vision_id ?? ''}_${sid}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          visionTitle: o.vision_title ?? null,
          strategyTitle: o.strategy_title ?? 'Chưa gắn chiến lược',
          strategyPeriod: o.strategy_period ?? null,
          objectives: [],
        });
      }
      map.get(key)!.objectives.push(o);
    }
    return Array.from(map.values()).filter(g => g.objectives.length > 0);
  });

  /** Group objectives by value chain activity for "Theo Chuỗi giá trị" tab; sorted by stage order (Chưa gắn last) */
  readonly objectivesByValueChain = computed(() => {
    const list = this.objectives();
    const activities = this.visionStrategySvc.valueChainActivities();
    const activitySortOrder = new Map<string, number>();
    for (const a of activities) activitySortOrder.set(a.id, a.sort_order);
    const noVcKey = '__no_vc__';
    const SORT_ORDER_UNLINKED = 999;
    const map = new Map<string, { label: string; sortOrder: number; objectives: BigPictureObjectiveWithScores[] }>();
    map.set(noVcKey, { label: 'Chưa gắn chuỗi giá trị', sortOrder: SORT_ORDER_UNLINKED, objectives: [] });
    for (const o of list) {
      const label = o.value_chain_activity_label ?? 'Chưa gắn chuỗi giá trị';
      const key = o.value_chain_activity_id ?? noVcKey;
      const sortOrder = o.value_chain_activity_sort_order ?? (key === noVcKey ? SORT_ORDER_UNLINKED : (activitySortOrder.get(key) ?? SORT_ORDER_UNLINKED));
      if (!map.has(key)) map.set(key, { label, sortOrder, objectives: [] });
      map.get(key)!.objectives.push(o);
    }
    return Array.from(map.values())
      .filter(g => g.objectives.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  /** Full list of value chain tabs (one per stage + Chưa gắn); never filtered by empty — for flow diagram and nested tabs */
  readonly valueChainTabList = computed(() => {
    const list = this.objectives();
    const activities = this.visionStrategySvc.valueChainActivities();
    const noVcKey = '__no_vc__';
    const SORT_ORDER_UNLINKED = 999;
    const byId = new Map<string, BigPictureObjectiveWithScores[]>();
    for (const a of activities) byId.set(a.id, []);
    byId.set(noVcKey, []);
    for (const o of list) {
      const key = o.value_chain_activity_id ?? noVcKey;
      if (byId.has(key)) byId.get(key)!.push(o);
    }
    const result: { id: string; label: string; description: string | null; sortOrder: number; objectives: BigPictureObjectiveWithScores[] }[] = activities.map(a => ({
      id: a.id,
      label: a.label,
      description: a.description ?? null,
      sortOrder: a.sort_order,
      objectives: byId.get(a.id) ?? [],
    }));
    result.push({ id: noVcKey, label: 'Chưa gắn chuỗi giá trị', description: null, sortOrder: SORT_ORDER_UNLINKED, objectives: byId.get(noVcKey) ?? [] });
    return result;
  });

  /** Selected index for nested value-chain tab group (sync with flow diagram click) */
  vcSelectedIndex = signal(0);

  /** Index of "Cây chiến lược (9 tầng)" tab = 5. When user switches to this tab, sync tree data so MatTree renders. */
  private readonly TREE_TAB_INDEX = 5;

  onBpTabIndexChange(_index: number): void {
    // No-op: tree tab uses signal-based rendering, no manual sync needed
  }

  /** Group objectives by KSF for "Theo KSF" tab; sorted by KSF sort_order (Chưa gắn last) */
  readonly objectivesByKsf = computed(() => {
    const list = this.objectives();
    const ksfList = this.visionStrategySvc.ksfs();
    const ksfSortOrder = new Map<string, number>();
    for (const k of ksfList) ksfSortOrder.set(k.id, k.sort_order);
    const noKsfKey = '__no_ksf__';
    const SORT_ORDER_UNLINKED = 999;
    const map = new Map<string, { label: string; sortOrder: number; objectives: BigPictureObjectiveWithScores[] }>();
    map.set(noKsfKey, { label: 'Chưa gắn KSF', sortOrder: SORT_ORDER_UNLINKED, objectives: [] });
    for (const o of list) {
      const label = o.ksf_label ?? 'Chưa gắn KSF';
      const key = o.ksf_id ?? noKsfKey;
      const sortOrder = key === noKsfKey ? SORT_ORDER_UNLINKED : (ksfSortOrder.get(key) ?? SORT_ORDER_UNLINKED);
      if (!map.has(key)) map.set(key, { label, sortOrder, objectives: [] });
      map.get(key)!.objectives.push(o);
    }
    return Array.from(map.values())
      .filter(g => g.objectives.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  canEditObjective(obj: BigPictureObjective): boolean {
    return this.auth.isDirector() || (obj.project_id != null && this.projectSvc.isManager(obj.project_id));
  }

  async openObjectiveDialog(o: BigPictureObjective): Promise<void> {
    const { ObjectiveDialogComponent } = await import('../objectives/objective-dialog.component');
    const ref = this.dialog.open(ObjectiveDialogComponent, {
      width: '600px',
      data: { objective: o, projectId: o.project_id ?? null },
    });
    ref.afterClosed().subscribe(() => this.load());
  }

  ngOnInit(): void {
    this.projectSvc.loadProjects();
    this.visionStrategySvc.loadValueChainActivities();
    this.visionStrategySvc.loadKsfs();
    this.load();
  }

  handleBtnClick(node: StrategyTreeNode, event: MouseEvent): void {
    event.stopPropagation();
    this._doToggle(node);
  }

  handleDivClick(node: StrategyTreeNode, event: MouseEvent): void {
    if (!hasStrategyTreeChildren(node)) return;
    this._doToggle(node);
  }

  private _doToggle(node: StrategyTreeNode): void {
    const key = this.nodeKey(node);
    this.expandedIds.update(s => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  private _flattenTree(nodes: StrategyTreeNode[]): StrategyTreeNode[] {
    const result: StrategyTreeNode[] = [];
    for (const n of nodes) {
      result.push(n);
      if (n.children?.length) result.push(...this._flattenTree(n.children));
    }
    return result;
  }

  private async loadSubtasksForTask(taskId: string): Promise<void> {
    const list = await this.taskSvc.getSubtasks(taskId);
    this.subtasksLoaded.update(m => {
      const next = new Map(m);
      next.set(taskId, list);
      return next;
    });
  }

  load(): void {
    this.strategySvc.loadBigPicture();
  }

  statusLabel(status: string): string {
    return STATUS_LABEL[status] ?? status;
  }

  activeTaskCount(obj: BigPictureObjective): number {
    return (obj.key_results ?? []).reduce((s, kr) => s + (kr.tasks?.length ?? 0), 0);
  }
}
