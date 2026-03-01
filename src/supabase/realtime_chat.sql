-- Chạy file này trong Supabase Dashboard → SQL Editor (chỉ cần chạy 1 lần)
-- Thêm các bảng Chat vào Realtime publication để tin nhắn mới hiện ngay không cần F5

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_groups;

-- (Tùy chọn) Cho Realtime gửi old record khi UPDATE/DELETE tin nhắn
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Nếu bảng đã có trong publication sẽ báo lỗi "already member" — bỏ qua.
