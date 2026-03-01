-- ============================================================
-- FIX: Mở rộng check constraints trên bảng notifications
--      để hỗ trợ Strategy Alignment (KR progress notifications).
--
-- Lỗi 23514 xảy ra vì trigger update_kr_progress_from_tasks() insert
-- notification với:
--   • type        = 'kr_progress'   → không có trong notifications_type_check
--   • entity_type = 'key_result'    → không có trong notifications_entity_type_check
--
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Fix constraint cho cột `type`
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'task_assigned',
      'task_deadline',
      'task_status_changed',
      'mention',
      'new_message',
      'added_to_project',
      'objective_status_changed',
      'kr_progress'           -- thêm mới cho Strategy Alignment
    ));

-- 2. Fix constraint cho cột `entity_type`
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_entity_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_entity_type_check
    CHECK (entity_type IN ('task', 'project', 'message', 'objective', 'key_result'));

SELECT 'notifications constraints updated (type + entity_type)' AS result;
