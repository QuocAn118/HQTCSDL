# Kiểm tay AI Vision với backend thật — chưa thực hiện

Ngày chuẩn bị: 03/11/2026. **Đây là bảng kiểm đang chờ chạy, không phải bằng
chứng đã tích hợp thành công.** Test backend giả và video tổng hợp không thay
thế các bước bên dưới (spec 7.5).

Cập nhật 04/11/2026: route heartbeat đã có theo xác nhận nhóm. Kiểm GET
`http://127.0.0.1:3000/health` và `/api/health` với session bỏ proxy môi trường,
timeout 2 giây: cả hai báo `ConnectTimeout`. Chưa có `backend/.env` và
`ai-vision/.env` trên máy này. Vì vậy chưa thể bắt đầu lượt live 10 phút hoặc
xác nhận CSDL đích là Dev. Không coi sự hiện diện route trong code là kết quả
kiểm thử heartbeat thực tế. Trọng số nay đã đóng băng, xem `freeze.json`.

Kiểm tra ban đầu trên máy:

- Chưa có `ai-vision/.env`; chưa cấu hình URL/khóa dịch vụ cho AI.
- POST route không tồn tại tại `http://127.0.0.1:3000/api/ai/khong-co`, dùng
  khóa thử `x`, không nhận được phản hồi trong hạn kết nối; requests báo
  `ConnectTimeout`. Chưa ghi nhận được status/body 401 hoặc 404 từ NestJS thật.
- Không gửi dữ liệu đếm, ảnh thiên địch hoặc heartbeat vào CSDL.
- Video V01/V02 hiện vẫn là ứng viên, chưa có playlist hợp lệ gồm đoạn thiên
  địch ở đầu để kiểm cooldown. Ngày 04/11 đã đóng băng `best.pt` trong `weights.json`.
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
| Heartbeat | LastSeenAt cập nhật; route đã có theo nhóm | Chưa kiểm | Chờ backend dev chạy |

Khi chạy xong mới thay các ô chờ bằng bằng chứng thật và đánh dấu Task 16.
Không đưa ảnh/video hoặc dữ liệu cá nhân vào repo.
