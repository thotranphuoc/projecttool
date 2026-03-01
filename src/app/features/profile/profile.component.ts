import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="profile-page">
      <div class="page-header">
        <h1 class="page-title">Profile</h1>
      </div>

      <div class="profile-card">
        <!-- Avatar + info -->
        <div class="avatar-section">
          <div class="avatar-wrapper">
            @if (avatarUrl()) {
              <img [src]="avatarUrl()!" class="avatar-img" alt="avatar"
                   (error)="onImgError()" />
            } @else {
              <div class="avatar-initial" [style.background]="avatarColor()">
                {{ initial() }}
              </div>
            }

            <!-- upload overlay -->
            <label class="avatar-overlay" [class.loading]="isUploading()">
              @if (isUploading()) {
                <mat-spinner diameter="24" />
              } @else {
                <mat-icon>photo_camera</mat-icon>
                <span>Đổi ảnh</span>
              }
              <input type="file" accept="image/png,image/jpeg,image/webp"
                     (change)="onFileChange($event)" hidden [disabled]="isUploading()" />
            </label>
          </div>

          <div class="profile-info">
            <h2>{{ auth.profile()?.display_name || 'Chưa đặt tên' }}</h2>
            <p>{{ auth.profile()?.email }}</p>
            <span class="role-badge" [class]="'role-' + auth.systemRole()">
              {{ roleLabel() }}
            </span>
          </div>
        </div>

        <!-- Form -->
        <div class="form-section">
          <mat-form-field appearance="outline" class="full-field">
            <mat-label>Tên hiển thị</mat-label>
            <input matInput [(ngModel)]="displayName" placeholder="Nguyễn Văn A" />
            <mat-icon matSuffix>person</mat-icon>
          </mat-form-field>

          @if (errorMsg()) {
            <div class="error-msg">
              <mat-icon>error_outline</mat-icon>{{ errorMsg() }}
            </div>
          }

          <div class="form-actions">
            <button mat-flat-button color="primary" (click)="save()" [disabled]="isSaving()">
              @if (isSaving()) { <mat-spinner diameter="18" /> }
              @else { Lưu thay đổi }
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-page { max-width: 600px; margin: 0 auto; }

    .profile-card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
    }

    /* Avatar */
    .avatar-section { display: flex; align-items: center; gap: 24px; margin-bottom: 32px; }

    .avatar-wrapper {
      position: relative;
      width: 100px; height: 100px;
      border-radius: 50%;
      flex-shrink: 0;
      cursor: pointer;
    }
    .avatar-wrapper:hover .avatar-overlay { opacity: 1; }

    .avatar-img {
      width: 100px; height: 100px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid #e2e8f0;
      display: block;
    }

    .avatar-initial {
      width: 100px; height: 100px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 36px; font-weight: 700; color: white;
      border: 3px solid transparent;
      user-select: none;
    }

    .avatar-overlay {
      position: absolute; inset: 0;
      border-radius: 50%;
      background: rgba(0,0,0,0.45);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px;
      color: white;
      opacity: 0;
      transition: opacity 0.2s;
      cursor: pointer;
    }
    .avatar-overlay.loading { opacity: 1; }
    .avatar-overlay mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .avatar-overlay span { font-size: 11px; font-weight: 600; }

    /* Info */
    .profile-info h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #0f172a; }
    .profile-info p  { margin: 0 0 10px; font-size: 14px; color: #64748b; }

    .role-badge {
      display: inline-block;
      padding: 3px 12px; border-radius: 999px;
      font-size: 12px; font-weight: 600;
    }
    .role-admin    { background: #fef3c7; color: #92400e; }
    .role-director { background: #ede9fe; color: #5b21b6; }
    .role-user     { background: #dbeafe; color: #1d4ed8; }

    /* Form */
    .form-section { border-top: 1px solid #f1f5f9; padding-top: 24px; }
    .full-field { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
    .form-actions button { min-width: 130px; height: 40px; display: flex; align-items: center; justify-content: center; gap: 8px; }

    .error-msg {
      display: flex; align-items: center; gap: 8px;
      color: #dc2626; font-size: 13px;
      background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;
    }
    .error-msg mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
  `]
})
export class ProfileComponent {
  readonly auth    = inject(AuthService);
  private userSvc  = inject(UserService);
  private snackBar = inject(MatSnackBar);

  displayName  = this.auth.profile()?.display_name ?? '';
  isSaving     = signal(false);
  isUploading  = signal(false);
  errorMsg     = signal('');
  // track avatar separately so it updates immediately after upload
  private uploadedUrl = signal<string | null>(null);

  readonly avatarUrl = computed(() =>
    this.uploadedUrl() ?? this.auth.profile()?.photo_url ?? null
  );

  readonly initial = computed(() => {
    const name = this.auth.profile()?.display_name ?? this.auth.profile()?.email ?? '?';
    return name.charAt(0).toUpperCase();
  });

  readonly avatarColor = computed(() => {
    const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];
    const name   = this.auth.profile()?.email ?? 'A';
    const idx    = name.charCodeAt(0) % colors.length;
    return colors[idx];
  });

  readonly roleLabel = computed(() => {
    const r = this.auth.systemRole();
    return r === 'admin' ? 'Admin' : r === 'director' ? 'Director' : 'User';
  });

  onImgError(): void {
    // clear broken URL so fallback initial shows
    this.uploadedUrl.set(null);
    this.auth.updateProfile({ photo_url: undefined as any });
  }

  async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file || !this.auth.userId()) return;

    // validate size (max 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      this.snackBar.open('Ảnh không được lớn hơn 2 MB', 'Đóng', { duration: 3000 });
      return;
    }

    this.isUploading.set(true);
    this.errorMsg.set('');
    try {
      const url = await this.userSvc.uploadAvatar(file, this.auth.userId()!);
      // append cache-buster so browser fetches new image
      const busted = `${url}?t=${Date.now()}`;
      this.uploadedUrl.set(busted);
      await this.auth.updateProfile({ photo_url: busted });
      this.snackBar.open('Đã cập nhật ảnh đại diện', '', { duration: 2000 });
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'Upload ảnh thất bại');
    } finally {
      this.isUploading.set(false);
      input.value = ''; // reset so same file can be re-selected
    }
  }

  async save(): Promise<void> {
    if (!this.displayName.trim()) return;
    this.isSaving.set(true);
    this.errorMsg.set('');
    try {
      await this.auth.updateProfile({ display_name: this.displayName.trim() });
      this.snackBar.open('Đã lưu thay đổi', '', { duration: 2000 });
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'Lưu thất bại');
    } finally {
      this.isSaving.set(false);
    }
  }
}
