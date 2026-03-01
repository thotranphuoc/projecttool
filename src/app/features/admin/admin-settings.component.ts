import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatButtonModule],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <h1 class="page-title">Cài đặt Chat</h1>
      </div>

      @if (chatSvc.settings(); as s) {
        <div class="card p-4 settings-card">
          <h3 class="section-title">Giao diện</h3>
          <div class="settings-row">
            <mat-form-field appearance="outline">
              <mat-label>Vị trí logo</mat-label>
              <mat-select [(ngModel)]="s.logo_position">
                <mat-option value="left">Trái</mat-option>
                <mat-option value="right">Phải</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Theme</mat-label>
              <mat-select [(ngModel)]="s.theme">
                <mat-option value="light">Sáng</mat-option>
                <mat-option value="dark">Tối</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Kích thước logo tối đa (KB)</mat-label>
              <input matInput type="number" [(ngModel)]="s.logo_max_size_kb" />
            </mat-form-field>
          </div>

          <h3 class="section-title">Tin nhắn & File</h3>
          <div class="settings-row">
            <mat-form-field appearance="outline">
              <mat-label>Xóa tin nhắn sau (ngày, 0 = không xóa)</mat-label>
              <input matInput type="number" [(ngModel)]="s.message_expiration_days" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Kích thước file tối đa (MB)</mat-label>
              <input matInput type="number" [(ngModel)]="s.max_file_size_mb" />
            </mat-form-field>
          </div>

          <h3 class="section-title">Tính năng</h3>
          <div class="toggles-row">
            <mat-slide-toggle [(ngModel)]="s.enable_file_upload">Upload file</mat-slide-toggle>
            <mat-slide-toggle [(ngModel)]="s.enable_emoji">Emoji reaction</mat-slide-toggle>
            <mat-slide-toggle [(ngModel)]="s.enable_edit">Sửa tin nhắn</mat-slide-toggle>
            <mat-slide-toggle [(ngModel)]="s.enable_delete">Xóa tin nhắn</mat-slide-toggle>
          </div>

          <div class="save-btn">
            <button mat-flat-button color="primary" (click)="save()" [disabled]="isSaving()">
              {{ isSaving() ? 'Đang lưu...' : 'Lưu cài đặt' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .settings-page { max-width: 720px; margin: 0 auto; }
    .settings-card { display: flex; flex-direction: column; gap: 16px; }
    .section-title { font-weight: 700; font-size: 15px; margin: 8px 0 12px; color: #374151; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .settings-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .settings-row mat-form-field { flex: 1; min-width: 200px; }
    .toggles-row { display: flex; gap: 24px; flex-wrap: wrap; }
    .save-btn { display: flex; justify-content: flex-end; margin-top: 8px; }
  `]
})
export class AdminSettingsComponent implements OnInit {
  readonly chatSvc = inject(ChatService);
  private snackBar = inject(MatSnackBar);
  isSaving         = signal(false);

  ngOnInit(): void { this.chatSvc.loadSettings(); }

  async save(): Promise<void> {
    this.isSaving.set(true);
    const s = this.chatSvc.settings();
    if (s) await this.chatSvc.updateSettings(s);
    this.snackBar.open('Đã lưu cài đặt', '', { duration: 2000 });
    this.isSaving.set(false);
  }
}
