import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VisionStrategyService } from '../../services/vision-strategy.service';
import { ProjectService } from '../../services/project.service';
import { ConfirmService } from '../../services/confirm.service';
import { AuthService } from '../../core/auth/auth.service';
import { Vision, Strategy } from '../../shared/models';
import { VisionFormDialogComponent } from './vision-form-dialog.component';
import { StrategyFormDialogComponent } from './strategy-form-dialog.component';

@Component({
  selector: 'app-vision-strategy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatCardModule, MatMenuModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Tầm nhìn & Chiến lược</h1>
          <p class="text-muted text-sm">Quản lý tầm nhìn và chiến lược theo kỳ; gắn Objective vào Chiến lược tại màn Objectives.</p>
        </div>
        @if (canEditVision()) {
          <button mat-flat-button color="primary" (click)="openVisionDialog()">
            <mat-icon>add</mat-icon> Thêm Tầm nhìn
          </button>
        }
      </div>

      @if (visionStrategySvc.isLoading() && visions().length === 0) {
        <div class="loading">Đang tải...</div>
      } @else if (visions().length === 0) {
        <div class="empty">
          <mat-icon>visibility</mat-icon>
          <h3>Chưa có tầm nhìn nào</h3>
          <p>Thêm tầm nhìn để bắt đầu định nghĩa chiến lược theo kỳ.</p>
          @if (canEditVision()) {
            <button mat-flat-button color="primary" (click)="openVisionDialog()">
              <mat-icon>add</mat-icon> Thêm Tầm nhìn
            </button>
          }
        </div>
      } @else {
        <div class="visions-list">
          @for (v of visions(); track v.id) {
            <div class="vision-card card">
              <div class="vision-header">
                <div class="vision-title-row">
                  <mat-icon class="vision-icon">visibility</mat-icon>
                  <div>
                    <h2 class="vision-title">{{ v.title }}</h2>
                    @if (v.description) {
                      <p class="vision-desc text-muted text-sm">{{ v.description }}</p>
                    }
                  </div>
                </div>
                @if (canEditVision()) {
                  <button mat-icon-button [matMenuTriggerFor]="visionMenu">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #visionMenu="matMenu">
                    <button mat-menu-item (click)="openVisionDialog(v)">
                      <mat-icon>edit</mat-icon> Sửa
                    </button>
                    <button mat-menu-item (click)="deleteVision(v)">
                      <mat-icon color="warn">delete</mat-icon> Xóa
                    </button>
                  </mat-menu>
                }
              </div>

              <div class="strategies-section">
                <div class="strategies-header">
                  <span class="strategies-label">Chiến lược</span>
                  @if (canEditStrategy()) {
                    <button mat-stroked-button (click)="openStrategyDialog(v.id)">
                      <mat-icon>add</mat-icon> Thêm Chiến lược
                    </button>
                  }
                </div>
                @if (strategiesByVision(v.id).length === 0) {
                  <div class="strategies-empty text-muted text-sm">Chưa có chiến lược. Nhấn "Thêm Chiến lược" để thêm.</div>
                } @else {
                  <div class="strategies-list">
                    @for (s of strategiesByVision(v.id); track s.id) {
                      <div class="strategy-row">
                        <div class="strategy-info">
                          <span class="strategy-title">{{ s.title }}</span>
                          <span class="strategy-period">{{ formatPeriod(s) }}</span>
                          <span class="strategy-scope">{{ projectName(s.project_id) }}</span>
                        </div>
                        @if (canEditStrategy()) {
                          <button mat-icon-button [matMenuTriggerFor]="strategyMenu">
                            <mat-icon>more_vert</mat-icon>
                          </button>
                          <mat-menu #strategyMenu="matMenu">
                            <button mat-menu-item (click)="openStrategyDialog(null, s)">
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
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 900px; margin: 0 auto; padding-bottom: 40px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .loading { padding: 48px; text-align: center; color: #64748b; }
    .empty { text-align: center; padding: 60px 24px; }
    .empty mat-icon { font-size: 56px; width: 56px; height: 56px; color: #cbd5e1; margin-bottom: 16px; }
    .empty h3 { margin: 0 0 8px; color: #475569; }
    .empty p { color: #94a3b8; margin-bottom: 20px; }
    .visions-list { display: flex; flex-direction: column; gap: 20px; }
    .vision-card { padding: 20px; }
    .vision-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 16px; }
    .vision-title-row { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
    .vision-icon { color: #3b82f6; font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; margin-top: 2px; }
    .vision-title { margin: 0 0 4px; font-size: 18px; font-weight: 700; color: #0f172a; }
    .vision-desc { margin: 0; white-space: pre-wrap; }
    .strategies-section { border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .strategies-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .strategies-label { font-weight: 600; font-size: 14px; color: #475569; }
    .strategies-empty { padding: 12px 0; }
    .strategies-list { display: flex; flex-direction: column; gap: 4px; }
    .strategy-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .strategy-info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 1; min-width: 0; }
    .strategy-title { font-weight: 600; font-size: 14px; color: #334155; }
    .strategy-period { font-size: 13px; color: #64748b; }
    .strategy-scope { font-size: 12px; color: #94a3b8; }
    .text-muted { color: #64748b; }
    .text-sm { font-size: 13px; }
  `]
})
export class VisionStrategyComponent implements OnInit {
  readonly visionStrategySvc = inject(VisionStrategyService);
  readonly projectSvc = inject(ProjectService);
  private dialog = inject(MatDialog);
  private confirmSvc = inject(ConfirmService);
  private snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  readonly visions = this.visionStrategySvc.visions;
  readonly strategies = this.visionStrategySvc.strategies;

  readonly strategiesByVision = (visionId: string) =>
    this.strategies().filter((s: Strategy) => s.vision_id === visionId);

  canEditVision(): boolean {
    return this.auth.isDirector() || this.auth.isAdmin();
  }

  canEditStrategy(): boolean {
    return this.auth.isDirector() || this.auth.isAdmin() || true;
  }

  async ngOnInit(): Promise<void> {
    await this.visionStrategySvc.loadVisions();
    await this.visionStrategySvc.loadStrategies();
    this.projectSvc.loadProjects();
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

  openVisionDialog(vision?: Vision): void {
    const ref = this.dialog.open(VisionFormDialogComponent, {
      width: '480px',
      data: { vision: vision ?? null },
    });
    ref.afterClosed().subscribe(async (result: typeof ref.componentInstance['form'] | undefined) => {
      if (!result) return;
      try {
        if (vision) {
          await this.visionStrategySvc.updateVision(vision.id, result);
          this.snackBar.open('Đã cập nhật Tầm nhìn.', undefined, { duration: 3000 });
        } else {
          await this.visionStrategySvc.createVision(result);
          this.snackBar.open('Đã thêm Tầm nhìn.', undefined, { duration: 3000 });
        }
      } catch (err: any) {
        this.snackBar.open(err?.message ?? 'Không thể lưu Tầm nhìn.', 'Đóng', { duration: 6000 });
      }
    });
  }

  openStrategyDialog(visionId?: string | null, strategy?: Strategy): void {
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
        this.snackBar.open(err?.message ?? 'Không thể lưu Chiến lược.', 'Đóng', { duration: 6000 });
      }
    });
  }

  async deleteVision(v: Vision): Promise<void> {
    const ok = await this.confirmSvc.open({
      title: 'Xóa Tầm nhìn',
      message: `Xóa "${v.title}"? Các chiến lược thuộc tầm nhìn này cũng sẽ bị xóa.`,
      confirmText: 'Xóa',
      confirmWarn: true,
    });
    if (!ok) return;
    try {
      await this.visionStrategySvc.deleteVision(v.id);
      this.snackBar.open('Đã xóa Tầm nhìn.', undefined, { duration: 3000 });
    } catch (err: any) {
      this.snackBar.open(err?.message ?? 'Không thể xóa Tầm nhìn.', 'Đóng', { duration: 6000 });
    }
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
      this.snackBar.open(err?.message ?? 'Không thể xóa Chiến lược.', 'Đóng', { duration: 6000 });
    }
  }
}
