import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth/auth.service';
import { ChatService } from '../../services/chat.service';
import { ConfirmService } from '../../services/confirm.service';
import { SupabaseService } from '../../core/supabase.service';
import { ChatGroup } from '../../shared/models';

export interface GroupMemberRow {
  id: string;
  display_name: string | null;
  photo_url: string | null;
  email: string | null;
  role: 'owner' | 'admin' | 'member';
}

@Component({
  selector: 'app-group-members-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>{{ data.group.name }}</h2>

      <mat-dialog-content>
        <section class="description-section">
          @if (canEditGroup()) {
            <div class="description-row">
              <mat-form-field appearance="outline" class="description-field">
                <textarea matInput [ngModel]="descriptionText()" (ngModelChange)="descriptionText.set($event)" rows="3" placeholder="Mô tả ngắn về nhóm..."></textarea>
              </mat-form-field>
              <button mat-icon-button matTooltip="Lưu" (click)="saveDescription()" [disabled]="savingDescription()">
                <mat-icon>save</mat-icon>
              </button>
            </div>
          } @else {
            <p class="description-read">{{ descriptionText() || 'Chưa có giới thiệu.' }}</p>
          }
        </section>

        @if (loading()) {
          <p class="text-muted">Đang tải...</p>
        } @else if (loadError()) {
          <p class="load-error">{{ loadError() }}</p>
        } @else {
          <mat-list>
            @for (row of members(); track row.id) {
              <mat-list-item>
                @if (row.photo_url && !avatarError(row.id)) {
                  <img [src]="row.photo_url" matListItemAvatar class="list-avatar" alt="" (error)="setAvatarError(row.id)" />
                } @else {
                  <span matListItemAvatar class="list-avatar list-avatar-initial">{{ initial(row) }}</span>
                }
                <span matListItemTitle>{{ row.display_name || row.email || 'User' }}</span>
                <span matListItemLine class="role-badge" [class.role-owner]="row.role === 'owner'" [class.role-admin]="row.role === 'admin'">
                  {{ roleLabel(row.role) }}
                </span>
                @if (canManageMember(row)) {
                  <div matListItemMeta class="member-actions">
                    @if (isOwner && row.id !== auth.userId()) {
                      @if (row.role === 'member') {
                        <button mat-icon-button matTooltip="Thăng phó nhóm" (click)="addAdmin(row.id)">
                          <mat-icon>admin_panel_settings</mat-icon>
                        </button>
                      }
                      @if (row.role === 'admin') {
                        <button mat-icon-button matTooltip="Rút quyền phó nhóm" (click)="removeAdmin(row.id)">
                          <mat-icon>remove_circle_outline</mat-icon>
                        </button>
                      }
                      <button mat-icon-button matTooltip="Chuyển quyền trưởng nhóm" (click)="transferOwner(row.id)">
                        <mat-icon>swap_horiz</mat-icon>
                      </button>
                    }
                    @if (canRemoveMember(row)) {
                      <button mat-icon-button matTooltip="Xóa khỏi nhóm" color="warn" (click)="removeMember(row)">
                        <mat-icon>person_remove</mat-icon>
                      </button>
                    }
                  </div>
                }
              </mat-list-item>
            }
          </mat-list>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Đóng</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { width: min(460px, 92vw); min-width: 0; box-sizing: border-box; }
    mat-dialog-content { max-height: 60vh; overflow-y: auto; padding-top: 8px; }
    .description-section { margin-bottom: 20px; }
    .description-row { display: flex; align-items: flex-start; gap: 8px; }
    .description-field { flex: 1; min-width: 0; }
    .description-row .mat-mdc-form-field-subscript-wrapper { display: none; }
    .description-read { margin: 0; color: #64748b; font-size: 14px; white-space: pre-wrap; line-height: 1.5; }
    .list-avatar { width: 40px !important; height: 40px !important; border-radius: 50%; object-fit: cover; }
    .list-avatar-initial { display: inline-flex !important; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 14px; font-weight: 600; }
    .role-badge { font-size: 12px; color: #64748b; }
    .role-owner { color: #b45309; font-weight: 600; }
    .role-admin { color: #0369a1; font-weight: 500; }
    .member-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
    .text-muted { color: #64748b; }
    .load-error { color: #b91c1c; font-size: 14px; margin: 8px 0; }
  `],
})
export class GroupMembersDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<GroupMembersDialogComponent>);
  readonly data = inject(MAT_DIALOG_DATA) as { group: ChatGroup };
  readonly auth = inject(AuthService);
  private chatSvc = inject(ChatService);
  private confirmSvc = inject(ConfirmService);
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);

  loading = signal(true);
  loadError = signal<string | null>(null);
  members = signal<GroupMemberRow[]>([]);
  descriptionText = signal('');
  savingDescription = signal(false);
  private avatarErrorIds = signal<Set<string>>(new Set());

  get isOwner(): boolean {
    return this.data.group.owner_id === this.auth.userId();
  }

  get isAdmin(): boolean {
    const uid = this.auth.userId();
    return !!uid && (this.data.group.admins ?? []).includes(uid);
  }

  canEditGroup(): boolean {
    return this.isOwner || this.isAdmin;
  }

  canManageMember(row: GroupMemberRow): boolean {
    if (row.id === this.auth.userId()) return false;
    if (this.isOwner) return true;
    if (this.isAdmin && row.role !== 'owner') return true;
    return false;
  }

  canRemoveMember(row: GroupMemberRow): boolean {
    if (row.id === this.auth.userId()) return false;
    if (row.role === 'owner') return false;
    return this.isOwner || this.isAdmin;
  }

  roleLabel(role: GroupMemberRow['role']): string {
    return role === 'owner' ? 'Chủ nhóm' : role === 'admin' ? 'Phó nhóm' : 'Thành viên';
  }

  initial(row: GroupMemberRow): string {
    return (row.display_name || row.email || '?').charAt(0).toUpperCase();
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

  async ngOnInit(): Promise<void> {
    const g = this.data.group;
    this.descriptionText.set(g.description ?? '');
    const ids = g.members ?? [];
    if (ids.length === 0) {
      this.members.set([]);
      this.loading.set(false);
      this.cdr.markForCheck();
      return;
    }
    try {
      const { data: profiles, error } = await this.supabase.client
        .from('profiles')
        .select('id, display_name, photo_url, email')
        .in('id', ids);
      if (error) throw error;
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      const ownerId = g.owner_id;
      const adminIds = new Set(g.admins ?? []);
      const rows: GroupMemberRow[] = ids.map((id) => {
        const p = map.get(id);
        const role: GroupMemberRow['role'] =
          id === ownerId ? 'owner' : adminIds.has(id) ? 'admin' : 'member';
        return {
          id,
          display_name: p?.display_name ?? null,
          photo_url: p?.photo_url ?? null,
          email: p?.email ?? null,
          role,
        };
      });
      this.members.set(rows);
      this.loadError.set(null);
    } catch (e: any) {
      console.error('[GroupMembersDialog] load error:', e);
      this.loadError.set(e?.message ?? 'Không tải được danh sách thành viên.');
      this.members.set([]);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  async saveDescription(): Promise<void> {
    this.savingDescription.set(true);
    const { error } = await this.chatSvc.updateGroupDescription(this.data.group.id, this.descriptionText().trim() || null);
    this.savingDescription.set(false);
    if (error) {
      this.snackBar.open(error, 'Đóng', { duration: 4000 });
      return;
    }
    this.snackBar.open('Đã lưu giới thiệu nhóm', '', { duration: 2000 });
    this.cdr.markForCheck();
  }

  async removeMember(row: GroupMemberRow): Promise<void> {
    const name = row.display_name || row.email || 'thành viên này';
    const ok = await this.confirmSvc.open({
      title: 'Xóa khỏi nhóm',
      message: `Xóa ${name} khỏi nhóm?`,
      confirmText: 'Xóa',
      confirmWarn: true,
    });
    if (!ok) return;
    const { error } = await this.chatSvc.removeGroupMember(this.data.group.id, row.id);
    if (error) {
      this.snackBar.open(error, 'Đóng', { duration: 4000 });
      return;
    }
    if (row.id === this.auth.userId()) {
      this.snackBar.open('Bạn đã rời nhóm', '', { duration: 2000 });
      this.dialogRef.close(true);
      return;
    }
    this.members.update((list) => list.filter((r) => r.id !== row.id));
    this.snackBar.open('Đã xóa khỏi nhóm', '', { duration: 2000 });
    this.cdr.markForCheck();
  }

  async addAdmin(userId: string): Promise<void> {
    const { error } = await this.chatSvc.addGroupAdmin(this.data.group.id, userId);
    if (error) {
      this.snackBar.open(error, 'Đóng', { duration: 4000 });
      return;
    }
    this.members.update((list) =>
      list.map((r) => (r.id === userId ? { ...r, role: 'admin' as const } : r))
    );
    this.snackBar.open('Đã thăng phó nhóm', '', { duration: 2000 });
    this.cdr.markForCheck();
  }

  async removeAdmin(userId: string): Promise<void> {
    const { error } = await this.chatSvc.removeGroupAdmin(this.data.group.id, userId);
    if (error) {
      this.snackBar.open(error, 'Đóng', { duration: 4000 });
      return;
    }
    this.members.update((list) =>
      list.map((r) => (r.id === userId ? { ...r, role: 'member' as const } : r))
    );
    this.snackBar.open('Đã rút quyền phó nhóm', '', { duration: 2000 });
    this.cdr.markForCheck();
  }

  async transferOwner(userId: string): Promise<void> {
    const row = this.members().find((r) => r.id === userId);
    const name = row?.display_name || row?.email || 'người này';
    const ok = await this.confirmSvc.open({
      title: 'Chuyển quyền trưởng nhóm',
      message: `Chuyển quyền trưởng nhóm cho ${name}? Bạn sẽ trở thành phó nhóm.`,
      confirmText: 'Chuyển',
      confirmWarn: true,
    });
    if (!ok) return;
    const { error } = await this.chatSvc.transferGroupOwnership(this.data.group.id, userId);
    if (error) {
      this.snackBar.open(error, 'Đóng', { duration: 4000 });
      return;
    }
    this.snackBar.open('Đã chuyển quyền trưởng nhóm', '', { duration: 2500 });
    this.dialogRef.close(true);
  }
}
