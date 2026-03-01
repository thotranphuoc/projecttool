-- ============================================================
-- FIX: subtasks RLS - Allow any project member to UPDATE and DELETE
--      (not only assignees/manager/admin for update, not only manager/admin for delete).
--      Fixes "subtask not updating" when assignees is empty and "cannot delete subtask".
--
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- UPDATE: any project member can update
DROP POLICY IF EXISTS "subtasks_update" ON subtasks;
CREATE POLICY "subtasks_update" ON subtasks FOR UPDATE TO authenticated
  USING (
    auth.uid() = ANY(assignees)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = subtasks.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = subtasks.project_id AND pm.user_id = auth.uid())
  );

-- DELETE: any project member can delete (was admin/manager only)
DROP POLICY IF EXISTS "subtasks_delete" ON subtasks;
CREATE POLICY "subtasks_delete" ON subtasks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = subtasks.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'manager')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = subtasks.project_id AND pm.user_id = auth.uid())
  );
