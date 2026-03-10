import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, input, signal, ViewEncapsulation } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TaskService } from '../../services/task.service';
import { ProjectService } from '../../services/project.service';
import { TimerService } from '../../services/timer.service';
import { ConfirmService } from '../../services/confirm.service';
import { Task, Subtask, TASK_COLUMNS, TaskStatus, TaskPriority, SubtaskStatus, SUBTASK_STATUS_OPTIONS } from '../../shared/models';
import { SecondsToHmsPipe } from '../../shared/pipes/seconds-to-hms.pipe';
import { SubtaskEditDialogComponent, SubtaskEditDialogData } from './subtask-edit-dialog.component';
import { CompletionNoteDialogComponent, CompletionNoteDialogData, CompletionNoteDialogResult } from './completion-note-dialog.component';
import { GanttComponent } from './gantt.component';
import { TaskImportDialogComponent } from './task-import-dialog.component';

@Component({
  selector: 'app-project',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, DragDropModule, RouterLink, DatePipe,
    MatButtonModule, MatIconModule, MatMenuModule, MatChipsModule,
    MatTooltipModule, MatProgressBarModule,
    MatFormFieldModule, MatInputModule, SecondsToHmsPipe,
    GanttComponent
  ],
  template: `
    <div class="project-page">
      <!-- Header -->
      <div class="page-header">
        <div class="flex items-center gap-2">
          <a routerLink="/dashboard" mat-icon-button>
            <mat-icon>arrow_back</mat-icon>
          </a>
          <div>
            <h1 class="page-title">{{ project()?.name || 'Project' }}</h1>
            <p class="text-muted text-sm">{{ project()?.client_name }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- Filter by priority -->
          <button mat-stroked-button [matMenuTriggerFor]="filterMenu">
            <mat-icon>filter_list</mat-icon> Lọc
            @if (priorityFilter()) { <span class="filter-badge">1</span> }
          </button>
          <mat-menu #filterMenu>
            <button mat-menu-item (click)="priorityFilter.set(null)">Tất cả</button>
            <button mat-menu-item (click)="priorityFilter.set('critical')">🔴 Critical</button>
            <button mat-menu-item (click)="priorityFilter.set('high')">🟠 High</button>
            <button mat-menu-item (click)="priorityFilter.set('medium')">🟡 Medium</button>
            <button mat-menu-item (click)="priorityFilter.set('low')">🟢 Low</button>
          </mat-menu>

          <!-- My Only: áp dụng cho Kanban, Gantt, Focus -->
          <button class="my-only-btn" mat-stroked-button [class.active]="myTasksOnly()" (click)="myTasksOnly.set(!myTasksOnly())" matTooltip="Chỉ hiện task được giao cho tôi">
            <mat-icon>person</mat-icon>
            Chỉ của tôi
          </button>

          <!-- View toggle: Kanban / Gantt / Focus -->
          <div class="view-toggle">
            <button [class.active]="viewMode() === 'kanban'" (click)="viewMode.set('kanban')" matTooltip="Kanban">
              <mat-icon>view_kanban</mat-icon>
            </button>
            <button [class.active]="viewMode() === 'gantt'" (click)="viewMode.set('gantt')" matTooltip="Gantt">
              <mat-icon>view_timeline</mat-icon>
            </button>
            <button [class.active]="viewMode() === 'focus'" (click)="viewMode.set('focus')" matTooltip="Focus: Đang làm & Sắp làm">
              <mat-icon>center_focus_strong</mat-icon>
            </button>
          </div>

          <button mat-stroked-button (click)="openImportDialog()" matTooltip="Import Task từ JSON">
            <mat-icon>upload_file</mat-icon>
            Import
          </button>

          <button mat-flat-button color="primary" (click)="openTaskDialog()">
            <mat-icon>add</mat-icon> Task mới
          </button>
        </div>
      </div>

      <!-- Gantt View -->
      @if (viewMode() === 'gantt') {
        <app-gantt
          [tasks]="ganttTasks()"
          [projectId]="id()"
          [taskScope]="ganttTaskScope()"
          [filterByViewRange]="true"
          [assigneesResolver]="getAssignees.bind(this)"
          (taskScopeChange)="ganttTaskScope.set($event)"
          (taskEdit)="openTaskDialog($event)"
        />
      }

      <!-- Focus View: Đang làm + Sắp làm -->
      @if (viewMode() === 'focus') {
        <div class="focus-view">
          <div class="focus-sections">
            <section class="focus-section">
              <h3 class="focus-section-title"><span class="dot in_progress"></span> Đang làm</h3>
              <div class="focus-task-list">
                @for (task of focusTasksActive(); track task.id) {
                  <div class="focus-task-card" (dblclick)="openTaskDialog(task)">
                    <div class="priority-strip" [class]="'strip-' + task.priority"></div>
                    <span class="focus-task-title">{{ task.title }}</span>
                    @if (task.due_date) {
                      <span class="focus-task-due">{{ task.due_date | date:'dd/MM/yyyy' }}</span>
                    }
                  </div>
                }
                @empty {
                  <p class="focus-empty">Không có task đang làm</p>
                }
              </div>
            </section>
            <section class="focus-section">
              <h3 class="focus-section-title"><span class="dot todo"></span> Sắp làm</h3>
              <div class="focus-task-list">
                @for (task of focusTasksSoon(); track task.id) {
                  <div class="focus-task-card" (dblclick)="openTaskDialog(task)">
                    <div class="priority-strip" [class]="'strip-' + task.priority"></div>
                    <span class="focus-task-title">{{ task.title }}</span>
                    @if (task.start_date) {
                      <span class="focus-task-due">Bắt đầu: {{ task.start_date | date:'dd/MM/yyyy' }}</span>
                    }
                  </div>
                }
                @empty {
                  <p class="focus-empty">Không có task sắp làm</p>
                }
              </div>
            </section>
          </div>
        </div>
      }

      <!-- Kanban Board -->
      @if (taskSvc.isLoading()) {
        <div class="loading-kanban">
          <div class="loading-text">Đang tải board...</div>
        </div>
      } @else if (viewMode() === 'kanban') {
        <div class="kanban-board">
          @for (col of columns; track col.status) {
            <div class="kanban-column">
              <div class="column-header">
                <div class="column-title-wrap">
                  <span class="column-dot" [class]="'dot-' + col.status"></span>
                  <span class="column-title">{{ col.label }}</span>
                  <span class="column-count">{{ getColumnTasks(col.status).length }}</span>
                </div>
              </div>

              <div class="column-body"
                   cdkDropList
                   [id]="col.status"
                   [cdkDropListData]="getColumnTasks(col.status)"
                   [cdkDropListConnectedTo]="connectedTo"
                   (cdkDropListDropped)="drop($event, col.status)">

                @for (task of getColumnTasks(col.status); track task.id) {
                  <div class="task-with-subtasks" cdkDrag [cdkDragDisabled]="!canMoveTask(task)">
                    <div class="task-card" (dblclick)="openTaskDialog(task)">
                      <div class="priority-strip" [class]="'strip-' + task.priority"></div>
                      <div class="task-card-body">
                        <div class="task-header">
                          @if (canMoveTask(task)) {
                            <span class="drag-handle" cdkDragHandle matTooltip="Kéo để di chuyển"><mat-icon>drag_indicator</mat-icon></span>
                          }
                          <span class="priority-badge priority-{{ task.priority }}">{{ task.priority }}</span>
                          @if (isOverdue(task)) {
                            <span class="overdue-badge">OVERDUE</span>
                          }
                          @if (task.due_date) {
                            <span class="task-due-badge" [class.text-danger]="isOverdue(task)">{{ task.due_date | date:'dd/MM' }}</span>
                          }
                        </div>
                        <h4 class="task-title" (click)="openTaskDialog(task)">{{ task.title }}</h4>
                        @if (getAssignees(task).length > 0) {
                          <div class="task-assignees">
                            @for (p of getAssignees(task).slice(0, 3); track p.id) {
                              @if (p.photo_url) {
                                <img [src]="p.photo_url" class="assignee-avatar" [alt]="p.display_name || ''" [matTooltip]="p.display_name || p.email || ''" />
                              } @else {
                                <span class="assignee-initial" [matTooltip]="p.display_name || p.email || ''">{{ (p.display_name || p.email || '?').charAt(0).toUpperCase() }}</span>
                              }
                            }
                            @if (getAssignees(task).length > 3) {
                              <span class="assignee-more">+{{ getAssignees(task).length - 3 }}</span>
                            }
                          </div>
                        }
                        @if (task.bsc_type) {
                          <div class="bsc-badge bsc-{{ task.bsc_type }}"
                               [matTooltip]="getBscBadgeTooltip(task)">
                            <mat-icon class="bsc-badge-icon">track_changes</mat-icon>
                            {{ getBscLabel(task.bsc_type) }}
                          </div>
                        }
                        @if (task.labels.length > 0) {
                          <div class="task-labels">
                            @for (label of task.labels.slice(0, 3); track label) {
                              <span class="label-chip">{{ label }}</span>
                            }
                          </div>
                        }
                        <div class="subtask-progress">
                          <mat-progress-bar mode="determinate" [value]="subtaskPct(task)" class="subtask-bar" (click)="toggleExpand(task); $event.stopPropagation()" />
                          <span class="text-xs text-muted" (click)="toggleExpand(task); $event.stopPropagation()">{{ getEffectiveSubtaskCounts(task).completed }}/{{ getEffectiveSubtaskCounts(task).total }} subtasks</span>
                          <button type="button" mat-icon-button class="add-subtask-inline-btn"
                                  [class.active]="isSubtaskInputOpen(task.id)"
                                  matTooltip="Thêm subtask"
                                  (click)="toggleSubtaskInput(task, $event)">
                            <mat-icon>add</mat-icon>
                          </button>
                          <button type="button" mat-icon-button class="expand-btn" [matTooltip]="isTaskExpanded(task.id) ? 'Thu gọn' : 'Mở rộng'" (click)="toggleExpand(task); $event.stopPropagation()">
                            <mat-icon class="expand-btn-icon">{{ isTaskExpanded(task.id) ? 'expand_less' : 'expand_more' }}</mat-icon>
                          </button>
                        </div>
                        <div class="task-footer">
                          <span class="task-time text-xs text-muted" matTooltip="Est: tổng estimate các subtask. Act: tổng thời gian các subtask + thời gian ghi trực tiếp cho task (nếu có).">
                            <mat-icon class="task-time-icon">schedule</mat-icon>
                            Est: {{ getEffectiveSubtaskTime(task).estimate | secondsToHms }} · Act: {{ getEffectiveSubtaskTime(task).actual | secondsToHms }}
                          </span>
                          <button type="button" mat-icon-button class="task-comment-btn" (click)="openCommentDialog(task); $event.stopPropagation()" matTooltip="Bình luận">
                            <mat-icon>comment</mat-icon>
                            @if ((taskSvc.commentCounts())[task.id] > 0) {
                              <span class="comment-count-badge">{{ taskSvc.commentCounts()[task.id] }}</span>
                            }
                          </button>
                          @if (getEffectiveSubtaskCounts(task).total === 0) {
                            @if (timerSvc.activeTimer()?.taskId === task.id) {
                              <button type="button" mat-icon-button color="warn" class="task-timer-btn" (click)="stopTimer(); $event.stopPropagation()" matTooltip="Dừng timer">
                                <mat-icon>stop_circle</mat-icon>
                              </button>
                            } @else {
                              <button type="button" mat-icon-button class="task-timer-btn" (click)="startTimer(task); $event.stopPropagation()" matTooltip="Bắt đầu timer"
                                      [disabled]="timerSvc.isRunning() && timerSvc.activeTimer()?.taskId !== task.id">
                                <mat-icon>play_circle</mat-icon>
                              </button>
                            }
                          }
                        </div>
                        @if (task.status === 'done' && task.completion_note) {
                          <div class="completion-note" (click)="$event.stopPropagation()">
                            <mat-icon class="completion-note-icon">check_circle</mat-icon>
                            <span class="completion-note-text">{{ task.completion_note }}</span>
                          </div>
                        }
                      </div>
                    </div>
                    @if (isTaskExpanded(task.id)) {
                      <div class="subtask-tree">
                        @for (subtask of getSubtasksForTask(task.id); track subtask.id) {
                          <div class="subtask-card" [class.done]="subtask.status === 'done'" (click)="$event.stopPropagation()" (dblclick)="openSubtaskEditDialog(task, subtask); $event.stopPropagation()">
                            <div class="subtask-card-main">
                              <div class="subtask-card-body">
                                <span class="subtask-card-title">{{ subtask.title }}</span>
                                @if (subtask.status === 'done' && subtask.completion_note) {
                                  <div class="subtask-completion-note">
                                    <mat-icon class="completion-note-icon">check_circle</mat-icon>
                                    <span class="completion-note-text">{{ subtask.completion_note }}</span>
                                  </div>
                                }
                                <div class="subtask-card-meta">
                                  <span class="text-xs text-muted">Est: {{ subtask.estimate_seconds | secondsToHms }} · Act: {{ subtask.actual_seconds | secondsToHms }}</span>
                                  @if (subtask.due_date) {
                                    <span class="text-xs text-muted">{{ subtask.due_date | date:'dd/MM' }}</span>
                                  }
                                  @if (getSubtaskAssignees(subtask).length > 0) {
                                    <span class="subtask-assignees">
                                      @for (p of getSubtaskAssignees(subtask).slice(0, 3); track p.id) {
                                        @if (p.photo_url) {
                                          <img [src]="p.photo_url" class="subtask-avatar" [matTooltip]="p.display_name || ''" alt="" />
                                        } @else {
                                          <span class="subtask-avatar subtask-avatar-initial" [matTooltip]="p.display_name || ''">{{ (p.display_name || p.email || '?').charAt(0).toUpperCase() }}</span>
                                        }
                                      }
                                    </span>
                                  }
                                </div>
                              </div>
                              <div class="subtask-card-actions">
                                @if (timerSvc.activeTimer()?.subtaskId === subtask.id) {
                                  <button mat-icon-button color="warn" (click)="stopTimer(); $event.stopPropagation()" matTooltip="Dừng"><mat-icon>stop_circle</mat-icon></button>
                                } @else if (subtask.status !== 'done') {
                                  <button mat-icon-button (click)="startSubtaskTimer(task, subtask); $event.stopPropagation()"
                                    [disabled]="!canStartSubtaskTimer(subtask)"
                                    [matTooltip]="subtaskTimerTooltip(subtask)"><mat-icon>play_circle</mat-icon></button>
                                }
                              </div>
                            </div>
                            <div class="subtask-card-status-row" (click)="$event.stopPropagation()">
                              <select class="subtask-status-native-select" [value]="subtask.status" (change)="onSubtaskStatusChange(task, subtask, $any($event.target).value)">
                                @for (opt of subtaskStatusOptions; track opt.status) {
                                  <option [value]="opt.status" [selected]="opt.status === subtask.status">{{ opt.label }}</option>
                                }
                              </select>
                            </div>
                          </div>
                        }
                      </div>
                    }
                    @if (isSubtaskInputOpen(task.id)) {
                      <div class="task-add-subtask-row" (click)="$event.stopPropagation()">
                        <input class="subtask-add-input" placeholder="Thêm subtask..." [ngModel]="newSubtaskTitles()[task.id] || ''" (ngModelChange)="setNewSubtaskTitle(task.id, $event)"
                               (keydown.enter)="addSubtaskInline(task)" (keydown.escape)="closeSubtaskInput(task.id, $event)" autofocus />
                        <button mat-icon-button (click)="addSubtaskInline(task)" [disabled]="!((newSubtaskTitles()[task.id] || '').trim())" matTooltip="Thêm">
                          <mat-icon>check</mat-icon>
                        </button>
                      </div>
                    }
                  </div>
                }

                <!-- Add task shortcut: chỉ hiện ở To Do và In Progress -->
                @if (col.status === 'todo' || col.status === 'in_progress') {
                  <button mat-button class="add-task-btn" (click)="openTaskDialog(null, col.status)">
                    <mat-icon>add</mat-icon> Thêm task
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .project-page { max-width: 100%; }
    .kanban-board { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 16px; min-height: calc(100vh - 200px); }
    .kanban-column { min-width: 280px; width: 280px; display: flex; flex-direction: column; }
    .column-header { margin-bottom: 12px; }
    .column-title-wrap { display: flex; align-items: center; gap: 8px; }
    .column-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot-todo        { background: #94a3b8; }
    .dot-in_progress { background: #3b82f6; }
    .dot-review      { background: #f59e0b; }
    .dot-done        { background: #10b981; }
    .column-title { font-weight: 700; font-size: 14px; color: #374151; }
    .column-count { background: #e2e8f0; color: #64748b; padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .column-body { flex: 1; background: #f1f5f9; border-radius: 12px; padding: 8px; min-height: 200px; display: flex; flex-direction: column; gap: 8px; }
    .task-card { background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden; cursor: pointer; position: relative; transition: box-shadow 0.2s; }
    .task-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
    .priority-strip { height: 3px; }
    .strip-low      { background: #10b981; }
    .strip-medium   { background: #f59e0b; }
    .strip-high     { background: #f97316; }
    .strip-critical { background: #ef4444; }
    .task-card-body { padding: 12px; }
    .task-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
    .task-due-badge { font-size: 11px; font-weight: 600; color: #64748b; }
    .task-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1.4; cursor: pointer; }
    .task-title:hover { color: #3b82f6; }
    .task-assignees { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; }
    .assignee-avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
    .assignee-initial { width: 22px; height: 22px; border-radius: 50%; background: #e2e8f0; color: #475569; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
    .assignee-more { font-size: 11px; color: #64748b; margin-left: 2px; }
    .bsc-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-bottom: 6px; cursor: default; }
    .bsc-badge-icon { font-size: 12px; width: 12px; height: 12px; }
    .bsc-financial { background: #dcfce7; color: #166534; }
    .bsc-customer  { background: #dbeafe; color: #1e40af; }
    .bsc-internal  { background: #f3e8ff; color: #6b21a8; }
    .bsc-learning  { background: #ffedd5; color: #9a3412; }
    .task-labels { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
    .label-chip { background: #e0f2fe; color: #0369a1; padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
    .subtask-progress { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .subtask-bar { flex: 1; height: 4px !important; border-radius: 2px; }
    .task-footer { display: flex; align-items: center; gap: 6px; min-height: 36px; flex-wrap: wrap; }
    .task-footer .mat-mdc-icon-button { display: inline-flex; align-items: center; justify-content: center; }
    .task-time { display: inline-flex; align-items: center; gap: 4px; flex: 1; min-width: 0; color: #64748b; font-size: 12px; }
    .task-time-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; }
    .task-comment-btn { position: relative; width: 36px !important; height: 36px !important; min-width: 36px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0; }
    .task-comment-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .comment-count-badge { position: absolute; top: 2px; right: 2px; min-width: 14px; height: 14px; padding: 0 3px; border-radius: 7px; background: #3b82f6; color: white; font-size: 10px; font-weight: 600; line-height: 14px; text-align: center; }
    .task-timer-btn { width: 36px !important; height: 36px !important; min-width: 36px !important; flex-shrink: 0; }
    .task-timer-btn mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .text-danger { color: #dc2626; }
    .add-task-btn { width: 100%; justify-content: flex-start !important; color: #94a3b8 !important; border-radius: 8px !important; }
    .add-task-btn:hover { background: #e2e8f0 !important; color: #475569 !important; }
    .filter-badge { background: #3b82f6; color: white; border-radius: 999px; padding: 0 6px; font-size: 11px; margin-left: 4px; }
    .view-toggle { display: flex; gap: 2px; background: #f1f5f9; border-radius: 8px; padding: 3px; }
    .view-toggle button { display: flex; align-items: center; justify-content: center; width: 36px; height: 32px; border: none; background: transparent; border-radius: 6px; cursor: pointer; color: #64748b; transition: all 0.15s; }
    .view-toggle button.active { background: white; color: #1e293b; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .view-toggle mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .my-only-btn.active { background: #eff6ff !important; color: #2563eb !important; border-color: #93c5fd !important; }
    .loading-kanban { display: flex; align-items: center; justify-content: center; height: 300px; }
    .loading-text { color: #94a3b8; font-size: 16px; }
    .focus-view { padding: 16px; max-width: 900px; }
    .focus-sections { display: flex; flex-direction: column; gap: 24px; }
    .focus-section-title { font-size: 15px; font-weight: 600; color: #1e293b; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; }
    .focus-section-title .dot { width: 8px; height: 8px; border-radius: 50%; }
    .focus-section-title .dot.in_progress { background: #3b82f6; }
    .focus-section-title .dot.todo { background: #94a3b8; }
    .focus-task-list { display: flex; flex-direction: column; gap: 8px; }
    .focus-task-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: box-shadow 0.15s; }
    .focus-task-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .focus-task-card .priority-strip { width: 4px; height: 100%; min-height: 24px; border-radius: 2px; flex-shrink: 0; }
    .focus-task-card .strip-critical { background: #dc2626; }
    .focus-task-card .strip-high { background: #ea580c; }
    .focus-task-card .strip-medium { background: #ca8a04; }
    .focus-task-card .strip-low { background: #16a34a; }
    .focus-task-title { flex: 1; font-size: 14px; color: #1e293b; min-width: 0; }
    .focus-task-due { font-size: 12px; color: #64748b; flex-shrink: 0; }
    .focus-empty { margin: 0; font-size: 14px; color: #94a3b8; padding: 12px 0; }
    .task-with-subtasks { display: flex; flex-direction: column; gap: 0; }
    .task-with-subtasks .task-card { margin: 0; }
    .subtask-progress { display: flex; align-items: center; gap: 4px; }
    .subtask-progress .subtask-bar { cursor: pointer; }
    .subtask-progress .text-muted { cursor: pointer; }
    .drag-handle { cursor: grab; color: #94a3b8; display: inline-flex; margin-right: 4px; }
    .drag-handle mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .drag-handle:active { cursor: grabbing; }
    .expand-btn { width: 40px !important; height: 40px !important; min-width: 40px !important; min-height: 40px !important; margin-left: 4px; display: inline-flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0; }
    .expand-btn .expand-btn-icon { font-size: 24px; width: 24px; height: 24px; pointer-events: none; }
    .add-subtask-inline-btn { width: 28px !important; height: 28px !important; min-width: 28px !important; min-height: 28px !important; flex-shrink: 0; color: #94a3b8; transition: color 0.15s, background 0.15s; display: inline-flex !important; align-items: center !important; justify-content: center !important; align-self: center; }
    .add-subtask-inline-btn mat-icon { font-size: 18px; width: 18px; height: 18px; line-height: 18px; }
    .add-subtask-inline-btn:hover { color: #3b82f6; }
    .add-subtask-inline-btn.active { color: #3b82f6; background: #eff6ff !important; border-radius: 6px; }
    .subtask-tree { contain: layout; min-height: 4px; }
    .task-add-subtask-row { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-top: 1px solid #e2e8f0; background: #fafafa; margin: 10px -1px -1px -1px; border-radius: 0 0 10px 10px; }
    .subtask-tree { margin-left: 24px; margin-top: 8px; padding-left: 12px; border-left: 2px solid #e2e8f0; display: flex; flex-direction: column; gap: 6px; }
    .subtask-card { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); cursor: pointer; }
    .subtask-card.done { opacity: 0.7; }
    .subtask-card.done .subtask-card-title { text-decoration: line-through; }
    .subtask-card-main { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
    .subtask-card-body { flex: 1; min-width: 0; padding-right: 4px; }
    .subtask-card-title { font-size: 13px; font-weight: 500; color: #334155; display: block; }
    .subtask-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
    .subtask-assignees { display: inline-flex; align-items: center; gap: 2px; }
    .subtask-avatar { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
    .subtask-avatar-initial { display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 9px; font-weight: 600; }
    .subtask-card-actions { display: flex; gap: 0; flex-shrink: 0; align-items: center; }
    .subtask-card-status-row { margin-top: 2px }
    .subtask-add-row { display: flex; align-items: center; gap: 4px; margin-top: 4px; padding: 4px 0; }
    .subtask-add-input { flex: 1; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; }
    .completion-note { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 12px; color: #166534; }
    .completion-note-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }
    .completion-note-text { word-break: break-word; }
    .subtask-completion-note { display: flex; align-items: flex-start; gap: 6px; margin-top: 4px; font-size: 11px; color: #15803d; }
    .subtask-completion-note .completion-note-icon { font-size: 14px; width: 14px; height: 14px; }
    .subtask-status-native-select {
      appearance: none;
      width: auto; min-width: 72px; max-width: 100px;
      height: 22px; padding: 0 20px 0 6px;
      font-size: 11px; font-weight: 500; color: #475569; line-height: 20px;
      border: 1px solid #e2e8f0; border-radius: 4px; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E") no-repeat right 4px center;
      cursor: pointer; outline: none;
    }
    .subtask-status-native-select:hover { border-color: #cbd5e1; }
    .subtask-status-native-select:focus { border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
  `]
})
export class ProjectComponent implements OnInit, OnDestroy {
  readonly id = input.required<string>();

  readonly auth       = inject(AuthService);
  readonly taskSvc    = inject(TaskService);
  readonly projectSvc = inject(ProjectService);
  readonly timerSvc   = inject(TimerService);
  private dialog      = inject(MatDialog);
  private snackBar    = inject(MatSnackBar);
  private confirmSvc  = inject(ConfirmService);
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);

  readonly columns     = TASK_COLUMNS;
  readonly connectedTo = TASK_COLUMNS.map(c => c.status);
  readonly subtaskStatusOptions = SUBTASK_STATUS_OPTIONS;

  viewMode       = signal<'kanban' | 'gantt' | 'focus'>('kanban');
  priorityFilter = signal<TaskPriority | null>(null);
  /** Gantt: 'active' = chỉ Đang làm + Sắp làm; 'all' = tất cả task */
  ganttTaskScope = signal<'all' | 'active'>('active');
  /** Chỉ của tôi: áp dụng cho Kanban, Gantt, Focus */
  myTasksOnly = signal(false);
  /** Task IDs where user is in subtask assignees (loaded when myTasksOnly is on) */
  taskIdsWithUserInSubtasks = signal<Set<string>>(new Set());

  /** Task IDs that are expanded to show subtask tree */
  expandedTaskIds = signal<Set<string>>(new Set());
  /** Task IDs that have the inline add-subtask input open */
  showingSubtaskInput = signal<Set<string>>(new Set());
  /** Cache: taskId -> Subtask[] */
  subtasksByTask = signal<Map<string, Subtask[]>>(new Map());
  /** Inline add subtask title by taskId */
  newSubtaskTitles = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      if (this.myTasksOnly() && this.id()) {
        const uid = this.auth.userId();
        if (uid) {
          this.taskSvc.getTaskIdsWithUserInSubtasks(this.id(), uid).then(ids =>
            this.taskIdsWithUserInSubtasks.set(ids)
          );
        } else {
          this.taskIdsWithUserInSubtasks.set(new Set());
        }
      } else {
        this.taskIdsWithUserInSubtasks.set(new Set());
      }
    });
  }

  readonly project = computed(() =>
    this.projectSvc.projects().find(p => p.id === this.id()) ?? null
  );

  readonly filteredTasks = computed(() => {
    const pf = this.priorityFilter();
    return pf ? this.taskSvc.tasks().filter(t => t.priority === pf) : this.taskSvc.tasks();
  });

  /** Sau khi áp dụng "Chỉ của tôi": dùng cho Kanban, Gantt, Focus. Bao gồm task assignee HOẶC subtask assignee. */
  readonly tasksForView = computed(() => {
    let list = this.filteredTasks();
    if (this.myTasksOnly()) {
      const uid = this.auth.userId();
      if (uid) {
        const inSubtasks = this.taskIdsWithUserInSubtasks();
        list = list.filter(t =>
          (t.assignees_preview ?? []).includes(uid) || inSubtasks.has(t.id)
        );
      }
    }
    return list;
  });

  /** Tasks for Gantt: khi scope 'active' chỉ giữ Đang làm (in_progress, review) + Sắp làm (todo có start_date trong 4 tuần tới). */
  readonly ganttTasks = computed(() => {
    const list = this.tasksForView();
    if (this.viewMode() !== 'gantt') return list;
    if (this.ganttTaskScope() === 'all') return list;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fourWeeksLater = new Date(today.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
    return list.filter(t => {
      if (t.status === 'in_progress' || t.status === 'review') return true;
      if (t.status === 'done') return false;
      if (t.status === 'todo') {
        if (!t.start_date) return true;
        const start = this.parseTaskDate(t.start_date);
        return start <= fourWeeksLater;
      }
      return false;
    });
  });

  /** Focus view: Đang làm + Sắp làm (đã áp dụng "Chỉ của tôi" qua tasksForView). */
  readonly focusTasks = computed(() => {
    const list = this.tasksForView();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fourWeeksLater = new Date(today.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
    return list.filter(t => {
      if (t.status === 'in_progress' || t.status === 'review') return true;
      if (t.status === 'todo') {
        if (!t.start_date) return true;
        const start = this.parseTaskDate(t.start_date);
        return start <= fourWeeksLater;
      }
      return false;
    });
  });
  readonly focusTasksActive = computed(() => this.focusTasks().filter(t => t.status === 'in_progress' || t.status === 'review'));
  readonly focusTasksSoon = computed(() => this.focusTasks().filter(t => t.status === 'todo'));

  private parseTaskDate(s: string | null): Date {
    if (!s) return new Date();
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  async ngOnInit(): Promise<void> {
    await this.taskSvc.loadTasks(this.id());
    if (!this.project()) this.projectSvc.loadProjects();
    const openTaskId = this.route.snapshot.queryParamMap.get('openTask');
    if (openTaskId) {
      const task = await this.taskSvc.getTask(this.id(), openTaskId);
      if (task) {
        this.openTaskDialog(task);
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      }
    }
  }

  ngOnDestroy(): void { this.taskSvc.cleanup(); }

  getColumnTasks(status: TaskStatus): Task[] {
    return this.tasksForView().filter(t => t.status === status);
  }

  /** Resolve assignee profiles from project members for display on task card */
  getAssignees(task: Task): { id: string; display_name: string | null; photo_url: string | null; email: string }[] {
    const proj = this.project();
    const members = (proj as any)?.project_members as Array<{ user_id: string; profiles?: { id: string; display_name: string | null; photo_url: string | null; email: string } }> | undefined;
    if (!members) return [];
    const ids = task.assignees_preview ?? [];
    return members
      .filter(m => m.user_id && ids.includes(m.user_id) && m.profiles)
      .map(m => m.profiles!);
  }

  /** Resolve assignee profiles for a subtask (same shape as getAssignees for tasks) */
  getSubtaskAssignees(subtask: Subtask): { id: string; display_name: string | null; photo_url: string | null; email: string }[] {
    const proj = this.project();
    const members = (proj as any)?.project_members as Array<{ user_id: string; profiles?: { id: string; display_name: string | null; photo_url: string | null; email: string } }> | undefined;
    if (!members) return [];
    const ids = subtask.assignees ?? [];
    return members
      .filter(m => m.user_id && ids.includes(m.user_id) && m.profiles)
      .map(m => m.profiles!);
  }

  getSubtasksForTask(taskId: string): Subtask[] {
    return this.subtasksByTask().get(taskId) ?? [];
  }

  /** Số subtask total/done: ưu tiên từ cache khi đã load, không cần gọi loadTasks(). */
  getEffectiveSubtaskCounts(task: Task): { total: number; completed: number } {
    const list = this.subtasksByTask().get(task.id);
    if (list && list.length > 0) {
      return { total: list.length, completed: list.filter(s => s.status === 'done').length };
    }
    return { total: task.total_subtasks ?? 0, completed: task.completed_subtasks ?? 0 };
  }

  /** Est/Act từ subtasks: ưu tiên từ cache khi có, tránh load lại cả list. */
  getEffectiveSubtaskTime(task: Task): { estimate: number; actual: number } {
    const list = this.subtasksByTask().get(task.id);
    if (list && list.length > 0) {
      const estimate = list.reduce((a, s) => a + (s.estimate_seconds ?? 0), 0);
      const actual = list.reduce((a, s) => a + (s.actual_seconds ?? 0), 0);
      return { estimate, actual };
    }
    return { estimate: task.total_estimate_seconds ?? 0, actual: task.total_actual_seconds ?? 0 };
  }

  async toggleExpand(task: Task): Promise<void> {
    const id = task.id;
    const prev = this.expandedTaskIds();
    const isExpanded = prev.has(id);
    if (isExpanded) {
      const nextSet = new Set(prev);
      nextSet.delete(id);
      this.expandedTaskIds.set(nextSet);
      return;
    }
    const nextSet = new Set(prev);
    nextSet.add(id);
    this.expandedTaskIds.set(nextSet);
    if (!this.subtasksByTask().has(id)) {
      const list = await this.taskSvc.getSubtasks(id);
      this.subtasksByTask.update(m => {
        const next = new Map(m);
        next.set(id, list);
        return next;
      });
    }
  }

  isSubtaskInputOpen(taskId: string): boolean {
    return this.showingSubtaskInput().has(taskId);
  }

  closeSubtaskInput(taskId: string, event: Event): void {
    event.stopPropagation();
    this.showingSubtaskInput.update(s => { const next = new Set(s); next.delete(taskId); return next; });
  }

  async toggleSubtaskInput(task: Task, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const id = task.id;
    const isOpen = this.showingSubtaskInput().has(id);
    this.showingSubtaskInput.update(s => {
      const next = new Set(s);
      if (isOpen) next.delete(id); else next.add(id);
      return next;
    });
    // Tự động expand để thấy subtask list khi mở input
    if (!isOpen && !this.expandedTaskIds().has(id)) {
      await this.toggleExpand(task);
    }
  }

  isTaskExpanded(taskId: string): boolean {
    return this.expandedTaskIds().has(taskId);
  }

  /** Gọi khi đổi trạng thái subtask từ dropdown. Nếu chọn Done thì mở dialog completion note. */
  onSubtaskStatusChange(task: Task, subtask: Subtask, newStatus: SubtaskStatus): void {
    if (newStatus === 'done') {
      this.openCompletionNoteForSubtask(task, subtask);
      return;
    }
    this.setSubtaskStatus(subtask, newStatus, null);
  }

  openCompletionNoteForSubtask(task: Task, subtask: Subtask): void {
    const data: CompletionNoteDialogData = { type: 'subtask', title: subtask.title };
    this.dialog.open(CompletionNoteDialogComponent, { width: '420px', data })
      .afterClosed()
      .subscribe(async (result: CompletionNoteDialogResult | undefined) => {
        if (result === undefined) return;
        await this.setSubtaskStatus(subtask, 'done', result.note ?? null);
      });
  }

  private async setSubtaskStatus(subtask: Subtask, status: SubtaskStatus, completionNote: string | null): Promise<void> {
    const res = await this.taskSvc.updateSubtask(subtask.id, { status, completion_note: completionNote });
    if (res?.error) {
      this.snackBar.open('Không thể đổi trạng thái subtask', 'Đóng', { duration: 2000 });
      return;
    }
    const parentId = subtask.parent_id;
    this.subtasksByTask.update(m => {
      const next = new Map(m);
      const list = [...(next.get(parentId) ?? [])];
      const idx = list.findIndex(s => s.id === subtask.id);
      if (idx >= 0) list[idx] = { ...list[idx], status, completion_note: completionNote };
      next.set(parentId, list);
      return next;
    });
  }

  async toggleSubtaskStatus(subtask: Subtask, done: boolean): Promise<void> {
    await this.setSubtaskStatus(subtask, done ? 'done' : 'todo', null);
  }

  async deleteSubtaskFromTree(task: Task, subtask: Subtask): Promise<void> {
    if (!(await this.confirmSvc.open({ title: 'Xóa subtask', message: `Xóa subtask "${subtask.title}"?`, confirmText: 'Xóa', confirmWarn: true }))) return;
    const result = await this.taskSvc.deleteSubtask(subtask.id);
    if (result?.error) {
      this.snackBar.open('Không thể xóa subtask', 'Đóng', { duration: 3000 });
      return;
    }
    this.subtasksByTask.update(m => {
      const next = new Map(m);
      const list = (next.get(task.id) ?? []).filter(s => s.id !== subtask.id);
      next.set(task.id, list);
      return next;
    });
  }

  /** Chỉ user được assign vào subtask mới được bắt đầu timer. */
  /** Chỉ assignee được bật timer, và subtask chưa Done. */
  canStartSubtaskTimer(subtask: Subtask): boolean {
    if (subtask.status === 'done') return false;
    const uid = this.auth.userId();
    if (!uid) return false;
    const assignees = subtask.assignees ?? [];
    return assignees.includes(uid);
  }

  subtaskTimerTooltip(subtask: Subtask): string {
    if (subtask.status === 'done') return 'Subtask đã Done, không thể bật timer';
    if (!this.canStartSubtaskTimer(subtask)) return 'Chỉ thành viên được assign mới bắt đầu timer';
    return 'Bắt đầu timer';
  }

  async startSubtaskTimer(task: Task, subtask: Subtask): Promise<void> {
    if (subtask.status === 'done') {
      this.snackBar.open('Subtask đã Done, không thể bật timer.', 'Đóng', { duration: 3000 });
      return;
    }
    if (!this.canStartSubtaskTimer(subtask)) {
      this.snackBar.open('Bạn chưa được assign vào subtask này. Chỉ thành viên được assign mới bắt đầu timer.', 'Đóng', { duration: 4000 });
      return;
    }
    await this.timerSvc.start(this.id(), task.id, subtask.id, task.title, this.project()?.name ?? '', subtask.title);
  }

  invalidateSubtaskCache(taskId: string): void {
    this.subtasksByTask.update(m => {
      const next = new Map(m);
      next.delete(taskId);
      return next;
    });
  }

  setNewSubtaskTitle(taskId: string, value: string): void {
    this.newSubtaskTitles.update(r => ({ ...r, [taskId]: value }));
  }

  async addSubtaskInline(task: Task): Promise<void> {
    const title = (this.newSubtaskTitles()[task.id] ?? '').trim();
    if (!title) return;
    const s = await this.taskSvc.createSubtask({
      parent_id: task.id, project_id: task.project_id,
      title, description: null, status: 'todo',
      assignees: [], due_date: null, estimate_seconds: 30 * 60,
      completion_note: null
    });
    if (s) {
      this.subtasksByTask.update(m => {
        const next = new Map(m);
        const list = [...(next.get(task.id) ?? []), s];
        next.set(task.id, list);
        return next;
      });
      this.newSubtaskTitles.update(r => ({ ...r, [task.id]: '' }));
      this.showingSubtaskInput.update(set => { const next = new Set(set); next.delete(task.id); return next; });
    } else {
      this.snackBar.open('Không thể thêm subtask. Vui lòng thử lại.', 'Đóng', { duration: 3000 });
    }
  }

  subtaskPct(task: Task): number {
    const { total, completed } = this.getEffectiveSubtaskCounts(task);
    return total ? Math.round((completed / total) * 100) : 0;
  }

  isOverdue(task: Task): boolean {
    return !!task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  }

  private readonly BSC_LABELS: Record<string, string> = {
    financial: 'Tài chính', customer: 'Khách hàng', internal: 'Quy trình nội bộ', learning: 'Học hỏi'
  };

  getBscLabel(bscType: string): string {
    return this.BSC_LABELS[bscType] ?? bscType;
  }

  getBscBadgeTooltip(task: Task): string {
    if (!task.bsc_type) return '';
    return `BSC: ${this.getBscLabel(task.bsc_type)} · Weight: ${task.contribution_weight ?? 1}`;
  }

  canMoveTask(task: Task): boolean {
    const uid = this.auth.userId();
    if (!uid) return false;
    if (this.auth.isAdmin()) return true;
    if (task.assignees_preview.includes(uid)) return true;
    return this.projectSvc.isManager(this.id());
  }

  canDeleteTask(task: Task): boolean {
    return this.auth.isAdmin() || this.projectSvc.isManager(this.id());
  }

  /** Chỉ PM, Director hoặc Admin được sửa subtask đã Done. */
  canEditDoneSubtask(projectId: string): boolean {
    return this.auth.isAdmin() || this.auth.isDirector() || this.projectSvc.isManager(projectId);
  }

  async drop(event: CdkDragDrop<Task[]>, targetStatus: TaskStatus): Promise<void> {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const task = event.previousContainer.data[event.previousIndex];
      if (!this.canMoveTask(task)) {
        this.snackBar.open('Bạn không có quyền di chuyển task này', 'Đóng', { duration: 2000 });
        return;
      }
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);

      if (targetStatus === 'done') {
        const data: CompletionNoteDialogData = { type: 'task', title: task.title };
        this.dialog.open(CompletionNoteDialogComponent, { width: '420px', data })
          .afterClosed()
          .subscribe((result: CompletionNoteDialogResult | undefined) => {
            if (result === undefined) return;
            this.taskSvc.updateTask(task.id, { status: 'done', completion_note: result.note ?? null });
          });
      } else {
        await this.taskSvc.updateStatus(task.id, targetStatus);
        const counts = this.getEffectiveSubtaskCounts(task);
        if (counts.total > 0 && counts.completed === counts.total) {
          const confirmed = await this.confirmSvc.open({ title: 'Đưa task vào Done?', message: `Tất cả subtasks của "${task.title}" đã hoàn thành. Đưa task vào Done?` });
          if (confirmed) await this.taskSvc.updateStatus(task.id, 'done');
        }
      }
    }
  }

  async startTimer(task: Task): Promise<void> {
    await this.timerSvc.start(this.id(), task.id, null, task.title, this.project()?.name ?? '');
  }

  async stopTimer(): Promise<void> {
    await this.timerSvc.stop();
    await this.taskSvc.loadTasks(this.id());
    this.snackBar.open('Đã lưu time log', '', { duration: 2000 });
  }

  async openTaskDialog(task: Task | null = null, defaultStatus?: TaskStatus): Promise<void> {
    const { TaskDialogComponent } = await import('./task-dialog.component');
    this.dialog.open(TaskDialogComponent, {
      width: '560px',
      data: { task, projectId: this.id(), defaultStatus }
    });
  }

  async openSubtaskEditDialog(task: Task, subtask: Subtask): Promise<void> {
    const membersRaw = await this.projectSvc.getMembers(this.id());
    const members: SubtaskEditDialogData['members'] = (membersRaw as any[]).map((m: any) => {
      const p = m.profiles ?? m.profile;
      return {
        user_id: m.user_id,
        display_name: p?.display_name ?? p?.email ?? 'User',
        email: p?.email
      };
    });
    const canEdit = subtask.status !== 'done' || this.canEditDoneSubtask(this.id());
    const data: SubtaskEditDialogData = { task, projectId: this.id(), subtask, members, canEdit };
    this.dialog.open(SubtaskEditDialogComponent, { width: '400px', data })
      .afterClosed()
      .subscribe((result: { updated?: boolean; deleted?: boolean; subtask?: Subtask } | undefined) => {
        if (!result?.subtask) return;
        if (result.deleted) {
          const taskId = result.subtask.parent_id;
          this.subtasksByTask.update(m => {
            const next = new Map(m);
            const list = (next.get(taskId) ?? []).filter(s => s.id !== result.subtask!.id);
            next.set(taskId, list);
            return next;
          });
          return;
        }
        if (result.updated) {
          const updatedSubtask = result.subtask;
          const taskId = updatedSubtask.parent_id;
          this.subtasksByTask.update(m => {
            const next = new Map(m);
            const list = (next.get(taskId) ?? []).map(s => s.id === updatedSubtask.id ? updatedSubtask : s);
            next.set(taskId, list);
            return next;
          });
        }
      });
  }

  async openCommentDialog(task: Task): Promise<void> {
    const { CommentDialogComponent } = await import('./comment-dialog.component');
    this.dialog.open(CommentDialogComponent, {
      width: '520px', data: { task, projectId: this.id() }
    });
  }

  openImportDialog(): void {
    if (!this.id()) return;
    this.dialog.open(TaskImportDialogComponent, {
      width: '880px',
      data: { projectId: this.id() }
    }).afterClosed().subscribe((result: { imported?: number; failed?: number } | undefined) => {
      if (result?.imported && result.imported > 0) {
        this.taskSvc.loadTasks(this.id());
      }
    });
  }

  async deleteTask(task: Task): Promise<void> {
    if (!(await this.confirmSvc.open({ title: 'Xóa task', message: `Xóa task "${task.title}"?`, confirmText: 'Xóa', confirmWarn: true }))) return;
    await this.taskSvc.deleteTask(task.id);
  }
}
