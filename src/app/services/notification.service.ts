import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { SupabaseService } from '../core/supabase.service';
import { Notification } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private supabase = inject(SupabaseService).client;
  private auth     = inject(AuthService);

  readonly notifications = signal<Notification[]>([]);
  readonly unreadCount   = computed(() => this.notifications().filter(n => !n.is_read).length);

  private channel: ReturnType<typeof this.supabase.channel> | null = null;

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      if (userId) {
        this.load(userId);
        this.subscribe(userId);
      } else {
        this.notifications.set([]);
        if (this.channel) {
          this.supabase.removeChannel(this.channel);
          this.channel = null;
        }
      }
    });
  }

  private async load(userId: string): Promise<void> {
    const { data } = await this.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    this.notifications.set(data ?? []);
  }

  private subscribe(userId: string): void {
    if (this.channel) this.supabase.removeChannel(this.channel);
    this.channel = this.supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        this.notifications.update(list => [payload.new as Notification, ...list]);
      })
      .subscribe();
  }

  async markRead(id: string): Promise<void> {
    await this.supabase.from('notifications').update({ is_read: true }).eq('id', id);
    this.notifications.update(list =>
      list.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  }

  async markAllRead(): Promise<void> {
    const uid = this.auth.userId();
    if (!uid) return;
    await this.supabase.from('notifications').update({ is_read: true }).eq('user_id', uid);
    this.notifications.update(list => list.map(n => ({ ...n, is_read: true })));
  }
}
