import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { APP_SLOGAN } from '../../app.constants';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="reset-page">
      <div class="reset-card">
        <div class="reset-logo">
          <mat-icon class="logo-icon">sync_alt</mat-icon>
          <h1>Đặt mật khẩu mới</h1>
          <p class="slogan">{{ slogan }}</p>
          <p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
        </div>

        @if (ready()) {
        <form (ngSubmit)="submitForm()">
          <mat-form-field appearance="outline">
            <mat-label>Mật khẩu mới</mat-label>
            <input matInput [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" name="password" required minlength="6" />
            <button mat-icon-button matSuffix type="button" (click)="showPassword.update(v => !v)">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Xác nhận mật khẩu</mat-label>
            <input matInput [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="confirmPassword" name="confirmPassword" required />
            <mat-icon matSuffix>lock</mat-icon>
          </mat-form-field>

          @if (errorMsg()) {
            <div class="error-msg">
              <mat-icon>error_outline</mat-icon>
              {{ errorMsg() }}
            </div>
          }

          <button mat-flat-button color="primary" type="submit" class="submit-btn" [disabled]="isLoading()">
            @if (isLoading()) {
              <mat-spinner diameter="20" />
            } @else {
              Đặt mật khẩu
            }
          </button>
        </form>
        } @else if (checking()) {
          <div class="checking-msg">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Đang xử lý...</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .reset-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      padding: 16px;
    }
    .reset-card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .reset-logo { text-align: center; margin-bottom: 32px; }
    .logo-icon { font-size: 52px; width: 52px; height: 52px; color: #3b82f6; display: block; margin: 0 auto 8px; }
    .reset-logo h1 { margin: 0 0 4px; font-size: 24px; font-weight: 800; color: #0f172a; }
    .reset-logo .slogan { margin: 0; font-size: 14px; font-weight: 600; color: #3b82f6; }
    .reset-logo p { margin: 4px 0 0; color: #64748b; font-size: 14px; }
    form { display: flex; flex-direction: column; }
    mat-form-field { width: 100%; margin-bottom: 4px; }
    .submit-btn { height: 46px; border-radius: 8px !important; font-size: 15px; font-weight: 600; margin-top: 8px; display: flex; align-items: center; justify-content: center; }
    .error-msg { display: flex; align-items: center; gap: 8px; color: #dc2626; font-size: 13px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
    .error-msg mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .checking-msg { text-align: center; padding: 32px; }
    .checking-msg p { margin: 16px 0 0; color: #64748b; font-size: 14px; }
    ::ng-deep .mat-mdc-form-field-icon-suffix { padding: 0 4px; overflow: visible; }
    ::ng-deep .mat-mdc-form-field-icon-suffix mat-icon { color: #94a3b8; }
  `]
})
export class ResetPasswordComponent implements OnInit {
  readonly slogan = APP_SLOGAN;
  private auth = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  password = '';
  confirmPassword = '';
  isLoading = signal(false);
  showPassword = signal(false);
  errorMsg = signal('');
  ready = signal(false);
  checking = signal(true);

  ngOnInit(): void {
    this.checkSession();
  }

  private async checkSession(): Promise<void> {
    // Supabase xử lý hash từ link email và tạo session. Chờ để đảm bảo session đã có.
    await new Promise(r => setTimeout(r, 500));
    const hasSession = this.auth.isAuthenticated();
    this.checking.set(false);
    if (!hasSession) {
      this.snackBar.open('Link khôi phục không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.', 'Đóng', { duration: 5000 });
      this.router.navigate(['/login']);
    } else {
      this.ready.set(true);
    }
  }

  async submitForm(): Promise<void> {
    this.errorMsg.set('');

    if (this.password.length < 6) {
      this.errorMsg.set('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMsg.set('Mật khẩu xác nhận không khớp.');
      return;
    }

    this.isLoading.set(true);
    try {
      const { error } = await this.auth.updatePassword(this.password);
      if (error) {
        this.errorMsg.set(error.message || 'Không thể đặt mật khẩu. Thử lại sau.');
      } else {
        this.snackBar.open('Đã đặt mật khẩu mới thành công.', '', { duration: 3000 });
        this.router.navigate(['/dashboard']);
      }
    } catch (e: any) {
      this.errorMsg.set(e?.message || 'Đã có lỗi xảy ra.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
