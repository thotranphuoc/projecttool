import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { ErrorLogService } from '../core/error-log.service';
import { AuthService } from '../core/auth/auth.service';
import { Project, CreateProjectDto, ProjectMember } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private supabase = inject(SupabaseService).client;
  private errorLog = inject(ErrorLogService);
  private auth     = inject(AuthService);

  readonly projects   = signal<Project[]>([]);
  readonly isLoading  = signal(false);

  async loadProjects(): Promise<void> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*, project_members(user_id, project_role, profiles(id, display_name, photo_url, email))')
        .order('created_at', { ascending: false });
      this.errorLog.logSupabase({ data, error }, 'loadProjects');
      this.projects.set(data ?? []);
    } catch (e) {
      console.error('loadProjects exception:', e);
      this.projects.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async getProject(id: string): Promise<Project | null> {
    const { data } = await this.supabase
      .from('projects')
      .select('*, project_members(user_id, project_role, profiles(id, display_name, photo_url, email, system_role))')
      .eq('id', id)
      .single();
    return data;
  }

  async createProject(dto: CreateProjectDto): Promise<Project | null> {
    const uid = this.auth.userId()!;
    const { data } = await this.supabase
      .from('projects')
      .insert({ ...dto, created_by: uid })
      .select()
      .single();
    if (data) {
      // Creator is always a manager so they can add members
      await this.supabase.from('project_members').insert({ project_id: data.id, user_id: uid, project_role: 'manager' });
      // If PM is someone else, add them as manager too
      if (dto.pm_id && dto.pm_id !== uid) {
        await this.supabase.from('project_members').insert({ project_id: data.id, user_id: dto.pm_id, project_role: 'manager' });
      }
      await this.loadProjects();
    }
    return data;
  }

  async updateProject(id: string, updates: Partial<CreateProjectDto>): Promise<void> {
    await this.supabase.from('projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    // If PM changed, ensure the new PM is in project_members (upsert to avoid duplicate error)
    if (updates.pm_id) {
      await this.supabase.from('project_members')
        .upsert({ project_id: id, user_id: updates.pm_id, project_role: 'manager' }, { onConflict: 'project_id,user_id' });
    }
    await this.loadProjects();
  }

  async deleteProject(id: string): Promise<void> {
    await this.supabase.from('projects').delete().eq('id', id);
    this.projects.update(list => list.filter(p => p.id !== id));
  }

  async getMembers(projectId: string): Promise<ProjectMember[]> {
    const { data } = await this.supabase
      .from('project_members')
      .select('*, profiles(id, display_name, photo_url, email, system_role)')
      .eq('project_id', projectId);
    return data ?? [];
  }

  async addMember(projectId: string, userId: string, role: 'manager' | 'member' = 'member'): Promise<{ error?: { message: string } }> {
    const { error } = await this.supabase
      .from('project_members')
      .insert({ project_id: projectId, user_id: userId, project_role: role });
    return { error: error ? { message: error.message } : undefined };
  }

  async removeMember(projectId: string, userId: string): Promise<{ error?: { message: string } }> {
    const { error } = await this.supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    return { error: error ? { message: error.message } : undefined };
  }

  async updateMemberRole(projectId: string, userId: string, role: 'manager' | 'member'): Promise<{ error?: { message: string } }> {
    const { error } = await this.supabase
      .from('project_members')
      .update({ project_role: role })
      .eq('project_id', projectId)
      .eq('user_id', userId);
    return { error: error ? { message: error.message } : undefined };
  }

  isManager(projectId: string): boolean {
    const uid = this.auth.userId();
    if (!uid) return false;
    if (this.auth.isAdmin()) return true;
    const project = this.projects().find(p => p.id === projectId);
    return (project?.project_members as any[])?.some(
      (m: any) => m.user_id === uid && m.project_role === 'manager'
    ) ?? false;
  }
}
