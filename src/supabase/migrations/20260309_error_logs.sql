-- Bảng error_logs: lưu lỗi từ Supabase và thao tác user để admin xem
CREATE TABLE IF NOT EXISTS error_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  context         TEXT NOT NULL,
  error_message   TEXT,
  error_code      TEXT,
  error_details   JSONB,
  url             TEXT,
  user_agent      TEXT,
  extra           JSONB
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_context ON error_logs(context);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Mọi user đã đăng nhập có thể INSERT log (gắn user_id của mình)
CREATE POLICY "error_logs_insert" ON error_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Chỉ admin/director được SELECT
CREATE POLICY "error_logs_select_admin" ON error_logs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role IN ('admin', 'director'))
  );
