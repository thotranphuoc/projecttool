-- ============================================================
-- MIGRATION: Thêm start_date vào bảng tasks (cho Gantt chart)
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS start_date DATE;

-- Backfill: tasks chưa có start_date → dùng ngày tạo làm mặc định
UPDATE tasks SET start_date = created_at::date WHERE start_date IS NULL;

SELECT 'start_date column added to tasks' AS result;
