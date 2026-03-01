-- ============================================================
-- STRATEGY ALIGNMENT MIGRATION
-- Hybrid BSC/OKR ↔ Project Tasks mapping
-- Decisions:
--   • Only tasks with explicit linked_kr_id contribute to KR (no project-level fallback)
--   • Trigger only fires for type='task_linked' KRs; metric KRs updated manually
--   • Cascade: KR progress → Objective progress (via existing trigger on key_results)
--   • bsc_type denormalized on tasks for fast badge display
--   • Big Picture RPC returns all objectives (SECURITY DEFINER) - frontend filters by RLS
-- ============================================================

-- ── 1. Schema: tasks ──────────────────────────────────────────
-- Remove old JSONB goal_link (no longer needed)
ALTER TABLE tasks DROP COLUMN IF EXISTS goal_link;

-- Add proper FK columns
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS linked_kr_id        UUID REFERENCES key_results(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contribution_weight  INTEGER NOT NULL DEFAULT 1
    CONSTRAINT tasks_weight_positive CHECK (contribution_weight > 0),
  -- Denormalized BSC type from linked objective (kept in sync by trigger)
  ADD COLUMN IF NOT EXISTS bsc_type TEXT
    CONSTRAINT tasks_bsc_type_values CHECK (bsc_type IN ('financial','customer','internal','learning'));

CREATE INDEX IF NOT EXISTS idx_tasks_linked_kr ON tasks(linked_kr_id) WHERE linked_kr_id IS NOT NULL;

-- ── 2. Schema: projects ───────────────────────────────────────
-- Metadata only: project aligns to this KR, but does NOT contribute tasks automatically
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS linked_kr_id UUID REFERENCES key_results(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_linked_kr ON projects(linked_kr_id) WHERE linked_kr_id IS NOT NULL;

-- ── 3. Function: sync bsc_type on task when linked_kr_id changes ──
CREATE OR REPLACE FUNCTION sync_task_bsc_type()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.linked_kr_id IS NULL THEN
    NEW.bsc_type := NULL;
  ELSE
    SELECT o.type INTO NEW.bsc_type
    FROM key_results kr
    JOIN objectives o ON o.id = kr.objective_id
    WHERE kr.id = NEW.linked_kr_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_bsc_type_sync ON tasks;
CREATE TRIGGER on_task_bsc_type_sync
  BEFORE INSERT OR UPDATE OF linked_kr_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION sync_task_bsc_type();

-- ── 4. Function: recalculate task_linked KR progress from tasks ──
-- Logic: (sum of contribution_weight where status='done') / (sum of all weights) * 100
-- Only fires for KRs with type='task_linked'
CREATE OR REPLACE FUNCTION update_kr_progress_from_tasks()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kr_id        UUID;
  v_old_kr_id    UUID;
  v_kr_type      TEXT;
  v_progress     NUMERIC;
  v_old_progress NUMERIC;
  v_kr_title     TEXT;
BEGIN
  -- Determine which KR(s) to update
  v_kr_id     := CASE WHEN TG_OP = 'DELETE' THEN NULL          ELSE NEW.linked_kr_id END;
  v_old_kr_id := CASE WHEN TG_OP = 'INSERT' THEN NULL          ELSE OLD.linked_kr_id END;

  -- Helper: recalculate a specific task_linked KR's progress
  -- ── Update NEW linked KR ──
  IF v_kr_id IS NOT NULL THEN
    SELECT type, progress_percent, title
      INTO v_kr_type, v_old_progress, v_kr_title
    FROM key_results WHERE id = v_kr_id;

    IF v_kr_type = 'task_linked' THEN
      SELECT COALESCE(
        SUM(contribution_weight) FILTER (WHERE status = 'done') * 100.0
          / NULLIF(SUM(contribution_weight), 0),
        0
      ) INTO v_progress
      FROM tasks WHERE linked_kr_id = v_kr_id;

      UPDATE key_results
        SET progress_percent = v_progress, updated_at = now()
      WHERE id = v_kr_id;

      -- Notify when progress crosses a 25% milestone (e.g., 0→25, 25→50, 50→75, 75→100)
      IF FLOOR(COALESCE(v_old_progress, 0) / 25) < FLOOR(v_progress / 25) THEN
        INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
        SELECT DISTINCT uid, 'kr_progress', 'Key Result tiến triển',
          v_kr_title || ' đạt ' || ROUND(v_progress)::text || '%',
          v_kr_id, 'key_result'
        FROM (
          -- Admin + Director always notified
          SELECT p.id AS uid FROM profiles p WHERE p.system_role IN ('admin','director')
          UNION
          -- Managers of project linked to the KR's objective
          SELECT pm.user_id AS uid
          FROM project_members pm
          JOIN objectives o ON o.id = (SELECT objective_id FROM key_results WHERE id = v_kr_id)
          WHERE pm.project_id = o.project_id AND pm.project_role = 'manager'
        ) notif_targets;
      END IF;
    END IF;
  END IF;

  -- ── Update OLD linked KR if changed ──
  IF v_old_kr_id IS NOT NULL AND v_old_kr_id IS DISTINCT FROM v_kr_id THEN
    SELECT type INTO v_kr_type FROM key_results WHERE id = v_old_kr_id;

    IF v_kr_type = 'task_linked' THEN
      SELECT COALESCE(
        SUM(contribution_weight) FILTER (WHERE status = 'done') * 100.0
          / NULLIF(SUM(contribution_weight), 0),
        0
      ) INTO v_progress
      FROM tasks WHERE linked_kr_id = v_old_kr_id;

      UPDATE key_results
        SET progress_percent = v_progress, updated_at = now()
      WHERE id = v_old_kr_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fire on: status change, linked_kr_id change, weight change, or delete
DROP TRIGGER IF EXISTS on_task_kr_change ON tasks;
CREATE TRIGGER on_task_kr_change
  AFTER INSERT OR UPDATE OF status, linked_kr_id, contribution_weight OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_kr_progress_from_tasks();

-- NOTE: KR → Objective cascade is handled by the EXISTING trigger:
--   on_key_result_change → update_objective_progress()
-- No new trigger needed here.

-- ── 5. RLS: fix tasks_insert — Admin/Director cũng được tạo task ──
-- is_project_member() chỉ check project_members, không bao gồm admin.
-- Trigger update_kr_progress_from_tasks cần SECURITY DEFINER để UPDATE key_results
-- mà không bị chặn bởi RLS của user thường.
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_system_role(ARRAY['admin','director'])
    OR public.is_project_member(project_id)
  );

-- ── 6. RPC: get_big_picture() ─────────────────────────────────
-- Returns all objectives → KRs → active tasks (in_progress + review)
-- SECURITY DEFINER: bypasses RLS to show full company picture
-- Note: Frontend should restrict UI access to all authenticated users per requirement
CREATE OR REPLACE FUNCTION get_big_picture()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSON;
BEGIN
  SELECT json_agg(obj_data ORDER BY obj_data->>'type', (obj_data->>'progress_percent')::numeric DESC)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'id',               o.id,
      'title',            o.title,
      'type',             o.type,
      'status',           o.status,
      'progress_percent', o.progress_percent,
      'project_id',       o.project_id,
      'key_results', (
        SELECT COALESCE(json_agg(kr_data ORDER BY (kr_data->>'weight')::numeric DESC), '[]'::json)
        FROM (
          SELECT jsonb_build_object(
            'id',               kr.id,
            'title',            kr.title,
            'type',             kr.type,
            'progress_percent', kr.progress_percent,
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
  ) sub_obj;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_big_picture() TO authenticated;
