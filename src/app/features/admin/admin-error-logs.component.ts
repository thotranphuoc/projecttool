import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorLogService, ErrorLogEntry } from '../../core/error-log.service';
import { AppSettingsService } from '../../services/app-settings.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-admin-error-logs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, DatePipe, JsonPipe, SlicePipe,
    MatTableModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSlideToggleModule, MatCheckboxModule, MatTooltipModule
  ],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <h1 class="page-title">Error Logs</h1>
        <div class="header-actions">
          @if (auth.isAdmin()) {
            <div class="toggle-row">
              <mat-slide-toggle [(ngModel)]="errorLogEnabled" (ngModelChange)="onToggleChange($event)" [disabled]="isSavingToggle()">
                Ghi log lỗi vào DB
              </mat-slide-toggle>
              <span class="toggle-hint">Tắt để tránh quá tải database</span>
            </div>
          }
          <div class="filters">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Lọc theo context</mat-label>
            <input matInput [(ngModel)]="contextFilter" (ngModelChange)="load()" placeholder="vd: loadTasks, createSubtask" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Lọc theo route</mat-label>
            <input matInput [(ngModel)]="routeFilter" (ngModelChange)="load()" placeholder="vd: /admin/error-logs" />
          </mat-form-field>
          <button mat-stroked-button (click)="load()">
            <mat-icon>refresh</mat-icon> Tải lại
          </button>
          @if (auth.isAdmin()) {
            <button mat-flat-button color="warn" (click)="removeSelected()" [disabled]="selectedIds().size === 0 || isDeleting()">
              <mat-icon>delete</mat-icon> Xóa {{ selectedIds().size > 0 ? '(' + selectedIds().size + ')' : '' }}
            </button>
          }
          </div>
        </div>
      </div>

      <div class="card" style="overflow:auto">
        <table mat-table [dataSource]="dataSource" multiTemplateDataRows class="logs-table">
          <ng-container matColumnDef="select">
            <th mat-header-cell *matHeaderCellDef>
              @if (auth.isAdmin()) {
                <mat-checkbox (change)="toggleSelectAll($event.checked)" [checked]="isAllSelected()" [indeterminate]="isSomeSelected()"></mat-checkbox>
              }
            </th>
            <td mat-cell *matCellDef="let row">
              @if (auth.isAdmin()) {
                <mat-checkbox (click)="$event.stopPropagation()" (change)="toggleSelect(row.id, $event.checked)" [checked]="isSelected(row.id)"></mat-checkbox>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="created_at">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Thời gian</th>
            <td mat-cell *matCellDef="let row">{{ row.created_at | date:'dd/MM/yyyy HH:mm:ss' }}</td>
          </ng-container>
          <ng-container matColumnDef="user_id">
            <th mat-header-cell *matHeaderCellDef>User</th>
            <td mat-cell *matCellDef="let row">{{ row.user_id ? (row.user_id | slice:0:8) + '…' : '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="context">
            <th mat-header-cell *matHeaderCellDef>Context</th>
            <td mat-cell *matCellDef="let row">{{ row.context }}</td>
          </ng-container>
          <ng-container matColumnDef="error_message">
            <th mat-header-cell *matHeaderCellDef>Lỗi</th>
            <td mat-cell *matCellDef="let row" class="error-msg">{{ row.error_message || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="error_code">
            <th mat-header-cell *matHeaderCellDef>Code</th>
            <td mat-cell *matCellDef="let row">{{ row.error_code || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="error_name">
            <th mat-header-cell *matHeaderCellDef>Loại</th>
            <td mat-cell *matCellDef="let row">{{ getErrorName(row) || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="expand">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button (click)="toggleDetail(row.id); $event.stopPropagation()" type="button">
                <mat-icon>{{ isExpanded(row.id) ? 'expand_less' : 'expand_more' }}</mat-icon>
              </button>
            </td>
          </ng-container>

          <ng-container matColumnDef="expandedDetail">
            <td mat-cell *matCellDef="let row" [attr.colspan]="displayedColumns.length">
              <div class="detail-content-inline">
                <div class="detail-header">
                  <span>Chi tiết lỗi</span>
                  <button mat-stroked-button type="button" (click)="copyForDetection(row)" matTooltip="Copy để paste cho AI detect">
                    <mat-icon>content_copy</mat-icon> Copy
                  </button>
                </div>
                <p><strong>URL:</strong> {{ row.url || '—' }}</p>
                <p><strong>Route:</strong> {{ row.route_path || getRouteFromUrl(row.url) || '—' }}</p>
                <p><strong>Error name:</strong> {{ getErrorName(row) || '—' }}</p>
                <p><strong>User Agent:</strong> {{ row.user_agent || '—' }}</p>
                @if (row.error_details) {
                  <p><strong>Chi tiết:</strong></p>
                  <pre class="detail-json">{{ row.error_details | json }}</pre>
                }
                @if (row.extra) {
                  <p><strong>Extra:</strong></p>
                  <pre class="detail-json">{{ row.extra | json }}</pre>
                }
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          <tr mat-row *matRowDef="let row; columns: ['expandedDetail']; when: isExpandedRow" class="detail-row"></tr>
        </table>

        @if (isLoading()) {
          <div class="table-loading">Đang tải...</div>
        } @else if (logs().length === 0) {
          <div class="table-empty">Không có log lỗi</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .admin-page { max-width: 1100px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; }
    .header-actions { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
    .toggle-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .toggle-hint { font-size: 12px; color: #64748b; }
    .filters { display: flex; align-items: center; gap: 12px; }
    .filter-field { width: 260px; }
    .logs-table { width: 100%; }
    .error-msg { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #dc2626; }
    .table-loading, .table-empty { text-align: center; padding: 32px; color: #94a3b8; }
    .detail-row .detail-content-inline { padding: 12px 16px; max-width: 100%; overflow-wrap: break-word; }
    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .detail-header button { flex-shrink: 0; }
    .detail-row .detail-json { margin-top: 4px; }
    .detail-content { padding: 12px 0; }
    .detail-content p { margin: 8px 0; font-size: 13px; }
    .detail-json { background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 12px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; }
  `]
})
export class AdminErrorLogsComponent implements OnInit {
  readonly auth = inject(AuthService);
  private errorLog = inject(ErrorLogService);
  private appSettings = inject(AppSettingsService);
  private snackBar = inject(MatSnackBar);
  private confirmSvc = inject(ConfirmService);

  logs = signal<ErrorLogEntry[]>([]);
  isLoading = signal(false);
  isSavingToggle = signal(false);
  contextFilter = '';
  routeFilter = '';
  errorLogEnabled = true;
  dataSource = new MatTableDataSource<ErrorLogEntry>([]);
  displayedColumns = ['select', 'created_at', 'user_id', 'context', 'error_message', 'error_code', 'error_name', 'expand'];
  expandedIds = signal<Set<string>>(new Set());
  selectedIds = signal<Set<string>>(new Set());
  isDeleting = signal(false);

  ngOnInit(): void {
    this.appSettings.loadAppSettings().then(() => {
      this.errorLogEnabled = this.appSettings.errorLogEnabled();
    });
    this.load();
  }

  async onToggleChange(enabled: boolean): Promise<void> {
    this.isSavingToggle.set(true);
    await this.appSettings.setErrorLogEnabled(enabled);
    this.errorLogEnabled = enabled;
    this.snackBar.open(enabled ? 'Đã bật ghi log lỗi' : 'Đã tắt ghi log lỗi', '', { duration: 2000 });
    this.isSavingToggle.set(false);
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    const list = await this.errorLog.loadLogs(100, 0, this.contextFilter || undefined, this.routeFilter || undefined);
    this.logs.set(list);
    this.dataSource.data = list;
    this.isLoading.set(false);
  }

  toggleDetail(id: string | undefined): void {
    if (!id) return;
    this.expandedIds.update(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    // Force MatTable to re-render rows (when predicate re-evaluation)
    this.dataSource.data = [...this.dataSource.data];
  }

  isExpanded(id: string | undefined): boolean {
    return id ? this.expandedIds().has(id) : false;
  }

  isSelected(id: string | undefined): boolean {
    return id ? this.selectedIds().has(id) : false;
  }

  isAllSelected(): boolean {
    const logs = this.logs();
    if (!logs.length) return false;
    return logs.every(r => r.id && this.selectedIds().has(r.id));
  }

  isSomeSelected(): boolean {
    const n = this.selectedIds().size;
    return n > 0 && n < this.logs().length;
  }

  toggleSelect(id: string | undefined, checked: boolean): void {
    if (!id) return;
    this.selectedIds.update(s => {
      const next = new Set(s);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      this.selectedIds.set(new Set(this.logs().filter(r => r.id).map(r => r.id!)));
    } else {
      this.selectedIds.set(new Set());
    }
  }

  async removeSelected(): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    if (!(await this.confirmSvc.open({
      title: 'Xác nhận xóa',
      message: `Xóa ${ids.length} log lỗi đã chọn?`,
      confirmText: 'Xóa',
      confirmWarn: true
    }))) return;
    this.isDeleting.set(true);
    const { deleted, error } = await this.errorLog.deleteLogs(ids);
    this.isDeleting.set(false);
    if (error) {
      this.snackBar.open('Lỗi khi xóa: ' + error, 'Đóng', { duration: 5000 });
    } else {
      this.selectedIds.set(new Set());
      this.snackBar.open(`Đã xóa ${deleted} log lỗi`, '', { duration: 2000 });
      await this.load();
    }
  }

  /** Predicate for mat-row: show expanded detail row only when this row is expanded */
  isExpandedRow = (_index: number, row: ErrorLogEntry) => this.isExpanded(row?.id);

  /** Fallback error name từ error_details cho log cũ */
  getErrorName(row: ErrorLogEntry): string | null {
    if (row.error_name) return row.error_name;
    const d = row.error_details as { name?: string } | null | undefined;
    return d?.name ?? null;
  }

  async copyForDetection(row: ErrorLogEntry): Promise<void> {
    const payload = {
      id: row.id,
      created_at: row.created_at,
      user_id: row.user_id,
      context: row.context,
      error_message: row.error_message,
      error_code: row.error_code,
      error_name: row.error_name ?? (row.error_details as { name?: string })?.name,
      error_details: row.error_details,
      url: row.url,
      route_path: row.route_path ?? this.getRouteFromUrl(row.url),
      user_agent: row.user_agent,
      extra: row.extra,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      this.snackBar.open('Đã copy vào clipboard', '', { duration: 1500 });
    } catch {
      this.snackBar.open('Không copy được', 'Đóng', { duration: 2000 });
    }
  }

  /** Fallback route từ URL cho log cũ chưa có route_path */
  getRouteFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      return new URL(url).pathname || null;
    } catch {
      return null;
    }
  }
}
