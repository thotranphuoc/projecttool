import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VisionStrategyService } from '../../services/vision-strategy.service';
import { ProjectService } from '../../services/project.service';
import { ConfirmService } from '../../services/confirm.service';
import { AuthService } from '../../core/auth/auth.service';
import { Strategy } from '../../shared/models';
import { StrategyFormDialogComponent } from './strategy-form-dialog.component';

@Component({
  selector: 'app-strategies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Chiến lược</h1>
          <p class="text-muted text-sm">Tầng Thiết kế — Chiến lược gắn với Tầm nhìn; gắn Objective vào Chiến lược tại màn Objectives.</p>
        </div>
        <div class="header-actions">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Lọc theo Tầm nhìn</mat-label>
            <mat-select [ngModel]="filterVisionId()" (ngModelChange)="filterVisionId.set($event)">
              <mat-option [value]="null">Tất cả</mat-option>
              @for (v of visionStrategySvc.visions(); track v.id) {
                <mat-option [value]="v.id">{{ v.title }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (canEdit()) {
            <button mat-flat-button color="primary" (click)="openDialog()">
              <mat-icon>add</mat-icon> Thêm Chiến lược
            </button>
          }
        </div>
      </div>

      @if (visionStrategySvc.isLoading() && strategies().length === 0) {
        <div class="loading">Đang tải...</div>
      } @else if (filteredStrategies().length === 0) {
        <div class="empty">
          <mat-icon>campaign</mat-icon>
          <h3>Chưa có chiến lược</h3>
          <p>{{ filterVisionId() ? 'Không có chiến lược nào thuộc tầm nhìn đã chọn.' : 'Thêm chiến lược để gắn với tầm nhìn và kỳ.' }}</p>
          @if (canEdit() && !filterVisionId()) {
            <button mat-flat-button color="primary" (click)="openDialog()">
              <mat-icon>add</mat-icon> Thêm Chiến lược
            </button>
          }
        </div>
      } @else {
        <div class="strategies-list">
          @for (s of filteredStrategies(); track s.id) {
            <div class="strategy-row">
              <div class="strategy-info">
                <span class="strategy-title">{{ s.title }}</span>
                <span class="strategy-meta">{{ visionTitle(s.vision_id) }} · {{ formatPeriod(s) }}</span>
                <span class="strategy-scope">{{ projectName(s.project_id) }}</span>
              </div>
              @if (canEdit()) {
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="openDialog(null, s)">
                    <mat-icon>edit</mat-icon> Sửa
                  </button>
                  <button mat-menu-item (click)="deleteStrategy(s)">
                    <mat-icon color="warn">delete</mat-icon> Xóa
                  </button>
                </mat-menu>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 900px; margin: 0 auto; padding-bottom: 40px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .filter-field { width: 220px; }
    .loading { padding: 48px; text-align: center; color: #64748b; }
    .empty { text-align: center; padding: 60px 24px; }
    .empty mat-icon { font-size: 56px; width: 56px; height: 56px; color: #cbd5e1; margin-bottom: 16px; }
    .empty h3 { margin: 0 0 8px; color: #475569; }
    .empty p { color: #94a3b8; margin-bottom: 20px; }
    .strategies-list { display: flex; flex-direction: column; gap: 8px; }
    .strategy-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .strategy-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
    .strategy-title { font-weight: 600; font-size: 15px; color: #334155; }
    .strategy-meta { font-size: 13px; color: #64748b; }
    .strategy-scope { font-size: 12px; color: #94a3b8; }
    .text-muted { color: #64748b; }
    .text-sm { font-size: 13px; }
  `]
})
export class StrategiesComponent implements OnInit {
  readonly visionStrategySvc = inject(VisionStrategyService);
  readonly projectSvc = inject(ProjectService);
  private dialog = inject(MatDialog);
  private confirmSvc = inject(ConfirmService);
  private snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  filterVisionId = signal<string | null>(null);
  readonly strategies = this.visionStrategySvc.strategies;
  readonly visions = this.visionStrategySvc.visions;

  readonly filteredStrategies = computed(() => {
    const fid = this.filterVisionId();
    const list = this.strategies();
    if (!fid) return list;
    return list.filter((s: Strategy) => s.vision_id === fid);
  });

  canEdit(): boolean {
    return this.auth.isDirector() || this.auth.isAdmin();
  }

  async ngOnInit(): Promise<void> {
    await this.visionStrategySvc.loadVisions();
    await this.visionStrategySvc.loadStrategies();
    this.projectSvc.loadProjects();
  }

  visionTitle(visionId: string): string {
    const v = this.visions().find(x => x.id === visionId);
    return v?.title ?? visionId;
  }

  formatPeriod(s: Strategy): string {
    if (s.period_quarter != null) return `${s.period_year}-Q${s.period_quarter}`;
    return String(s.period_year);
  }

  projectName(projectId: string | null): string {
    if (!projectId) return 'Toàn công ty';
    const p = this.projectSvc.projects().find(x => x.id === projectId);
    return p?.name ?? projectId;
  }

  openDialog(visionId?: string | null, strategy?: Strategy): void {
    const ref = this.dialog.open(StrategyFormDialogComponent, {
      width: '480px',
      data: { strategy: strategy ?? null, visionId: visionId ?? undefined },
    });
    ref.afterClosed().subscribe(async (result: any) => {
      if (!result) return;
      try {
        if (strategy) {
          await this.visionStrategySvc.updateStrategy(strategy.id, result);
          this.snackBar.open('Đã cập nhật Chiến lược.', undefined, { duration: 3000 });
        } else {
          await this.visionStrategySvc.createStrategy(result);
          this.snackBar.open('Đã thêm Chiến lược.', undefined, { duration: 3000 });
        }
      } catch (err: any) {
        console.error('Strategy save failed', err);
        this.snackBar.open(err?.message ?? 'Không thể lưu Chiến lược.', 'Đóng', { duration: 6000 });
      }
    });
  }

  async deleteStrategy(s: Strategy): Promise<void> {
    const ok = await this.confirmSvc.open({
      title: 'Xóa Chiến lược',
      message: `Xóa "${s.title}"? Objective đã gắn sẽ được bỏ liên kết (không xóa objective).`,
      confirmText: 'Xóa',
      confirmWarn: true,
    });
    if (!ok) return;
    try {
      await this.visionStrategySvc.deleteStrategy(s.id);
      this.snackBar.open('Đã xóa Chiến lược.', undefined, { duration: 3000 });
    } catch (err: any) {
      console.error('Strategy delete failed', err);
      this.snackBar.open(err?.message ?? 'Không thể xóa Chiến lược.', 'Đóng', { duration: 6000 });
    }
  }
}
