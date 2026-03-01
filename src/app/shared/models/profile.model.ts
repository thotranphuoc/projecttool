export type SystemRole = 'admin' | 'director' | 'user';
export type ProjectRole = 'manager' | 'member';

export interface ActiveTimer {
  isRunning: boolean;
  taskId: string;
  subtaskId: string | null;
  projectId: string;
  startTime: string; // ISO string
  taskTitle?: string;
  projectName?: string;
  subtaskTitle?: string;
}

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  system_role: SystemRole;
  active_timer: ActiveTimer | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  project_role: ProjectRole;
  joined_at: string;
  profile?: Profile;
}
