import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth/auth.service';
import { AppSettingsService } from '../services/app-settings.service';

export interface ErrorLogEntry {
  id?: string;
  created_at?: string;
  user_id?: string | null;
  context: string;
  error_message?: string | null;
  error_code?: string | null;
  error_name?: string | null;
  error_details?: Record<string, unknown> | null;
  url?: string | null;
  route_path?: string | null;
  user_agent?: string | null;
  extra?: Record<string, unknown> | null;
}

@Injectable({ providedIn: 'root' })
export class ErrorLogService {
  private supabase = inject(SupabaseService).client;
  private auth = inject(AuthService);
  private appSettings = inject(AppSettingsService);

  /** Ghi log lỗi vào DB và console. Không throw, tránh loop. */
  async log(error: unknown, context: string, extra?: Record<string, unknown>): Promise<void> {
    const url = typeof window !== 'undefined' ? window.location.href : null;
    const payload: Omit<ErrorLogEntry, 'id' | 'created_at'> = {
      user_id: this.auth.userId() ?? null,
      context,
      error_message: this.getErrorMessage(error),
      error_code: (error as { code?: string })?.code ?? null,
      error_name: (error instanceof Error ? error.name : (error as { name?: string })?.name) ?? null,
      error_details: this.safeSerialize(error),
      url,
      route_path: url ? this.extractRoutePath(url) : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      extra: extra ?? null,
    };

    console.error('[ErrorLog]', context, payload);

    if (!this.appSettings.errorLogEnabled()) return;

    try {
      const { error: insertError } = await this.supabase
        .from('error_logs')
        .insert(payload);

      if (insertError) {
        console.error('Failed to save error log to DB:', insertError);
      }
    } catch (e) {
      console.error('ErrorLogService.log failed:', e);
    }
  }

  /** Helper: log khi có { data, error } từ Supabase */
  logSupabase(result: { data?: unknown; error?: unknown }, context: string, extra?: Record<string, unknown>): void {
    if (result?.error) {
      this.log(result.error, `Supabase: ${context}`, { ...extra, responseData: result.data });
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) return String((error as { message: unknown }).message);
    return String(error);
  }

  private extractRoutePath(url: string): string {
    try {
      const u = new URL(url);
      return u.pathname || '/';
    } catch {
      return url;
    }
  }

  private safeSerialize(obj: unknown): Record<string, unknown> | null {
    try {
      if (obj instanceof Error) {
        return { name: obj.name, message: obj.message, stack: obj.stack };
      }
      if (typeof obj === 'object' && obj !== null) {
        const o = obj as Record<string, unknown>;
        return { ...o };
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Admin/Director: xóa error logs theo danh sách id */
  async deleteLogs(ids: string[]): Promise<{ deleted: number; error?: string }> {
    if (!ids.length) return { deleted: 0 };
    const { error } = await this.supabase
      .from('error_logs')
      .delete()
      .in('id', ids);
    if (error) {
      console.error('Failed to delete error logs:', error);
      return { deleted: 0, error: error.message };
    }
    return { deleted: ids.length };
  }

  /** Admin/Director: lấy danh sách error logs từ DB */
  async loadLogs(limit = 100, offset = 0, contextFilter?: string, routeFilter?: string): Promise<ErrorLogEntry[]> {
    let q = this.supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (contextFilter?.trim()) {
      q = q.ilike('context', `%${contextFilter.trim()}%`);
    }
    if (routeFilter?.trim()) {
      q = q.ilike('route_path', `%${routeFilter.trim()}%`);
    }
    const { data, error } = await q;
    if (error) {
      console.error('Failed to load error logs:', error);
      return [];
    }
    return (data ?? []) as ErrorLogEntry[];
  }
}
