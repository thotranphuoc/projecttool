import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase.service';
import { Profile } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService).client;
  private router   = inject(Router);

  readonly session    = signal<Session | null>(null);
  readonly profile    = signal<Profile | null>(null);
  readonly isLoading  = signal(true);

  readonly isAuthenticated = computed(() => !!this.session());
  readonly userId          = computed(() => this.session()?.user.id ?? null);
  readonly systemRole      = computed(() => this.profile()?.system_role ?? 'user');
  readonly isAdmin         = computed(() => this.systemRole() === 'admin');
  readonly isDirector      = computed(() => ['admin', 'director'].includes(this.systemRole()));

  constructor() {
    this.initAuth();
  }

  private async initAuth(): Promise<void> {
    // Step 1: Get current session synchronously from storage
    const { data: { session }, error: sessErr } = await this.supabase.auth.getSession();
    if (sessErr) console.error('getSession error:', sessErr.message);

    this.session.set(session);
    if (session) {
      await this.loadProfile(session.user.id);
    } else {
      this.isLoading.set(false);
    }

    // Step 2: Subscribe to future auth changes; skip INITIAL_SESSION (handled above)
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return;

      this.session.set(session);
      if (session) {
        await this.loadProfile(session.user.id);
      } else {
        this.profile.set(null);
        this.isLoading.set(false);
        this.router.navigate(['/login']);
      }
    });
  }

  private async loadProfile(userId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('loadProfile error:', error.code, error.message);
        if (error.code === 'PGRST116') {
          // Profile not yet created by trigger — retry once after 1.5s
          await new Promise(r => setTimeout(r, 1500));
          const { data: retry } = await this.supabase
            .from('profiles').select('*').eq('id', userId).single();
          this.profile.set(retry);
        }
      } else {
        this.profile.set(data);
      }
    } catch (e) {
      console.error('loadProfile exception:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async signInWithGoogle(): Promise<void> {
    await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
  }

  async signInWithPassword(email: string, password: string) {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signUp(email: string, password: string, displayName?: string) {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName ?? email.split('@')[0] }
      }
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const uid = this.userId();
    if (uid) {
      await this.supabase.from('profiles').update({ active_timer: null }).eq('id', uid);
    }
    await this.supabase.auth.signOut();
    this.router.navigate(['/login']);
  }

  async updateProfile(updates: Partial<Pick<Profile, 'display_name' | 'photo_url'>>): Promise<void> {
    const uid = this.userId();
    if (!uid) return;
    const { data } = await this.supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', uid)
      .select()
      .single();
    if (data) this.profile.set(data);
  }
}
