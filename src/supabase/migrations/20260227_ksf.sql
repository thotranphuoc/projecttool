-- KSF (Key Success Factors) — Yếu tố thành công then chốt / Luật chơi ngành
-- Requires: has_system_role() (from vision_strategy_value_chain or fix_rls_policies)

CREATE TABLE IF NOT EXISTS ksfs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE objectives
  ADD COLUMN IF NOT EXISTS ksf_id UUID REFERENCES ksfs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_objectives_ksf ON objectives(ksf_id) WHERE ksf_id IS NOT NULL;

ALTER TABLE ksfs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ksfs_select" ON ksfs;
DROP POLICY IF EXISTS "ksfs_insert" ON ksfs;
DROP POLICY IF EXISTS "ksfs_update" ON ksfs;
DROP POLICY IF EXISTS "ksfs_delete" ON ksfs;

CREATE POLICY "ksfs_select" ON ksfs FOR SELECT TO authenticated USING (true);
CREATE POLICY "ksfs_insert" ON ksfs FOR INSERT TO authenticated
  WITH CHECK (public.has_system_role(ARRAY['admin', 'director']));
CREATE POLICY "ksfs_update" ON ksfs FOR UPDATE TO authenticated
  USING (public.has_system_role(ARRAY['admin', 'director']));
CREATE POLICY "ksfs_delete" ON ksfs FOR DELETE TO authenticated
  USING (public.has_system_role(ARRAY['admin', 'director']));
