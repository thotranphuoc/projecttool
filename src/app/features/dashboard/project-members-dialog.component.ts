import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProjectService } from '../../services/project.service';
import { UserService } from '../../services/user.service';
import { Project, ProjectMember, Profile } from '../../shared/models';

@Component({
  selector: 'app-project-members-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatListModule, MatChipsModule, MatTooltipModule
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>Thành viên — {{ data.project.name }}</h2>

      <mat-dialog-content>
        <!-- Add member -->
        <div class="add-section">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Tìm user theo email</mat-label>
            <input matInput [(ngModel)]="searchEmail" (input)="searchUsers()" placeholder="user@email.com" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          @if (searchResults().length > 0) {
            <div class="search-results">
              @for (user of searchResults(); track user.id) {
                <div class="search-result-item" (click)="addMember(user)">
                  @if (user.photo_url && !avatarError(user.id)) {
                    <img [src]="user.photo_url" class="mini-avatar" alt=""
                         (error)="setAvatarError(user.id)" />
                  } @else {
                    <span class="mini-avatar mini-avatar-initial">{{ userInitial(user) }}</span>
                  }
                  <div>
                    <div class="font-semibold text-sm">{{ user.display_name }}</div>
                    <div class="text-xs text-muted">{{ user.email }}</div>
                  </div>
                  <mat-icon class="add-icon">person_add</mat-icon>
                </div>
              }
            </div>
          }
        </div>

        <!-- Members list -->
        <h4 class="section-title">Danh sách thành viên ({{ members().length }})</h4>
        <mat-list>
          @for (member of members(); track member.user_id) {
            <mat-list-item>
              @if (getProfile(member)?.photo_url && !avatarError(member.user_id)) {
                <img [src]="getProfile(member)!.photo_url!" matListItemAvatar class="member-avatar" alt=""
                     (error)="setAvatarError(member.user_id)" />
              } @else {
                <span matListItemAvatar class="member-avatar member-avatar-initial">{{ memberInitial(member) }}</span>
              }
              <span matListItemTitle>{{ getProfile(member)?.display_name || member.user_id }}</span>
              <span matListItemLine class="text-muted text-xs">{{ getProfile(member)?.email }}</span>
              <div matListItemMeta class="member-actions">
                <mat-select [(ngModel)]="member.project_role" (ngModelChange)="updateRole(member, $event)" class="role-select">
                  <mat-option value="manager">Manager</mat-option>
                  <mat-option value="member">Member</mat-option>
                </mat-select>
                <button mat-icon-button color="warn" (click)="removeMember(member)" matTooltip="Xóa thành viên">
                  <mat-icon>remove_circle_outline</mat-icon>
                </button>
              </div>
            </mat-list-item>
          }
        </mat-list>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-flat-button color="primary" mat-dialog-close>Đóng</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { min-width: 480px; }
    mat-dialog-content { max-height: 65vh; }
    .add-section { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .search-results { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .search-result-item { display: flex; align-items: center; gap: 12px; padding: 10px 16px; cursor: pointer; transition: background 0.2s; }
    .search-result-item:hover { background: #f8fafc; }
    .mini-avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; object-fit: cover; }
    .mini-avatar-initial { display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 12px; font-weight: 600; }
    .add-icon { margin-left: auto; color: #3b82f6; }
    .section-title { margin: 8px 0; color: #475569; font-size: 13px; font-weight: 600; }
    .member-avatar { width: 36px !important; height: 36px !important; border-radius: 50%; object-fit: cover; }
    .member-avatar-initial { display: inline-flex !important; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 14px; font-weight: 600; }
    .member-actions { display: flex; align-items: center; gap: 8px; }
    .role-select { font-size: 13px; width: 100px; }
  `]
})
export class ProjectMembersDialogComponent implements OnInit {
  readonly data      = inject(MAT_DIALOG_DATA) as { project: Project };
  private projectSvc = inject(ProjectService);
  private userSvc    = inject(UserService);
  private snackBar   = inject(MatSnackBar);

  members       = signal<ProjectMember[]>([]);
  searchEmail   = '';
  searchResults = signal<Profile[]>([]);
  private avatarErrorIds = signal<Set<string>>(new Set());

  userInitial(user: Profile): string { return (user.display_name || user.email || '?').charAt(0).toUpperCase(); }
  memberInitial(member: ProjectMember): string {
    const p = this.getProfile(member); return (p?.display_name || p?.email || '?').charAt(0).toUpperCase();
  }
  avatarError(id: string): boolean { return this.avatarErrorIds().has(id); }
  setAvatarError(id: string): void {
    this.avatarErrorIds.update(s => { const n = new Set(s); n.add(id); return n; });
  }

  async ngOnInit(): Promise<void> {
    const raw = await this.projectSvc.getMembers(this.data.project.id);
    this.members.set(raw);
  }

  getProfile(member: ProjectMember): any {
    return (member as any).profiles;
  }

  async searchUsers(): Promise<void> {
    if (this.searchEmail.length < 3) { this.searchResults.set([]); return; }
    const results = await this.userSvc.searchByEmail(this.searchEmail);
    const existingIds = this.members().map(m => m.user_id);
    this.searchResults.set(results.filter(u => !existingIds.includes(u.id)));
  }

  async addMember(user: Profile): Promise<void> {
    const { error } = await this.projectSvc.addMember(this.data.project.id, user.id, 'member');
    if (error) {
      this.snackBar.open(error.message || 'Không thể thêm thành viên. Chỉ Admin hoặc Manager của project mới thêm được.', 'Đóng', { duration: 4000 });
      return;
    }
    this.members.update(list => [...list, { project_id: this.data.project.id, user_id: user.id, project_role: 'member', joined_at: new Date().toISOString(), profiles: user } as any]);
    this.searchResults.set(this.searchResults().filter(u => u.id !== user.id));
    this.snackBar.open(`Đã thêm ${user.display_name || user.email}`, '', { duration: 2000 });
  }

  async removeMember(member: ProjectMember): Promise<void> {
    const { error } = await this.projectSvc.removeMember(this.data.project.id, member.user_id);
    if (error) {
      this.snackBar.open(error.message || 'Không thể xóa thành viên.', 'Đóng', { duration: 3000 });
      return;
    }
    this.members.update(list => list.filter(m => m.user_id !== member.user_id));
    this.snackBar.open('Đã xóa thành viên', '', { duration: 2000 });
  }

  async updateRole(member: ProjectMember, role: 'manager' | 'member'): Promise<void> {
    const { error } = await this.projectSvc.updateMemberRole(this.data.project.id, member.user_id, role);
    if (error) {
      this.snackBar.open(error.message || 'Không thể đổi vai trò.', 'Đóng', { duration: 3000 });
      return;
    }
    this.members.update(list => list.map(m => m.user_id === member.user_id ? { ...m, project_role: role } : m));
  }
}
