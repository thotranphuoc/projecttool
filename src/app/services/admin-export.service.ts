import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { ProjectService } from './project.service';

function escapeCsvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function dateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable({ providedIn: 'root' })
export class AdminExportService {
  private supabase = inject(SupabaseService).client;
  private projectSvc = inject(ProjectService);

  async exportVisions(): Promise<void> {
    const { data } = await this.supabase
      .from('visions')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at');
    const rows = (data ?? []).map((r: any) => [
      r.id,
      r.title ?? '',
      r.description ?? '',
      r.sort_order,
      r.created_at ?? '',
      r.updated_at ?? '',
    ]);
    downloadCsv(
      `tam-nhin-${dateStr()}.csv`,
      ['ID', 'Tiêu đề', 'Mô tả', 'Thứ tự', 'Ngày tạo', 'Ngày cập nhật'],
      rows
    );
  }

  async exportStrategies(): Promise<void> {
    const { data } = await this.supabase
      .from('strategies')
      .select('*, vision:visions(id, title)')
      .order('sort_order', { ascending: true })
      .order('period_year', { ascending: false })
      .order('period_quarter', { ascending: false, nullsFirst: false });
    const rows = (data ?? []).map((r: any) => [
      r.id,
      r.vision_id ?? '',
      r.vision?.title ?? '',
      r.project_id ?? '',
      r.title ?? '',
      r.description ?? '',
      r.period_year ?? '',
      r.period_quarter ?? '',
      r.sort_order ?? '',
      r.created_at ?? '',
      r.updated_at ?? '',
    ]);
    downloadCsv(
      `chien-luoc-${dateStr()}.csv`,
      ['ID', 'Vision ID', 'Tên Vision', 'Project ID', 'Tiêu đề', 'Mô tả', 'Năm', 'Quý', 'Thứ tự', 'Ngày tạo', 'Ngày cập nhật'],
      rows
    );
  }

  async exportValueChainActivities(): Promise<void> {
    const { data } = await this.supabase
      .from('value_chain_activities')
      .select('*')
      .order('sort_order', { ascending: true });
    const rows = (data ?? []).map((r: any) => [
      r.id,
      r.code ?? '',
      r.label ?? '',
      r.sort_order ?? '',
    ]);
    downloadCsv(
      `chuoi-gia-tri-${dateStr()}.csv`,
      ['ID', 'Code', 'Tên hiển thị', 'Thứ tự'],
      rows
    );
  }

  async exportKsfs(): Promise<void> {
    const { data } = await this.supabase
      .from('ksfs')
      .select('*')
      .order('sort_order', { ascending: true });
    const rows = (data ?? []).map((r: any) => [
      r.id,
      r.code ?? '',
      r.label ?? '',
      r.sort_order ?? '',
    ]);
    downloadCsv(
      `ksf-${dateStr()}.csv`,
      ['ID', 'Code', 'Tên hiển thị', 'Thứ tự'],
      rows
    );
  }

  async exportObjectives(): Promise<void> {
    const { data } = await this.supabase
      .from('objectives')
      .select('*, strategy:strategies(id, title), value_chain_activity:value_chain_activities(id, label), ksf:ksfs(id, label)')
      .order('created_at');
    const rows = (data ?? []).map((r: any) => [
      r.id,
      r.project_id ?? '',
      r.title ?? '',
      r.description ?? '',
      r.type ?? '',
      r.status ?? '',
      r.progress_percent ?? 0,
      r.strategy_id ?? '',
      r.strategy?.title ?? '',
      r.value_chain_activity_id ?? '',
      r.value_chain_activity?.label ?? '',
      r.ksf_id ?? '',
      r.ksf?.label ?? '',
      r.created_at ?? '',
      r.updated_at ?? '',
    ]);
    downloadCsv(
      `objectives-${dateStr()}.csv`,
      ['ID', 'Project ID', 'Tiêu đề', 'Mô tả', 'BSC Type', 'Trạng thái', 'Tiến độ %', 'Strategy ID', 'Tên chiến lược', 'Chuỗi giá trị ID', 'Tên chuỗi giá trị', 'KSF ID', 'Tên KSF', 'Ngày tạo', 'Ngày cập nhật'],
      rows
    );
  }

  async exportKeyResults(): Promise<void> {
    const { data } = await this.supabase
      .from('key_results')
      .select('*, objectives(id, title)')
      .order('created_at');
    const rows = (data ?? []).map((r: any) => [
      r.id,
      r.objective_id ?? '',
      r.objectives?.title ?? '',
      r.title ?? '',
      r.type ?? '',
      r.weight ?? '',
      r.target_value ?? '',
      r.current_value ?? '',
      r.unit ?? '',
      r.progress_percent ?? 0,
      r.created_at ?? '',
      r.updated_at ?? '',
    ]);
    downloadCsv(
      `key-results-${dateStr()}.csv`,
      ['ID', 'Objective ID', 'Tên Objective', 'Tiêu đề', 'Loại', 'Trọng số', 'Mục tiêu', 'Hiện tại', 'Đơn vị', 'Tiến độ %', 'Ngày tạo', 'Ngày cập nhật'],
      rows
    );
  }

  async exportTasks(): Promise<void> {
    let tasks: any[] = [];
    const { data: direct } = await this.supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (direct != null && direct.length > 0) {
      tasks = direct;
    } else {
      await this.projectSvc.loadProjects();
      const projects = this.projectSvc.projects();
      for (const p of projects) {
        const { data: projectTasks } = await this.supabase
          .from('tasks')
          .select('*')
          .eq('project_id', p.id)
          .order('created_at', { ascending: false });
        if (projectTasks?.length) tasks.push(...projectTasks);
      }
    }
    const rows = tasks.map((r: any) => [
      r.id,
      r.project_id ?? '',
      r.title ?? '',
      r.description ?? '',
      r.status ?? '',
      r.priority ?? '',
      r.linked_kr_id ?? '',
      r.due_date ?? '',
      r.start_date ?? '',
      r.contribution_weight ?? 1,
      r.created_at ?? '',
      r.updated_at ?? '',
    ]);
    downloadCsv(
      `tasks-${dateStr()}.csv`,
      ['ID', 'Project ID', 'Tiêu đề', 'Mô tả', 'Trạng thái', 'Ưu tiên', 'KR ID', 'Hạn', 'Ngày bắt đầu', 'Trọng số', 'Ngày tạo', 'Ngày cập nhật'],
      rows
    );
  }

  async exportAll(): Promise<void> {
    await this.exportVisions();
    await new Promise(r => setTimeout(r, 300));
    await this.exportStrategies();
    await new Promise(r => setTimeout(r, 300));
    await this.exportValueChainActivities();
    await new Promise(r => setTimeout(r, 300));
    await this.exportKsfs();
    await new Promise(r => setTimeout(r, 300));
    await this.exportObjectives();
    await new Promise(r => setTimeout(r, 300));
    await this.exportKeyResults();
    await new Promise(r => setTimeout(r, 300));
    await this.exportTasks();
  }
}
