export type ObjectiveType = 'financial' | 'customer' | 'internal' | 'learning';
export type ObjectiveStatus = 'on_track' | 'at_risk' | 'behind';
export type KeyResultType = 'metric' | 'task_linked';

export interface Vision {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Strategy {
  id: string;
  vision_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  period_year: number;
  period_quarter: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  vision?: Vision;
}

export interface ValueChainActivity {
  id: string;
  code: string;
  label: string;
  description?: string | null;
  sort_order: number;
}

export interface Ksf {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sort_order: number;
}

export interface Perspective {
  id: string;
  code: string;
  label: string;
  sort_order: number;
}

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
  strategy_id?: string | null;
  value_chain_activity_id?: string | null;
  ksf_id?: string | null;
  perspective_id?: string | null;
  strategy?: Strategy | null;
  value_chain_activity?: ValueChainActivity | null;
  ksf?: Ksf | null;
  perspective?: Perspective | null;
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

/** Objective entry in Big Picture (includes strategy/vision/value_chain from RPC) */
export interface BigPictureObjective extends Objective {
  key_results: BigPictureKR[];
  strategy_id?: string | null;
  strategy_title?: string | null;
  strategy_period?: string | null;
  vision_id?: string | null;
  vision_title?: string | null;
  value_chain_activity_id?: string | null;
  value_chain_activity_code?: string | null;
  value_chain_activity_label?: string | null;
  value_chain_activity_sort_order?: number | null;
  ksf_id?: string | null;
  ksf_code?: string | null;
  ksf_label?: string | null;
  perspective_id?: string | null;
  perspective_code?: string | null;
  perspective_label?: string | null;
}

export const BSC_TYPES: { type: ObjectiveType; label: string; icon: string }[] = [
  { type: 'financial',  label: 'Tài chính',        icon: 'attach_money' },
  { type: 'customer',   label: 'Khách hàng',       icon: 'people' },
  { type: 'internal',   label: 'Quy trình nội bộ', icon: 'settings' },
  { type: 'learning',   label: 'Học hỏi & phát triển', icon: 'school' },
];
