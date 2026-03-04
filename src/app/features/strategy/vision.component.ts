import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VisionStrategyService } from '../../services/vision-strategy.service';
import { ConfirmService } from '../../services/confirm.service';
import { AuthService } from '../../core/auth/auth.service';
import { Vision } from '../../shared/models';
import { VisionFormDialogComponent } from './vision-form-dialog.component';

@Component({
  selector: 'app-vision',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatCardModule, MatMenuModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Tầm nhìn</h1>
          <p class="text-muted text-sm">Tầng Định hướng — Xác định tương lai. Quản lý tầm nhìn; Chiến lược gắn với tầm nhìn tại màn Chiến lược.</p>
        </div>
        @if (canEdit()) {
          <button mat-flat-button color="primary" (click)="openDialog()">
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
          @if (canEdit()) {
            <button mat-flat-button color="primary" (click)="openDialog()">
              <mat-icon>add</mat-icon> Thêm Tầm nhìn
            </button>
          }
        </div>
      } @else {
        <mat-menu #visionMenu="matMenu">
          <button mat-menu-item (click)="onEditSelected()">
            <mat-icon>edit</mat-icon> Sửa
          </button>
          <button mat-menu-item (click)="onDeleteSelected()">
            <mat-icon color="warn">delete</mat-icon> Xóa
          </button>
        </mat-menu>
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
                @if (canEdit()) {
                  <button mat-icon-button [matMenuTriggerFor]="visionMenu" (click)="selectedVision.set(v)">
                    <mat-icon>more_vert</mat-icon>
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
    .page { max-width: 720px; margin: 0 auto; padding-bottom: 40px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .page-title { margin: 0 0 4px; font-size: 22px; font-weight: 700; color: #0f172a; }
    .loading { padding: 48px; text-align: center; color: #64748b; }
    .empty { text-align: center; padding: 60px 24px; }
    .empty mat-icon { font-size: 56px; width: 56px; height: 56px; color: #cbd5e1; margin-bottom: 16px; }
    .empty h3 { margin: 0 0 8px; color: #475569; }
    .empty p { color: #94a3b8; margin-bottom: 20px; }
    .visions-list { display: flex; flex-direction: column; gap: 16px; }
    .vision-card { padding: 20px; }
    .vision-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .vision-title-row { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
    .vision-icon { color: #3b82f6; font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; margin-top: 2px; }
    .vision-title { margin: 0 0 4px; font-size: 18px; font-weight: 700; color: #0f172a; }
    .vision-desc { margin: 0; white-space: pre-wrap; }
    .text-muted { color: #64748b; }
    .text-sm { font-size: 13px; }
  `]
})
export class VisionComponent implements OnInit {
  readonly visionStrategySvc = inject(VisionStrategyService);
  private dialog = inject(MatDialog);
  private confirmSvc = inject(ConfirmService);
  private snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  readonly visions = this.visionStrategySvc.visions;
  /** Vision selected when opening the row menu (for Sửa/Xóa) */
  selectedVision = signal<Vision | null>(null);

  canEdit(): boolean {
    return this.auth.isDirector() || this.auth.isAdmin();
  }

  ngOnInit(): void {
    void this.visionStrategySvc.loadVisions();
  }

  onEditSelected(): void {
    const v = this.selectedVision();
    if (v) this.openDialog(v);
  }

  onDeleteSelected(): void {
    const v = this.selectedVision();
    if (v) void this.deleteVision(v);
  }

  openDialog(vision?: Vision): void {
    const ref = this.dialog.open(VisionFormDialogComponent, {
      width: '480px',
      data: { vision: vision ?? null },
    });
    ref.afterClosed().subscribe(async (result: { title: string; description: string | null; sort_order: number } | undefined) => {
      if (!result) return;
      const dto = { title: result.title.trim(), description: result.description?.trim() || null, sort_order: result.sort_order ?? 0 };
      try {
        if (vision) {
          await this.visionStrategySvc.updateVision(vision.id, dto);
          this.snackBar.open('Đã cập nhật Tầm nhìn.', undefined, { duration: 3000 });
        } else {
          await this.visionStrategySvc.createVision(dto);
          this.snackBar.open('Đã thêm Tầm nhìn.', undefined, { duration: 3000 });
        }
      } catch (err: any) {
        console.error('Vision save failed', err);
        this.snackBar.open(err?.message ?? 'Không thể lưu Tầm nhìn.', 'Đóng', { duration: 6000 });
      }
    });
  }

  async deleteVision(v: Vision): Promise<void> {
    const ok = await this.confirmSvc.open({
      title: 'Xóa Tầm nhìn',
      message: `Xóa "${v.title}"? Các chiến lược thuộc tầm nhìn này sẽ bị ảnh hưởng (có thể bỏ liên kết).`,
      confirmText: 'Xóa',
      confirmWarn: true,
    });
    if (!ok) return;
    try {
      await this.visionStrategySvc.deleteVision(v.id);
      this.snackBar.open('Đã xóa Tầm nhìn.', undefined, { duration: 3000 });
    } catch (err: any) {
      console.error('Vision delete failed', err);
      this.snackBar.open(err?.message ?? 'Không thể xóa Tầm nhìn.', 'Đóng', { duration: 6000 });
    }
  }
}
