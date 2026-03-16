import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AuthService } from '../../core/auth/auth.service';
import { UserService } from '../../services/user.service';
import { Profile } from '../../shared/models';

export interface NewGroupResult {
  name: string;
  memberIds: string[];
}

@Component({
  selector: 'app-new-group-dialog',
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
    MatCheckboxModule,
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>Tạo nhóm chat</h2>

      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tên nhóm *</mat-label>
          <input matInput [ngModel]="groupName()" (ngModelChange)="groupName.set($event)" placeholder="Ví dụ: Team Marketing" />
        </mat-form-field>

        <h4 class="section-label">Thêm thành viên (tùy chọn)</h4>
        @if (loading()) {
          <p class="text-muted">Đang tải danh sách...</p>
        } @else if (users().length === 0) {
          <p class="text-muted">Không có user nào để thêm.</p>
        } @else {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Tìm theo tên hoặc email</mat-label>
            <input matInput [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Nhập để lọc..." />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          <div class="user-list">
            @for (user of filteredUsers(); track user.id) {
              <label class="user-row">
                <mat-checkbox [checked]="selectedIds().includes(user.id)" (change)="toggleUser(user.id)" />
                @if (user.photo_url && !avatarError(user.id)) {
                  <img [src]="user.photo_url" class="row-avatar" alt="" (error)="setAvatarError(user.id)" />
                } @else {
                  <span class="row-avatar row-avatar-initial">{{ userInitial(user) }}</span>
                }
                <div class="row-info">
                  <span class="row-name">{{ user.display_name || user.email || 'User' }}</span>
                  <span class="row-email text-xs">{{ user.email }}</span>
                </div>
              </label>
            }
          </div>
          @if (selectedIds().length > 0) {
            <p class="text-muted text-sm">Đã chọn {{ selectedIds().length }} thành viên</p>
          }
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Hủy</button>
        <button mat-flat-button color="primary" [disabled]="!groupName().trim()" (click)="submit()">
          Tạo nhóm
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { width: min(440px, 92vw); min-width: 0; box-sizing: border-box; }
    .full-width { width: 100%; }
    mat-dialog-content { max-height: 65vh; overflow-y: auto; }
    .section-label { margin: 12px 0 8px; font-size: 13px; font-weight: 600; color: #475569; }
    .user-list { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .user-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; transition: background 0.15s; }
    .user-row:hover { background: #f8fafc; }
    .row-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; object-fit: cover; }
    .row-avatar-initial { display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 14px; font-weight: 600; }
    .row-info { flex: 1; min-width: 0; }
    .row-name { display: block; font-weight: 500; font-size: 14px; }
    .row-email { color: #64748b; }
    .text-muted { color: #64748b; }
    .text-xs { font-size: 12px; }
    .text-sm { font-size: 13px; margin-top: 8px; }
  `],
})
export class NewGroupDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<NewGroupDialogComponent>);
  private auth = inject(AuthService);
  private userSvc = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  groupName = signal('');
  searchQuery = signal('');
  loading = signal(true);
  users = signal<Profile[]>([]);
  selectedIds = signal<string[]>([]);
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

  userInitial(user: Profile): string {
    return (user.display_name || user.email || '?').charAt(0).toUpperCase();
  }

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

  toggleUser(userId: string): void {
    this.selectedIds.update((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    );
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.userSvc.loadAll();
      const uid = this.auth.userId();
      const all = this.userSvc.users().filter((u) => u.id !== uid);
      this.users.set(all);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  submit(): void {
    const name = this.groupName().trim();
    if (name) {
      this.dialogRef.close({ name, memberIds: this.selectedIds() } as NewGroupResult);
    }
  }
}
