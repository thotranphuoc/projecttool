-- ============================================================
-- VISION, STRATEGY, VALUE CHAIN (Cách 3)
-- Additive migration: visions, strategies, value_chain_activities;
-- objectives get strategy_id + value_chain_activity_id;
-- get_big_picture() extended with strategy/vision/value_chain.
-- Requires: has_system_role(), is_project_member(), is_project_manager()
--   (from fix_rls_policies.sql or run below block if missing)
-- ============================================================

-- ── 1. Helper functions (if not already present) ─────────────────
CREATE OR REPLACE FUNCTION public.has_system_role(p_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role = ANY(p_roles));
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM project_members WHERE project_id = p_project_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_project_manager(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM project_members WHERE project_id = p_project_id AND user_id = auth.uid() AND project_role = 'manager');
$$;

-- ── 2. Tables ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strategies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id     UUID NOT NULL REFERENCES visions(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  period_year   INT NOT NULL,
  period_quarter INT CHECK (period_quarter IS NULL OR (period_quarter >= 1 AND period_quarter <= 4)),
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_strategies_vision ON strategies(vision_id);
CREATE INDEX IF NOT EXISTS idx_strategies_project ON strategies(project_id) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS value_chain_activities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- ── 3. Alter objectives ─────────────────────────────────────────
ALTER TABLE objectives
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS value_chain_activity_id UUID REFERENCES value_chain_activities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_objectives_strategy ON objectives(strategy_id) WHERE strategy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_objectives_value_chain ON objectives(value_chain_activity_id) WHERE value_chain_activity_id IS NOT NULL;

-- ── 4. Seed value_chain_activities (6 giai đoạn chuỗi giá trị) ───
INSERT INTO value_chain_activities (code, label, sort_order) VALUES
  ('stage_1_traffic',   'Giai đoạn 1: Traffic',        1),
  ('stage_2_cdp_data',  'Giai đoạn 2: CDP/Data',       2),
  ('stage_3_adtech',    'Giai đoạn 3: AdTech',         3),
  ('stage_4_performance','Giai đoạn 4: Performance',   4),
  ('stage_5_ecommerce', 'Giai đoạn 5: eCommerce',      5),
  ('stage_6_ai_loop',   'Giai đoạn 6: AI & Loop',      6)
ON CONFLICT (code) DO NOTHING;

-- ── 5. RLS ─────────────────────────────────────────────────────
ALTER TABLE visions ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_chain_activities ENABLE ROW LEVEL SECURITY;

-- visions: everyone can read; only admin/director can write
CREATE POLICY "visions_select" ON visions FOR SELECT TO authenticated USING (true);
CREATE POLICY "visions_insert" ON visions FOR INSERT TO authenticated
  WITH CHECK (public.has_system_role(ARRAY['admin','director']));
CREATE POLICY "visions_update" ON visions FOR UPDATE TO authenticated
  USING (public.has_system_role(ARRAY['admin','director']));
CREATE POLICY "visions_delete" ON visions FOR DELETE TO authenticated
  USING (public.has_system_role(ARRAY['admin','director']));

-- strategies: read if company-wide or user is project member; write: admin/director all, manager only for their project
CREATE POLICY "strategies_select" ON strategies FOR SELECT TO authenticated
  USING (
    project_id IS NULL
    OR public.is_project_member(project_id)
    OR public.has_system_role(ARRAY['admin','director'])
  );
CREATE POLICY "strategies_insert" ON strategies FOR INSERT TO authenticated
  WITH CHECK (
    public.has_system_role(ARRAY['admin','director'])
    OR (project_id IS NOT NULL AND public.is_project_manager(project_id))
  );
CREATE POLICY "strategies_update" ON strategies FOR UPDATE TO authenticated
  USING (
    public.has_system_role(ARRAY['admin','director'])
    OR (project_id IS NOT NULL AND public.is_project_manager(project_id))
  );
CREATE POLICY "strategies_delete" ON strategies FOR DELETE TO authenticated
  USING (
    public.has_system_role(ARRAY['admin','director'])
    OR (project_id IS NOT NULL AND public.is_project_manager(project_id))
  );

-- value_chain_activities: everyone read; only admin write
CREATE POLICY "value_chain_select" ON value_chain_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "value_chain_insert" ON value_chain_activities FOR INSERT TO authenticated
  WITH CHECK (public.has_system_role(ARRAY['admin']));
CREATE POLICY "value_chain_update" ON value_chain_activities FOR UPDATE TO authenticated
  USING (public.has_system_role(ARRAY['admin']));
CREATE POLICY "value_chain_delete" ON value_chain_activities FOR DELETE TO authenticated
  USING (public.has_system_role(ARRAY['admin']));

-- ── 6. RPC: get_big_picture() with strategy/vision/value_chain ─
CREATE OR REPLACE FUNCTION get_big_picture()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSON;
BEGIN
  SELECT json_agg(obj_data ORDER BY obj_data->>'type', (obj_data->>'progress_percent')::numeric DESC)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'id',                        o.id,
      'title',                     o.title,
      'type',                      o.type,
      'status',                    o.status,
      'progress_percent',           o.progress_percent,
      'project_id',                o.project_id,
      'strategy_id',               o.strategy_id,
      'strategy_title',            s.title,
      'strategy_period',           CASE
        WHEN s.period_quarter IS NOT NULL THEN (s.period_year::text || '-Q' || s.period_quarter::text)
        ELSE s.period_year::text
      END,
      'vision_id',                 v.id,
      'vision_title',              v.title,
      'value_chain_activity_id',   vca.id,
      'value_chain_activity_code', vca.code,
      'value_chain_activity_label', vca.label,
      'key_results', (
        SELECT COALESCE(json_agg(kr_data ORDER BY (kr_data->>'weight')::numeric DESC), '[]'::json)
        FROM (
          SELECT jsonb_build_object(
            'id',               kr.id,
            'title',            kr.title,
            'type',             kr.type,
            'progress_percent',  kr.progress_percent,
            'weight',           kr.weight,
            'target_value',     kr.target_value,
            'current_value',    kr.current_value,
            'unit',             kr.unit,
            'tasks', (
              SELECT COALESCE(json_agg(
                jsonb_build_object(
                  'id',                  t.id,
                  'title',               t.title,
                  'status',              t.status,
                  'priority',            t.priority,
                  'project_id',          t.project_id,
                  'contribution_weight', t.contribution_weight,
                  'assignees_preview',   t.assignees_preview,
                  'due_date',            t.due_date
                ) ORDER BY t.status, t.updated_at DESC
              ), '[]'::json)
              FROM tasks t
              WHERE t.linked_kr_id = kr.id
                AND t.status IN ('in_progress', 'review')
            )
          ) kr_data
          FROM key_results kr WHERE kr.objective_id = o.id
        ) sub_kr
      )
    ) obj_data
    FROM objectives o
    LEFT JOIN strategies s ON s.id = o.strategy_id
    LEFT JOIN visions v ON v.id = s.vision_id
    LEFT JOIN value_chain_activities vca ON vca.id = o.value_chain_activity_id
  ) sub_obj;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_big_picture() TO authenticated;
