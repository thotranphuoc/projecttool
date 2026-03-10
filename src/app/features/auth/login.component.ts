import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
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
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <mat-icon class="logo-icon">sync_alt</mat-icon>
          <h1>Sync2Scale</h1>
          <p class="slogan">{{ slogan }}</p>
          <p>{{ mode() === 'login' ? 'Đăng nhập để tiếp tục' : mode() === 'register' ? 'Tạo tài khoản mới' : 'Khôi phục mật khẩu' }}</p>
        </div>

        <form (ngSubmit)="submitForm()">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" [(ngModel)]="email" name="email" required placeholder="your@email.com" />
            <mat-icon matSuffix>email</mat-icon>
          </mat-form-field>

          @if (mode() !== 'forgot') {
          <mat-form-field appearance="outline">
            <mat-label>Mật khẩu</mat-label>
            <input matInput [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" name="password" [required]="mode() === 'login'" />
            <button mat-icon-button matSuffix type="button" (click)="showPassword.update(v => !v)">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>
          }

          @if (mode() === 'register') {
            <mat-form-field appearance="outline">
              <mat-label>Xác nhận mật khẩu</mat-label>
              <input matInput [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="confirmPassword" name="confirmPassword" required />
              <mat-icon matSuffix>lock</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Họ và tên</mat-label>
              <input matInput type="text" [(ngModel)]="displayName" name="displayName" required placeholder="Nguyễn Văn A" />
              <mat-icon matSuffix>person</mat-icon>
            </mat-form-field>
          }

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
              {{ mode() === 'login' ? 'Đăng nhập' : mode() === 'register' ? 'Tạo tài khoản' : 'Gửi link khôi phục' }}
            }
          </button>
        </form>

        <p class="register-link">
          @if (mode() === 'forgot') {
            <a (click)="mode.set('login'); errorMsg.set('')">Quay lại đăng nhập</a>
          } @else {
            {{ mode() === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?' }}
            <a (click)="mode.update(v => v === 'login' ? 'register' : 'login'); errorMsg.set('')">
              {{ mode() === 'login' ? 'Đăng ký ngay' : 'Đăng nhập' }}
            </a>
          }
        </p>
        @if (mode() === 'login') {
        <p class="forgot-link">
          <a (click)="mode.set('forgot'); errorMsg.set('')">Quên mật khẩu?</a>
        </p>
        }
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      padding: 16px;
    }
    .login-card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .login-logo { text-align: center; margin-bottom: 32px; }
    .logo-icon { font-size: 52px; width: 52px; height: 52px; color: #3b82f6; display: block; margin: 0 auto 8px; }
    .login-logo h1 { margin: 0 0 4px; font-size: 28px; font-weight: 800; color: #0f172a; }
    .login-logo .slogan { margin: 0; font-size: 15px; font-weight: 600; color: #3b82f6; letter-spacing: 0.3px; }
    .login-logo p  { margin: 4px 0 0; color: #64748b; font-size: 14px; }
    form { display: flex; flex-direction: column; }
    mat-form-field { width: 100%; margin-bottom: 4px; }
    .submit-btn { height: 46px; border-radius: 8px !important; font-size: 15px; font-weight: 600; margin-top: 8px; display: flex; align-items: center; justify-content: center; }
    .register-link { text-align: center; margin-top: 20px; font-size: 14px; color: #64748b; }
    .register-link a { color: #3b82f6; cursor: pointer; font-weight: 600; }
    .forgot-link { text-align: center; margin-top: 8px; font-size: 13px; }
    .forgot-link a { color: #64748b; cursor: pointer; }
    .forgot-link a:hover { color: #3b82f6; text-decoration: underline; }
    .error-msg { display: flex; align-items: center; gap: 8px; color: #dc2626; font-size: 13px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
    .error-msg mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    /* ensure suffix icons are visible and not clipped */
    ::ng-deep .mat-mdc-form-field-icon-suffix { padding: 0 4px; overflow: visible; }
    ::ng-deep .mat-mdc-form-field-icon-suffix mat-icon { color: #94a3b8; }
  `]
})
export class LoginComponent {
  readonly slogan = APP_SLOGAN;
  private auth     = inject(AuthService);
  private router   = inject(Router);
  private route    = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  email           = '';
  password        = '';
  confirmPassword = '';
  displayName     = '';
  isLoading       = signal(false);
  showPassword    = signal(false);
  errorMsg        = signal('');
  mode            = signal<'login' | 'register' | 'forgot'>('login');

  async submitForm(): Promise<void> {
    this.errorMsg.set('');

    if (!this.email.trim()) {
      this.errorMsg.set('Vui lòng nhập email.');
      return;
    }

    if (this.mode() === 'forgot') {
      this.isLoading.set(true);
      try {
        const { error } = await this.auth.resetPasswordForEmail(this.email.trim());
        if (error) {
          this.errorMsg.set(error.message || 'Không thể gửi email. Thử lại sau.');
        } else {
          this.snackBar.open(
            'Đã gửi link khôi phục mật khẩu đến email của bạn. Kiểm tra hộp thư (và thư mục spam).',
            'Đóng',
            { duration: 6000 }
          );
          this.mode.set('login');
        }
      } catch (e: any) {
        this.errorMsg.set(e?.message || 'Đã có lỗi xảy ra.');
      } finally {
        this.isLoading.set(false);
      }
      return;
    }

    if (!this.password) {
      this.errorMsg.set('Vui lòng nhập mật khẩu.');
      return;
    }

    if (this.mode() === 'register') {
      if (this.password.length < 6) {
        this.errorMsg.set('Mật khẩu phải có ít nhất 6 ký tự.');
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.errorMsg.set('Mật khẩu xác nhận không khớp.');
        return;
      }
      if (!this.displayName.trim()) {
        this.errorMsg.set('Vui lòng nhập họ và tên.');
        return;
      }
    }

    this.isLoading.set(true);
    try {
      if (this.mode() === 'login') {
        await this.auth.signInWithPassword(this.email, this.password);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      } else {
        await this.auth.signUp(this.email, this.password, this.displayName.trim());
        this.snackBar.open(
          'Tài khoản đã tạo! Kiểm tra email để xác thực rồi đăng nhập lại.',
          'Đóng',
          { duration: 7000 }
        );
        this.mode.set('login');
        this.password = '';
        this.confirmPassword = '';
      }
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('Invalid login credentials')) {
        this.errorMsg.set('Email hoặc mật khẩu không đúng.');
      } else if (msg.includes('User already registered')) {
        this.errorMsg.set('Email này đã được đăng ký. Hãy đăng nhập.');
      } else if (msg.includes('Email not confirmed')) {
        this.errorMsg.set('Email chưa được xác thực. Kiểm tra hộp thư của bạn.');
      } else {
        this.errorMsg.set(msg || 'Đã có lỗi xảy ra, thử lại sau.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
