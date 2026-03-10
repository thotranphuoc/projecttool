-- Khi xóa task, xóa task_id khỏi key_results.linked_task_ids (array không có FK CASCADE)
CREATE OR REPLACE FUNCTION cleanup_key_results_linked_task_ids()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE key_results
  SET linked_task_ids = array_remove(linked_task_ids, OLD.id)
  WHERE OLD.id = ANY(linked_task_ids);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cleanup_linked_task_ids_on_task_delete ON tasks;
CREATE TRIGGER cleanup_linked_task_ids_on_task_delete
  AFTER DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_key_results_linked_task_ids();
