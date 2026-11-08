# Kiểm tra đầu-cuối toàn hệ thống — 08/11/2026

Bằng chứng cho báo cáo (NV6). Mọi số liệu dưới đây là kết quả thật của lượt chạy này. Không sửa code nào trong lượt kiểm.

## Môi trường

| Mục | Giá trị |
|---|---|
| Ngày giờ | 08/11/2026, 03:43Z → 05:17Z (10:43–12:17 giờ VN). Luồng chính trên trình duyệt: 04:07–04:38Z |
| Commit | Nhánh `e2e-final` tạo từ `main` `12cea6f`. Đã có các merge `web` (`e7f6894`), `simulator-fix` (`3910f4c`), `web-heartbeat` (`17b706d`), `ai-vision-fix` (`8cdeee0`) và các commit `backend-latency` (`0339c41`…`12cea6f`). Cây làm việc sạch lúc chạy |
| Máy | Laptop Intel Core i7-4810MQ 2,8 GHz, 4 nhân / 8 luồng, RAM 32 GB; Windows 10 IoT Enterprise LTSC 10.0.19044 |
| Phần mềm | Node v25.8.0, npm 11.11.0; SQL Server Express 17.0.1145.4; Mosquitto 2.1.2; Chromium của Playwright MCP |
| CSDL | `SwiftletCare_Dev`, chạy `deploy.ps1 -Reset -AnchorDateVn 2026-11-07` (ngày neo = hôm qua, theo checklist 7.4). Không động tới `SwiftletCare` (demo) hay CSDL nào khác ngoài `_Dev`/`_Test` |
| Backend | `node dist/main.js` với **bản sao `.env` trong thư mục tạm**, chỉ đổi `DEMO_TOOLS=true`. `ANOMALY_SCHEDULER=on`. Bản sao đã xóa sau khi kiểm |
| Web | `next build` rồi `next start -p 3001`, `NEXT_PUBLIC_API_URL=http://localhost:3000` |
| Thứ tự bật | Mosquitto → simulator `normal` (04:06:40Z, 26 client) → backend (health `ok/ok/connected` lúc 04:07:05Z) → web. Đúng checklist 7.4 |

Mật khẩu tài khoản seed và `X-Service-Key` được script đọc thẳng từ file `.env` hoặc `.env.test`, không in ra hay ghi vào đây. Trên trình duyệt, mật khẩu đi qua một server tạm chỉ nghe 127.0.0.1, đã xóa sau khi kiểm.

## Bước 0–1: mã nguồn và test

| Bước | Kết quả | Đạt |
|---|---|---|
| `main` có đủ năm nhánh | `web`, `web-heartbeat`, `ai-vision-fix`, `backend-latency` đều là tổ tiên của `main`. Ref `simulator-fix` không còn, nhưng commit merge `3910f4c` nằm trong `main` | Đạt |
| backend `npm ci` + `npm test` | ci exit 0; Jest **305/305** | Đạt |
| web `npm ci` + `npm test` | ci exit 0, có **5 cảnh báo `EBADENGINE`**: vitest 5.0.5 yêu cầu Node `^22.12 \|\| ^24 \|\| >=26`, máy dùng 25.8.0; Vitest **99/99** (8 file) | Đạt, có cảnh báo |
| simulator `npm ci` + `npm test` | ci exit 0; node:test **114/114** | Đạt |
| `npm run build` backend, `next build` web | Cả hai exit 0 | Đạt |

## Bước 3: luồng trên trình duyệt (Playwright, owner1 trừ khi ghi khác)

Giờ UTC. Mã cảnh báo là `AlertId` trong `SwiftletCare_Dev` của lượt này, đã reset sau khi kiểm.

| # | Bước | Kết quả | Bằng chứng | Đạt | Ghi chú |
|---|---|---|---|---|---|
| 1 | Đăng nhập owner1 | Vào `/houses/1` (H1), Tổng quan hiện 4 khu vực F0–F3 với số đo | URL sau đăng nhập `/houses/1` | Đạt | |
| 2 | Dashboard cập nhật không cần F5 | Ô số đo F1 đổi ở 3,2 s, 13,5 s và 23,7 s trong 26 giây quan sát; 0 lần điều hướng trang | Bộ ghi trong trang, bắt đầu 04:08:54Z | Đạt | Nhịp 10 giây của simulator |
| 3 | `--scenario hot` → FAN H1-F2 bật rồi tắt | Bật tự động 100% lúc **04:12:10**, tắt lúc **04:17:12** (5 phút 2 giây). Trang Thiết bị đang mở hiện "Đang bật 100% · Tự động" mà không tải lại | ControlLogs thiết bị 11: #4 "TEMP 30.05 > Max 30", #5 "Nha chot: TEMP 27.98" | Đạt | |
| 4 | Điều khiển tay FAN Level 50 rồi trả về AUTO (FAN H1-F1) | Bấm "Bật" ở 50%: `POST /api/devices/7/control {"mode":"MANUAL","isOn":true,"level":50}` 200, web hiện "Đang bật 50% · Điều khiển tay". "Trả về tự động": `{"mode":"AUTO"}` 200; trong 2,5 giây web hiện "Đang tắt · Tự động" | ControlLogs thiết bị 7: #1 MANUAL bật 50 (userId 2), #2 sang AUTO, #3 AUTO tắt "Khong con luat nao can bat" (04:11:27–29) | Đạt | Thanh trượt chỉ chọn mức; lệnh chỉ gửi khi bấm "Bật" (đúng code) |
| 5 | `--scenario dry` → MIST H1-F3 | Bật lúc **04:23:47**, tắt lúc **04:27:35** | ControlLogs thiết bị 14: #8 "HUMID 74.82 < Min 75", #9 "Nha chot: HUMID 82.05" | Đạt | |
| 6 | Cảnh báo ngưỡng xuất hiện trên web | #6 (TEMP 30,08) mở; hiện trên trang Cảnh báo lúc 04:19:21.6, không tải lại. Tự RESOLVED và rời danh sách đang mở lúc 04:20:11.3, không tải lại | Bộ ghi DOM trong trang; #4 (TEMP 30,05) mở 04:12:10, RESOLVED 04:13:01; #7 (HUMID) mở 04:23:47, đóng trước 04:24:46 | Đạt | Cảnh báo ngưỡng của `hot` và `dry` chỉ sống **khoảng 50–60 giây** vì vòng điều khiển kéo số đo về ngay. Không kịp ACK tay, nên ACK được kiểm ở #5 (dòng 7) |
| 7 | ACK, RESOLVED trên web | Cảnh báo #5 (PREDATOR, bước 4 bên dưới): ACK kèm ghi chú → `PATCH /api/alerts/5 {"status":"ACK","note":…}` 200; "Đã xử lý" → `{"status":"RESOLVED"}` 200, `resolvedBy` 2. Lịch sử: NEW → ACK (ghi chú) → RESOLVED; rời danh sách đang mở | Hai phản hồi PATCH, lịch sử 3 dòng | Đạt | Ngưỡng tự RESOLVED ở #4, #6, #7 (SP đóng, `userId` null) |
| 8 | Lịch sử biểu đồ | F2 · Nhiệt độ, 24 giờ, gom 15 phút: `GET /api/zones/3/readings` 200, 37 điểm, biểu đồ đường vẽ được (trục 27,9–29,7). "Chim ra/vào 14 ngày" có biểu đồ cột. "Thống kê theo ngày (7 ngày)" hiện bảng, mỗi ngày 288 mẫu | Phản hồi API, phần tử SVG | Đạt | Bảng thống kê 7 ngày vẫn "Đang tải…" lúc 2,5 giây, có dữ liệu lúc kiểm lại sau 7,5 giây. Chưa đo thời gian chính xác |
| 9 | `--drop H1-F1-SENSOR --drop-after 1 --drop-for 7` → DEVICE_OFFLINE mở rồi đóng; huy hiệu OFFLINE tự cập nhật | DEVICE_OFFLINE **#8** mở 04:34:04 → huy hiệu OFFLINE trên Tổng quan (đang mở, không tải lại) lên 1 lúc 04:34:07.9 (sau **3,9 s**). Simulator nối lại → #8 RESOLVED 04:36:12 → huy hiệu về 0 lúc 04:36:12.9 (dưới **1 s**) | Lịch sử #8: NEW 04:34:04, RESOLVED 04:36:12; log simulator "[RESTORE] Reconnecting: H1-F1-SENSOR" | Đạt | Lần này thấy ngay nhờ sự kiện cảnh báo; chu kỳ tải lại 30 giây không cần dùng tới |
| 10 | `/admin/tools` (admin) tạo POPULATION_DROP H2 | Nhập 07/11/2026 20:30 giờ VN → `POST … {"nowUtc":"2026-11-07T13:30:00Z"}` 200, tạo **#9** POPULATION_DROP H2 CRITICAL, "Số chim về hôm nay (280) thấp hơn trung bình 7 ngày (480) quá 20%". Bấm lần hai: `{"newAlerts":[]}`, hiện "Không có cảnh báo mới." | Phản hồi API | Đạt | Trang `/admin/tools` không có nút Đăng xuất hay thanh điều hướng; phải xóa phiên để đổi tài khoản |
| 11 | owner2 không thấy nhà H1 | Đăng nhập owner2 → `/houses/2`; danh sách nhà chỉ có H2. `/houses/1`, `/houses/1/alerts`, `/houses/1/devices`: "Không tìm thấy"; mọi lệnh gọi API của H1 trả 404 (17 lệnh). owner2 thấy #9 trong cảnh báo H2 | Danh sách phản hồi API | Đạt | |

## Bước 4: thiên địch

| Bước | Kết quả | Bằng chứng | Đạt |
|---|---|---|---|
| `POST /api/ai/predator-detections` với `contracts/fixtures/ai/snake.jpg` (camera H1-F0-CAMERA, snake 0,87, `X-Service-Key` đọc từ `.env`) | 200 `{"created":true,"alertId":5,"skipReason":null}` lúc 04:17:56 | Phản hồi API | Đạt |
| Cảnh báo PREDATOR có ảnh trên web | #5 hiện trên trang Cảnh báo (đang mở, không tải lại) lúc 04:17:57.4. Chi tiết: "PREDATOR · CRITICAL · snake (0.87)", ảnh hiện bằng URL `blob:`, 160×120, tải xong | Bộ ghi DOM, thuộc tính ảnh | Đạt |
| AI thật (YOLO + video) của TV3 | **Không chạy trên máy này**: thiếu `ai-vision/data/weights/best.pt` và video V01–V07. TV3 đã chạy trên máy của TV3, xem `ai-vision/results/e2e.md` (04–05/11/2026). Tài liệu này **không khẳng định** kết quả đó | — | Chưa làm |

Ảnh chụp của #5 trong `backend/storage/snapshots/2026/11/08/` đã xóa sau khi reset CSDL.

## Bước 5: độ trễ

Không đo lại. Xem `backend/results/latency.md` (đo 08/11/2026 trên cùng máy).
- Số đo → `readings.new`: p95 0,79–1,66 s, nhưng 0,8–3,8% mẫu vượt 2 s; có cụm chậm khoảng 65 giây một lần, chưa rõ nguyên nhân.
- Cảnh báo → `alert.created`: max 1,47 s.
- Chưa đo mobile, LAN và thông báo đẩy.

## Bước 6: test hợp đồng backend

Chạy `npm run test:contract` sau khi đã tắt backend dev, simulator và web; Mosquitto vẫn chạy. CSDL `SwiftletCare_Test` được phục hồi từ `SwiftletCare_Test_seed.bak` cho mỗi chuỗi.

| Kết quả | Chi tiết |
|---|---|
| **55/55 đạt**, 0 fail, 0 cancelled | 04:39:30 → 05:16:57Z (37 phút 27 giây) |
| DEVICE_OFFLINE từ nhịp nền | Có cảnh báo sau 56 giây |
| Danh sách bỏ qua tường minh | `rest/harvests-post.cut`, `rest/report-env-vs-yield.cut` (dưới ranh giới cắt, mục 9 backend chưa làm) |

## Log trong lượt kiểm

Log backend (04:07–04:38Z) không có dòng `ERROR` hay `WARN` nào.

## Phát hiện trong lượt này

Không phát hiện lỗi chức năng nào làm hỏng một bước. Các điểm ghi nhận:

1. **Cảnh báo ngưỡng sống rất ngắn khi demo `hot`/`dry`** (#4: 51 giây, #6: 50 giây). Người trình bày khó ACK tay một cảnh báo ngưỡng. Khi demo ACK/RESOLVED nên dùng cảnh báo thiên địch hoặc sụt đàn.
2. **`/admin/tools` không có Đăng xuất hay điều hướng**; muốn đổi tài khoản phải xóa phiên hoặc mở tab mới.
3. **`EBADENGINE`**: vitest 5.0.5 không khai báo hỗ trợ Node 25.8.0 (bảng phiên bản trong AGENTS.md cho phép `>=24`). Test vẫn đạt 99/99.
4. **Bảng "Thống kê theo ngày (7 ngày)" tải chậm**: chưa có ở 2,5 s, đã có ở 7,5 s. Chưa đo chính xác.

## Hạn chế còn lại

- **AI thật** chưa chạy trên máy này (thiếu `best.pt` và video). Chỉ kiểm đường HTTP thiên địch bằng ảnh fixture.
- **Mobile** chưa kiểm trong lượt này. Không có thông báo đẩy (hạn chế 5 của spec backend).
- **Độ trễ:** có mẫu vượt 2 s; cụm chậm khoảng 65 giây một lần chưa rõ nguyên nhân (`backend/results/latency.md`).
- **Các phát hiện web chưa sửa** trong `web/results/e2e.md`:
  - T15W-3: mất mạng rồi bấm tab.
  - T15W-4: tiêu đề "Nhà yến".
  - T15W-5: nhật ký hiện "Tắt 50%".
  - T15W-6: thông báo tên quá dài.
  - Heartbeat không phát sự kiện tới web; huy hiệu cơ cấu chấp hành dựa vào chu kỳ tải lại 30 giây.
- **POPULATION_DROP** chỉ demo được một lần mỗi CSDL (hạn chế 6 của spec backend).
- **Chỉ chạy trên một máy:** không có LAN, không có máy thứ hai.
- **ACL Mosquitto:** repo chưa có file ACL. Các máy đang chạy không bật ACL.

## Việc TV2 tự làm (không tự động hóa được ở đây)

| Việc | Lý do |
|---|---|
| **Ctrl+C bằng phím thật** trên cửa sổ backend, simulator và AI (một lần và hai lần liên tiếp) | Lượt này dừng tiến trình bằng công cụ, không phải bàn phím thật; tắt êm chưa được kiểm bằng tay |
| **S5: khởi động lại SQL Server** khi backend đang chạy (dịch vụ `MSSQL$SQLEXPRESS`), xem backend báo 503 rồi tự hồi | Cần quyền admin để dừng dịch vụ, và làm gián đoạn các CSDL khác trên máy |
| **Mở web bằng IP LAN từ một máy khác** (điện thoại hoặc laptop), kèm luật Firewall cho cổng 3000/3001 | Không có máy thứ hai; `web/results/e2e.md` bước 11 cũng mới thử trên chính máy |
| **Mật khẩu MQTT trên máy demo**: tạo `backend`, `simulator` (và `latency-probe` nếu đo độ trễ) bằng `mosquitto_passwd`, điền vào từng `.env`; không dùng lại mật khẩu yếu | File `passwd` và `.env` không nằm trong repo; mỗi máy tự tạo |

## Dọn dẹp

- `deploy.ps1 -Database SwiftletCare_Dev -Reset` sau khi kiểm, ngày neo mặc định, exit 0.
- Đã tắt backend, simulator, web, Mosquitto, Playwright, các script theo dõi và server mật khẩu tạm. Cổng 1883, 3000, 3001, 3100 không còn tiến trình nào nghe.
- Đã xóa bản sao `.env` và ảnh thử trong `backend/storage`.
