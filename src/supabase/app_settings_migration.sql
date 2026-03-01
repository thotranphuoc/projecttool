-- Chạy file này trong Supabase Dashboard → SQL Editor (chỉ cần chạy 1 lần)
-- Tạo bảng app_settings và RLS cho tính năng "Hiển thị menu"

-- Bảng app_settings (singleton)
CREATE TABLE IF NOT EXISTS app_settings (
  id              TEXT PRIMARY KEY DEFAULT 'default',
  menu_visibility JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
INSERT INTO app_settings (id, menu_visibility) VALUES ('default', '{}') ON CONFLICT (id) DO NOTHING;

-- Bật RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: mọi user đăng nhập đều đọc được
CREATE POLICY "app_settings_select" ON app_settings FOR SELECT TO authenticated USING (true);

-- Policy: chỉ admin mới được sửa
CREATE POLICY "app_settings_update" ON app_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.system_role = 'admin'));
