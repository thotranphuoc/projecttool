-- ============================================================
-- FIX: Notifications RLS — Triggers insert for other users
--      so they get "new row violates row-level security".
--      Make trigger functions SECURITY DEFINER to bypass RLS.
--
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Objective status changed (inside update_objective_progress)
CREATE OR REPLACE FUNCTION update_objective_progress()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_task_id    UUID;
  v_obj_id     UUID;
  v_progress   NUMERIC;
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  v_obj_id := COALESCE(NEW.objective_id, OLD.objective_id);
  SELECT COALESCE(SUM(progress_percent * weight) / NULLIF(SUM(weight),0), 0) INTO v_progress
  FROM key_results WHERE objective_id = v_obj_id;
  v_new_status := CASE WHEN v_progress >= 70 THEN 'on_track' WHEN v_progress >= 40 THEN 'at_risk' ELSE 'behind' END;
  SELECT status INTO v_old_status FROM objectives WHERE id = v_obj_id;
  UPDATE objectives SET progress_percent = v_progress, status = v_new_status, updated_at = now() WHERE id = v_obj_id;
  IF v_old_status = 'on_track' AND v_new_status IN ('at_risk','behind') THEN
    INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
    SELECT DISTINCT u.uid, 'objective_status_changed', 'Objective cần chú ý',
      (SELECT title FROM objectives WHERE id = v_obj_id) || ' → ' || v_new_status, v_obj_id, 'objective'
    FROM (
      SELECT pm.user_id AS uid FROM project_members pm JOIN objectives o ON o.id = v_obj_id WHERE pm.project_id = o.project_id AND pm.project_role = 'manager'
      UNION SELECT p.id AS uid FROM profiles p WHERE p.system_role IN ('admin','director')
    ) u;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

-- 2. Task assigned / status changed
CREATE OR REPLACE FUNCTION notify_on_task_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR v_uid IN SELECT UNNEST(NEW.assignees_preview) EXCEPT SELECT UNNEST(OLD.assignees_preview) LOOP
      INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
      VALUES (v_uid, 'task_assigned', 'Task mới được giao', 'Bạn được giao: ' || NEW.title, NEW.id, 'task');
    END LOOP;
    IF OLD.status <> NEW.status THEN
      INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
      SELECT uid, 'task_status_changed', 'Trạng thái task thay đổi', NEW.title || ' → ' || NEW.status, NEW.id, 'task'
      FROM UNNEST(NEW.assignees_preview) AS uid WHERE uid <> auth.uid();
    END IF;
  ELSIF TG_OP = 'INSERT' AND array_length(NEW.assignees_preview, 1) > 0 THEN
    FOR v_uid IN SELECT UNNEST(NEW.assignees_preview) LOOP
      INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
      VALUES (v_uid, 'task_assigned', 'Task mới được giao', 'Bạn được giao: ' || NEW.title, NEW.id, 'task');
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

-- 3. @mention in comments
CREATE OR REPLACE FUNCTION notify_on_comment_mention()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID;
BEGIN
  FOREACH v_uid IN ARRAY COALESCE(NEW.mentioned_user_ids, '{}') LOOP
    IF v_uid <> NEW.author_id THEN
      INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
      VALUES (v_uid, 'mention', 'Bạn được nhắc đến',
        (SELECT display_name FROM profiles WHERE id = NEW.author_id) || ' đã nhắc bạn trong comment',
        NEW.task_id, 'task');
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

-- 4. Added to project
CREATE OR REPLACE FUNCTION notify_on_project_member_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
  VALUES (NEW.user_id, 'added_to_project', 'Bạn được thêm vào project',
    'Project: ' || (SELECT name FROM projects WHERE id = NEW.project_id), NEW.project_id, 'project');
  RETURN NEW;
END; $$;

SELECT 'Notification triggers updated to SECURITY DEFINER' AS result;
