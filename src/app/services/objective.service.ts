import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { Objective, KeyResult, BigPictureObjective } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class ObjectiveService {
  private supabase = inject(SupabaseService).client;

  readonly objectives      = signal<Objective[]>([]);
  readonly isLoading       = signal(false);
  readonly allKeyResults   = signal<KeyResult[]>([]);

  /** Load all KRs (global + all projects) for use in dropdowns */
  async loadAllKeyResults(): Promise<void> {
    const { data } = await this.supabase
      .from('key_results')
      .select('*, objectives(id, title, type)')
      .order('created_at');
    this.allKeyResults.set(data ?? []);
  }

  /** Call get_big_picture() RPC → returns full company strategy picture */
  async getBigPicture(): Promise<BigPictureObjective[]> {
    const { data, error } = await this.supabase.rpc('get_big_picture');
    if (error) { console.error('get_big_picture error:', error); return []; }
    const raw = (data as any[]) ?? [];
    return raw.map((row: any) => ({
      ...row,
      value_chain_activity_id: row.value_chain_activity_id ?? row.valueChainActivityId ?? null,
      value_chain_activity_code: row.value_chain_activity_code ?? row.valueChainActivityCode ?? null,
      value_chain_activity_label: row.value_chain_activity_label ?? row.valueChainActivityLabel ?? null,
      value_chain_activity_sort_order: row.value_chain_activity_sort_order ?? row.valueChainActivitySortOrder ?? null,
      ksf_id: row.ksf_id ?? row.ksfId ?? null,
      ksf_code: row.ksf_code ?? row.ksfCode ?? null,
      ksf_label: row.ksf_label ?? row.ksfLabel ?? null,
      perspective_id: row.perspective_id ?? row.perspectiveId ?? null,
      perspective_code: row.perspective_code ?? row.perspectiveCode ?? null,
      perspective_label: row.perspective_label ?? row.perspectiveLabel ?? null,
    })) as BigPictureObjective[];
  }

  async loadObjectives(projectId: string | null = null): Promise<void> {
    this.isLoading.set(true);
    let query = this.supabase
      .from('objectives')
      .select(`
        *,
        key_results(*),
        strategy:strategies(id, title, period_year, period_quarter, vision_id, vision:visions(id, title)),
        value_chain_activity:value_chain_activities(id, code, label),
        ksf:ksfs(id, code, label)
      `)
      .order('created_at');

    if (projectId === null) {
      query = query.is('project_id', null);
    } else {
      query = query.eq('project_id', projectId);
    }

    const { data } = await query;
    const list = (data ?? []).map((row: any) => ({
      ...row,
      strategy: row.strategy,
      value_chain_activity: row.value_chain_activity,
      ksf: row.ksf,
    }));
    this.objectives.set(list);
    this.isLoading.set(false);
  }

  async createObjective(dto: Partial<Objective>): Promise<Objective | null> {
    const { data } = await this.supabase.from('objectives').insert(dto).select('*, key_results(*)').single();
    if (data) this.objectives.update(list => [...list, data]);
    return data;
  }

  async updateObjective(id: string, updates: Partial<Objective>): Promise<void> {
    await this.supabase.from('objectives').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    this.objectives.update(list => list.map(o => o.id === id ? { ...o, ...updates } : o));
  }

  async deleteObjective(id: string): Promise<void> {
    await this.supabase.from('objectives').delete().eq('id', id);
    this.objectives.update(list => list.filter(o => o.id !== id));
  }

  async addKeyResult(kr: Partial<KeyResult>): Promise<KeyResult | null> {
    const { data } = await this.supabase.from('key_results').insert(kr).select().single();
    if (data) {
      this.objectives.update(list => list.map(o =>
        o.id === kr.objective_id
          ? { ...o, key_results: [...(o.key_results ?? []), data] }
          : o
      ));
    }
    return data;
  }

  async updateKeyResult(id: string, updates: Partial<KeyResult>): Promise<void> {
    await this.supabase.from('key_results').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    this.objectives.update(list => list.map(o => ({
      ...o,
      key_results: (o.key_results ?? []).map(kr => kr.id === id ? { ...kr, ...updates } : kr)
    })));
  }

  async deleteKeyResult(id: string, objectiveId: string): Promise<void> {
    await this.supabase.from('key_results').delete().eq('id', id);
    this.objectives.update(list => list.map(o =>
      o.id === objectiveId
        ? { ...o, key_results: (o.key_results ?? []).filter(kr => kr.id !== id) }
        : o
    ));
  }
}
