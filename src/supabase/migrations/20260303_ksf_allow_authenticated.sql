-- Cho phép mọi user đã đăng nhập (authenticated) thêm/sửa/xóa KSF.
-- Nếu sau này muốn giới hạn chỉ admin/director, chạy lại policy dùng has_system_role.

DROP POLICY IF EXISTS "ksfs_insert" ON ksfs;
DROP POLICY IF EXISTS "ksfs_update" ON ksfs;
DROP POLICY IF EXISTS "ksfs_delete" ON ksfs;

CREATE POLICY "ksfs_insert" ON ksfs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ksfs_update" ON ksfs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ksfs_delete" ON ksfs FOR DELETE TO authenticated USING (true);
