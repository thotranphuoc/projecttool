-- ============================================================
-- REFACTOR PRD: Perspectives, Value Chain 7 stages, KR weight ≤ 1
-- ============================================================

-- ── 1. Perspectives (F, C, P, L - Balanced Scorecard) ─────────
CREATE TABLE IF NOT EXISTS perspectives (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO perspectives (code, label, sort_order) VALUES
  ('F', 'Tài chính',   1),
  ('C', 'Khách hàng',  2),
  ('P', 'Quy trình',   3),
  ('L', 'Học tập',     4)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

ALTER TABLE objectives
  ADD COLUMN IF NOT EXISTS perspective_id UUID REFERENCES perspectives(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_objectives_perspective ON objectives(perspective_id) WHERE perspective_id IS NOT NULL;

ALTER TABLE perspectives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perspectives_select" ON perspectives;
DROP POLICY IF EXISTS "perspectives_insert" ON perspectives;
DROP POLICY IF EXISTS "perspectives_update" ON perspectives;
DROP POLICY IF EXISTS "perspectives_delete" ON perspectives;
CREATE POLICY "perspectives_select" ON perspectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "perspectives_insert" ON perspectives FOR INSERT TO authenticated WITH CHECK (public.has_system_role(ARRAY['admin','director']));
CREATE POLICY "perspectives_update" ON perspectives FOR UPDATE TO authenticated USING (public.has_system_role(ARRAY['admin','director']));
CREATE POLICY "perspectives_delete" ON perspectives FOR DELETE TO authenticated USING (public.has_system_role(ARRAY['admin','director']));

-- ── 2. Value Chain 7 giai đoạn (thêm Commercial/Sales giữa Performance và eCommerce) ─
INSERT INTO value_chain_activities (code, label, sort_order) VALUES
  ('stage_5_commercial_sales', 'Giai đoạn 5: Commercial/Sales', 5)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

UPDATE value_chain_activities SET sort_order = 6 WHERE code = 'stage_5_ecommerce';
UPDATE value_chain_activities SET sort_order = 7 WHERE code = 'stage_6_ai_loop';

-- ── 3. Key Results: weight ≤ 1 ────────────────────────────────
-- Chuẩn hóa dữ liệu cũ trước khi thêm constraint (các dòng weight > 1 sẽ được đặt = 1)
UPDATE key_results SET weight = 1 WHERE weight > 1;
ALTER TABLE key_results DROP CONSTRAINT IF EXISTS key_results_weight_check;
ALTER TABLE key_results ADD CONSTRAINT key_results_weight_range CHECK (weight > 0 AND weight <= 1);
