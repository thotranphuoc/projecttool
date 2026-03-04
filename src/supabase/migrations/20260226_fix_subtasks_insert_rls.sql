-- ============================================================
-- FIX: subtasks INSERT RLS
-- Allow admin/director to insert subtasks (not only project members).
-- Mirrors the SELECT policy pattern: has_system_role OR is_project_member.
--
-- Root cause: if the current user has system_role = 'admin'/'director' but
-- is not in project_members for this project, they can SELECT tasks
-- (admin bypass on SELECT) but cannot INSERT subtasks (no admin bypass).
-- ============================================================

-- Ensure helper functions exist (idempotent)
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

-- Fix subtasks INSERT: allow admin/director OR project member
DROP POLICY IF EXISTS "subtasks_insert" ON subtasks;
CREATE POLICY "subtasks_insert" ON subtasks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_system_role(ARRAY['admin', 'director'])
    OR public.is_project_member(project_id)
  );

SELECT 'subtasks_insert RLS fixed' AS result;
