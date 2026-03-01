-- Bổ sung trường giới thiệu nhóm. Chạy trong Supabase SQL Editor (1 lần).

ALTER TABLE chat_groups ADD COLUMN IF NOT EXISTS description TEXT;
