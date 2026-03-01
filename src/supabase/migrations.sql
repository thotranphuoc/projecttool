-- ============================================================
-- PM App — Supabase Migration
-- Run this entire file in Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- TABLES
-- ============================================================

-- profiles (1:1 với auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT,
  photo_url    TEXT,
  system_role  TEXT NOT NULL DEFAULT 'user'
               CHECK (system_role IN ('admin','director','user')),
  active_timer JSONB,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- projects
CREATE TABLE IF NOT EXISTS projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  client_name           TEXT,
  client_contact        TEXT,
  pm_id                 UUID REFERENCES profiles(id) ON DELETE SET NULL,
  start_date            DATE,
  end_date              DATE,
  status                TEXT DEFAULT 'planning'
                        CHECK (status IN ('planning','in_progress','on_hold','completed','cancelled')),
  budget                NUMERIC,
  currency              TEXT DEFAULT 'VND',
  description           TEXT,
  objectives_text       TEXT,
  scope                 TEXT,
  deliverables          TEXT,
  stats_total_tasks     INT NOT NULL DEFAULT 0,
  stats_completed_tasks INT NOT NULL DEFAULT 0,
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- project_members (junction — thay projects.members UUID[])
CREATE TABLE IF NOT EXISTS project_members (
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'member'
               CHECK (project_role IN ('manager','member')),
  joined_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_user    ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);

-- tasks
CREATE TABLE IF NOT EXISTS tasks (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title                  TEXT NOT NULL,
  description            TEXT,
  status                 TEXT NOT NULL DEFAULT 'todo'
                         CHECK (status IN ('todo','in_progress','review','done')),
  priority               TEXT NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('low','medium','high','critical')),
  labels                 TEXT[] DEFAULT '{}',
  assignees_preview      UUID[] DEFAULT '{}',
  due_date               DATE,
  goal_link              JSONB,
  total_subtasks         INT NOT NULL DEFAULT 0,
  completed_subtasks     INT NOT NULL DEFAULT 0,
  total_actual_seconds   BIGINT NOT NULL DEFAULT 0,
  total_estimate_seconds BIGINT NOT NULL DEFAULT 0,
  search_vector          TSVECTOR,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date       ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignees      ON tasks USING gin(assignees_preview);
CREATE INDEX IF NOT EXISTS idx_tasks_fts            ON tasks USING gin(search_vector);

-- subtasks
CREATE TABLE IF NOT EXISTS subtasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','done')),
  assignees        UUID[] DEFAULT '{}',
  due_date         DATE,
  estimate_seconds BIGINT NOT NULL DEFAULT 0,
  actual_seconds   BIGINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subtasks_parent  ON subtasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_project ON subtasks(project_id);

-- time_logs
CREATE TABLE IF NOT EXISTS time_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  subtask_id UUID REFERENCES subtasks(id) ON DELETE CASCADE,
  seconds    INT NOT NULL CHECK (seconds > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_logs_user    ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_task    ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_subtask ON time_logs(subtask_id);

-- task_comments (thay tasks.comments JSONB)
CREATE TABLE IF NOT EXISTS task_comments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content            TEXT NOT NULL,
  mentioned_user_ids UUID[] DEFAULT '{}',
  created_at         TIMESTAMPTZ DEFAULT now(),
  edited_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

-- objectives
CREATE TABLE IF NOT EXISTS objectives (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  type             TEXT NOT NULL
                   CHECK (type IN ('financial','customer','internal','learning')),
  status           TEXT NOT NULL DEFAULT 'on_track'
                   CHECK (status IN ('on_track','at_risk','behind')),
  progress_percent NUMERIC NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_objectives_project ON objectives(project_id);

-- key_results (thay objectives.key_results JSONB)
CREATE TABLE IF NOT EXISTS key_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id     UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('metric','task_linked')),
  target_value     NUMERIC,
  current_value    NUMERIC DEFAULT 0,
  unit             TEXT,
  linked_task_ids  UUID[] DEFAULT '{}',
  weight           NUMERIC NOT NULL DEFAULT 1 CHECK (weight > 0),
  progress_percent NUMERIC NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_key_results_objective ON key_results(objective_id);

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

-- message_reads (thay messages.is_read BOOLEAN)
CREATE TABLE IF NOT EXISTS message_reads (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'task_assigned','task_deadline','task_status_changed',
                'mention','new_message','added_to_project','objective_status_changed'
              )),
  title       TEXT NOT NULL,
  body        TEXT,
  entity_id   UUID,
  entity_type TEXT CHECK (entity_type IN ('task','project','message','objective')),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user        ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE is_read = false;

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  changes     JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity  ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

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

-- app_settings (singleton: menu visibility etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  id              TEXT PRIMARY KEY DEFAULT 'default',
  menu_visibility JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
INSERT INTO app_settings (id, menu_visibility) VALUES ('default', '{}') ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives     ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_groups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings   ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));

-- projects
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director'))
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = projects.id AND pm.user_id = auth.uid())
  );
CREATE POLICY "projects_insert" ON projects FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));
CREATE POLICY "projects_update" ON projects FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = projects.id AND pm.user_id = auth.uid() AND pm.project_role = 'manager')
  );
CREATE POLICY "projects_delete" ON projects FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));

-- project_members
CREATE POLICY "project_members_select" ON project_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director'))
    OR EXISTS (SELECT 1 FROM project_members pm2 WHERE pm2.project_id = project_members.project_id AND pm2.user_id = auth.uid())
  );
CREATE POLICY "project_members_insert" ON project_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager')
  );
CREATE POLICY "project_members_update" ON project_members FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager')
  );
CREATE POLICY "project_members_delete" ON project_members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager')
  );

-- tasks
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director'))
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
  );
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()));
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
    OR auth.uid() = ANY(assignees_preview)
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager')
  );
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager')
  );

-- subtasks
CREATE POLICY "subtasks_select" ON subtasks FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director'))
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = subtasks.project_id AND pm.user_id = auth.uid())
  );
CREATE POLICY "subtasks_insert" ON subtasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = subtasks.project_id AND pm.user_id = auth.uid()));
CREATE POLICY "subtasks_update" ON subtasks FOR UPDATE TO authenticated
  USING (
    auth.uid() = ANY(assignees)
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = subtasks.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager')
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
  );
CREATE POLICY "subtasks_delete" ON subtasks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = subtasks.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager')
  );

-- time_logs
CREATE POLICY "time_logs_select" ON time_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director'))
    OR EXISTS (
      SELECT 1 FROM project_members pm JOIN tasks t ON t.id = time_logs.task_id
      WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager'
    )
  );
CREATE POLICY "time_logs_insert" ON time_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "time_logs_update" ON time_logs FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- task_comments
CREATE POLICY "task_comments_select" ON task_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm JOIN tasks t ON t.id = task_comments.task_id
      WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
  );
CREATE POLICY "task_comments_insert" ON task_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM project_members pm JOIN tasks t ON t.id = task_comments.task_id
      WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
    )
  );
CREATE POLICY "task_comments_update" ON task_comments FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "task_comments_delete" ON task_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));

-- objectives
CREATE POLICY "objectives_select" ON objectives FOR SELECT TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director'))
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = objectives.project_id AND pm.user_id = auth.uid())
  );
CREATE POLICY "objectives_insert" ON objectives FOR INSERT TO authenticated
  WITH CHECK (
    (project_id IS NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director')))
    OR (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = objectives.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager'))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
  );
CREATE POLICY "objectives_update" ON objectives FOR UPDATE TO authenticated
  USING (
    (project_id IS NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director')))
    OR (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = objectives.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager'))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
  );
CREATE POLICY "objectives_delete" ON objectives FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director')));

-- key_results
CREATE POLICY "key_results_select" ON key_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM objectives o WHERE o.id = key_results.objective_id
      AND (
        o.project_id IS NULL
        OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = o.project_id AND pm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director'))
      )
    )
  );
CREATE POLICY "key_results_write" ON key_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM objectives o WHERE o.id = key_results.objective_id
      AND (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin','director'))
        OR (o.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM project_members pm WHERE pm.project_id = o.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager'
        ))
      )
    )
  );

-- chat
CREATE POLICY "conversations_all" ON conversations FOR ALL TO authenticated
  USING (participant_a = auth.uid() OR participant_b = auth.uid())
  WITH CHECK (participant_a = auth.uid() OR participant_b = auth.uid());

CREATE POLICY "chat_groups_select" ON chat_groups FOR SELECT TO authenticated USING (auth.uid() = ANY(members));
CREATE POLICY "chat_groups_insert" ON chat_groups FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "chat_groups_update" ON chat_groups FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR auth.uid() = ANY(admins));
CREATE POLICY "chat_groups_delete" ON chat_groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));

CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid()))
    OR (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM chat_groups cg WHERE cg.id = messages.group_id AND auth.uid() = ANY(cg.members)))
  );
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())))
      OR (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM chat_groups cg WHERE cg.id = messages.group_id AND auth.uid() = ANY(cg.members)))
    )
  );
CREATE POLICY "messages_update" ON messages FOR UPDATE TO authenticated USING (sender_id = auth.uid());
CREATE POLICY "messages_delete" ON messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));

CREATE POLICY "message_reads_all" ON message_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- notifications / audit_logs / chat_settings
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));

CREATE POLICY "chat_settings_select" ON chat_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat_settings_update" ON chat_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));

CREATE POLICY "app_settings_select" ON app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings_update" ON app_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- 1. Sync auth.users → profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, photo_url)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    photo_url    = COALESCE(EXCLUDED.photo_url, profiles.photo_url),
    updated_at   = now();
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Full-text search vector for tasks
CREATE OR REPLACE FUNCTION update_task_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', COALESCE(NEW.title,'') || ' ' || COALESCE(NEW.description,''));
  RETURN NEW;
END; $$;
CREATE OR REPLACE TRIGGER on_task_fts_update
  BEFORE INSERT OR UPDATE OF title, description ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_task_search_vector();

-- 3. Roll-up: time_logs → subtasks.actual_seconds
CREATE OR REPLACE FUNCTION update_subtask_actual_seconds()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_subtask_id UUID;
BEGIN
  v_subtask_id := COALESCE(NEW.subtask_id, OLD.subtask_id);
  IF v_subtask_id IS NOT NULL THEN
    UPDATE subtasks SET actual_seconds = (SELECT COALESCE(SUM(seconds),0) FROM time_logs WHERE subtask_id = v_subtask_id), updated_at = now() WHERE id = v_subtask_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE OR REPLACE TRIGGER on_time_log_change
  AFTER INSERT OR UPDATE OR DELETE ON time_logs FOR EACH ROW EXECUTE FUNCTION update_subtask_actual_seconds();

-- 4. Roll-up: subtasks → tasks aggregates
CREATE OR REPLACE FUNCTION update_task_aggregates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_task_id UUID;
BEGIN
  v_task_id := COALESCE(NEW.parent_id, OLD.parent_id);
  UPDATE tasks SET
    total_subtasks         = (SELECT COUNT(*)                         FROM subtasks WHERE parent_id = v_task_id),
    completed_subtasks     = (SELECT COUNT(*)                         FROM subtasks WHERE parent_id = v_task_id AND status = 'done'),
    total_actual_seconds   = (SELECT COALESCE(SUM(actual_seconds),0)  FROM subtasks WHERE parent_id = v_task_id),
    total_estimate_seconds = (SELECT COALESCE(SUM(estimate_seconds),0) FROM subtasks WHERE parent_id = v_task_id),
    updated_at             = now()
  WHERE id = v_task_id;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE OR REPLACE TRIGGER on_subtask_change
  AFTER INSERT OR UPDATE OR DELETE ON subtasks FOR EACH ROW EXECUTE FUNCTION update_task_aggregates();

-- 5. Roll-up: tasks → projects stats
CREATE OR REPLACE FUNCTION update_project_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_project_id UUID;
BEGIN
  v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  UPDATE projects SET
    stats_total_tasks     = (SELECT COUNT(*) FROM tasks WHERE project_id = v_project_id),
    stats_completed_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = v_project_id AND status = 'done'),
    updated_at            = now()
  WHERE id = v_project_id;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE OR REPLACE TRIGGER on_task_change
  AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION update_project_stats();

-- 6. key_results → objective progress + auto-status + notification
CREATE OR REPLACE FUNCTION update_objective_progress()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_obj_id     UUID;
  v_progress   NUMERIC;
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  v_obj_id := COALESCE(NEW.objective_id, OLD.objective_id);
  SELECT COALESCE(SUM(progress_percent * weight) / NULLIF(SUM(weight),0), 0) INTO v_progress
  FROM key_results WHERE objective_id = v_obj_id;
  v_new_status := CASE WHEN v_progress >= 70 THEN 'on_track' WHEN v_progress >= 40 THEN 'at_risk' ELSE 'behind' END;
  SELECT status INTO v_old_status FROM objectives WHERE id = v_obj_id;
  UPDATE objectives SET progress_percent = v_progress, status = v_new_status, updated_at = now() WHERE id = v_obj_id;
  IF v_old_status = 'on_track' AND v_new_status IN ('at_risk','behind') THEN
    INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
    SELECT DISTINCT u.uid, 'objective_status_changed', 'Objective cần chú ý',
      (SELECT title FROM objectives WHERE id = v_obj_id) || ' → ' || v_new_status, v_obj_id, 'objective'
    FROM (
      SELECT pm.user_id AS uid FROM project_members pm JOIN objectives o ON o.id = v_obj_id WHERE pm.project_id = o.project_id AND pm.project_role = 'manager'
      UNION SELECT p.id AS uid FROM profiles p WHERE p.system_role IN ('admin','director')
    ) u;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE OR REPLACE TRIGGER on_key_result_change
  AFTER INSERT OR UPDATE OR DELETE ON key_results FOR EACH ROW EXECUTE FUNCTION update_objective_progress();

-- 7. task assigned / status changed → notifications
CREATE OR REPLACE FUNCTION notify_on_task_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_uid UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR v_uid IN SELECT UNNEST(NEW.assignees_preview) EXCEPT SELECT UNNEST(OLD.assignees_preview) LOOP
      INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
      VALUES (v_uid, 'task_assigned', 'Task mới được giao', 'Bạn được giao: ' || NEW.title, NEW.id, 'task');
    END LOOP;
    IF OLD.status <> NEW.status THEN
      INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
      SELECT uid, 'task_status_changed', 'Trạng thái task thay đổi', NEW.title || ' → ' || NEW.status, NEW.id, 'task'
      FROM UNNEST(NEW.assignees_preview) AS uid WHERE uid <> auth.uid();
    END IF;
  ELSIF TG_OP = 'INSERT' AND array_length(NEW.assignees_preview, 1) > 0 THEN
    FOR v_uid IN SELECT UNNEST(NEW.assignees_preview) LOOP
      INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
      VALUES (v_uid, 'task_assigned', 'Task mới được giao', 'Bạn được giao: ' || NEW.title, NEW.id, 'task');
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION notify_on_task_change();

-- 8. @mention in task_comments → notification
CREATE OR REPLACE FUNCTION notify_on_comment_mention()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_uid UUID;
BEGIN
  FOREACH v_uid IN ARRAY COALESCE(NEW.mentioned_user_ids, '{}') LOOP
    IF v_uid <> NEW.author_id THEN
      INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
      VALUES (v_uid, 'mention', 'Bạn được nhắc đến',
        (SELECT display_name FROM profiles WHERE id = NEW.author_id) || ' đã nhắc bạn trong comment',
        NEW.task_id, 'task');
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
CREATE OR REPLACE TRIGGER on_comment_mention
  AFTER INSERT ON task_comments FOR EACH ROW EXECUTE FUNCTION notify_on_comment_mention();

-- 9. added to project → notification
CREATE OR REPLACE FUNCTION notify_on_project_member_added()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
  VALUES (NEW.user_id, 'added_to_project', 'Bạn được thêm vào project',
    'Project: ' || (SELECT name FROM projects WHERE id = NEW.project_id), NEW.project_id, 'project');
  RETURN NEW;
END; $$;
CREATE OR REPLACE TRIGGER on_project_member_added
  AFTER INSERT ON project_members FOR EACH ROW EXECUTE FUNCTION notify_on_project_member_added();

-- 10. Audit log
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)));
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER audit_tasks      AFTER UPDATE OR DELETE ON tasks      FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_projects   AFTER UPDATE OR DELETE ON projects   FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_objectives AFTER UPDATE OR DELETE ON objectives FOR EACH ROW EXECUTE FUNCTION log_audit();

-- ============================================================
-- RPC: Full-text search tasks
-- ============================================================
CREATE OR REPLACE FUNCTION search_tasks(p_query TEXT, p_project_id UUID DEFAULT NULL)
RETURNS SETOF tasks LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT t.* FROM tasks t
  WHERE (p_project_id IS NULL OR t.project_id = p_project_id)
    AND t.search_vector @@ plainto_tsquery('simple', p_query)
    AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid())
  ORDER BY ts_rank(t.search_vector, plainto_tsquery('simple', p_query)) DESC LIMIT 20;
$$;

-- ============================================================
-- pg_cron JOBS (run after enabling pg_cron extension)
-- ============================================================

-- Daily at 8:00 AM: notify assignees of tasks due in 2 days
SELECT cron.schedule('notify-upcoming-deadlines', '0 8 * * *', $$
  INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
  SELECT DISTINCT UNNEST(t.assignees_preview), 'task_deadline', 'Task sắp đến hạn',
    t.title || ' đến hạn ngày ' || t.due_date::text, t.id, 'task'
  FROM tasks t
  WHERE t.due_date = CURRENT_DATE + INTERVAL '2 days' AND t.status <> 'done'
    AND array_length(t.assignees_preview, 1) > 0;
$$);

-- Daily at 2:00 AM: cleanup expired messages
SELECT cron.schedule('cleanup-expired-messages', '0 2 * * *', $$
  DELETE FROM messages WHERE created_at < now() - (
    SELECT message_expiration_days || ' days' FROM chat_settings WHERE id = 'default'
  )::INTERVAL AND (SELECT message_expiration_days FROM chat_settings WHERE id = 'default') > 0;
$$);

-- ============================================================
-- STORAGE BUCKETS (run in Supabase Dashboard > Storage)
-- or via SQL:
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', false, 10485760)
ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "avatars_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "chat_attachments_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      EXISTS (SELECT 1 FROM conversations c WHERE c.id = (storage.foldername(name))[2]::uuid AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid()))
      OR EXISTS (SELECT 1 FROM chat_groups cg WHERE cg.id = (storage.foldername(name))[2]::uuid AND auth.uid() = ANY(cg.members))
    )
  );
CREATE POLICY "chat_attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');
