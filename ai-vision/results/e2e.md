# AI Vision với backend Dev thật — 04/11/2026

Đã kiểm chứng tích hợp bằng mô hình thật và video chạy thử V01. **Chưa hoàn
tất Task 16 với video thiên địch được duyệt.** Không dùng lượt này làm số đo
độ chính xác đếm hoặc báo động giả/giờ.

## Môi trường

- Commit AI/backend: `e156247837ce78aab22a24a1beef46bb8aebd3f5`.
- SQL Express Mixed Mode, TCP 1433; CSDL **SwiftletCare_Dev** mới, 5 migration,
  SP/trigger/view thật và seed neo 03/11/2026. Không reset CSDL có sẵn.
- NestJS build thành công; URL `http://127.0.0.1:3000`, đọc `.env` cục bộ.
- Mosquitto 2.1.2, nghe 127.0.0.1:1883, tài khoản backend, persistence.
  Client không tài khoản bị từ chối, exit 5. Windows service broker để Manual;
  broker chạy nền riêng với cấu hình xác thực.
- CLI Mosquitto không mở được đường dẫn repo có dấu trên máy này. Runtime
  broker ở thư mục ASCII `%USERPROFILE%/SwiftletCare-Dev/mosquitto`.
  File mật khẩu đã hash, không đưa vào Git.
- Backend và AI có cùng service key, SNAPSHOT_MAX_BYTES=2097152.
- best.pt đã đóng băng, SHA-256
  `0dbec2d3176e637873a7ea3209c23c97a5a41806cc3b8c250ed55c7b2fee5cc9`.
  Giữ nguyên YAML/hash trong `freeze.json`, imgsz 640, bật heartbeat.
- H1 phát lặp V01.webm theo thời gian thật. Nguồn là house martin ở tổ,
  không phải video nhà yến hoặc thiên địch. Không sửa tham số theo kết quả.

## Kiểm HTTP và broker

| Kiểm tra | Kết quả thật |
|---|---|
| GET /api/health | 200, status=ok, db=ok, mqtt=connected |
| Sai X-Service-Key tại /api/ai/bird-counts | 401 UNAUTHENTICATED |
| POST /api/ai/khong-co, khóa đúng | 404 NOT_FOUND, sqlNumber=null, details=null |
| POST /api/ai/heartbeat, object hợp lệ | 200, accepted=1, rejected=0 |
| MQTT không tài khoản | Connection Refused: not authorised, exit 5 |

Probe heartbeat đầu gửi nhầm mảng bị DTO từ chối 400; gửi lại object đúng
fixture nhận 200. Không đổi hợp đồng/code để chấp nhận mảng. Query cảnh báo
dùng `type`/`limit`; backend từ chối các tên sai `alertType`/`pageSize`.

## Lượt live thật

Bắt đầu log start **2026-11-04T02:37:37Z** (09:37:37 giờ VN), kết thúc
02:47:41Z: **602,55 giây** sau start, exit **0**. Dừng bằng
`GenerateConsoleCtrlEvent(CTRL_C_EVENT)` của Windows, không dùng
`_thread.interrupt_main` hay đồng hồ giả. Đây là kiểm tự động bằng tín hiệu
console thật, chưa phải thao tác bàn phím tay. Log stop lúc 02:47:40Z.

| Hạng mục | Kết quả thực tế |
|---|---|
| Live >= 10 phút | 602,55 giây, exit 0, không lỗi runtime |
| Heartbeat lượt chính | 20 lần HTTP 200 |
| Gửi số đếm lượt chính | 12 lần HTTP 200, gồm tổng cuối lúc 02:47:40Z |
| FPS toàn luồng từng phút | 13,75–18,03 FPS; có bỏ khung theo thời gian thật |
| Cửa sổ 02:35, 02:40, 02:45 UTC | API và tổng cuối trong log cùng in=0/out=0 |
| Ảnh cảnh báo | Ba ảnh đầu GET 200, image/jpeg; đã xem ảnh có khung đỏ |
| File khóa | Đã xóa, restart lấy khóa thành công; sau restart cũng đã xóa |
| Health sau cả hai lượt | 200, db=ok, mqtt=connected |

Số đếm **0 không phải bằng chứng đếm đúng**: V01 chưa có nhãn đếm tay và
không phù hợp đánh giá qua vạch cố định. `e2e_windows.csv` chỉ đối chiếu vận
chuyển/lưu trữ số đếm, không tính MAE hoặc Recall trên video.

## Cảnh báo và ảnh

Ba cảnh báo đầu từ chính mô hình thật, không chèn thủ công:

| AlertId Dev | Lớp nhận dạng | at (UTC) | Confidence | GET snapshot |
|---|---|---|---:|---|
| 10 | snake | 2026-11-04T02:37:38Z | 0,60 | 200, image/jpeg, 196739 byte, 1280x720 |
| 11 | owl | 2026-11-04T02:38:07Z | 0,71 | 200, image/jpeg, 189109 byte, 1280x720 |
| 12 | rat | 2026-11-04T02:38:06Z | 0,64 | 200, image/jpeg, 191716 byte, 1280x720 |

Ảnh snake đã xem trực tiếp: khung đỏ bao chim non ở tổ, **là nhận dạng sai**.
Các cảnh báo chứng minh luồng mô hình → xác nhận → HTTP → SP → lưu ảnh → API
đang hoạt động, không chứng minh nhận đúng thiên địch. Chưa xác nhận loài thật
từng khung hoặc đo false-alarm rate của toàn video.

## Khởi động lại và cooldown backend

Restart lúc **02:47:54Z**, chạy 48,39 giây rồi Ctrl+C, exit 0. Sự kiện snake
cuối lượt chính có at **02:47:38Z**, tạo AlertId **16**. Sau restart:

| Lớp | at sau restart | HTTP | created | skipReason |
|---|---|---:|---|---|
| snake | 2026-11-04T02:47:55Z | 200 | false | COOLDOWN |
| owl | 2026-11-04T02:48:23Z | 200 | false | COOLDOWN |
| rat | 2026-11-04T02:48:23Z | 200 | false | COOLDOWN |

Cả ba gửi đúng một lần (attempt=1), không thử lại. API chỉ có các cảnh báo
mới từ lượt chính (ID 10–16), không có cảnh báo mới từ lượt restart.
Heartbeat restart có 2 lần 200; LastSeenAt camera qua API là
**2026-11-04T02:48:26Z**, status ONLINE tại thời điểm đối chiếu.

Chi tiết nhỏ, không có khóa/JWT: `e2e_summary.json` và `e2e_windows.csv`.
Bằng chứng cục bộ gitignore ở `data/local-setup/`: receipt, HTTP probe, ảnh tải
lại từ backend, log từng lượt. `data/logs/H1-F0-CAMERA.log` ghi nối.

## Tái lập snapshot

`core.autocrlf=true` đã đổi script đo LF thành CRLF khi checkout, làm hash byte
lệch dù Git không có diff nội dung. Đã kiểm hash sau chuẩn hóa trùng snapshot,
khôi phục byte LF gốc và thêm `.gitattributes` cho artifact đã đóng băng.
Không đổi `freeze.json`, trọng số, tham số hoặc số đo; không đo lại test.
Test hồi quy kiểm hash các file nguồn sau checkout.

## Còn thiếu để hoàn tất Task 16

- Video thiên địch được duyệt, có nguồn/giấy phép và nhãn trước suy luận.
- Video đếm qua vạch cố định và nhãn đếm tay; TV5 đối chiếu.
- Xác nhận đồng bộ giờ Windows; chưa thay đổi dịch vụ thời gian.
- Ctrl+C hai lần liên tiếp bằng bàn phím thật chưa kiểm; test đơn vị đã có.
- Chưa mở web trong lượt này; đã đối chiếu REST API theo spec cho phép.

Backend và broker được giữ chạy nền; AI đã dừng để tránh tiếp tục phát cảnh
báo sai. Camera có thể chuyển OFFLINE sau 5 phút nếu không bật lại AI, đúng
nghiệp vụ. Cảnh báo DEVICE_OFFLINE của cảm biến khi chưa bật simulator là
hành vi nhịp nền với seed hôm trước, không phải lỗi heartbeat camera.
