export type ObjectiveType = 'financial' | 'customer' | 'internal' | 'learning';
export type ObjectiveStatus = 'on_track' | 'at_risk' | 'behind';
export type KeyResultType = 'metric' | 'task_linked';

export interface Objective {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  type: ObjectiveType;
  status: ObjectiveStatus;
  progress_percent: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  key_results?: KeyResult[];
}

export interface KeyResult {
  id: string;
  objective_id: string;
  title: string;
  type: KeyResultType;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  linked_task_ids: string[];
  weight: number;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

/** Lightweight task info returned by get_big_picture() RPC */
export interface BigPictureTask {
  id: string;
  title: string;
  status: 'in_progress' | 'review';
  priority: string;
  project_id: string;
  contribution_weight: number;
  assignees_preview: string[];
  due_date: string | null;
}

/** KR entry in Big Picture (includes active tasks) */
export interface BigPictureKR extends KeyResult {
  tasks: BigPictureTask[];
}

/** Objective entry in Big Picture */
export interface BigPictureObjective extends Objective {
  key_results: BigPictureKR[];
}

export const BSC_TYPES: { type: ObjectiveType; label: string; icon: string }[] = [
  { type: 'financial',  label: 'Tài chính',        icon: 'attach_money' },
  { type: 'customer',   label: 'Khách hàng',       icon: 'people' },
  { type: 'internal',   label: 'Quy trình nội bộ', icon: 'settings' },
  { type: 'learning',   label: 'Học hỏi & phát triển', icon: 'school' },
];
