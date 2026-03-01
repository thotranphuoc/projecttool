export interface Conversation {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string | null;
  last_message: string | null;
  created_at: string;
  other_profile?: { id: string; display_name: string | null; photo_url: string | null };
  unread_count?: number;
}

export interface ChatGroup {
  id: string;
  name: string;
  description?: string | null;
  owner_id: string;
  members: string[];
  admins: string[];
  avatar_url: string | null;
  theme: string | null;
  last_message_at: string | null;
  last_message: string | null;
  created_at: string;
  unread_count?: number;
}

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string | null;
  sender_photo_url: string | null;
  conversation_id: string | null;
  group_id: string | null;
  content: string;
  emoji: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  reply_to_id: string | null;
  reply_to_content: string | null;
  mentioned_user_ids: string[];
  is_system_message: boolean;
  created_at: string;
  edited_at: string | null;
}

export interface ChatSettings {
  id: string;
  logo_position: string;
  message_expiration_days: number;
  logo_max_size_kb: number;
  allowed_formats: string[];
  max_file_size_mb: number;
  theme: string;
  enable_file_upload: boolean;
  enable_emoji: boolean;
  enable_edit: boolean;
  enable_delete: boolean;
  updated_at: string;
}
