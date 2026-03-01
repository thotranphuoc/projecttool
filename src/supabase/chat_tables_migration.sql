-- Chạy file này trong Supabase Dashboard → SQL Editor (chỉ cần chạy 1 lần)
-- Tạo các bảng Chat. Yêu cầu: bảng "profiles" đã tồn tại (thường có sẵn khi dùng Auth).
-- Nếu báo lỗi "relation profiles does not exist" thì cần chạy phần tạo profiles trong migrations.sql trước.

-- chat_groups
CREATE TABLE IF NOT EXISTS chat_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  members         UUID[] NOT NULL DEFAULT '{}',
  admins          UUID[] NOT NULL DEFAULT '{}',
  avatar_url      TEXT,
  theme           TEXT,
  last_message_at TIMESTAMPTZ,
  last_message    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_groups_members ON chat_groups USING gin(members);

-- conversations (1:1)
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_b   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  last_message    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(participant_a, participant_b)
);
CREATE INDEX IF NOT EXISTS idx_conversations_a ON conversations(participant_a);
CREATE INDEX IF NOT EXISTS idx_conversations_b ON conversations(participant_b);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name        TEXT,
  sender_photo_url   TEXT,
  conversation_id    UUID REFERENCES conversations(id) ON DELETE CASCADE,
  group_id           UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
  content            TEXT NOT NULL,
  emoji              TEXT,
  file_url           TEXT,
  file_name          TEXT,
  file_type          TEXT,
  file_size_bytes    BIGINT,
  reply_to_id        UUID REFERENCES messages(id) ON DELETE SET NULL,
  reply_to_content   TEXT,
  mentioned_user_ids UUID[] DEFAULT '{}',
  is_system_message  BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT now(),
  edited_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_group        ON messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_id);

-- message_reads
CREATE TABLE IF NOT EXISTS message_reads (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);

-- (Tùy chọn) Cho Realtime gửi old record khi UPDATE/DELETE
ALTER TABLE messages REPLICA IDENTITY FULL;

-- chat_settings (singleton)
CREATE TABLE IF NOT EXISTS chat_settings (
  id                      TEXT PRIMARY KEY DEFAULT 'default',
  logo_position           TEXT NOT NULL DEFAULT 'left',
  message_expiration_days INT NOT NULL DEFAULT 0,
  logo_max_size_kb        INT NOT NULL DEFAULT 256,
  allowed_formats         TEXT[] DEFAULT '{}',
  max_file_size_mb        NUMERIC NOT NULL DEFAULT 10,
  theme                   TEXT NOT NULL DEFAULT 'light',
  enable_file_upload      BOOLEAN NOT NULL DEFAULT true,
  enable_emoji            BOOLEAN NOT NULL DEFAULT true,
  enable_edit             BOOLEAN NOT NULL DEFAULT true,
  enable_delete           BOOLEAN NOT NULL DEFAULT true,
  updated_at              TIMESTAMPTZ DEFAULT now()
);
INSERT INTO chat_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE chat_groups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_settings   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_all" ON conversations;
CREATE POLICY "conversations_all" ON conversations FOR ALL TO authenticated
  USING (participant_a = auth.uid() OR participant_b = auth.uid())
  WITH CHECK (participant_a = auth.uid() OR participant_b = auth.uid());

DROP POLICY IF EXISTS "chat_groups_select" ON chat_groups;
CREATE POLICY "chat_groups_select" ON chat_groups FOR SELECT TO authenticated USING (auth.uid() = ANY(members));
DROP POLICY IF EXISTS "chat_groups_insert" ON chat_groups;
CREATE POLICY "chat_groups_insert" ON chat_groups FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "chat_groups_update" ON chat_groups;
CREATE POLICY "chat_groups_update" ON chat_groups FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR auth.uid() = ANY(admins));
DROP POLICY IF EXISTS "chat_groups_delete" ON chat_groups;
CREATE POLICY "chat_groups_delete" ON chat_groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));

DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid()))
    OR (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM chat_groups cg WHERE cg.id = messages.group_id AND auth.uid() = ANY(cg.members)))
  );
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())))
      OR (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM chat_groups cg WHERE cg.id = messages.group_id AND auth.uid() = ANY(cg.members)))
    )
  );
DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages FOR UPDATE TO authenticated USING (sender_id = auth.uid());
DROP POLICY IF EXISTS "messages_delete" ON messages;
CREATE POLICY "messages_delete" ON messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));

DROP POLICY IF EXISTS "message_reads_all" ON message_reads;
CREATE POLICY "message_reads_all" ON message_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_settings_select" ON chat_settings;
CREATE POLICY "chat_settings_select" ON chat_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "chat_settings_update" ON chat_settings;
CREATE POLICY "chat_settings_update" ON chat_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));
