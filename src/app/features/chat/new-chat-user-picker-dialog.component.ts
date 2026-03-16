import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { AuthService } from '../../core/auth/auth.service';
import { UserService } from '../../services/user.service';
import { Profile } from '../../shared/models';

export interface NewChatUserPickerData {
  excludeIds?: string[];
}

@Component({
  selector: 'app-new-chat-user-picker-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>Chọn người để nhắn tin</h2>

      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tìm theo tên hoặc email</mat-label>
          <input matInput [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Nhập để lọc..." />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        @if (loading()) {
          <p class="text-muted">Đang tải danh sách...</p>
        } @else if (loadError()) {
          <p class="load-error">{{ loadError() }}</p>
        } @else if (filteredUsers().length === 0) {
          <p class="text-muted">Không có user nào để chọn.</p>
        } @else {
          <mat-list>
            @for (user of filteredUsers(); track user.id) {
              <mat-list-item (click)="selectUser(user)" class="user-list-item">
                @if (user.photo_url && !avatarError(user.id)) {
                  <img [src]="user.photo_url" matListItemAvatar class="list-avatar" alt="" (error)="setAvatarError(user.id)" />
                } @else {
                  <span matListItemAvatar class="list-avatar list-avatar-initial">{{ userInitial(user) }}</span>
                }
                <span matListItemTitle>{{ user.display_name || user.email || 'User' }}</span>
                <span matListItemLine class="text-muted text-xs">{{ user.email }}</span>
                <mat-icon matListItemMeta>chevron_right</mat-icon>
              </mat-list-item>
            }
          </mat-list>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Hủy</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { width: min(440px, 92vw); min-width: 0; box-sizing: border-box; }
    .full-width { width: 100%; }
    mat-dialog-content { max-height: 60vh; overflow-y: auto; }
    .user-list-item { cursor: pointer; }
    .user-list-item:hover { background: #f8fafc; }
    .list-avatar { width: 40px !important; height: 40px !important; border-radius: 50%; object-fit: cover; }
    .list-avatar-initial { display: inline-flex !important; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 14px; font-weight: 600; }
    .text-muted { color: #64748b; }
    .text-xs { font-size: 12px; }
    .load-error { color: #b91c1c; font-size: 14px; margin: 8px 0; }
  `],
})
export class NewChatUserPickerDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<NewChatUserPickerDialogComponent>);
  private auth = inject(AuthService);
  private userSvc = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  private data = inject(MAT_DIALOG_DATA, { optional: true }) as NewChatUserPickerData | undefined;

  searchQuery = signal('');
  loading = signal(true);
  users = signal<Profile[]>([]);
  private avatarErrorIds = signal<Set<string>>(new Set());

  filteredUsers = computed(() => {
    const list = this.users();
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      u =>
        (u.display_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
    );
  });

  avatarError(id: string): boolean {
    return this.avatarErrorIds().has(id);
  }

  setAvatarError(id: string): void {
    this.avatarErrorIds.update((s) => {
      const n = new Set(s);
      n.add(id);
      return n;
    });
  }

  userInitial(user: Profile): string {
    return (user.display_name || user.email || '?').charAt(0).toUpperCase();
  }

  loadError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.userSvc.loadAll();
      const uid = this.auth.userId();
      const excludeIds = new Set(this.data?.excludeIds ?? []);
      excludeIds.add(uid ?? '');
      const all = this.userSvc.users().filter((u) => !excludeIds.has(u.id));
      this.users.set(all);
    } catch (e: any) {
      console.error('[NewChatUserPicker] loadAll error:', e);
      this.loadError.set(e?.message ?? 'Không tải được danh sách. Kiểm tra đăng nhập và quyền truy cập.');
      this.users.set([]);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  selectUser(user: Profile): void {
    this.dialogRef.close(user);
  }
}
