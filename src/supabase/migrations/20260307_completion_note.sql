-- Completion note for Task and Subtask when marking Done (outcome / link file)
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS completion_note TEXT;
