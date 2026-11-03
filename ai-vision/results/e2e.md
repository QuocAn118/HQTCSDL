# Kiểm tay AI Vision với backend thật — chưa thực hiện

Ngày chuẩn bị: 03/11/2026. **Đây là bảng kiểm đang chờ chạy, không phải bằng
chứng đã tích hợp thành công.** Test backend giả và video tổng hợp không thay
thế các bước bên dưới (spec 7.5).

Kiểm tra ban đầu trên máy:

- Chưa có `ai-vision/.env`; chưa cấu hình URL/khóa dịch vụ cho AI.
- POST route không tồn tại tại `http://127.0.0.1:3000/api/ai/khong-co`, dùng
  khóa thử `x`, không nhận được phản hồi trong hạn kết nối; requests báo
  `ConnectTimeout`. Chưa ghi nhận được status/body 401 hoặc 404 từ NestJS thật.
- Không gửi dữ liệu đếm, ảnh thiên địch hoặc heartbeat vào CSDL.
- Video V01/V02 hiện vẫn là ứng viên, chưa có playlist hợp lệ gồm đoạn thiên
  địch ở đầu để kiểm cooldown. Trọng số vẫn là bản trial trong `weights.json`.
- Chưa xác nhận backend dùng `SwiftletCare_Dev` hoặc đã có seed camera.

## Chuẩn bị trước khi chạy

1. Xác nhận với TV2 URL backend dev, seed hai mã camera và CSDL
   `SwiftletCare_Dev`; không reset CSDL demo `SwiftletCare`.
2. Cấu hình `.env` cục bộ từ mẫu; lấy AI_SERVICE_KEY qua kênh riêng. Không ghi
   khóa vào bảng kiểm, log, commit hoặc nội dung PR.
3. Kiểm giới hạn ảnh hai bên, đồng bộ giờ Windows và playlist video đã duyệt.
4. Ghi commit AI/backend, SHA-256 trọng số, cấu hình camera và giờ bắt đầu thực
   tế trước khi điền kết quả dưới đây.

| Bước | Mong đợi | Kết quả thật | Trạng thái |
|---|---|---|---|
| Route sai | Ghi status/body 401 hoặc 404 của backend thật | Chưa nhận được phản hồi | Chờ backend |
| Live | Chạy ít nhất 10 phút | Chưa chạy | Chờ cấu hình và video |
| Số đếm | Web/API khớp log counts.sent theo cửa sổ 5 phút | Chưa kiểm | Chờ |
| Thiên địch | Cảnh báo PREDATOR và ảnh có khung bao; ghi at | Chưa kiểm | Chờ |
| Cooldown | Khởi động lại trong 5 phút, nhận skipReason=COOLDOWN, không thêm cảnh báo | Chưa kiểm | Chờ |
| Dừng | Tổng cuối đến backend và file khóa được xóa | Chưa kiểm với backend thật | Chờ |
| Heartbeat | LastSeenAt cập nhật, chỉ bật nếu backend có route | Chưa kiểm | Chờ xác nhận Task 26 backend |

Khi chạy xong mới thay các ô chờ bằng bằng chứng thật và đánh dấu Task 16.
Không đưa ảnh/video hoặc dữ liệu cá nhân vào repo.
