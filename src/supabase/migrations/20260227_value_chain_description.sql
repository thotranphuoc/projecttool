-- Thêm cột mô tả cho từng giai đoạn chuỗi giá trị
ALTER TABLE value_chain_activities
  ADD COLUMN IF NOT EXISTS description TEXT;
