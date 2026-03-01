export type NotificationType =
  | 'task_assigned'
  | 'task_deadline'
  | 'task_status_changed'
  | 'mention'
  | 'new_message'
  | 'added_to_project'
  | 'objective_status_changed';

export type NotificationEntityType = 'task' | 'project' | 'message' | 'objective';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_id: string | null;
  entity_type: NotificationEntityType | null;
  is_read: boolean;
  created_at: string;
}
