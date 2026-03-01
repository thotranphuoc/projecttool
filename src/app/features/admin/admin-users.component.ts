import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from '../../services/user.service';
import { Profile, SystemRole } from '../../shared/models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, DatePipe,
    MatTableModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule
  ],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <h1 class="page-title">Quản lý Users</h1>
        <mat-form-field appearance="outline" style="width:260px">
          <mat-label>Tìm kiếm</mat-label>
          <input matInput [(ngModel)]="searchQuery" placeholder="Email hoặc tên..." />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>

      <div class="card" style="overflow:hidden">
        <table mat-table [dataSource]="filtered()" class="users-table">
          <ng-container matColumnDef="user">
            <th mat-header-cell *matHeaderCellDef>Người dùng</th>
            <td mat-cell *matCellDef="let user">
              <div class="user-cell">
                @if (user.photo_url && !avatarError(user.id)) {
                  <img [src]="user.photo_url" class="user-avatar-sm" alt=""
                       (error)="setAvatarError(user.id)" />
                } @else {
                  <span class="user-avatar-sm user-avatar-initial">{{ userInitial(user) }}</span>
                }
                <div>
                  <div class="font-semibold text-sm">{{ user.display_name || '(chưa đặt tên)' }}</div>
                  <div class="text-xs text-muted">{{ user.email }}</div>
                </div>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>System Role</th>
            <td mat-cell *matCellDef="let user">
              <mat-select [(ngModel)]="user.system_role" (ngModelChange)="updateRole(user, $event)" class="role-select">
                <mat-option value="user">User</mat-option>
                <mat-option value="director">Director</mat-option>
                <mat-option value="admin">Admin</mat-option>
              </mat-select>
            </td>
          </ng-container>

          <ng-container matColumnDef="joined">
            <th mat-header-cell *matHeaderCellDef>Ngày tham gia</th>
            <td mat-cell *matCellDef="let user" class="text-sm text-muted">
              {{ user.created_at | date:'dd/MM/yyyy' }}
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>

        @if (userSvc.isLoading()) {
          <div style="text-align:center; padding:32px; color:#94a3b8">Đang tải...</div>
        } @else if (filtered().length === 0) {
          <div style="text-align:center; padding:32px; color:#94a3b8">Không tìm thấy user nào</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .admin-page { max-width: 900px; margin: 0 auto; }
    .users-table { width: 100%; }
    .user-cell { display: flex; align-items: center; gap: 10px; }
    .user-avatar-sm { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .user-avatar-initial { display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 14px; font-weight: 600; }
    .role-select { font-size: 13px; }
    th.mat-header-cell { font-weight: 700; color: #374151; }
  `]
})
export class AdminUsersComponent implements OnInit {
  readonly userSvc = inject(UserService);
  private snackBar = inject(MatSnackBar);

  searchQuery      = '';
  displayedColumns = ['user', 'role', 'joined'];
  private avatarErrorIds = signal<Set<string>>(new Set());

  userInitial(user: Profile): string {
    return (user.display_name || user.email || '?').charAt(0).toUpperCase();
  }

  avatarError(userId: string): boolean { return this.avatarErrorIds().has(userId); }
  setAvatarError(userId: string): void {
    this.avatarErrorIds.update(s => { const n = new Set(s); n.add(userId); return n; });
  }

  readonly filtered = computed(() => {
    const q = this.searchQuery.toLowerCase();
    return this.userSvc.users().filter(u =>
      !q || (u.email ?? '').toLowerCase().includes(q) || (u.display_name ?? '').toLowerCase().includes(q)
    );
  });

  ngOnInit(): void { this.userSvc.loadAll(); }

  async updateRole(user: Profile, role: SystemRole): Promise<void> {
    await this.userSvc.updateRole(user.id, role);
    this.snackBar.open(`Đã cập nhật role cho ${user.display_name}`, '', { duration: 2000 });
  }
}
