-- ============================================================
-- FIX: Task total_actual_seconds must include direct time_logs
--      (when user runs timer from task card, subtask_id is null).
--      Currently only time via subtasks is summed.
--
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Task aggregates: include direct time (time_logs where subtask_id IS NULL)
CREATE OR REPLACE FUNCTION update_task_aggregates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_task_id UUID;
BEGIN
  v_task_id := COALESCE(NEW.parent_id, OLD.parent_id);
  UPDATE tasks SET
    total_subtasks         = (SELECT COUNT(*) FROM subtasks WHERE parent_id = v_task_id),
    completed_subtasks     = (SELECT COUNT(*) FROM subtasks WHERE parent_id = v_task_id AND status = 'done'),
    total_actual_seconds   = (SELECT COALESCE(SUM(actual_seconds),0) FROM subtasks WHERE parent_id = v_task_id)
                           + (SELECT COALESCE(SUM(seconds),0) FROM time_logs WHERE task_id = v_task_id AND subtask_id IS NULL),
    total_estimate_seconds = (SELECT COALESCE(SUM(estimate_seconds),0) FROM subtasks WHERE parent_id = v_task_id),
    updated_at             = now()
  WHERE id = v_task_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

-- 2. When a direct time_log is added/updated/deleted, refresh the task total
CREATE OR REPLACE FUNCTION update_task_direct_time()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_task_id UUID;
BEGIN
  v_task_id := COALESCE(NEW.task_id, OLD.task_id);
  IF v_task_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE tasks SET
    total_actual_seconds = (SELECT COALESCE(SUM(actual_seconds),0) FROM subtasks WHERE parent_id = v_task_id)
                         + (SELECT COALESCE(SUM(seconds),0) FROM time_logs WHERE task_id = v_task_id AND subtask_id IS NULL),
    updated_at           = now()
  WHERE id = v_task_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS on_time_log_direct_task ON time_logs;
CREATE TRIGGER on_time_log_direct_task
  AFTER INSERT OR UPDATE OR DELETE ON time_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_task_direct_time();

SELECT 'Task time roll-up fixed: direct time_logs now included in task total_actual_seconds' AS result;
