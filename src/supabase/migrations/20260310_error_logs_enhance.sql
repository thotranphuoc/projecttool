-- Bổ sung trường để dễ detect/nhóm lỗi: route_path, error_name
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS route_path TEXT;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS error_name TEXT;

-- Index cho filter theo route (vd: lỗi chỉ xảy ra ở /admin/error-logs)
CREATE INDEX IF NOT EXISTS idx_error_logs_route_path ON error_logs(route_path);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_name ON error_logs(error_name);
