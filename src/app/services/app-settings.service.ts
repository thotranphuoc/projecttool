import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private supabase = inject(SupabaseService).client;

  readonly menuVisibility = signal<Record<string, boolean>>({});
  readonly errorLogEnabled = signal<boolean>(true);

  async loadAppSettings(): Promise<void> {
    const { data } = await this.supabase
      .from('app_settings')
      .select('menu_visibility, error_log_enabled')
      .eq('id', 'default')
      .single();
    this.menuVisibility.set((data?.menu_visibility as Record<string, boolean>) ?? {});
    this.errorLogEnabled.set(data?.error_log_enabled ?? true);
  }

  async setErrorLogEnabled(enabled: boolean): Promise<void> {
    await this.supabase
      .from('app_settings')
      .update({ error_log_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', 'default');
    this.errorLogEnabled.set(enabled);
  }

  async updateMenuVisibility(route: string, visible: boolean): Promise<void> {
    const current = this.menuVisibility();
    const next = { ...current, [route]: visible };
    await this.supabase
      .from('app_settings')
      .update({ menu_visibility: next, updated_at: new Date().toISOString() })
      .eq('id', 'default');
    this.menuVisibility.set(next);
  }

  async setAllMenuVisible(routes: string[]): Promise<void> {
    const next: Record<string, boolean> = {};
    for (const route of routes) next[route] = true;
    await this.supabase
      .from('app_settings')
      .update({ menu_visibility: next, updated_at: new Date().toISOString() })
      .eq('id', 'default');
    this.menuVisibility.set(next);
  }
}
