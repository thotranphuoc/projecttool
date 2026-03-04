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
import { Ksf } from '../../shared/models';
import { KsfFormDialogComponent } from './ksf-form-dialog.component';

@Component({
  selector: 'app-ksf',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatCardModule, MatMenuModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">KSF (Yếu tố thành công then chốt)</h1>
          <p class="text-muted text-sm">Luật chơi ngành — "Ngành này cần gì để thắng?". Dùng để gắn Objective tại màn Objectives và xem báo cáo theo KSF tại Big Picture.</p>
        </div>
        @if (canEdit()) {
          <button mat-flat-button color="primary" (click)="openDialog()">
            <mat-icon>add</mat-icon> Thêm KSF
          </button>
        }
      </div>

      @if (visionStrategySvc.isLoading() && ksfs().length === 0) {
        <div class="loading">Đang tải...</div>
      } @else if (ksfs().length === 0) {
        <div class="empty">
          <mat-icon>rule</mat-icon>
          <h3>Chưa có KSF nào</h3>
          <p>Thêm các yếu tố thành công then chốt (vd: Chất lượng nội dung, Quy mô audience, Tối ưu quảng cáo).</p>
          @if (canEdit()) {
            <button mat-flat-button color="primary" (click)="openDialog()">
              <mat-icon>add</mat-icon> Thêm KSF
            </button>
          }
        </div>
      } @else {
        <mat-menu #ksfMenu="matMenu">
          <button mat-menu-item (click)="onEditSelected()">
            <mat-icon>edit</mat-icon> Sửa
          </button>
          <button mat-menu-item (click)="onDeleteSelected()">
            <mat-icon color="warn">delete</mat-icon> Xóa
          </button>
        </mat-menu>
        <div class="ksf-list">
          @for (k of ksfs(); track k.id; let i = $index) {
            <div class="ksf-card card">
              <div class="ksf-header">
                <div class="ksf-title-row">
                  <div class="ksf-order">{{ i + 1 }}</div>
                  <div class="ksf-info">
                    <h2 class="ksf-label">{{ k.label }}</h2>
                    <span class="ksf-code text-muted text-sm">{{ k.code }}</span>
                    @if (k.description) {
                      <p class="ksf-desc text-muted text-sm">{{ k.description }}</p>
                    }
                  </div>
                </div>
                @if (canEdit()) {
                  <button mat-icon-button [matMenuTriggerFor]="ksfMenu" (click)="selectedKsf.set(k)">
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
    .ksf-list { display: flex; flex-direction: column; gap: 16px; }
    .ksf-card { padding: 20px; }
    .ksf-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .ksf-title-row { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
    .ksf-order { width: 36px; height: 36px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .ksf-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .ksf-label { margin: 0 0 4px; font-size: 18px; font-weight: 700; color: #0f172a; }
    .ksf-code { font-size: 13px; }
    .ksf-desc { margin: 0; white-space: pre-wrap; }
    .text-muted { color: #64748b; }
    .text-sm { font-size: 13px; }
  `]
})
export class KsfComponent implements OnInit {
  readonly visionStrategySvc = inject(VisionStrategyService);
  private dialog = inject(MatDialog);
  private confirmSvc = inject(ConfirmService);
  private snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  readonly ksfs = this.visionStrategySvc.ksfs;
  selectedKsf = signal<Ksf | null>(null);

  canEdit(): boolean {
    return this.auth.isDirector() || this.auth.isAdmin();
  }

  ngOnInit(): void {
    void this.visionStrategySvc.loadKsfs();
  }

  onEditSelected(): void {
    const k = this.selectedKsf();
    if (k) this.openDialog(k);
  }

  onDeleteSelected(): void {
    const k = this.selectedKsf();
    if (k) void this.deleteKsf(k);
  }

  openDialog(ksf?: Ksf): void {
    const ref = this.dialog.open(KsfFormDialogComponent, {
      width: '480px',
      data: { ksf: ksf ?? null },
    });
    ref.afterClosed().subscribe(async (result: { code: string; label: string; description?: string | null; sort_order: number } | undefined) => {
      if (!result) return;
      const payload = {
        code: result.code?.trim() ?? '',
        label: result.label?.trim() ?? '',
        description: result.description?.trim() || null,
        sort_order: Number(result.sort_order) || 0,
      };
      if (!payload.code || !payload.label) return;
      try {
        if (ksf) {
          await this.visionStrategySvc.updateKsf(ksf.id, payload);
          this.snackBar.open('Đã cập nhật KSF.', undefined, { duration: 3000 });
        } else {
          await this.visionStrategySvc.createKsf(payload);
          this.snackBar.open('Đã thêm KSF.', undefined, { duration: 3000 });
        }
      } catch (err: any) {
        console.error('KSF save failed', err);
        const msg = err?.message ?? err?.error_description ?? 'Không thể lưu KSF.';
        this.snackBar.open(msg, 'Đóng', { duration: 6000 });
      }
    });
  }

  async deleteKsf(k: Ksf): Promise<void> {
    const ok = await this.confirmSvc.open({
      title: 'Xóa KSF',
      message: `Xóa "${k.label}"? Objective đã gắn sẽ được bỏ liên kết (không xóa objective).`,
      confirmText: 'Xóa',
      confirmWarn: true,
    });
    if (!ok) return;
    try {
      await this.visionStrategySvc.deleteKsf(k.id);
      this.snackBar.open('Đã xóa KSF.', undefined, { duration: 3000 });
    } catch (err: any) {
      console.error('KSF delete failed', err);
      this.snackBar.open(err?.message ?? 'Không thể xóa KSF.', 'Đóng', { duration: 6000 });
    }
  }
}
