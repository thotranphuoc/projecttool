import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { Vision, Strategy, ValueChainActivity, Ksf, Perspective } from '../shared/models';

@Injectable({ providedIn: 'root' })
export class VisionStrategyService {
  private supabase = inject(SupabaseService).client;

  readonly visions = signal<Vision[]>([]);
  readonly strategies = signal<Strategy[]>([]);
  readonly valueChainActivities = signal<ValueChainActivity[]>([]);
  readonly ksfs = signal<Ksf[]>([]);
  readonly perspectives = signal<Perspective[]>([]);
  readonly isLoading = signal(false);

  async loadPerspectives(): Promise<void> {
    const { data } = await this.supabase
      .from('perspectives')
      .select('*')
      .order('sort_order', { ascending: true });
    this.perspectives.set(data ?? []);
  }

  async loadVisions(): Promise<void> {
    this.isLoading.set(true);
    const { data } = await this.supabase
      .from('visions')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at');
    this.visions.set(data ?? []);
    this.isLoading.set(false);
  }

  async loadStrategies(visionId?: string): Promise<void> {
    let query = this.supabase
      .from('strategies')
      .select('*, vision:visions(id, title)')
      .order('sort_order', { ascending: true })
      .order('created_at');
    if (visionId) {
      query = query.eq('vision_id', visionId);
    }
    const { data } = await query;
    const list = (data ?? []).map((row: any) => ({
      ...row,
      vision: row.vision,
    }));
    this.strategies.set(list);
  }

  /** Load all strategies (for dropdowns); optionally filter by project or company-wide */
  async loadAllStrategies(): Promise<void> {
    const { data } = await this.supabase
      .from('strategies')
      .select('*, vision:visions(id, title)')
      .order('sort_order', { ascending: true })
      .order('period_year', { ascending: false })
      .order('period_quarter', { ascending: false, nullsFirst: false });
    const list = (data ?? []).map((row: any) => ({
      ...row,
      vision: row.vision,
    }));
    this.strategies.set(list);
  }

  async loadStrategiesForProject(projectId: string | null): Promise<Strategy[]> {
    let query = this.supabase
      .from('strategies')
      .select('*, vision:visions(id, title)')
      .order('sort_order')
      .order('period_year', { ascending: false });
    if (projectId) {
      query = query.or(`project_id.eq.${projectId},project_id.is.null`);
    } else {
      query = query.is('project_id', null);
    }
    const { data } = await query;
    return (data ?? []).map((row: any) => ({ ...row, vision: row.vision }));
  }

  async loadValueChainActivities(): Promise<void> {
    const { data } = await this.supabase
      .from('value_chain_activities')
      .select('*')
      .order('sort_order', { ascending: true });
    this.valueChainActivities.set(data ?? []);
  }

  async createValueChainActivity(dto: Partial<ValueChainActivity>): Promise<ValueChainActivity | null> {
    const { data, error } = await this.supabase.from('value_chain_activities').insert(dto).select().single();
    if (error) throw error;
    if (data) this.valueChainActivities.update(list => [...list, data].sort((a, b) => a.sort_order - b.sort_order));
    return data;
  }

  async updateValueChainActivity(id: string, dto: Partial<ValueChainActivity>): Promise<void> {
    const { error } = await this.supabase.from('value_chain_activities').update(dto).eq('id', id);
    if (error) {
      console.error('[VisionStrategyService] updateValueChainActivity failed', { id, error });
      throw error;
    }
    this.valueChainActivities.update(list =>
      list.map(v => v.id === id ? { ...v, ...dto } : v).sort((a, b) => a.sort_order - b.sort_order)
    );
  }

  async deleteValueChainActivity(id: string): Promise<void> {
    const { error } = await this.supabase.from('value_chain_activities').delete().eq('id', id);
    if (error) throw error;
    this.valueChainActivities.update(list => list.filter(v => v.id !== id));
  }

  async loadKsfs(): Promise<void> {
    const { data } = await this.supabase
      .from('ksfs')
      .select('*')
      .order('sort_order', { ascending: true });
    this.ksfs.set(data ?? []);
  }

  async createKsf(dto: Partial<Ksf>): Promise<Ksf | null> {
    const { data, error } = await this.supabase.from('ksfs').insert(dto).select().single();
    if (error) throw error;
    if (data) this.ksfs.update(list => [...list, data].sort((a, b) => a.sort_order - b.sort_order));
    return data;
  }

  async updateKsf(id: string, dto: Partial<Ksf>): Promise<void> {
    const { error } = await this.supabase.from('ksfs').update(dto).eq('id', id);
    if (error) throw error;
    this.ksfs.update(list =>
      list.map(k => k.id === id ? { ...k, ...dto } : k).sort((a, b) => a.sort_order - b.sort_order)
    );
  }

  async deleteKsf(id: string): Promise<void> {
    const { error } = await this.supabase.from('ksfs').delete().eq('id', id);
    if (error) throw error;
    this.ksfs.update(list => list.filter(k => k.id !== id));
  }

  async createVision(dto: Partial<Vision>): Promise<Vision | null> {
    const payload = { ...dto, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('visions').insert(payload).select().single();
    if (error) throw error;
    if (data) this.visions.update(list => [...list, data]);
    return data;
  }

  async updateVision(id: string, dto: Partial<Vision>): Promise<void> {
    const { error } = await this.supabase.from('visions').update({ ...dto, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    this.visions.update(list => list.map(v => v.id === id ? { ...v, ...dto } : v));
  }

  async deleteVision(id: string): Promise<void> {
    const { error } = await this.supabase.from('visions').delete().eq('id', id);
    if (error) throw error;
    this.visions.update(list => list.filter(v => v.id !== id));
  }

  async createStrategy(dto: Partial<Strategy>): Promise<Strategy | null> {
    const payload = { ...dto, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('strategies').insert(payload).select('*, vision:visions(id, title)').single();
    if (error) throw error;
    if (data) {
      const row = { ...data, vision: (data as any).vision };
      this.strategies.update(list => [...list, row]);
      return row;
    }
    return null;
  }

  async updateStrategy(id: string, dto: Partial<Strategy>): Promise<void> {
    const { error } = await this.supabase.from('strategies').update({ ...dto, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    this.strategies.update(list => list.map(s => s.id === id ? { ...s, ...dto } : s));
  }

  async deleteStrategy(id: string): Promise<void> {
    const { error } = await this.supabase.from('strategies').delete().eq('id', id);
    if (error) throw error;
    this.strategies.update(list => list.filter(s => s.id !== id));
  }
}
