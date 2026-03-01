# Bật Realtime cho bảng profiles

Để cột **Trạng thái** (Đang làm / Rảnh) trên Team Activity cập nhật realtime khi thành viên bật/tắt timer, cần thêm bảng `profiles` vào publication **supabase_realtime**.

## Cách 1: Dùng Supabase Dashboard

1. Mở [Supabase Dashboard](https://app.supabase.com/) và chọn project của bạn.
2. Sidebar bên trái: vào **Database** → **Publications**  
   (đường dẫn: `https://supabase.com/dashboard/project/<project-ref>/database/publications`)
3. Chọn publication **`supabase_realtime`**.
4. Trong danh sách bảng, **bật (toggle ON)** cho bảng **`profiles`**.
5. Lưu nếu có nút lưu. Thay đổi có hiệu lực ngay.

## Cách 2: Dùng SQL

1. Vào **SQL Editor** trong Supabase Dashboard.
2. Chạy câu lệnh:

```sql
alter publication supabase_realtime add table profiles;
```

3. Nếu bảng `profiles` đã có trong publication thì sẽ báo lỗi; khi đó không cần làm gì thêm.

---

Sau khi bật, ứng dụng sẽ nhận event **UPDATE** khi `profiles.active_timer` (và mọi cột khác của `profiles`) thay đổi.

## Không thấy update realtime?

1. **Kiểm tra publication**  
   Vào **Database → Publications** → `supabase_realtime`. Bảng **profiles** phải được bật (có trong danh sách).

2. **Kiểm tra Console (F12)**  
   Mở DevTools → Console. Vào trang Team Activity, sau đó bật hoặc tắt timer (cùng user hoặc user khác).  
   - Nếu thấy `[Team Activity] Realtime profiles channel error:` → lỗi kết nối Realtime (kiểm tra network, Supabase project).  
   - Nếu không có lỗi nhưng cột Trạng thái vẫn không đổi → thử refresh trang hoặc đăng xuất/đăng nhập lại.

3. **Test với hai user**  
   User A: mở Team Activity (chọn project có cả A và B). User B: ở tab/trình duyệt khác, bật timer. Trên màn hình Team Activity của A, cột Trạng thái của B phải chuyển sang "Đang làm" không cần refresh.

4. **RLS**  
   Policy `profiles_select` phải cho phép authenticated SELECT mọi profile (ví dụ `USING (true)`). Nếu chỉ cho SELECT profile của chính mình thì user khác sẽ không nhận được event khi B update.
