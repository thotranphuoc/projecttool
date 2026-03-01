import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { AuthService } from '../core/auth/auth.service';
import { Conversation, ChatGroup, Message, ChatSettings } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private supabase = inject(SupabaseService).client;
  private auth     = inject(AuthService);

  readonly conversations = signal<Conversation[]>([]);
  readonly groups        = signal<ChatGroup[]>([]);
  readonly messages      = signal<Message[]>([]);
  readonly settings      = signal<ChatSettings | null>(null);

  private msgChannel: ReturnType<typeof this.supabase.channel> | null = null;

  // ── Conversations ─────────────────────────────────────────
  async loadConversations(): Promise<void> {
    const uid = this.auth.userId()!;
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .or(`participant_a.eq.${uid},participant_b.eq.${uid}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (error) {
      console.error('[ChatService] loadConversations error:', error.code, error.message);
      this.conversations.set([]);
      return;
    }
    const raw = data ?? [];
    const enriched = await Promise.all(
      raw.map(async (c) => {
        const otherId = c.participant_a === uid ? c.participant_b : c.participant_a;
        const { data: profile } = await this.supabase
          .from('profiles')
          .select('id, display_name, photo_url')
          .eq('id', otherId)
          .maybeSingle();
        return { ...c, other_profile: profile ?? undefined } as Conversation;
      })
    );
    this.conversations.set(enriched);
  }

  async getOrCreateConversation(otherUserId: string): Promise<Conversation | null> {
    const uid = this.auth.userId()!;
    const a = uid < otherUserId ? uid : otherUserId;
    const b = uid < otherUserId ? otherUserId : uid;
    const { data: existing, error: selectError } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('participant_a', a)
      .eq('participant_b', b)
      .maybeSingle();
    if (selectError) {
      console.error('[ChatService] getOrCreateConversation select error:', selectError.code, selectError.message);
      return null;
    }
    if (existing) return existing;
    const { data, error: insertError } = await this.supabase
      .from('conversations')
      .insert({ participant_a: a, participant_b: b })
      .select()
      .single();
    if (insertError) {
      console.error('[ChatService] getOrCreateConversation insert error:', insertError.code, insertError.message);
      return null;
    }
    return data;
  }

  // ── Groups ────────────────────────────────────────────────
  async loadGroups(): Promise<void> {
    const uid = this.auth.userId()!;
    const { data, error } = await this.supabase
      .from('chat_groups')
      .select('*')
      .contains('members', [uid])
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (error) {
      console.error('[ChatService] loadGroups error:', error.code, error.message);
      this.groups.set([]);
      return;
    }
    this.groups.set(data ?? []);
  }

  async createGroup(name: string, memberIds: string[]): Promise<ChatGroup | null> {
    const uid = this.auth.userId()!;
    const { data } = await this.supabase
      .from('chat_groups')
      .insert({ name, owner_id: uid, members: [uid, ...memberIds], admins: [uid] })
      .select()
      .single();
    if (data) this.groups.update(list => [data, ...list]);
    return data;
  }

  async addGroupMember(groupId: string, userId: string): Promise<{ error?: string }> {
    const { data: group, error: fetchError } = await this.supabase
      .from('chat_groups')
      .select('members')
      .eq('id', groupId)
      .single();
    if (fetchError || !group) return { error: fetchError?.message ?? 'Không tìm thấy nhóm' };
    const members = (group.members as string[]) ?? [];
    if (members.includes(userId)) return {};
    const next = [...members, userId];
    const { error: updateError } = await this.supabase
      .from('chat_groups')
      .update({ members: next })
      .eq('id', groupId);
    if (updateError) return { error: updateError.message };
    this.groups.update(list =>
      list.map(g => g.id === groupId ? { ...g, members: next } : g)
    );
    return {};
  }

  async removeGroupMember(groupId: string, userId: string): Promise<{ error?: string }> {
    const { data: group, error: fetchError } = await this.supabase
      .from('chat_groups')
      .select('members, admins')
      .eq('id', groupId)
      .single();
    if (fetchError || !group) return { error: fetchError?.message ?? 'Không tìm thấy nhóm' };
    const members = ((group.members as string[]) ?? []).filter(id => id !== userId);
    const admins = ((group.admins as string[]) ?? []).filter(id => id !== userId);
    const { error: updateError } = await this.supabase
      .from('chat_groups')
      .update({ members, admins })
      .eq('id', groupId);
    if (updateError) return { error: updateError.message };
    this.groups.update(list =>
      list.map(g => g.id === groupId ? { ...g, members, admins } : g)
    );
    return {};
  }

  async updateGroupDescription(groupId: string, description: string | null): Promise<{ error?: string }> {
    const { error } = await this.supabase
      .from('chat_groups')
      .update({ description: description ?? null })
      .eq('id', groupId);
    if (error) return { error: error.message };
    this.groups.update(list =>
      list.map(g => g.id === groupId ? { ...g, description: description ?? null } : g)
    );
    return {};
  }

  async addGroupAdmin(groupId: string, userId: string): Promise<{ error?: string }> {
    const { data: group, error: fetchError } = await this.supabase
      .from('chat_groups')
      .select('members, admins')
      .eq('id', groupId)
      .single();
    if (fetchError || !group) return { error: fetchError?.message ?? 'Không tìm thấy nhóm' };
    const admins = (group.admins as string[]) ?? [];
    if (admins.includes(userId)) return {};
    const members = (group.members as string[]) ?? [];
    if (!members.includes(userId)) return { error: 'User chưa ở trong nhóm' };
    const next = [...admins, userId];
    const { error: updateError } = await this.supabase
      .from('chat_groups')
      .update({ admins: next })
      .eq('id', groupId);
    if (updateError) return { error: updateError.message };
    this.groups.update(list =>
      list.map(g => g.id === groupId ? { ...g, admins: next } : g)
    );
    return {};
  }

  async removeGroupAdmin(groupId: string, userId: string): Promise<{ error?: string }> {
    const { data: group, error: fetchError } = await this.supabase
      .from('chat_groups')
      .select('owner_id, admins')
      .eq('id', groupId)
      .single();
    if (fetchError || !group) return { error: fetchError?.message ?? 'Không tìm thấy nhóm' };
    if ((group.owner_id as string) === userId) return { error: 'Không thể rút quyền trưởng nhóm' };
    const admins = ((group.admins as string[]) ?? []).filter(id => id !== userId);
    const { error: updateError } = await this.supabase
      .from('chat_groups')
      .update({ admins })
      .eq('id', groupId);
    if (updateError) return { error: updateError.message };
    this.groups.update(list =>
      list.map(g => g.id === groupId ? { ...g, admins } : g)
    );
    return {};
  }

  async transferGroupOwnership(groupId: string, newOwnerId: string): Promise<{ error?: string }> {
    const { data: group, error: fetchError } = await this.supabase
      .from('chat_groups')
      .select('owner_id, members, admins')
      .eq('id', groupId)
      .single();
    if (fetchError || !group) return { error: fetchError?.message ?? 'Không tìm thấy nhóm' };
    const members = (group.members as string[]) ?? [];
    if (!members.includes(newOwnerId)) return { error: 'Người nhận phải là thành viên nhóm' };
    const admins = (group.admins as string[]) ?? [];
    const nextAdmins = admins.filter(id => id !== newOwnerId);
    nextAdmins.push(group.owner_id as string);
    const { error: updateError } = await this.supabase
      .from('chat_groups')
      .update({ owner_id: newOwnerId, admins: [...new Set(nextAdmins)] })
      .eq('id', groupId);
    if (updateError) return { error: updateError.message };
    this.groups.update(list =>
      list.map(g => g.id === groupId ? { ...g, owner_id: newOwnerId, admins: [...new Set(nextAdmins)] } : g)
    );
    return {};
  }

  // ── Messages ──────────────────────────────────────────────
  async loadMessages(conversationId: string | null, groupId: string | null): Promise<void> {
    let query = this.supabase.from('messages').select('*').order('created_at');
    if (conversationId) query = query.eq('conversation_id', conversationId);
    if (groupId)        query = query.eq('group_id', groupId);
    const { data, error } = await query;
    if (error) {
      console.error('[ChatService] loadMessages error:', error.code, error.message);
      this.messages.set([]);
      this.subscribeMessages(conversationId, groupId);
      return;
    }
    this.messages.set(data ?? []);
    this.subscribeMessages(conversationId, groupId);
  }

  private subscribeMessages(conversationId: string | null, groupId: string | null): void {
    if (this.msgChannel) this.supabase.removeChannel(this.msgChannel);
    const filter = conversationId
      ? `conversation_id=eq.${conversationId}`
      : `group_id=eq.${groupId}`;
    this.msgChannel = this.supabase
      .channel(`messages:${conversationId ?? groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter },
        (p) => this.messages.update(list => {
          const msg = p.new as Message;
          return list.some(m => m.id === msg.id) ? list : [...list, msg];
        }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter },
        (p) => this.messages.update(list => list.map(m => m.id === p.new['id'] ? p.new as Message : m)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter },
        (p) => this.messages.update(list => list.filter(m => m.id !== p.old['id'])))
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[ChatService] Realtime đã kết nối cho cuộc hội thoại/nhóm.');
        } else if (status === 'CHANNEL_ERROR' || err) {
          console.error('[ChatService] Realtime lỗi:', status, err);
        }
      });
  }

  async sendMessage(payload: {
    conversationId?: string;
    groupId?: string;
    content: string;
    replyToId?: string;
    replyToContent?: string;
    mentionedUserIds?: string[];
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
  }): Promise<void> {
    const profile = this.auth.profile()!;
    const { data: newMsg, error: insertError } = await this.supabase.from('messages').insert({
      sender_id:          profile.id,
      sender_name:        profile.display_name,
      sender_photo_url:   profile.photo_url,
      conversation_id:    payload.conversationId ?? null,
      group_id:           payload.groupId ?? null,
      content:            payload.content,
      reply_to_id:        payload.replyToId ?? null,
      reply_to_content:   payload.replyToContent ?? null,
      mentioned_user_ids: payload.mentionedUserIds ?? [],
      file_url:           payload.fileUrl ?? null,
      file_name:          payload.fileName ?? null,
      file_type:          payload.fileType ?? null,
      file_size_bytes:    payload.fileSizeBytes ?? null,
    }).select().single();
    if (insertError) {
      console.error('[ChatService] sendMessage error:', insertError.code, insertError.message);
      throw new Error(insertError.message || 'Không gửi được tin nhắn');
    }
    if (newMsg) this.messages.update(list => list.some(m => m.id === newMsg.id) ? list : [...list, newMsg as Message]);
    // Update conversation/group last_message
    if (payload.conversationId) {
      await this.supabase.from('conversations').update({ last_message: payload.content, last_message_at: new Date().toISOString() }).eq('id', payload.conversationId);
    }
    if (payload.groupId) {
      await this.supabase.from('chat_groups').update({ last_message: payload.content, last_message_at: new Date().toISOString() }).eq('id', payload.groupId);
    }
  }

  async editMessage(id: string, content: string): Promise<void> {
    await this.supabase.from('messages').update({ content, edited_at: new Date().toISOString() }).eq('id', id);
  }

  async deleteMessage(id: string): Promise<void> {
    await this.supabase.from('messages').delete().eq('id', id);
  }

  async markRead(messageId: string): Promise<void> {
    const uid = this.auth.userId()!;
    await this.supabase.from('message_reads').upsert({ message_id: messageId, user_id: uid });
  }

  async uploadAttachment(file: File, scope: 'conversations' | 'groups', scopeId: string) {
    const filePath = `${scope}/${scopeId}/${Date.now()}_${file.name}`;
    const { error } = await this.supabase.storage.from('chat-attachments').upload(filePath, file);
    if (error) throw error;
    const { data } = await this.supabase.storage.from('chat-attachments').createSignedUrl(filePath, 3600);
    return { url: data!.signedUrl, name: file.name, type: file.type, size: file.size };
  }

  // ── Settings ──────────────────────────────────────────────
  async loadSettings(): Promise<void> {
    const { data, error } = await this.supabase.from('chat_settings').select('*').eq('id', 'default').single();
    if (error) {
      console.error('[ChatService] loadSettings error:', error.code, error.message);
      this.settings.set(null);
      return;
    }
    this.settings.set(data);
  }

  async updateSettings(updates: Partial<ChatSettings>): Promise<void> {
    await this.supabase.from('chat_settings').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', 'default');
    this.settings.update(s => s ? { ...s, ...updates } : s);
  }

  cleanupMessages(): void {
    if (this.msgChannel) {
      this.supabase.removeChannel(this.msgChannel);
      this.msgChannel = null;
    }
    this.messages.set([]);
  }
}
