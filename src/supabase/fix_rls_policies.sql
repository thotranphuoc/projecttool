-- ============================================================
-- FIX: RLS Policies - Replace self-referential and cross-table
--      RLS checks with SECURITY DEFINER helper functions
--      to prevent infinite recursion and 500/400 errors.
--
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. Helper functions (SECURITY DEFINER bypasses RLS) ──────

CREATE OR REPLACE FUNCTION public.has_system_role(p_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role = ANY(p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_manager(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid() AND project_role = 'manager'
  );
$$;

-- ── 2. Fix: projects ──────────────────────────────────────────

DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated
  USING (
    public.has_system_role(ARRAY['admin','director'])
    OR public.is_project_member(id)
  );

CREATE POLICY "projects_insert" ON projects FOR INSERT TO authenticated
  WITH CHECK (public.has_system_role(ARRAY['admin']));

CREATE POLICY "projects_update" ON projects FOR UPDATE TO authenticated
  USING (
    public.has_system_role(ARRAY['admin'])
    OR public.is_project_manager(id)
  );

CREATE POLICY "projects_delete" ON projects FOR DELETE TO authenticated
  USING (public.has_system_role(ARRAY['admin']));

-- ── 3. Fix: project_members (remove self-referential query) ───

DROP POLICY IF EXISTS "project_members_select" ON project_members;
DROP POLICY IF EXISTS "project_members_insert" ON project_members;
DROP POLICY IF EXISTS "project_members_update" ON project_members;
DROP POLICY IF EXISTS "project_members_delete" ON project_members;

CREATE POLICY "project_members_select" ON project_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_system_role(ARRAY['admin','director'])
    OR public.is_project_member(project_id)
  );

CREATE POLICY "project_members_insert" ON project_members FOR INSERT TO authenticated
  WITH CHECK (
    public.has_system_role(ARRAY['admin'])
    OR public.is_project_manager(project_id)
  );

CREATE POLICY "project_members_update" ON project_members FOR UPDATE TO authenticated
  USING (
    public.has_system_role(ARRAY['admin'])
    OR public.is_project_manager(project_id)
  );

CREATE POLICY "project_members_delete" ON project_members FOR DELETE TO authenticated
  USING (
    public.has_system_role(ARRAY['admin'])
    OR public.is_project_manager(project_id)
  );

-- ── 4. Fix: tasks ─────────────────────────────────────────────

DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_update" ON tasks;
DROP POLICY IF EXISTS "tasks_delete" ON tasks;

CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated
  USING (
    public.has_system_role(ARRAY['admin','director'])
    OR public.is_project_member(project_id)
  );

CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    auth.uid() = ANY(assignees_preview)
    OR public.has_system_role(ARRAY['admin'])
    OR public.is_project_manager(project_id)
  );

CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated
  USING (
    public.has_system_role(ARRAY['admin'])
    OR public.is_project_manager(project_id)
  );

-- ── 5. Fix: subtasks ──────────────────────────────────────────

DROP POLICY IF EXISTS "subtasks_select" ON subtasks;
DROP POLICY IF EXISTS "subtasks_insert" ON subtasks;
DROP POLICY IF EXISTS "subtasks_update" ON subtasks;
DROP POLICY IF EXISTS "subtasks_delete" ON subtasks;

CREATE POLICY "subtasks_select" ON subtasks FOR SELECT TO authenticated
  USING (
    public.has_system_role(ARRAY['admin','director'])
    OR public.is_project_member(project_id)
  );

CREATE POLICY "subtasks_insert" ON subtasks FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "subtasks_update" ON subtasks FOR UPDATE TO authenticated
  USING (
    auth.uid() = ANY(assignees)
    OR public.has_system_role(ARRAY['admin'])
    OR public.is_project_manager(project_id)
    OR public.is_project_member(project_id)
  );

CREATE POLICY "subtasks_delete" ON subtasks FOR DELETE TO authenticated
  USING (
    public.has_system_role(ARRAY['admin'])
    OR public.is_project_manager(project_id)
  );

-- ── 6. Fix: time_logs ─────────────────────────────────────────

DROP POLICY IF EXISTS "time_logs_select" ON time_logs;
DROP POLICY IF EXISTS "time_logs_insert" ON time_logs;
DROP POLICY IF EXISTS "time_logs_update" ON time_logs;
DROP POLICY IF EXISTS "time_logs_delete" ON time_logs;

CREATE POLICY "time_logs_select" ON time_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_system_role(ARRAY['admin','director'])
  );

CREATE POLICY "time_logs_insert" ON time_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "time_logs_update" ON time_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_system_role(ARRAY['admin']));

CREATE POLICY "time_logs_delete" ON time_logs FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_system_role(ARRAY['admin']));

-- ── 7. Fix: task_comments ─────────────────────────────────────

DROP POLICY IF EXISTS "task_comments_select" ON task_comments;
DROP POLICY IF EXISTS "task_comments_insert" ON task_comments;
DROP POLICY IF EXISTS "task_comments_update" ON task_comments;
DROP POLICY IF EXISTS "task_comments_delete" ON task_comments;

CREATE POLICY "task_comments_select" ON task_comments FOR SELECT TO authenticated
  USING (
    public.has_system_role(ARRAY['admin','director'])
    OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id AND public.is_project_member(t.project_id)
    )
  );

CREATE POLICY "task_comments_insert" ON task_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id AND public.is_project_member(t.project_id)
    )
  );

CREATE POLICY "task_comments_update" ON task_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "task_comments_delete" ON task_comments FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_system_role(ARRAY['admin'])
  );

-- ── 8. Fix: profiles_update_admin (self-query) ────────────────

DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated
  USING (public.has_system_role(ARRAY['admin']));

-- ── Done ──────────────────────────────────────────────────────
SELECT 'RLS policies fixed successfully' AS result;
