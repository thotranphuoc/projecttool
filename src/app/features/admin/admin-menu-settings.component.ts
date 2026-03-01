import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppSettingsService } from '../../services/app-settings.service';
import { NAV_ITEMS } from '../../app.constants';

@Component({
  selector: 'app-admin-menu-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatSlideToggleModule, MatButtonModule],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <h1 class="page-title">Hiển thị menu</h1>
        <button mat-stroked-button (click)="showAll()" [disabled]="isSaving()">
          Hiện tất cả
        </button>
      </div>

      <div class="card p-4 settings-card">
        <p class="section-desc">Bật/tắt từng mục trong sidebar. Ẩn mục sẽ không hiện với mọi user (trừ khi truy cập trực tiếp qua URL).</p>
        <ul class="menu-list">
          @for (item of navItems; track item.route) {
            <li class="menu-row">
              <span class="menu-label">{{ item.label }}</span>
              <mat-slide-toggle
                [checked]="isVisible(item.route)"
                (change)="onToggle(item.route, $event.checked)">
              </mat-slide-toggle>
            </li>
          }
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .settings-page { max-width: 640px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .page-title { margin: 0; font-size: 1.5rem; }
    .settings-card { display: flex; flex-direction: column; gap: 16px; }
    .section-desc { margin: 0; color: #64748b; font-size: 14px; }
    .menu-list { list-style: none; margin: 0; padding: 0; }
    .menu-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
    .menu-row:last-child { border-bottom: none; }
    .menu-label { font-weight: 500; font-size: 14px; }
  `]
})
export class AdminMenuSettingsComponent implements OnInit {
  readonly navItems = NAV_ITEMS;
  private appSettingsSvc = inject(AppSettingsService);
  private snackBar = inject(MatSnackBar);
  isSaving = signal(false);

  readonly isVisible = (route: string): boolean => this.appSettingsSvc.menuVisibility()[route] !== false;

  ngOnInit(): void {
    this.appSettingsSvc.loadAppSettings();
  }

  async onToggle(route: string, visible: boolean): Promise<void> {
    this.isSaving.set(true);
    try {
      await this.appSettingsSvc.updateMenuVisibility(route, visible);
      this.snackBar.open(visible ? 'Đã hiện mục menu' : 'Đã ẩn mục menu', '', { duration: 2000 });
    } finally {
      this.isSaving.set(false);
    }
  }

  async showAll(): Promise<void> {
    this.isSaving.set(true);
    try {
      await this.appSettingsSvc.setAllMenuVisible(this.navItems.map(i => i.route));
      this.snackBar.open('Đã hiện tất cả mục menu', '', { duration: 2000 });
    } finally {
      this.isSaving.set(false);
    }
  }
}
