import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { AuthService } from '../core/auth/auth.service';
import { ActiveTimer } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class TimerService {
  private supabase = inject(SupabaseService).client;
  private auth     = inject(AuthService);

  /** Tick every second when running so templates re-render and elapsed() updates */
  private _tick = signal(0);

  readonly activeTimer = computed(() => this.auth.profile()?.active_timer ?? null);
  readonly isRunning   = computed(() => this.activeTimer()?.isRunning ?? false);
  readonly elapsed     = computed(() => {
    this._tick(); // depend on tick so this recomputes every second when timer runs
    const timer = this.activeTimer();
    if (!timer?.isRunning) return 0;
    return Math.floor((Date.now() - new Date(timer.startTime).getTime()) / 1000);
  });

  constructor() {
    setInterval(() => {
      if (this.isRunning()) this._tick.update(t => t + 1);
    }, 1000);
  }

  async start(
    projectId: string,
    taskId: string,
    subtaskId: string | null = null,
    taskTitle?: string,
    projectName?: string,
    subtaskTitle?: string
  ): Promise<void> {
    if (this.isRunning()) await this.stop();

    const uid = this.auth.userId()!;
    const timer: ActiveTimer = {
      isRunning: true,
      taskId,
      subtaskId,
      projectId,
      startTime: new Date().toISOString(),
      taskTitle: taskTitle ?? undefined,
      projectName: projectName ?? undefined,
      subtaskTitle: subtaskTitle ?? undefined
    };
    await this.supabase.from('profiles').update({ active_timer: timer }).eq('id', uid);
    this.auth.profile.update(p => p ? { ...p, active_timer: timer } : p);
    this._tick.update(t => t + 1);
  }

  async stop(): Promise<number> {
    const timer = this.activeTimer();
    if (!timer?.isRunning) return 0;

    const uid     = this.auth.userId()!;
    const seconds = Math.max(1, Math.floor((Date.now() - new Date(timer.startTime).getTime()) / 1000));

    await this.supabase.from('profiles').update({ active_timer: null }).eq('id', uid);
    this.auth.profile.update(p => p ? { ...p, active_timer: null } : p);

    // Log time
    await this.supabase.from('time_logs').insert({
      user_id: uid,
      task_id: timer.taskId,
      subtask_id: timer.subtaskId,
      seconds
    });

    return seconds;
  }

  formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  }
}
