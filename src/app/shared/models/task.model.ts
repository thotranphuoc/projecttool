export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  labels: string[];
  assignees_preview: string[];
  start_date: string | null;
  due_date: string | null;
  /** FK to key_results.id — only tasks with this set contribute to KR progress */
  linked_kr_id: string | null;
  /** Weight of this task's contribution to its KR (default 1) */
  contribution_weight: number;
  /** Denormalized BSC type from linked objective, kept in sync by DB trigger */
  bsc_type: 'financial' | 'customer' | 'internal' | 'learning' | null;
  total_subtasks: number;
  completed_subtasks: number;
  /** Sum of current (non-deleted) subtasks' actual_seconds (+ direct time_logs if task timer used). Roll-up from DB. */
  total_actual_seconds: number;
  /** Sum of current (non-deleted) subtasks' estimate_seconds. Roll-up from DB. */
  total_estimate_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: string;
  parent_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'done';
  assignees: string[];
  due_date: string | null;
  estimate_seconds: number;
  actual_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface TimeLog {
  id: string;
  user_id: string;
  task_id: string;
  subtask_id: string | null;
  seconds: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  mentioned_user_ids: string[];
  created_at: string;
  edited_at: string | null;
  author?: { display_name: string | null; photo_url: string | null };
}

export interface CreateTaskDto {
  project_id: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  labels?: string[];
  assignees_preview?: string[];
  start_date?: string | null;
  due_date?: string | null;
  linked_kr_id?: string | null;
  contribution_weight?: number;
}

export const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo',        label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review',      label: 'Review' },
  { status: 'done',        label: 'Done' },
];
