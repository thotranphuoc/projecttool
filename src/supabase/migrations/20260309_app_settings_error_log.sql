-- Thêm cột error_log_enabled vào app_settings (Admin bật/tắt ghi log lỗi)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS error_log_enabled BOOLEAN DEFAULT true;

-- Mặc định bật cho bản ghi hiện có
UPDATE app_settings SET error_log_enabled = true WHERE error_log_enabled IS NULL;
