import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TaskService } from '../../services/task.service';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../core/auth/auth.service';
import { Task, TaskComment } from '../../shared/models';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

interface MentionMember {
  user_id: string;
  display_name: string;
  email?: string;
  photo_url?: string | null;
}

@Component({
  selector: 'app-comment-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, TimeAgoPipe],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>Comments — {{ data.task.title }}</h2>
      <mat-dialog-content>
        <div class="comments-list">
          @if (comments().length === 0) {
            <div class="empty-comments">Chưa có comment nào. Hãy là người đầu tiên!</div>
          }
          @for (comment of comments(); track comment.id) {
            <div class="comment-item">
              @if (comment.author?.photo_url) {
                <img [src]="comment.author?.photo_url" class="comment-avatar" [alt]="comment.author?.display_name || ''" />
              } @else {
                <span class="comment-avatar comment-avatar-initial">{{ authorInitial(comment.author) }}</span>
              }
              <div class="comment-body">
                <div class="comment-header">
                  <strong>{{ comment.author?.display_name || 'Unknown' }}</strong>
                  <span class="text-xs text-muted">{{ comment.created_at | timeAgo }}</span>
                  @if (comment.author_id === auth.userId()) {
                    <button mat-icon-button class="delete-btn" (click)="deleteComment(comment)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  }
                </div>
                <p class="comment-text">{{ comment.content }}</p>
              </div>
            </div>
          }
        </div>
      </mat-dialog-content>

      <div class="comment-input-area">
        @if (auth.profile()?.photo_url) {
          <img [src]="auth.profile()!.photo_url!" class="comment-avatar" alt="" />
        } @else {
          <span class="comment-avatar comment-avatar-initial">{{ currentUserInitial() }}</span>
        }
        <div class="comment-input-wrap flex-1">
          <mat-form-field appearance="outline" class="full-width">
            <textarea #commentInput matInput [ngModel]="newComment()" (ngModelChange)="newComment.set($event)" placeholder="Viết comment... (gõ @ để nhắc thành viên)"
                      rows="2" (keydown.ctrl.enter)="sendComment()"
                      (input)="onCommentInput($event)" (keydown)="onCommentKeydown($event)"></textarea>
          </mat-form-field>
          @if (showMentionDropdown()) {
            <div class="mention-dropdown">
              @for (m of filteredMentionMembers(); track m.user_id) {
                <button type="button" class="mention-item" (click)="selectMention(m)">
                  @if (m.photo_url) {
                    <img [src]="m.photo_url" class="mention-avatar" [alt]="m.display_name" />
                  } @else {
                    <span class="mention-avatar mention-avatar-initial">{{ (m.display_name || m.email || '?').charAt(0).toUpperCase() }}</span>
                  }
                  <span>{{ m.display_name || m.email || 'User' }}</span>
                </button>
              }
              @if (filteredMentionMembers().length === 0) {
                <div class="mention-empty">Không tìm thấy</div>
              }
            </div>
          }
        </div>
        <button mat-flat-button color="primary" (click)="sendComment()" [disabled]="!newComment().trim()">
          <mat-icon>send</mat-icon>
        </button>
      </div>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Đóng</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { min-width: 500px; }
    mat-dialog-content { max-height: 50vh; overflow-y: auto; }
    .comments-list { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }
    .comment-item { display: flex; gap: 10px; }
    .comment-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; object-fit: cover; }
    .comment-avatar-initial { display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 14px; font-weight: 600; }
    .comment-body { flex: 1; background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0; }
    .comment-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .comment-text { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
    .delete-btn { width: 24px !important; height: 24px !important; margin-left: auto; }
    .comment-input-area { display: flex; gap: 10px; align-items: flex-start; padding: 8px 24px; border-top: 1px solid #e2e8f0; }
    .comment-input-area .flex-1 { flex: 1; min-width: 0; }
    .comment-input-wrap { position: relative; }
    .comment-input-wrap .full-width { width: 100%; }
    .mention-dropdown { position: absolute; left: 0; right: 0; top: 100%; margin-top: 4px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-height: 200px; overflow-y: auto; z-index: 10; }
    .mention-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: none; cursor: pointer; text-align: left; font-size: 14px; }
    .mention-item:hover { background: #f1f5f9; }
    .mention-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .mention-avatar-initial { display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 12px; font-weight: 600; }
    .mention-empty { padding: 12px; color: #94a3b8; font-size: 13px; }
    .empty-comments { text-align: center; color: #94a3b8; padding: 24px; }
  `]
})
export class CommentDialogComponent implements OnInit {
  readonly data      = inject(MAT_DIALOG_DATA) as { task: Task; projectId?: string };
  readonly auth      = inject(AuthService);
  private taskSvc    = inject(TaskService);
  private projectSvc = inject(ProjectService);

  comments    = signal<TaskComment[]>([]);
  newComment  = signal('');
  mentionedIds = signal<string[]>([]);

  mentionMembers   = signal<MentionMember[]>([]);
  showMentionDropdown = signal(false);
  mentionQuery      = signal('');
  mentionStartIndex = 0;
  private mentionTextarea: HTMLTextAreaElement | null = null;

  filteredMentionMembers = computed(() => {
    const q = this.mentionQuery().toLowerCase().trim();
    const list = this.mentionMembers();
    if (!q) return list.slice(0, 10);
    return list.filter(m =>
      (m.display_name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q)
    ).slice(0, 10);
  });

  async ngOnInit(): Promise<void> {
    const [list, projectId] = [await this.taskSvc.getComments(this.data.task.id), this.data.projectId];
    this.comments.set(list);
    if (projectId) {
      const members = await this.projectSvc.getMembers(projectId);
      const mentionList: MentionMember[] = (members as any[]).map((m: any) => {
        const p = m.profiles ?? m.profile;
        return {
          user_id: m.user_id,
          display_name: p?.display_name ?? p?.email ?? 'User',
          email: p?.email,
          photo_url: p?.photo_url ?? null
        };
      });
      this.mentionMembers.set(mentionList);
    }
  }

  onCommentInput(e: Event): void {
    const ta = (e.target as HTMLTextAreaElement);
    this.mentionTextarea = ta;
    const value = ta.value;
    const start = ta.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, start);
    const atIdx = beforeCursor.lastIndexOf('@');
    if (atIdx === -1 || /\s/.test(beforeCursor.slice(atIdx + 1))) {
      this.showMentionDropdown.set(false);
      return;
    }
    this.mentionStartIndex = atIdx;
    this.mentionQuery.set(beforeCursor.slice(atIdx + 1));
    this.showMentionDropdown.set(true);
  }

  onCommentKeydown(e: KeyboardEvent): void {
    if (!this.showMentionDropdown()) return;
    if (e.key === 'Escape') {
      this.showMentionDropdown.set(false);
    }
  }

  selectMention(m: MentionMember): void {
    const ta = this.mentionTextarea;
    if (!ta) return;
    const insert = '@' + (m.display_name || m.email || 'User') + ' ';
    const value = this.newComment();
    const start = this.mentionStartIndex;
    const end = ta.selectionStart ?? value.length;
    this.newComment.set(value.slice(0, start) + insert + value.slice(end));
    this.mentionedIds.update(ids => [...ids, m.user_id]);
    this.showMentionDropdown.set(false);
    this.mentionQuery.set('');
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + insert.length, start + insert.length); }, 0);
  }

  async sendComment(): Promise<void> {
    const text = this.newComment().trim();
    if (!text) return;
    const uid = this.auth.userId()!;
    const mentions = [...this.mentionedIds()];
    const comment = await this.taskSvc.addComment(this.data.task.id, uid, text, mentions);
    if (comment) {
      comment.author = { display_name: this.auth.profile()?.display_name ?? null, photo_url: this.auth.profile()?.photo_url ?? null };
      this.comments.update(list => [...list, comment]);
      this.newComment.set('');
      this.mentionedIds.set([]);
      if (this.data.projectId) this.taskSvc.loadCommentCounts(this.data.projectId);
    }
  }

  async deleteComment(comment: TaskComment): Promise<void> {
    await this.taskSvc.deleteComment(comment.id);
    this.comments.update(list => list.filter(c => c.id !== comment.id));
  }

  authorInitial(author: { display_name?: string | null; email?: string } | undefined): string {
    if (!author) return '?';
    const name = author.display_name || (author as any).email || '';
    return (name || '?').charAt(0).toUpperCase();
  }

  currentUserInitial(): string {
    const p = this.auth.profile();
    const name = p?.display_name || p?.email || '';
    return (name || '?').charAt(0).toUpperCase();
  }

  parseMentions(_text: string): string[] {
    return this.mentionedIds();
  }
}
