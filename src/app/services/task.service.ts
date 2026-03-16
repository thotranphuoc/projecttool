import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { ErrorLogService } from '../core/error-log.service';
import { Task, Subtask, TaskComment, TimeLog, CreateTaskDto, TaskStatus } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private supabase = inject(SupabaseService).client;
  private errorLog = inject(ErrorLogService);

  readonly tasks         = signal<Task[]>([]);
  readonly isLoading     = signal(false);
  readonly commentCounts = signal<Record<string, number>>({});

  private channel: ReturnType<typeof this.supabase.channel> | null = null;

  async loadTasks(projectId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      this.errorLog.logSupabase({ data, error }, 'loadTasks', { projectId });
      this.tasks.set(data ?? []);
      this.isLoading.set(false);
    } catch (e: any) {
      this.isLoading.set(false);
      throw e;
    }
    this.subscribeRealtime(projectId);
    await this.loadCommentCounts(projectId);
  }

  async loadCommentCounts(projectId: string): Promise<void> {
    const taskIds = this.tasks().map(t => t.id);
    if (taskIds.length === 0) {
      this.commentCounts.set({});
      return;
    }
    const { data } = await this.supabase
      .from('task_comments')
      .select('task_id')
      .in('task_id', taskIds);
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { task_id: string }[]) {
      counts[row.task_id] = (counts[row.task_id] ?? 0) + 1;
    }
    this.commentCounts.set(counts);
  }

  private subscribeRealtime(projectId: string): void {
    if (this.channel) this.supabase.removeChannel(this.channel);
    this.channel = this.supabase
      .channel(`tasks:${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          this.tasks.update(list => [...list, payload.new as Task]);
        } else if (payload.eventType === 'UPDATE') {
          this.tasks.update(list => list.map(t => t.id === payload.new['id'] ? payload.new as Task : t));
        } else if (payload.eventType === 'DELETE') {
          this.tasks.update(list => list.filter(t => t.id !== payload.old['id']));
        }
      })
      .subscribe();
  }

  cleanup(): void {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.tasks.set([]);
    this.commentCounts.set({});
  }

  async getTask(projectId: string, taskId: string): Promise<Task | null> {
    const { data } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', taskId)
      .single();
    return data;
  }

  /** Get project_id for a task (e.g. for notification deep link). */
  async getTaskProjectId(taskId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('tasks')
      .select('project_id')
      .eq('id', taskId)
      .single();
    return data?.project_id ?? null;
  }

  async createTask(dto: CreateTaskDto): Promise<Task | null> {
    const { data } = await this.supabase.from('tasks').insert(dto).select().single();
    if (data) {
      const list = this.tasks();
      const sameProject = list.length === 0 || list[0].project_id === (data as Task).project_id;
      if (sameProject) {
        this.tasks.update(tasks => [...tasks, data as Task]);
      }
    }
    return data;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    const updated_at = new Date().toISOString();
    const { error } = await this.supabase
      .from('tasks')
      .update({ ...updates, updated_at })
      .eq('id', id);
    if (!error && this.tasks().some(t => t.id === id)) {
      this.tasks.update(list =>
        list.map(t => t.id === id ? { ...t, ...updates, updated_at } : t)
      );
    }
  }

  async updateStatus(id: string, status: TaskStatus): Promise<void> {
    await this.updateTask(id, { status });
  }

  async deleteTask(id: string): Promise<void> {
    await this.supabase.from('tasks').delete().eq('id', id);
  }

  // ── Subtasks ──────────────────────────────────────────────
  /** Task IDs (parent_id) where user is assigned to at least one subtask. Dùng cho filter "Chỉ của tôi". */
  async getTaskIdsWithUserInSubtasks(projectId: string, userId: string): Promise<Set<string>> {
    const { data } = await this.supabase
      .from('subtasks')
      .select('parent_id')
      .eq('project_id', projectId)
      .contains('assignees', [userId]);
    const ids = new Set<string>();
    for (const row of (data ?? []) as { parent_id: string }[]) {
      if (row.parent_id) ids.add(row.parent_id);
    }
    return ids;
  }

  async getSubtasks(taskId: string): Promise<Subtask[]> {
    const { data } = await this.supabase.from('subtasks').select('*').eq('parent_id', taskId).order('created_at');
    const raw = (data ?? []) as any[];
    return raw.map(row => ({
      ...row,
      assignees: Array.isArray(row.assignees) ? row.assignees.map((id: unknown) => typeof id === 'string' ? id : String(id)) : []
    })) as Subtask[];
  }

  async createSubtask(dto: Omit<Subtask, 'id' | 'actual_seconds' | 'created_at' | 'updated_at'>): Promise<Subtask | null> {
    const { data, error } = await this.supabase.from('subtasks').insert(dto).select().single();
    this.errorLog.logSupabase({ data, error }, 'createSubtask', { parent_id: dto.parent_id });
    return data;
  }

  async updateSubtask(id: string, updates: Partial<Subtask>): Promise<{ error: unknown } | null> {
    const { error } = await this.supabase
      .from('subtasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    return error ? (this.errorLog.log(error, 'updateSubtask', { id }), { error }) : null;
  }

  async deleteSubtask(id: string): Promise<{ error: unknown } | null> {
    const { error } = await this.supabase.from('subtasks').delete().eq('id', id);
    return error ? { error } : null;
  }

  /** Admin: load all tasks with project name. */
  async loadAllTasksForAdmin(): Promise<{ id: string; title: string; status: string; project_id: string; project_name: string }[]> {
    const { data } = await this.supabase
      .from('tasks')
      .select('id, title, status, project_id, projects(name)')
      .order('created_at', { ascending: false });
    return (data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      project_id: r.project_id,
      project_name: r.projects?.name ?? '—'
    }));
  }

  /** Admin: load all subtasks with task and project info. */
  async loadAllSubtasksForAdmin(): Promise<{ id: string; title: string; status: string; task_id: string; task_title: string; project_name: string }[]> {
    const { data } = await this.supabase
      .from('subtasks')
      .select('id, title, status, parent_id, tasks(title), projects(name)')
      .order('created_at', { ascending: false });
    return (data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      task_id: r.parent_id,
      task_title: r.tasks?.title ?? '—',
      project_name: r.projects?.name ?? '—'
    }));
  }

  // ── Comments ──────────────────────────────────────────────
  async getComments(taskId: string): Promise<TaskComment[]> {
    const { data } = await this.supabase
      .from('task_comments')
      .select('id, task_id, author_id, content, mentioned_user_ids, created_at, edited_at, author:profiles(display_name, photo_url, email)')
      .eq('task_id', taskId)
      .order('created_at');
    const raw = (data ?? []) as any[];
    return raw.map(row => {
      const author = row.author ?? row.profiles ?? null;
      return {
        id: row.id,
        task_id: row.task_id,
        author_id: row.author_id,
        content: row.content,
        mentioned_user_ids: row.mentioned_user_ids ?? [],
        created_at: row.created_at,
        edited_at: row.edited_at ?? null,
        author: author ? { display_name: author.display_name ?? null, photo_url: author.photo_url ?? null } : undefined
      } as TaskComment;
    });
  }

  async addComment(taskId: string, authorId: string, content: string, mentionedIds: string[] = []): Promise<{ comment: TaskComment | null; error?: string }> {
    const { data, error } = await this.supabase
      .from('task_comments')
      .insert({ task_id: taskId, author_id: authorId, content, mentioned_user_ids: mentionedIds })
      .select('*, author:profiles(display_name, photo_url)')
      .single();
    if (error) {
      this.errorLog.log(error, 'addComment', { taskId });
      return { comment: null, error: error.message };
    }
    return { comment: data as TaskComment };
  }

  async deleteComment(id: string): Promise<void> {
    await this.supabase.from('task_comments').delete().eq('id', id);
  }

  // ── Time logs ─────────────────────────────────────────────
  async getTimeLogs(taskId: string): Promise<TimeLog[]> {
    const { data } = await this.supabase.from('time_logs').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
    return data ?? [];
  }
}
