import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild, inject, signal, NgZone } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenu } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VisionStrategyService } from '../../services/vision-strategy.service';
import { ConfirmService } from '../../services/confirm.service';
import { AuthService } from '../../core/auth/auth.service';
import { ValueChainActivity } from '../../shared/models';
import { ValueChainFormDialogComponent } from './value-chain-form-dialog.component';

@Component({
  selector: 'app-value-chain',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatCardModule, MatMenuModule, MatTooltipModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Chuỗi giá trị</h1>
          <p class="text-muted text-sm">Các giai đoạn (mắt xích) trong chuỗi giá trị. Dùng để gắn Objective tại màn Objectives và xem báo cáo theo chuỗi tại Big Picture.</p>
        </div>
        @if (auth.isAdmin()) {
          <button mat-flat-button color="primary" (click)="openDialog()">
            <mat-icon>add</mat-icon> Thêm giai đoạn
          </button>
        }
      </div>

      @if (visionStrategySvc.isLoading() && activities().length === 0) {
        <div class="loading">Đang tải...</div>
      } @else if (activities().length === 0) {
        <div class="empty">
          <mat-icon>account_tree</mat-icon>
          <h3>Chưa có giai đoạn nào</h3>
          <p>Thêm các giai đoạn chuỗi giá trị (vd: Traffic, CDP/Data, AdTech, Performance, eCommerce, AI & Loop).</p>
          @if (auth.isAdmin()) {
            <button mat-flat-button color="primary" (click)="openDialog()">
              <mat-icon>add</mat-icon> Thêm giai đoạn
            </button>
          }
        </div>
      } @else {
        <div class="list">
          @for (a of activities(); track a.id; let i = $index) {
            <div class="card activity-row">
              <div class="activity-order">{{ i + 1 }}</div>
              <div class="activity-info">
                <span class="activity-label">{{ a.label }}</span>
                <span class="activity-code text-muted text-sm">{{ a.code }}</span>
                @if (a.description?.trim()) {
                  <p class="activity-description text-muted text-sm">{{ a.description }}</p>
                }
              </div>
              @if (auth.isAdmin()) {
                <button mat-icon-button (click)="openDialog(a)" matTooltip="Sửa">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button [matMenuTriggerFor]="activityMenuRef" (click)="selectedActivity.set(a)" matTooltip="Khác">
                  <mat-icon>more_vert</mat-icon>
                </button>
              }
            </div>
          }
        </div>
        @if (auth.isAdmin()) {
          <mat-menu #activityMenuRef>
            <button mat-menu-item (click)="selectedActivity() && deleteActivity(selectedActivity()!)">
              <mat-icon color="warn">delete</mat-icon> Xóa
            </button>
          </mat-menu>
        }
      }
    </div>
  `,
  styles: [`
    .page { max-width: 720px; margin: 0 auto; padding-bottom: 40px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .loading { padding: 48px; text-align: center; color: #64748b; }
    .empty { text-align: center; padding: 60px 24px; }
    .empty mat-icon { font-size: 56px; width: 56px; height: 56px; color: #cbd5e1; margin-bottom: 16px; }
    .empty h3 { margin: 0 0 8px; color: #475569; }
    .empty p { color: #94a3b8; margin-bottom: 20px; }
    .list { display: flex; flex-direction: column; gap: 12px; }
    .activity-row { display: flex; align-items: center; gap: 16px; padding: 16px 20px; }
    .activity-order { width: 36px; height: 36px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .activity-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .activity-label { font-weight: 600; font-size: 15px; color: #0f172a; }
    .activity-code { font-size: 13px; }
    .activity-description { margin: 4px 0 0; font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
    .text-muted { color: #64748b; }
    .text-sm { font-size: 13px; }
  `]
})
export class ValueChainComponent implements OnInit {
  readonly visionStrategySvc = inject(VisionStrategyService);
  private dialog = inject(MatDialog);
  private confirmSvc = inject(ConfirmService);
  private snackBar = inject(MatSnackBar);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  readonly auth = inject(AuthService);

  readonly activities = this.visionStrategySvc.valueChainActivities;
  /** Activity selected when opening the row menu (single shared menu) */
  selectedActivity = signal<ValueChainActivity | null>(null);
  @ViewChild('activityMenuRef') activityMenuRef!: MatMenu;
  /** Queue updates so they run one after another and never overwrite each other */
  private updateQueue = Promise.resolve();

  ngOnInit(): void {
    this.visionStrategySvc.loadValueChainActivities();
  }

  openDialog(activity?: ValueChainActivity | null): void {
    const act = activity ?? null;
    const label = act ? act.label : '(Thêm mới)';
    setTimeout(() => {
      const ref = this.dialog.open(ValueChainFormDialogComponent, {
        width: '420px',
        data: { activity: act },
        restoreFocus: false,
        autoFocus: 'first-tabbable',
      });
      ref.afterClosed().subscribe((result: { code: string; label: string; description?: string | null; sort_order: number } | undefined) => {
        if (!result) return;
        if (act) {
          const id = act.id;
          const actLabel = act.label;
          const payload = { ...result };
          this.updateQueue = this.updateQueue
            .then(() => this.visionStrategySvc.updateValueChainActivity(id, payload))
            .then(() => {
              this.ngZone.run(() => {
                this.cdr.markForCheck();
                this.snackBar.open('Đã cập nhật giai đoạn.', undefined, { duration: 3000 });
              });
            })
            .catch((err: any) => {
              console.error('[ValueChain] updateValueChainActivity error', { id, actLabel, err });
              this.ngZone.run(() => {
                this.cdr.markForCheck();
                this.snackBar.open(err?.message ?? 'Không thể cập nhật.', 'Đóng', { duration: 6000 });
              });
            });
          return;
        }
        void this.visionStrategySvc.createValueChainActivity(result)
          .then(() => {
            this.snackBar.open('Đã thêm giai đoạn.', undefined, { duration: 3000 });
          })
          .catch((err: any) => {
            console.error('[ValueChain] createValueChainActivity error', err);
            this.snackBar.open(err?.message ?? 'Không thể thêm giai đoạn.', 'Đóng', { duration: 6000 });
          });
      });
    }, 0);
  }

  async deleteActivity(a: ValueChainActivity): Promise<void> {
    const ok = await this.confirmSvc.open({
      title: 'Xóa giai đoạn',
      message: `Xóa "${a.label}"? Objective đã gắn sẽ được bỏ liên kết (không xóa objective).`,
      confirmText: 'Xóa',
      confirmWarn: true,
    });
    if (!ok) return;
    try {
      await this.visionStrategySvc.deleteValueChainActivity(a.id);
      this.snackBar.open('Đã xóa giai đoạn.', undefined, { duration: 3000 });
    } catch (err: any) {
      console.error('Value chain delete failed', err);
      this.snackBar.open(err?.message ?? 'Không thể xóa giai đoạn.', 'Đóng', { duration: 6000 });
    }
  }
}
