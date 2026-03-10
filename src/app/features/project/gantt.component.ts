import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component, input, output, OnChanges, SimpleChanges, OnInit, signal,
  ViewChild, ElementRef, HostListener, inject,
} from '@angular/core';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Task } from '../../shared/models';
import { TaskService } from '../../services/task.service';

// ─── Constants ────────────────────────────────────────────────────────────────

type ViewMode = 'day' | 'week' | 'month' | 'quarter';

const PX_PER_DAY: Record<ViewMode, number> = { day: 40, week: 20, month: 10, quarter: 4 };
const LABEL_W = 240;   // px – fixed width of task-name column
const MS_DAY  = 86_400_000;

const STATUS_COLOR: Record<string, string> = {
  todo:        '#94a3b8',
  in_progress: '#3b82f6',
  review:      '#f59e0b',
  done:        '#22c55e',
};

const MONTHS_LONG  = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface GanttRow {
  id:       string;
  title:    string;
  status:   string;
  priority: string;
  barLeft:  number;
  barWidth: number;
  color:    string;
  tooltip:  string;
  origin:   Task;
}

interface PrimaryCell   { label: string; widthPx: number; }
interface SecondaryCell { label: string; subLabel?: string; widthPx: number; isWeekend: boolean; isToday: boolean; }
interface WeekendRegion { leftPx: number; widthPx: number; }

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-gantt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DragDropModule, FormsModule, MatIconModule, MatTooltipModule,
    MatButtonModule, MatFormFieldModule, MatInputModule,
  ],
  template: `
<div class="g-wrap">

  <!-- ── Toolbar ───────────────────────────────────────────────────────── -->
  <div class="g-toolbar">
    <div class="g-switcher">
      <button [class.active]="viewMode==='day'"     (click)="setView('day')">Ngày</button>
      <button [class.active]="viewMode==='week'"    (click)="setView('week')">Tuần</button>
      <button [class.active]="viewMode==='month'"   (click)="setView('month')">Tháng</button>
      <button [class.active]="viewMode==='quarter'" (click)="setView('quarter')">Quý</button>
    </div>
    <div class="g-scope">
      <button [class.active]="taskScope()==='all'"     (click)="setTaskScope('all')" matTooltip="Hiện tất cả task">Tất cả</button>
      <button [class.active]="taskScope()==='active'"  (click)="setTaskScope('active')" matTooltip="Chỉ Đang làm & Sắp làm">Đang làm & Sắp làm</button>
    </div>
    <div class="g-legend">
      <span class="lg"><span class="lg-dot" style="background:#3b82f6"></span>In Progress</span>
      <span class="lg"><span class="lg-dot" style="background:#f59e0b"></span>Review</span>
      <span class="lg"><span class="lg-dot" style="background:#22c55e"></span>Done</span>
      <span class="lg"><span class="lg-dot" style="background:#94a3b8"></span>Todo</span>
    </div>
  </div>

  <!-- ── Empty state (no projectId) ───────────────────────────────────────── -->
  @if (!projectId()) {
    <div class="g-empty">
      <mat-icon>date_range</mat-icon>
      <p>Chưa chọn dự án</p>
    </div>
  } @else {

  <!-- ── Gantt table ────────────────────────────────────────────────────── -->
  <div class="g-outer">

    <!-- Header (overflow:hidden — scrolled in sync with body via JS) -->
    <div class="g-hdr-scroll" #hdrScroll>
      <div class="g-hdr-inner" [style.width.px]="LABEL_W + totalPx">

        <!-- Primary row: months / quarters / weeks -->
        <div class="g-hdr-row g-hdr-primary">
          <div class="g-corner g-corner-top" [style.width.px]="LABEL_W"></div>
          @for (c of primaryCells; track $index) {
            <div class="g-hdr-cell g-primary-cell" [style.width.px]="c.widthPx">{{ c.label }}</div>
          }
        </div>

        <!-- Secondary row: days / week-starts / months -->
        <div class="g-hdr-row g-hdr-secondary">
          <div class="g-corner g-corner-bot" [style.width.px]="LABEL_W">Task</div>
          @for (c of secondaryCells; track $index) {
            <div class="g-hdr-cell g-secondary-cell"
                 [class.wknd]="c.isWeekend"
                 [class.today-hdr]="c.isToday"
                 [style.width.px]="c.widthPx">
              @if (c.subLabel) {
                <span class="c-name">{{ c.label }}</span>
                <span class="c-num">{{ c.subLabel }}</span>
              } @else {
                {{ c.label }}
              }
            </div>
          }
        </div>

      </div>
    </div><!-- /g-hdr-scroll -->

    <!-- Body (scrollable both axes) -->
    <div class="g-body-scroll" #bodyScroll (scroll)="onBodyScroll($event)">
      <div class="g-body-inner" [style.min-width.px]="LABEL_W + totalPx"
           cdkDropList
           [cdkDropListData]="rows"
           (cdkDropListDropped)="onRowReorder($event)">

        @if (rows.length === 0) {
          <div class="g-empty-row">
            <div class="g-label" [style.width.px]="LABEL_W"></div>
            <div class="g-lane" [style.width.px]="totalPx">Chưa có task — click dòng dưới để chọn ngày bắt đầu</div>
          </div>
        }

        @for (row of rows; track row.id) {
          <div class="g-row" cdkDrag>
            <!-- Sticky task label -->
            <div class="g-label" [style.width.px]="LABEL_W"
                 (click)="taskEdit.emit(row.origin)"
                 [title]="row.tooltip">
              <span class="g-drag-handle" cdkDragHandle (click)="$event.stopPropagation()" matTooltip="Kéo để sắp xếp thứ tự"><mat-icon>drag_indicator</mat-icon></span>
              <span class="s-dot" [style.background]="statusColor(row.status)"></span>
              <span class="l-title">{{ row.title }}</span>
              <span class="p-pip p-{{row.priority}}"></span>
            </div>
            <!-- Timeline lane -->
            <div class="g-lane" [style.width.px]="totalPx">
              <!-- Weekend shading (day & week views) -->
              @for (wr of weekendRegions; track $index) {
                <div class="g-wknd" [style.left.px]="wr.leftPx" [style.width.px]="wr.widthPx"></div>
              }
              <!-- Today line -->
              @if (todayPx !== null) {
                <div class="g-today-line" [style.left.px]="todayPx"></div>
              }
              <!-- Bar -->
              <div class="g-bar"
                   [style.left.px]="row.barLeft"
                   [style.width.px]="row.barWidth"
                   [style.background]="row.color"
                   (mousedown)="onBarMouseDown($event, row, 'move')"
                   [matTooltip]="row.tooltip">
                <span class="g-bar-handle left"
                      (mousedown)="onBarMouseDown($event, row, 'resize-left')"></span>
                <span class="g-bar-handle right"
                      (mousedown)="onBarMouseDown($event, row, 'resize-right')"></span>
                @if (getBarAssignees(row.origin).length > 0) {
                  <div class="g-bar-assignees">
                    @for (p of getBarAssignees(row.origin).slice(0, 2); track p.id) {
                      @if (p.photo_url) {
                        <img
                          [src]="p.photo_url"
                          class="g-bar-avatar"
                          [alt]="p.display_name || ''"
                          [matTooltip]="p.display_name || p.email || ''"
                        />
                      } @else {
                        <span
                          class="g-bar-avatar g-bar-avatar-initial"
                          [matTooltip]="p.display_name || p.email || ''">
                          {{ (p.display_name || p.email || '?').charAt(0).toUpperCase() }}
                        </span>
                      }
                    }
                    @if (getBarAssignees(row.origin).length > 2) {
                      <span class="g-bar-avatar-more">
                        +{{ getBarAssignees(row.origin).length - 2 }}
                      </span>
                    }
                  </div>
                }
                <span class="g-bar-lbl">{{ row.title }}</span>
              </div>
            </div>
          </div>
        }

        <!-- Row: Click chọn ngày bắt đầu (ở cuối Gantt) -->
        <div class="g-row g-row-create">
          <div class="g-label g-label-create" [style.width.px]="LABEL_W">
            <mat-icon>add_circle_outline</mat-icon>
            <span>Click vào vùng thời gian để chọn ngày bắt đầu</span>
          </div>
          <div class="g-lane g-lane-create" #createLane [style.width.px]="totalPx"
               (click)="onCreateLaneClick($event)">
          </div>
        </div>

      </div>
    </div><!-- /g-body-scroll -->

  </div><!-- /g-outer -->

  <!-- Quick-create form (sau khi click chọn ngày bắt đầu) -->
  @if (quickCreate(); as qc) {
    <div class="g-quick-create-overlay" (click)="cancelQuickCreate()">
      <div class="g-quick-create-panel" (click)="$event.stopPropagation()">
        <h3 class="g-quick-create-title">Tạo task nhanh</h3>
        <mat-form-field appearance="outline" class="g-quick-create-field">
          <mat-label>Tiêu đề</mat-label>
          <input matInput [ngModel]="qc.title" (ngModelChange)="updateQuickCreateTitle($event)" (keydown.enter)="onQuickCreateEnter($event)" placeholder="Tên task" />
        </mat-form-field>
        <div class="g-quick-create-actions">
          <button mat-button (click)="cancelQuickCreate()">Hủy</button>
          <button mat-flat-button color="primary" (click)="submitQuickCreate()" [disabled]="!qc.title.trim()">
            Tạo task
          </button>
        </div>
      </div>
    </div>
  }
  }<!-- /@else -->

</div><!-- /g-wrap -->
  `,
  styles: [`
:host { display: block; }

/* ── Wrapper ──────────────────────────────────────────────────────────────── */
.g-wrap {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 170px);
  min-height: 400px;
}

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.g-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0 14px; flex-wrap: wrap; gap: 8px; flex-shrink: 0;
}
.g-switcher {
  display: flex; gap: 2px;
  background: #f1f5f9; border-radius: 8px; padding: 3px;
}
.g-switcher button {
  padding: 4px 14px; border: none; background: transparent; border-radius: 6px;
  font-size: 13px; cursor: pointer; color: #64748b; transition: all 0.15s;
}
.g-switcher button.active {
  background: white; color: #1e293b; font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,.12);
}
.g-scope {
  display: flex; gap: 2px;
  background: #f1f5f9; border-radius: 8px; padding: 3px;
}
.g-scope button {
  padding: 4px 12px; border: none; background: transparent; border-radius: 6px;
  font-size: 12px; cursor: pointer; color: #64748b; transition: all 0.15s;
}
.g-scope button.active {
  background: white; color: #1e293b; font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,.12);
}
.g-legend  { display: flex; gap: 14px; align-items: center; }
.lg        { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #64748b; }
.lg-dot    { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* ── Empty ────────────────────────────────────────────────────────────────── */
.g-empty      { text-align: center; padding: 60px 24px; color: #94a3b8; }
.g-empty mat-icon { font-size: 52px; width: 52px; height: 52px; margin-bottom: 12px; opacity: .6; }
.g-empty p    { margin: 4px 0; font-size: 14px; }
.g-empty .hint { font-size: 12px; }

/* ── Outer container ──────────────────────────────────────────────────────── */
.g-outer {
  display: flex; flex-direction: column; flex: 1; overflow: hidden;
  border: 1px solid #e2e8f0; border-radius: 8px;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.g-hdr-scroll  { overflow: hidden; flex-shrink: 0; background: #f8fafc; }
.g-hdr-inner   { display: flex; flex-direction: column; }
.g-hdr-row     { display: flex; }

/* Corner cells */
.g-corner      { flex-shrink: 0; background: #f8fafc; border-right: 2px solid #cbd5e1; }
.g-corner-top  { height: 28px; border-bottom: 1px solid #e2e8f0; }
.g-corner-bot  {
  height: 30px; display: flex; align-items: center; padding: 0 12px;
  font-size: 11px; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: .05em;
}

/* Header cells */
.g-hdr-cell {
  flex-shrink: 0; overflow: hidden; box-sizing: border-box;
  border-right: 1px solid #e2e8f0;
  display: flex; align-items: center; justify-content: center;
  user-select: none; white-space: nowrap;
}
.g-primary-cell {
  height: 28px; font-size: 12px; font-weight: 600; color: #334155;
  border-bottom: 1px solid #e2e8f0; background: #f8fafc;
  justify-content: flex-start; padding: 0 8px;
}
.g-secondary-cell {
  height: 30px; font-size: 11px; color: #64748b; background: #f8fafc;
  flex-direction: column; line-height: 1.2; gap: 1px;
}
.g-secondary-cell.wknd     { background: #f0f4f8; }
.g-secondary-cell.today-hdr { background: #eff6ff; color: #2563eb; font-weight: 700; }
.c-name { font-size: 9px; text-transform: uppercase; opacity: .75; }
.c-num  { font-size: 12px; font-weight: 600; }

/* ── Body ─────────────────────────────────────────────────────────────────── */
.g-body-scroll { overflow: auto; flex: 1; }
.g-body-inner  { display: flex; flex-direction: column; }

/* Row */
.g-row { display: flex; border-bottom: 1px solid #f1f5f9; }
.g-row:hover .g-label { background: #f8fafc; }
.g-row:hover .g-lane  { background: rgba(241,245,249,.35); }

/* Sticky task label */
.g-label {
  flex-shrink: 0; position: sticky; left: 0; z-index: 5;
  background: white; border-right: 2px solid #cbd5e1;
  height: 44px; display: flex; align-items: center;
  gap: 6px; padding: 0 10px;
  cursor: pointer; overflow: hidden; transition: background .12s;
}
.g-drag-handle {
  flex-shrink: 0; cursor: grab; color: #94a3b8;
  display: flex; align-items: center; padding: 2px;
}
.g-drag-handle:active { cursor: grabbing; }
.g-drag-handle mat-icon { font-size: 18px; width: 18px; height: 18px; }
.s-dot  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.l-title {
  flex: 1; min-width: 0; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; color: #1e293b;
}
.p-pip        { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.p-critical   { background: #ef4444; }
.p-high       { background: #f97316; }
.p-medium     { background: #eab308; }
.p-low        { background: #22c55e; }

/* Timeline lane */
.g-lane {
  flex-shrink: 0; position: relative;
  height: 44px; transition: background .12s;
}

/* Weekend shading */
.g-wknd {
  position: absolute; top: 0; height: 44px;
  background: rgba(148,163,184,.07); pointer-events: none;
}

/* Today line */
.g-today-line {
  position: absolute; top: 0; height: 44px; width: 2px;
  background: #ef4444; z-index: 4; pointer-events: none;
  transform: translateX(-1px);
}
.g-today-line::before {
  content: ''; position: absolute; top: -3px; left: 50%;
  transform: translateX(-50%);
  width: 7px; height: 7px; border-radius: 50%; background: #ef4444;
}

/* Bar */
.g-bar {
  position: absolute;
  top: calc(50% - 12px);
  height: 24px; border-radius: 4px; z-index: 2;
  cursor: pointer; overflow: hidden;
  display: flex; align-items: center; gap: 4px;
  transition: filter .15s;
  min-width: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,.15);
}
.g-bar:hover { filter: brightness(1.1); box-shadow: 0 2px 6px rgba(0,0,0,.2); }
.g-bar-lbl {
  font-size: 11px; font-weight: 600; color: rgba(255,255,255,.95);
  padding: 0 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Drag handles (resize left / right) */
.g-bar-handle {
  position: absolute; top: 0; width: 5px; height: 100%;
  background: rgba(15,23,42,.16); cursor: ew-resize;
}
.g-bar-handle.left  { left: 0;  border-radius: 4px 0 0 4px; }
.g-bar-handle.right { right: 0; border-radius: 0 4px 4px 0; }
.g-bar-handle:hover { background: rgba(15,23,42,.28); }

/* Assignees inside bar */
.g-bar-assignees {
  display: flex; align-items: center; gap: 2px;
}
.g-bar-avatar {
  width: 16px; height: 16px; border-radius: 999px; object-fit: cover;
  border: 1px solid rgba(15,23,42,.35);
}
.g-bar-avatar-initial {
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(248,250,252,.9); color: #475569;
  font-size: 10px; font-weight: 600;
}
.g-bar-avatar-more {
  font-size: 10px; color: #e5e7eb; margin-left: 2px;
}

/* Create row (kéo chọn vùng) */
.g-row-create { background: #f8fafc; border-bottom: 2px dashed #cbd5e1; }
.g-label-create { color: #64748b; font-size: 12px; }
.g-label-create mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 6px; color: #3b82f6; }
.g-lane-create { cursor: pointer; position: relative; }
.g-empty-row { color: #94a3b8; font-size: 12px; }
.g-empty-row .g-lane { display: flex; align-items: center; padding-left: 12px; }

/* Quick-create dialog: chỉ tiêu đề */
.g-quick-create-overlay {
  position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 1000;
  display: flex; align-items: center; justify-content: center; padding: 16px;
  backdrop-filter: blur(2px);
}
.g-quick-create-panel {
  background: white; border-radius: 16px; padding: 28px 32px;
  width: 100%; max-width: 360px;
  box-shadow: 0 24px 48px -12px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.04);
}
.g-quick-create-title {
  margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #0f172a;
  letter-spacing: -0.02em;
}
.g-quick-create-field { width: 100%; display: block; margin-bottom: 4px; }
.g-quick-create-actions {
  margin-top: 24px; display: flex; justify-content: flex-end; gap: 10px;
}
.g-quick-create-actions button { font-weight: 500; }
  `],
})
export class GanttComponent implements OnChanges, OnInit {

  readonly LABEL_W = LABEL_W;

  tasks      = input.required<Task[]>();
  projectId  = input<string>();  // optional: khi có thì hiện create row + quick create
  /** 'active' = chỉ Đang làm + Sắp làm (do parent filter); 'all' = tất cả task đã truyền vào */
  taskScope  = input<'all' | 'active'>('active');
  /** Chỉ hiện task có [start,end] giao với khung nhìn hiện tại */
  filterByViewRange = input<boolean>(true);
  /** Hàm resolve assignees: được truyền từ ProjectComponent (getAssignees) */
  assigneesResolver = input<(task: Task) => { id: string; display_name: string | null; photo_url: string | null; email: string }[] | null>();

  taskEdit   = output<Task>();
  taskCreated = output<Task>();
  taskScopeChange = output<'all' | 'active'>();

  private taskSvc = inject(TaskService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('hdrScroll')  private hdrScrollRef?:  ElementRef<HTMLElement>;
  @ViewChild('bodyScroll') private bodyScrollRef?: ElementRef<HTMLElement>;
  @ViewChild('createLane') private createLaneRef?: ElementRef<HTMLElement>;

  /** Form tạo nhanh (mở sau khi click chọn ngày bắt đầu trên create lane) */
  quickCreate = signal<{ title: string; start: Date; end: Date } | null>(null);

  viewMode: ViewMode = 'month';

  rows:           GanttRow[]       = [];
  primaryCells:   PrimaryCell[]    = [];
  secondaryCells: SecondaryCell[]  = [];
  weekendRegions: WeekendRegion[]  = [];
  totalPx   = 0;
  todayPx:  number | null = null;

  private viewStartD!: Date;
  private viewEndD!:   Date;

  /** Thứ tự hiển thị task (theo id). Không sort theo ngày; cho phép drag reorder. */
  private taskIdsInOrder: string[] = [];

  private dragState: {
    rowId: string;
    mode: 'move' | 'resize-left' | 'resize-right';
    startClientX: number;
    origStart: Date;
    origEnd: Date;
  } | null = null;

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.buildView();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks'] || changes['projectId'] || changes['taskScope'] || changes['filterByViewRange']) this.buildView();
  }

  // ─── Public ─────────────────────────────────────────────────────────────────

  setView(mode: ViewMode): void {
    this.viewMode = mode;
    this.buildView();
  }

  setTaskScope(scope: 'all' | 'active'): void {
    this.taskScopeChange.emit(scope);
  }

  onBarMouseDown(event: MouseEvent, row: GanttRow, mode: 'move' | 'resize-left' | 'resize-right'): void {
    event.stopPropagation();
    event.preventDefault();
    const dates = this.taskDates(row.origin);
    this.dragState = {
      rowId: row.id,
      mode,
      startClientX: event.clientX,
      origStart: dates.start,
      origEnd: dates.end,
    };
  }

  onBodyScroll(e: Event): void {
    if (this.hdrScrollRef) {
      this.hdrScrollRef.nativeElement.scrollLeft = (e.target as HTMLElement).scrollLeft;
    }
  }

  onRowReorder(event: CdkDragDrop<GanttRow[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.rows, event.previousIndex, event.currentIndex);
    moveItemInArray(this.taskIdsInOrder, event.previousIndex, event.currentIndex);
  }

  onCreateLaneClick(event: MouseEvent): void {
    if (!this.createLaneRef?.nativeElement || !this.bodyScrollRef?.nativeElement) return;
    const rect = this.createLaneRef.nativeElement.getBoundingClientRect();
    const scrollLeft = this.bodyScrollRef.nativeElement.scrollLeft;
    const clickX = Math.max(0, Math.min(this.totalPx, event.clientX - rect.left + scrollLeft));
    const ppd = PX_PER_DAY[this.viewMode];
    const startDate = new Date(this.viewStartD.getTime() + (clickX / ppd) * MS_DAY);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + 14 * MS_DAY);
    endDate.setHours(23, 59, 59, 999);
    this.quickCreate.set({ title: '', start: startDate, end: endDate });
  }

  toDateInputStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  parseDateInput(str: string): Date {
    if (!str) return new Date();
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  updateQuickCreateTitle(value: string): void {
    this.quickCreate.update(q => q ? { ...q, title: value } : null);
  }

  onQuickCreateEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const qc = this.quickCreate();
    if (qc?.title.trim()) this.submitQuickCreate();
  }

  cancelQuickCreate(): void {
    this.quickCreate.set(null);
  }

  async submitQuickCreate(): Promise<void> {
    const qc = this.quickCreate();
    const pid = this.projectId();
    if (!qc || !qc.title.trim() || !pid) return;
    try {
      const created = await this.taskSvc.createTask({
        project_id: pid,
        title: qc.title.trim(),
        start_date: this.toLocalDateStr(qc.start),
        due_date:   this.toLocalDateStr(qc.end),
        status: 'todo',
      });
      if (created) this.taskCreated.emit(created);
      this.quickCreate.set(null);
      this.buildView();
    } catch (err: any) {
      console.error(err);
    }
  }

  statusColor(s: string): string {
    return STATUS_COLOR[s] ?? '#94a3b8';
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    if (!this.dragState) return;
    const deltaX = event.clientX - this.dragState.startClientX;
    const ppd    = PX_PER_DAY[this.viewMode];
    let deltaDays = Math.round(deltaX / ppd);
    if (deltaDays === 0) return;

    const { mode, origStart, origEnd } = this.dragState;

    const durationDays = Math.max(1, Math.round((origEnd.getTime() - origStart.getTime()) / MS_DAY));

    let newStart = new Date(origStart);
    let newEnd   = new Date(origEnd);

    if (mode === 'move') {
      const shiftMs = deltaDays * MS_DAY;
      newStart = new Date(origStart.getTime() + shiftMs);
      newEnd   = new Date(origEnd.getTime() + shiftMs);
    } else if (mode === 'resize-left') {
      const maxShrink = durationDays - 1;
      if (deltaDays > maxShrink) deltaDays = maxShrink;
      const shiftMs = deltaDays * MS_DAY;
      newStart = new Date(origStart.getTime() + shiftMs);
      if (newStart >= origEnd) newStart = new Date(origEnd.getTime() - MS_DAY);
    } else if (mode === 'resize-right') {
      const shiftMs = deltaDays * MS_DAY;
      newEnd = new Date(origEnd.getTime() + shiftMs);
      if (newEnd <= origStart) newEnd = new Date(origStart.getTime() + MS_DAY);
    }

    this.previewRowDates(this.dragState.rowId, newStart, newEnd);
  }

  @HostListener('window:mouseup', ['$event'])
  async onWindowMouseUp(event: MouseEvent): Promise<void> {
    if (!this.dragState) return;
    const state = this.dragState;
    this.dragState = null;

    const deltaX = event.clientX - state.startClientX;
    const ppd    = PX_PER_DAY[this.viewMode];
    let deltaDays = Math.round(deltaX / ppd);

    const { mode, origStart, origEnd } = state;
    const durationDays = Math.max(1, Math.round((origEnd.getTime() - origStart.getTime()) / MS_DAY));

    let newStart = new Date(origStart);
    let newEnd   = new Date(origEnd);

    if (mode === 'move') {
      const shiftMs = deltaDays * MS_DAY;
      newStart = new Date(origStart.getTime() + shiftMs);
      newEnd   = new Date(origEnd.getTime() + shiftMs);
    } else if (mode === 'resize-left') {
      const maxShrink = durationDays - 1;
      if (deltaDays > maxShrink) deltaDays = maxShrink;
      const shiftMs = deltaDays * MS_DAY;
      newStart = new Date(origStart.getTime() + shiftMs);
      if (newStart >= origEnd) newStart = new Date(origEnd.getTime() - MS_DAY);
    } else if (mode === 'resize-right') {
      const shiftMs = deltaDays * MS_DAY;
      newEnd = new Date(origEnd.getTime() + shiftMs);
      if (newEnd <= origStart) newEnd = new Date(origStart.getTime() + MS_DAY);
    }

    const startStr = this.toLocalDateStr(newStart);
    const endStr   = this.toLocalDateStr(newEnd);

    // Persist to backend
    try {
      await this.taskSvc.updateTask(state.rowId, {
        start_date: startStr,
        due_date:   endStr,
      });
    } catch {
      // ignore here; realtime or next reload will correct if needed
    }

    this.buildView();
  }

  // ─── Build ──────────────────────────────────────────────────────────────────

  private buildView(): void {
    const tasks = this.tasks();
    if (!tasks.length) {
      this.rows = [];
      this.taskIdsInOrder = [];
      this.setDefaultViewRange();
      this.buildHeaderCells();
      this.totalPx = this.secondaryCells.reduce((s, c) => s + c.widthPx, 0);
      this.todayPx = this.computeTodayPx();
      this.weekendRegions = this.computeWeekendRegions();
      this.cdr.markForCheck();
      return;
    }

    this.computeViewRange(tasks);
    this.buildHeaderCells();
    this.totalPx = this.secondaryCells.reduce((s, c) => s + c.widthPx, 0);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayMs = (today.getTime() - this.viewStartD.getTime()) / MS_DAY;
    this.todayPx = (todayMs >= 0 && today.getTime() <= this.viewEndD.getTime())
      ? Math.round(todayMs * PX_PER_DAY[this.viewMode])
      : null;

    const idSet = new Set(tasks.map(t => t.id));
    this.taskIdsInOrder = this.taskIdsInOrder.filter(id => idSet.has(id));
    tasks.forEach(t => { if (!this.taskIdsInOrder.includes(t.id)) this.taskIdsInOrder.push(t.id); });

    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const filterByRange = this.filterByViewRange();
    this.rows = this.taskIdsInOrder
      .map(id => taskMap.get(id))
      .filter((t): t is Task => !!t && (!filterByRange || this.taskIntersectsView(t)))
      .map(t => this.buildRow(t))
      .filter((r): r is GanttRow => r !== null);

    this.weekendRegions = this.computeWeekendRegions();
    this.cdr.markForCheck();
  }

  private setDefaultViewRange(): void {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    this.viewStartD = this.prevMonday(new Date(now.getFullYear(), now.getMonth(), 1));
    this.viewEndD = this.nextSunday(new Date(now.getFullYear(), now.getMonth() + 2, 0));
  }

  private computeTodayPx(): number | null {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayMs = (today.getTime() - this.viewStartD.getTime()) / MS_DAY;
    return (todayMs >= 0 && today.getTime() <= this.viewEndD.getTime())
      ? Math.round(todayMs * PX_PER_DAY[this.viewMode])
      : null;
  }

  private computeWeekendRegions(): WeekendRegion[] {
    const out: WeekendRegion[] = [];
    if (this.viewMode !== 'day' && this.viewMode !== 'week') return out;
    const ppd = PX_PER_DAY[this.viewMode];
    let d = new Date(this.viewStartD);
    while (d <= this.viewEndD) {
      if (d.getDay() === 6) {
        const leftPx = Math.round((d.getTime() - this.viewStartD.getTime()) / MS_DAY) * ppd;
        out.push({ leftPx, widthPx: 2 * ppd });
      }
      d = new Date(d.getTime() + MS_DAY);
    }
    return out;
  }

  // ─── View range ─────────────────────────────────────────────────────────────

  private computeViewRange(tasks: Task[]): void {
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const task of tasks) {
      const { start, end } = this.taskDates(task);
      if (!minDate || start < minDate) minDate = start;
      if (!maxDate || end   > maxDate) maxDate  = end;
    }

    if (!minDate || !maxDate) {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      minDate = new Date(now.getFullYear(), now.getMonth(), 1);
      maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const padDays = this.viewMode === 'quarter' ? 45 : this.viewMode === 'month' ? 21 : 14;
    let vs = new Date(minDate.getTime() - padDays * MS_DAY);
    let ve = new Date(maxDate.getTime() + padDays * MS_DAY);

    switch (this.viewMode) {
      case 'day':
      case 'week':
        vs = this.prevMonday(vs);
        ve = this.nextSunday(ve);
        break;

      case 'month':
        // Snap to start-of-month then align to Monday for weekly cells
        vs = new Date(vs.getFullYear(), vs.getMonth(), 1);
        vs = this.prevMonday(vs);
        ve = new Date(ve.getFullYear(), ve.getMonth() + 1, 0);
        ve = this.nextSunday(ve);
        break;

      case 'quarter': {
        const qs = Math.floor(vs.getMonth() / 3);
        vs = new Date(vs.getFullYear(), qs * 3, 1);
        const qe = Math.floor(ve.getMonth() / 3);
        ve = new Date(ve.getFullYear(), qe * 3 + 3, 0);
        break;
      }
    }

    this.viewStartD = vs;
    this.viewEndD   = ve;
  }

  // ─── Header cells ───────────────────────────────────────────────────────────

  private buildHeaderCells(): void {
    this.primaryCells   = [];
    this.secondaryCells = [];

    const ppd   = PX_PER_DAY[this.viewMode];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const vS    = this.viewStartD;
    const vE    = this.viewEndD;

    if (this.viewMode === 'day' || this.viewMode === 'week') {
      // Secondary: 1 cell per day
      let d = new Date(vS);
      let lastKey = '';

      while (d <= vE) {
        const dow       = d.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isToday   = d.getTime() === today.getTime();

        let label: string;
        let subLabel: string | undefined;
        if (this.viewMode === 'day') {
          label = String(d.getDate());
        } else {
          label    = DAYS_SHORT[dow];
          subLabel = String(d.getDate());
        }

        this.secondaryCells.push({ label, subLabel, widthPx: ppd, isWeekend, isToday });

        // Primary grouping
        let key: string;
        let primLabel: string;
        if (this.viewMode === 'day') {
          key       = `${d.getFullYear()}-${d.getMonth()}`;
          primLabel = `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
        } else {
          const ws  = this.prevMonday(d);
          key       = `${ws.getFullYear()}-${ws.getMonth()}-${ws.getDate()}`;
          primLabel = this.weekLabel(ws);
        }

        if (key !== lastKey) {
          lastKey = key;
          this.primaryCells.push({ label: primLabel, widthPx: ppd });
        } else {
          this.primaryCells[this.primaryCells.length - 1].widthPx += ppd;
        }

        d = new Date(d.getTime() + MS_DAY);
      }

    } else if (this.viewMode === 'month') {
      // Secondary: 1 cell per week (7 days, starting Monday)
      // viewStartD is already Monday-aligned
      let d = new Date(vS);
      let lastKey = '';

      while (d <= vE) {
        const weekEnd = new Date(d.getTime() + 6 * MS_DAY);
        const mid     = new Date(d.getTime() + 3 * MS_DAY); // Wednesday = representative day
        const isToday = today >= d && today <= weekEnd;

        this.secondaryCells.push({ label: String(d.getDate()), widthPx: 7 * ppd, isWeekend: false, isToday });

        // Primary: month of Wednesday (avoids edge-week ambiguity)
        const key       = `${mid.getFullYear()}-${mid.getMonth()}`;
        const primLabel = `${MONTHS_LONG[mid.getMonth()]} ${mid.getFullYear()}`;

        if (key !== lastKey) {
          lastKey = key;
          this.primaryCells.push({ label: primLabel, widthPx: 7 * ppd });
        } else {
          this.primaryCells[this.primaryCells.length - 1].widthPx += 7 * ppd;
        }

        d = new Date(d.getTime() + 7 * MS_DAY);
      }

    } else {
      // quarter – Secondary: 1 cell per month
      let d = new Date(vS);
      let lastKey = '';

      while (d <= vE) {
        const year        = d.getFullYear();
        const month       = d.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const widthPx     = daysInMonth * ppd;
        const isToday     = today.getFullYear() === year && today.getMonth() === month;

        this.secondaryCells.push({ label: MONTHS_SHORT[month], widthPx, isWeekend: false, isToday });

        const q         = Math.floor(month / 3) + 1;
        const key       = `${year}-Q${q}`;
        const primLabel = `Q${q} ${year}`;

        if (key !== lastKey) {
          lastKey = key;
          this.primaryCells.push({ label: primLabel, widthPx });
        } else {
          this.primaryCells[this.primaryCells.length - 1].widthPx += widthPx;
        }

        d = new Date(year, month + 1, 1);
      }
    }
  }

  // ─── Row builder ────────────────────────────────────────────────────────────

  private buildRow(task: Task): GanttRow | null {
    const { start, end } = this.taskDates(task);
    const ppd    = PX_PER_DAY[this.viewMode];
    const barLeft  = Math.round((start.getTime() - this.viewStartD.getTime()) / MS_DAY) * ppd;
    const rawWidth = Math.round((end.getTime()   - start.getTime())           / MS_DAY) * ppd;
    const barWidth = Math.max(rawWidth, 4);

    const fmt     = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    const tooltip = `${task.title} · ${fmt(start)} → ${fmt(end)}`;

    return {
      id: task.id, title: task.title,
      status: task.status, priority: task.priority,
      barLeft, barWidth,
      color:   STATUS_COLOR[task.status] ?? '#94a3b8',
      tooltip, origin: task,
    };
  }

  private previewRowDates(rowId: string, start: Date, end: Date): void {
    const ppd = PX_PER_DAY[this.viewMode];
    const barLeft  = Math.round((start.getTime() - this.viewStartD.getTime()) / MS_DAY) * ppd;
    const rawWidth = Math.round((end.getTime()   - start.getTime())           / MS_DAY) * ppd;
    const barWidth = Math.max(rawWidth, 4);

    this.rows = this.rows.map(r =>
      r.id === rowId ? { ...r, barLeft, barWidth } : r
    );
  }

  /** Task có [start,end] giao với khung nhìn viewStartD..viewEndD không */
  private taskIntersectsView(task: Task): boolean {
    const { start, end } = this.taskDates(task);
    return end >= this.viewStartD && start <= this.viewEndD;
  }

  // ─── Date helpers ───────────────────────────────────────────────────────────

  private taskDates(task: Task): { start: Date; end: Date } {
    let start: Date, end: Date;

    if (task.due_date) {
      end   = this.parseLocal(task.due_date);
      start = task.start_date
        ? this.parseLocal(task.start_date)
        : new Date(end.getTime() - 14 * MS_DAY);
    } else {
      if (task.start_date) {
        start = this.parseLocal(task.start_date);
      } else {
        start = new Date(task.created_at);
        start.setHours(0, 0, 0, 0);
      }
      end = new Date(start.getTime() + 14 * MS_DAY);
    }

    return { start, end };
  }

  private toLocalDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Parse 'YYYY-MM-DD' as LOCAL midnight — avoids UTC shift in UTC+N timezones. */
  private parseLocal(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** Most recent Monday on or before d. */
  private prevMonday(d: Date): Date {
    const r = new Date(d); r.setHours(0, 0, 0, 0);
    const dow = r.getDay();
    r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
    return r;
  }

  /** Upcoming Sunday on or after d. */
  private nextSunday(d: Date): Date {
    const r = new Date(d); r.setHours(0, 0, 0, 0);
    const dow = r.getDay();
    r.setDate(r.getDate() + (dow === 0 ? 0 : 7 - dow));
    return r;
  }

  /** Format ISO week label: "W8  16 Feb – 22 Feb" */
  private weekLabel(monday: Date): string {
    const sunday  = new Date(monday.getTime() + 6 * MS_DAY);
    const wn      = this.isoWeek(monday);
    const m1      = MONTHS_SHORT[monday.getMonth()];
    const m2      = MONTHS_SHORT[sunday.getMonth()];
    const endStr  = sunday.getDate() + (m1 !== m2 ? ' ' + m2 : '');
    return `W${wn}  ${monday.getDate()} ${m1}–${endStr}`;
  }

  /** ISO 8601 week number. */
  private isoWeek(d: Date): number {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t.valueOf() - yearStart.valueOf()) / MS_DAY + 1) / 7);
  }

  getBarAssignees(task: Task): { id: string; display_name: string | null; photo_url: string | null; email: string }[] {
    const resolver = this.assigneesResolver();
    if (!resolver) return [];
    try {
      return resolver(task) ?? [];
    } catch {
      return [];
    }
  }
}
