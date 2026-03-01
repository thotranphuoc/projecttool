# Thiết lập Chat

Để tính năng Chat hoạt động đúng (danh sách hội thoại, gửi tin, tin mới hiện realtime), cần đảm bảo các bước sau.

## 1. Migration bảng Chat

Đảm bảo đã chạy migration tạo các bảng: `conversations`, `chat_groups`, `messages`, `message_reads`, `chat_settings`, và seed row `chat_settings` (id = 'default').

**Cách nhanh (khuyến nghị):** Mở Supabase Dashboard → **SQL Editor** → chạy file [chat_tables_migration.sql](chat_tables_migration.sql) trước. File này tạo đủ bảng chat + RLS. Yêu cầu bảng `profiles` đã tồn tại (thường có sẵn khi dùng Auth).

- Nếu dùng file gốc: chạy toàn bộ [migrations.sql](migrations.sql) trong SQL Editor (hoặc phần liên quan tới chat).
- Hoặc đảm bảo đã chạy project migration qua Supabase CLI / Dashboard.

## 2. Realtime cho Chat

Tin nhắn mới chỉ hiện ngay (không cần F5) khi các bảng chat nằm trong publication **supabase_realtime**.

**Cách làm:** Mở Supabase Dashboard → **SQL Editor** → chạy file [realtime_chat.sql](realtime_chat.sql) (hoặc copy nội dung vào và Run).

Nếu bảng đã có trong publication sẽ báo lỗi "already member" — bỏ qua.

**Kiểm tra publication:** Trong SQL Editor chạy:
```sql
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```
Phải thấy ít nhất `messages`, `conversations`, `chat_groups`. Nếu thiếu, chạy lại [realtime_chat.sql](realtime_chat.sql).

**Cách bật qua Dashboard:** Database → **Replication** → publication `supabase_realtime` → bật (toggle) các bảng `messages`, `conversations`, `chat_groups`.

## 3. Chat settings

Trang Admin → Cài đặt Chat cần có row `id = 'default'` trong bảng `chat_settings`. Migration thường đã có `INSERT INTO chat_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;`. Nếu thiếu, chạy:

```sql
INSERT INTO chat_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;
```

## 4. Storage (gửi file đính kèm)

Nếu dùng tính năng gửi file trong Chat, cần bucket **chat-attachments** và policy tương ứng (xem phần storage trong migrations.sql). Kiểm tra trong Dashboard → Storage → bucket `chat-attachments` đã tồn tại và policy đã bật.

## Realtime không hoạt động?

1. **Console trình duyệt:** Mở Chat, chọn một cuộc hội thoại, bấm F12 → tab Console. Nếu Realtime kết nối thành công sẽ thấy log `[ChatService] Realtime đã kết nối cho cuộc hội thoại/nhóm.` Nếu thấy `[ChatService] Realtime lỗi` thì kiểm tra lại publication và RLS.
2. **RLS:** Realtime chỉ gửi event khi user (JWT) có quyền SELECT trên row đó. Đảm bảo policy `messages_select` cho phép user đọc tin trong cuộc hội thoại/nhóm mà họ tham gia.
3. **Tin của mình vẫn hiện ngay:** Ứng dụng đã dùng optimistic update — tin bạn gửi sẽ hiện ngay; tin từ người khác phụ thuộc Realtime.

## Checklist nhanh

- [ ] Đã chạy [chat_tables_migration.sql](chat_tables_migration.sql) (tạo bảng chat) trong SQL Editor
- [ ] Đã chạy [realtime_chat.sql](realtime_chat.sql) trong SQL Editor (sau khi bảng đã có)
- [ ] Đã kiểm tra `pg_publication_tables` có `messages`, `conversations`, `chat_groups`
- [ ] Bảng `chat_settings` có row id = 'default'
- [ ] (Tùy chọn) Bucket `chat-attachments` đã tạo nếu cần gửi file
