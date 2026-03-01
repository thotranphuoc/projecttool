-- ============================================================
-- 1. Tasks: allow any project member to UPDATE (e.g. change assignees)
-- 2. Subtasks: when status = 'done', only Admin/Director/PM can UPDATE
--
-- Requires: has_system_role(), is_project_manager(), is_project_member()
--           (from fix_rls_policies.sql)
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tasks: add project member to UPDATE policy
DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    auth.uid() = ANY(assignees_preview)
    OR public.has_system_role(ARRAY['admin'])
    OR public.is_project_manager(project_id)
    OR public.is_project_member(project_id)
  );

-- 2. Subtasks: when Done, only Admin/Director/PM can update (USING = who can touch the row).
--    WITH CHECK: allow assignee/member to set status TO done; otherwise USING would be reused and block them.
DROP POLICY IF EXISTS "subtasks_update" ON subtasks;
CREATE POLICY "subtasks_update" ON subtasks FOR UPDATE TO authenticated
  USING (
    (status <> 'done' AND (
      auth.uid() = ANY(assignees)
      OR public.has_system_role(ARRAY['admin'])
      OR public.is_project_manager(project_id)
      OR public.is_project_member(project_id)
    ))
    OR (status = 'done' AND (
      public.has_system_role(ARRAY['admin','director'])
      OR public.is_project_manager(project_id)
    ))
  )
  WITH CHECK (
    auth.uid() = ANY(assignees)
    OR public.has_system_role(ARRAY['admin'])
    OR public.is_project_manager(project_id)
    OR public.is_project_member(project_id)
  );

SELECT 'tasks_update and subtasks_update policies applied' AS result;
