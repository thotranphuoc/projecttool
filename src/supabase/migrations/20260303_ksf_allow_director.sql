-- Allow director to insert/update/delete KSFs (đồng bộ với visions)
DROP POLICY IF EXISTS "ksfs_insert" ON ksfs;
DROP POLICY IF EXISTS "ksfs_update" ON ksfs;
DROP POLICY IF EXISTS "ksfs_delete" ON ksfs;

CREATE POLICY "ksfs_insert" ON ksfs FOR INSERT TO authenticated
  WITH CHECK (public.has_system_role(ARRAY['admin', 'director']));
CREATE POLICY "ksfs_update" ON ksfs FOR UPDATE TO authenticated
  USING (public.has_system_role(ARRAY['admin', 'director']));
CREATE POLICY "ksfs_delete" ON ksfs FOR DELETE TO authenticated
  USING (public.has_system_role(ARRAY['admin', 'director']));
