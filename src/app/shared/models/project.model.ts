import { ProjectMember } from './profile.model';

export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  client_name: string | null;
  client_contact: string | null;
  pm_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  budget: number | null;
  currency: string;
  description: string | null;
  objectives_text: string | null;
  scope: string | null;
  deliverables: string | null;
  stats_total_tasks: number;
  stats_completed_tasks: number;
  /** Metadata: this project aligns to this KR (does NOT auto-contribute tasks) */
  linked_kr_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  project_members?: ProjectMember[];
}

export interface CreateProjectDto {
  name: string;
  client_name?: string;
  client_contact?: string;
  pm_id?: string;
  start_date?: string;
  end_date?: string;
  status?: ProjectStatus;
  budget?: number;
  currency?: string;
  description?: string;
  objectives_text?: string;
  scope?: string;
  deliverables?: string;
  linked_kr_id?: string | null;
}
