import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { Profile, SystemRole } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private supabase = inject(SupabaseService).client;

  readonly users     = signal<Profile[]>([]);
  readonly isLoading = signal(false);

  async loadAll(): Promise<void> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase.from('profiles').select('*').order('display_name');
      if (error) throw error;
      this.users.set(data ?? []);
    } finally {
      this.isLoading.set(false);
    }
  }

  async searchByEmail(query: string): Promise<Profile[]> {
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .ilike('email', `%${query}%`)
      .limit(10);
    return data ?? [];
  }

  async updateRole(userId: string, role: SystemRole): Promise<void> {
    await this.supabase.from('profiles').update({ system_role: role, updated_at: new Date().toISOString() }).eq('id', userId);
    this.users.update(list => list.map(u => u.id === userId ? { ...u, system_role: role } : u));
  }

  async uploadAvatar(file: File, userId: string, supabase = this.supabase): Promise<string> {
    const ext      = file.name.split('.').pop();
    const filePath = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  }
}
