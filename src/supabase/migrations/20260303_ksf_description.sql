-- Thêm cột description cho bảng ksfs
ALTER TABLE ksfs ADD COLUMN IF NOT EXISTS description TEXT;
