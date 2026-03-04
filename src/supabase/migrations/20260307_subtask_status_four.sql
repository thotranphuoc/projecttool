-- Đồng bộ trạng thái subtask với task: thêm in_progress, review
-- Drop bất kỳ check constraint nào liên quan status (tên có thể khác tùy DB)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.subtasks'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.subtasks DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE subtasks ADD CONSTRAINT subtasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'review', 'done'));
