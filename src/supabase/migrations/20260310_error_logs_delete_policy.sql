-- Cho phép admin/director xóa error logs
DROP POLICY IF EXISTS "error_logs_delete_admin" ON error_logs;
CREATE POLICY "error_logs_delete_admin" ON error_logs FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin', 'director'))
  );
