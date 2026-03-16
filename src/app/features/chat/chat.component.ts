import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, ElementRef, inject, signal, computed, effect } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmService } from '../../services/confirm.service';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../core/auth/auth.service';
import { ChatService } from '../../services/chat.service';
import { UserService } from '../../services/user.service';
import { firstValueFrom } from 'rxjs';
import { Conversation, ChatGroup, Message, Profile } from '../../shared/models';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { NewChatUserPickerDialogComponent, NewChatUserPickerData } from './new-chat-user-picker-dialog.component';
import { NewGroupDialogComponent, NewGroupResult } from './new-group-dialog.component';
import { GroupMembersDialogComponent } from './group-members-dialog.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, SlicePipe, TimeAgoPipe,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatTooltipModule, MatMenuModule
  ],
  template: `
    <div class="chat-layout" [class.panel-open]="activeConvId() || activeGroupId()">
      <!-- Sidebar: conversations + groups -->
      <div class="chat-sidebar">
        <div class="sidebar-header">
          <h3>Chat</h3>
          <div class="header-actions">
            <button mat-icon-button matTooltip="Chat mới" (click)="openNewDM()"><mat-icon>chat_bubble_outline</mat-icon></button>
            <button mat-icon-button matTooltip="Tạo nhóm" (click)="openNewGroup()"><mat-icon>group_add</mat-icon></button>
          </div>
        </div>

        <div class="search-box">
          <mat-icon>search</mat-icon>
          <input [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Tìm cuộc trò chuyện..." />
        </div>

        @if (loadError()) {
          <div class="chat-load-error">{{ loadError() }}</div>
        }

        <div class="chat-list">
          <!-- Conversations 1:1 -->
          @for (conv of filteredConversations(); track conv.id) {
            <div class="chat-item" [class.active]="activeConvId() === conv.id" (click)="openConversation(conv)">
              <div class="chat-avatar">{{ initials(conv.other_profile?.display_name) }}</div>
              <div class="chat-info">
                <span class="chat-name">{{ conv.other_profile?.display_name || 'User' }}</span>
                <span class="chat-preview text-xs text-muted">{{ conv.last_message | slice:0:30 }}</span>
              </div>
              <span class="chat-time text-xs text-muted">{{ conv.last_message_at | timeAgo }}</span>
            </div>
          }

          <!-- Groups -->
          @if (chatSvc.groups().length > 0) {
            <div class="section-label">NHÓM</div>
          }
          @for (group of filteredGroups(); track group.id) {
            <div class="chat-item" [class.active]="activeGroupId() === group.id" (click)="openGroup(group)">
              <div class="chat-avatar group-avatar">
                <mat-icon>group</mat-icon>
              </div>
              <div class="chat-info">
                <span class="chat-name">{{ group.name }}</span>
                <span class="chat-preview text-xs text-muted">{{ group.last_message | slice:0:30 }}</span>
              </div>
              <span class="chat-time text-xs text-muted">{{ group.last_message_at | timeAgo }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Chat window -->
      <div class="chat-window">
        @if (!activeConvId() && !activeGroupId()) {
          <div class="no-chat-selected">
            <mat-icon>chat_bubble_outline</mat-icon>
            <h3>Chọn cuộc trò chuyện</h3>
            <p>Chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu chat.</p>
          </div>
        } @else {
          <!-- Chat header -->
          <div class="chat-header">
            <!-- Back button: mobile only -->
            <button mat-icon-button class="back-btn" (click)="activeConvId.set(null); activeGroupId.set(null)" aria-label="Quay lại">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="chat-header-avatar">{{ initials(activeTitle()) }}</div>
            <div class="chat-header-info">
              <h4>{{ activeTitle() }}</h4>
              <span class="text-xs text-muted">{{ chatSvc.messages().length }} tin nhắn</span>
            </div>
            @if (activeGroupId()) {
              <button mat-icon-button matTooltip="Thành viên nhóm" (click)="openGroupMembers()">
                <mat-icon>group</mat-icon>
              </button>
              <button mat-icon-button matTooltip="Thêm thành viên" (click)="openAddGroupMember()">
                <mat-icon>person_add</mat-icon>
              </button>
            }
          </div>

          <!-- Messages -->
          <div class="messages-area" #messagesArea>
            @for (msg of chatSvc.messages(); track msg.id) {
              <div class="message-wrapper" [class.own]="msg.sender_id === auth.userId()">
                @if (msg.sender_id !== auth.userId()) {
                  @if (msg.sender_photo_url && !msgAvatarError(msg.id)) {
                    <img [src]="msg.sender_photo_url" class="msg-avatar" alt=""
                         (error)="setMsgAvatarError(msg.id)" />
                  } @else {
                    <span class="msg-avatar msg-avatar-initial">{{ msgInitial(msg) }}</span>
                  }
                }
                <div class="message-bubble" [class.own-bubble]="msg.sender_id === auth.userId()">
                  @if (msg.sender_id !== auth.userId()) {
                    <span class="sender-name text-xs font-semibold">{{ msg.sender_name }}</span>
                  }
                  @if (msg.reply_to_content) {
                    <div class="reply-quote">{{ msg.reply_to_content | slice:0:80 }}...</div>
                  }
                  <p class="msg-content">{{ msg.content }}</p>
                  @if (msg.file_url) {
                    <a [href]="msg.file_url" target="_blank" class="file-attachment">
                      <mat-icon>attachment</mat-icon> {{ msg.file_name }}
                    </a>
                  }
                  <div class="msg-meta">
                    <span class="text-xs">{{ msg.created_at | timeAgo }}</span>
                    @if (msg.edited_at) { <span class="text-xs text-muted">(đã sửa)</span> }
                    @if (msg.sender_id === auth.userId() && chatSvc.settings()?.enable_delete) {
                      <button mat-icon-button class="msg-action" (click)="deleteMessage(msg)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Message input -->
          <div class="message-input-area">
            <label class="attach-btn" matTooltip="Đính kèm file">
              <mat-icon>attach_file</mat-icon>
              <input type="file" hidden (change)="onFileAttach($event)" />
            </label>
            <div class="input-wrapper">
              <textarea [ngModel]="newMessage()"
                        (ngModelChange)="newMessage.set($event)"
                        placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter xuống dòng)"
                        (keydown.enter)="onEnterKey($event)"
                        rows="1" class="msg-input"></textarea>
            </div>
            <button mat-flat-button color="primary" (click)="sendMessage()" [disabled]="!newMessage().trim() && !pendingFile()">
              <mat-icon>send</mat-icon>
            </button>
          </div>
          @if (pendingFile()) {
            <div class="pending-file">
              <mat-icon>attachment</mat-icon> {{ pendingFile()!.name }}
              <button mat-icon-button (click)="pendingFile.set(null)"><mat-icon>close</mat-icon></button>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .chat-layout { display: flex; height: calc(100vh - 90px); background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .chat-sidebar { width: 300px; min-width: 300px; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; }
    .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e2e8f0; }
    .sidebar-header h3 { margin: 0; font-weight: 700; }
    .header-actions { display: flex; gap: 4px; }
    .search-box { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid #f1f5f9; }
    .search-box input { border: none; outline: none; flex: 1; font-size: 14px; }
    .search-box mat-icon { color: #94a3b8; font-size: 18px; }
    .chat-list { flex: 1; overflow-y: auto; }
    .section-label { padding: 8px 16px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 1px; }
    .chat-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; transition: background 0.15s; }
    .chat-item:hover { background: #f8fafc; }
    .chat-item.active { background: #eff6ff; }
    .chat-avatar { width: 42px; height: 42px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0; }
    .group-avatar { background: #8b5cf6; }
    .chat-info { flex: 1; min-width: 0; }
    .chat-name { display: block; font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chat-preview { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chat-time { flex-shrink: 0; }
    .chat-window { flex: 1; display: flex; flex-direction: column; }
    .no-chat-selected { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; gap: 12px; }
    .no-chat-selected mat-icon { font-size: 64px; width: 64px; height: 64px; }
    .chat-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; }
    .chat-header-info { flex: 1; min-width: 0; }
    .chat-header-avatar { width: 40px; height: 40px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; }
    .chat-header h4 { margin: 0; font-size: 15px; font-weight: 700; }
    .messages-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .message-wrapper { display: flex; gap: 8px; }
    .message-wrapper.own { flex-direction: row-reverse; }
    .msg-avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; object-fit: cover; }
    .msg-avatar-initial { display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 12px; font-weight: 600; }
    .message-bubble { max-width: 65%; background: #f1f5f9; border-radius: 12px 12px 12px 4px; padding: 10px 14px; }
    .own-bubble { background: #3b82f6; color: white; border-radius: 12px 12px 4px 12px; }
    .sender-name { display: block; margin-bottom: 2px; color: #3b82f6; }
    .own-bubble .sender-name { color: rgba(255,255,255,0.8); }
    .reply-quote { border-left: 3px solid #94a3b8; padding-left: 8px; font-size: 12px; color: #64748b; margin-bottom: 6px; }
    .own-bubble .reply-quote { border-color: rgba(255,255,255,0.5); color: rgba(255,255,255,0.7); }
    .msg-content { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
    .file-attachment { display: flex; align-items: center; gap: 4px; font-size: 13px; color: inherit; text-decoration: underline; }
    .msg-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
    .msg-meta span { font-size: 11px; opacity: 0.7; }
    .msg-action { width: 32px !important; height: 32px !important; line-height: 32px !important; }
    .back-btn { display: none; flex-shrink: 0; }
    @media (max-width: 768px) {
      .chat-layout { height: calc(100dvh - 80px); border-radius: 0; border-left: 0; border-right: 0; }
      .chat-sidebar { width: 100%; min-width: 0; border-right: none; }
      /* When a conversation is open: hide sidebar, show chat window full-width */
      .chat-layout.panel-open .chat-sidebar { display: none; }
      .chat-layout.panel-open .chat-window { display: flex; }
      /* When no conversation: show sidebar, hide chat window */
      .chat-layout:not(.panel-open) .chat-window { display: none; }
      .back-btn { display: inline-flex; }
      .message-bubble { max-width: 85%; }
    }
    .message-input-area { display: flex; align-items: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid #e2e8f0; }
    .attach-btn { display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; padding: 8px; border-radius: 50%; }
    .attach-btn:hover { background: #f1f5f9; }
    .input-wrapper { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; }
    .msg-input { width: 100%; border: none; outline: none; background: transparent; resize: none; font-size: 14px; font-family: inherit; }
    .pending-file { display: flex; align-items: center; gap: 8px; padding: 4px 16px 8px; font-size: 13px; color: #3b82f6; }
    .chat-load-error { padding: 12px 16px; font-size: 13px; color: #b91c1c; background: #fef2f2; border-radius: 8px; margin: 8px; }
  `]
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesArea') private messagesAreaRef?: ElementRef<HTMLDivElement>;

  readonly auth    = inject(AuthService);
  readonly chatSvc = inject(ChatService);
  private dialog   = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private userSvc  = inject(UserService);
  private confirmSvc = inject(ConfirmService);

  loadError = signal<string | null>(null);
  activeConvId  = signal<string | null>(null);
  activeGroupId = signal<string | null>(null);
  newMessage    = signal('');
  searchQuery   = signal('');
  pendingFile   = signal<File | null>(null);
  private msgAvatarErrorIds = signal<Set<string>>(new Set());

  private scrollToBottom(): void {
    const el = this.messagesAreaRef?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private scrollToBottomEffect = effect(() => {
    this.chatSvc.messages();
    this.activeConvId();
    this.activeGroupId();
    setTimeout(() => this.scrollToBottom(), 0);
  });

  msgInitial(msg: Message): string { return (msg.sender_name || '?').charAt(0).toUpperCase(); }
  msgAvatarError(msgId: string): boolean { return this.msgAvatarErrorIds().has(msgId); }
  setMsgAvatarError(msgId: string): void {
    this.msgAvatarErrorIds.update(s => { const n = new Set(s); n.add(msgId); return n; });
  }

  readonly activeTitle = computed(() => {
    if (this.activeConvId()) {
      const conv = this.chatSvc.conversations().find(c => c.id === this.activeConvId());
      return conv?.other_profile?.display_name ?? 'Chat';
    }
    if (this.activeGroupId()) {
      return this.chatSvc.groups().find(g => g.id === this.activeGroupId())?.name ?? 'Group';
    }
    return '';
  });

  readonly filteredConversations = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.chatSvc.conversations().filter(c =>
      !q || (c.other_profile?.display_name ?? '').toLowerCase().includes(q)
    );
  });

  readonly filteredGroups = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.chatSvc.groups().filter(g => !q || g.name.toLowerCase().includes(q));
  });

  async ngOnInit(): Promise<void> {
    try {
      await Promise.all([this.chatSvc.loadConversations(), this.chatSvc.loadGroups(), this.chatSvc.loadSettings()]);
      this.loadError.set(null);
    } catch (e: any) {
      const msg = e?.message ?? 'Không tải được danh sách chat. Kiểm tra console.';
      this.loadError.set(msg);
      this.snackBar.open(msg, 'Đóng', { duration: 5000 });
    }
  }

  ngOnDestroy(): void { this.chatSvc.cleanupMessages(); }

  openConversation(conv: Conversation): void {
    this.activeConvId.set(conv.id);
    this.activeGroupId.set(null);
    this.chatSvc.loadMessages(conv.id, null);
  }

  openGroup(group: ChatGroup): void {
    this.activeGroupId.set(group.id);
    this.activeConvId.set(null);
    this.chatSvc.loadMessages(null, group.id);
  }

  onEnterKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage(): Promise<void> {
    const content = this.newMessage().trim();
    const file    = this.pendingFile();
    if (!content && !file) return;

    let fileData: any = {};
    try {
      if (file) {
        const scope   = this.activeConvId() ? 'conversations' : 'groups';
        const scopeId = this.activeConvId() ?? this.activeGroupId()!;
        fileData = await this.chatSvc.uploadAttachment(file, scope, scopeId);
        this.pendingFile.set(null);
      }

      await this.chatSvc.sendMessage({
        conversationId: this.activeConvId() ?? undefined,
        groupId:        this.activeGroupId() ?? undefined,
        content:        content || (file?.name ?? ''),
        fileUrl:        fileData.url, fileName: fileData.name,
        fileType:       fileData.type, fileSizeBytes: fileData.size
      });
      this.newMessage.set('');
    } catch (e: any) {
      const msg = e?.message ?? 'Không gửi được tin nhắn';
      this.snackBar.open(msg, 'Đóng', { duration: 4000 });
    }
  }

  async deleteMessage(msg: Message): Promise<void> {
    if (!(await this.confirmSvc.open({ title: 'Xóa tin nhắn', message: 'Xóa tin nhắn này?', confirmText: 'Xóa', confirmWarn: true }))) return;
    await this.chatSvc.deleteMessage(msg.id);
  }

  onFileAttach(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.pendingFile.set(file);
  }

  async openNewDM(): Promise<void> {
    const ref = this.dialog.open(NewChatUserPickerDialogComponent, { width: '420px' });
    const selected = await firstValueFrom(ref.afterClosed()) as Profile | undefined;
    if (!selected) return;
    const conv = await this.chatSvc.getOrCreateConversation(selected.id);
    if (conv) {
      await this.chatSvc.loadConversations();
      this.openConversation(conv as any);
    }
  }

  async openNewGroup(): Promise<void> {
    const ref = this.dialog.open(NewGroupDialogComponent, { width: '440px' });
    const result = await firstValueFrom(ref.afterClosed()) as NewGroupResult | undefined;
    if (!result?.name?.trim()) return;
    const group = await this.chatSvc.createGroup(result.name.trim(), result.memberIds ?? []);
    if (group) this.openGroup(group);
  }

  openGroupMembers(): void {
    const gid = this.activeGroupId();
    if (!gid) return;
    const group = this.chatSvc.groups().find((g) => g.id === gid);
    if (!group) return;
    const ref = this.dialog.open(GroupMembersDialogComponent, { width: '500px', data: { group } });
    ref.afterClosed().subscribe((result) => {
      if (result === true) {
        this.chatSvc.loadGroups();
        this.activeGroupId.set(null);
      }
    });
  }

  async openAddGroupMember(): Promise<void> {
    const gid = this.activeGroupId();
    if (!gid) return;
    const group = this.chatSvc.groups().find((g) => g.id === gid);
    const ref = this.dialog.open(NewChatUserPickerDialogComponent, {
      width: '420px',
      data: { excludeIds: group?.members ?? [] } as NewChatUserPickerData,
    });
    const selected = await firstValueFrom(ref.afterClosed()) as Profile | undefined;
    if (!selected) return;
    const { error } = await this.chatSvc.addGroupMember(gid, selected.id);
    if (error) {
      this.snackBar.open(error, 'Đóng', { duration: 4000 });
    } else {
      this.snackBar.open(`Đã thêm ${selected.display_name || selected.email || 'thành viên'} vào nhóm`, '', { duration: 2500 });
    }
  }

  initials(name: string | null | undefined): string {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }
}

