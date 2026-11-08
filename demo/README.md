# Bộ demo 5 phút

Dùng cho buổi demo trên máy TV3 (có `best.pt`, video V04–V07, YOLO chạy CPU), Windows PowerShell 5.1. Mọi lệnh chạy **từ gốc repo**. Bộ này chỉ có script và tài liệu, không sửa code backend, web, simulator hay ai-vision. CSDL là **`SwiftletCare_Dev`**; nếu muốn dùng một CSDL demo riêng thì hỏi nhóm trưởng trước.

| File | Làm gì |
|---|---|
| `start-demo.ps1 [-SkipAi]` | Bật theo checklist spec backend 7.4:<br>1. Mosquitto<br>2. Simulator `normal`, riêng `H1-F2-SENSOR` bị `--drop`<br>3. `zone-keeper.ps1`<br>4. Backend, dùng **bản sao** `backend/.env` có `DEMO_TOOLS=true` trong `%TEMP%\swiftletcare-demo`<br>5. Web: `next build` rồi `next start -p 3001`<br><br>Sau mỗi bước đều kiểm (số đo đầu tiên, health, `/login`). Nếu không có `-SkipAi` thì kiểm thêm file của AI. Không in mật khẩu hay khóa |
| `stop-demo.ps1` | Chỉ tắt các cây tiến trình mà script demo đã mở, nhận diện theo PID và giờ bắt đầu ghi lại lúc mở; không tắt theo tên chung chung. Xóa bản sao `.env` và file tạm |
| `reset-demo.ps1` | `deploy.ps1 -Database SwiftletCare_Dev -Reset`, ngày neo = hôm qua theo giờ VN. Từ chối nếu backend còn chạy |
| `zone-keeper.ps1` | Gửi số đo bình thường cho H1-F2 mỗi 10 giây, thay cho phần simulator đã ngừng. Khi có cờ nóng thì gửi TEMP nóng |
| `hot-now.ps1 [-Seconds 40]` | Gửi ngay TEMP 31,5 cho H1-F2. Quạt H1-F2 tự bật sau khoảng 3 giây. Sau `-Seconds` giây thì tự chạy `cool-now`; `-Seconds 0` giữ nóng đến khi gọi `cool-now` |
| `cool-now.ps1` | Gửi TEMP 27,5 cho H1-F2. Quạt tự tắt, cảnh báo ngưỡng tự đóng |
| `ai-now.ps1` | Bật AI thật cho H1-F0-CAMERA, playlist V05 → V06, có `--heartbeat`, trong cửa sổ riêng. So SHA-256 với `ai-vision/results/video-freeze-2026-11-05.json` trước; sai hoặc thiếu thì dừng |
| `predator-now.ps1 [-Class snake]` | Dự phòng: `POST /api/ai/predator-detections` với `contracts/fixtures/ai/snake.jpg` |
| `run-sql.ps1` + `sql-demo.sql` | 2 truy vấn phần CSDL, có in thời gian thực thi |

## Vì sao có `zone-keeper` (quạt tự bật không phải chờ 5 phút)

Gửi số đo nóng bằng MQTT, tài khoản `simulator` đọc từ `simulator/.env`, đủ 4 chỉ số, `at` là giờ UTC hiện tại có `Z`: vòng tự động bật FAN sau **2,7–3,8 giây**.

Nhưng nếu simulator vẫn gửi số đo cho khu vực đó, quạt sẽ **bật/tắt liên tục**. Đo thật 08/11: trong 24 giây có 3 lần bật, 3 lần tắt và 3 cảnh báo ngưỡng mới. Lý do là cứ 10 giây simulator lại gửi TEMP khoảng 27,5, và lô nào chỉ có số đo đó thì TEMP ≤ 28, vòng điều khiển tắt quạt.

Cách xử lý không cần sửa code: simulator chạy kịch bản `normal` với cờ có sẵn `--drop H1-F2-SENSOR --drop-after 0 --drop-for 600`, nên chỉ cảm biến này ngừng gửi. `zone-keeper` gửi thay mỗi 10 giây, nên dashboard vẫn có số liệu và cảm biến không bị OFFLINE. Đo lại sau khi sửa: **1 lần bật (2,7 s), 1 lần tắt (3,3 s), 1 cảnh báo**.

Người trình bày nói rõ: **"số đo nóng ở F2 do script đẩy vào để khỏi chờ, các khu vực khác là simulator"**.

## Checklist trước demo (làm trước giờ demo ít nhất 15 phút)

- [ ] SQL Server chạy, dịch vụ `MSSQL$SQLEXPRESS`, TCP 1433.
- [ ] `powershell -ExecutionPolicy Bypass -File demo\reset-demo.ps1`: CSDL mới, ngày neo hôm qua (sụt đàn chỉ demo được **một lần** mỗi CSDL).
- [ ] Có đủ `.env`:
  - `backend/.env`: `DB_NAME` kết thúc bằng `_Dev`, có `AI_SERVICE_KEY`, `MQTT_PASSWORD`, `JWT_SECRET`.
  - `simulator/.env`: có mật khẩu MQTT của `simulator`.
  - `database/.env`
  - `web/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:3000`
  - `ai-vision/.env`: cùng `AI_SERVICE_KEY` với backend.
- [ ] Mật khẩu: tài khoản seed theo `database/README.md`; tài khoản MQTT `backend`/`simulator` đã tạo bằng `mosquitto_passwd` (`infra/mosquitto/README.md`). Không đọc to, không chiếu lên màn hình.
- [ ] Cổng 1883, 3000, 3001 trống. Dịch vụ Windows "Mosquitto Broker" đã dừng.
- [ ] AI:
  - Có `ai-vision/.venv`, `ai-vision/data/weights/best.pt`, `ai-vision/data/videos/V05.mp4` và `V06.mp4`.
  - SHA-256 khớp `ai-vision/results/video-freeze-2026-11-05.json`; `ai-now.ps1` tự so, hoặc chạy vòng lặp trong `ai-vision/README.md` mục "Demo thiên địch trên H1".
  - Không có file khóa `ai-vision/data/run/H1-F0-CAMERA.lock`.
- [ ] `powershell -ExecutionPolicy Bypass -File demo\start-demo.ps1`. Đo 08/11 mất khoảng 3 phút 36 giây, `next build` chiếm khoảng 2,5 phút. Phải in được dòng "SAN SANG".
- [ ] Trình duyệt:
  - **Tab 1, owner1:** `http://localhost:3001`, mở Tổng quan nhà H1.
  - **Mở sẵn tab Lịch sử một lần**: bảng thống kê 7 ngày tải chậm, đo 08/11 chưa có lúc 2,5 giây, đã có lúc 7,5 giây.
  - **Cửa sổ ẩn danh riêng cho admin** `/admin/tools`, chỉ khi muốn demo sụt đàn. Trang này **không có nút Đăng xuất**, nên không đổi tài khoản trong đó.
- [ ] Một cửa sổ PowerShell ở gốc repo, gõ sẵn lệnh `hot-now`.
- [ ] Mở sẵn `backend/results/latency.md` để đọc số ở phút 4:30.
- [ ] Video quay sẵn của lần tập (phương án cuối cùng) mở sẵn.

## Kịch bản 5 phút

| Mốc | Người nói | Người thao tác | Lệnh / thao tác |
|---|---|---|---|
| **0:00** | Giới thiệu: nhà yến IoT; simulator → MQTT → NestJS → SQL Server (SP/trigger) → web; AI phát hiện thiên địch. Mọi thời gian lưu UTC | Màn hình Tổng quan H1 | — |
| **0:30** | "Số đo cập nhật trực tiếp, không cần tải lại" (nhịp 10 giây) | Chỉ vào một ô số đo đang đổi | — |
| **1:15** | "Đẩy một số đo nóng vào khu vực F2 (script, để khỏi chờ). Vượt Max 30 → vòng tự động bật quạt và mở cảnh báo ngưỡng." Không ACK cảnh báo này | Gõ lệnh, quay lại Tổng quan xem "Quạt H1 tầng 2" chuyển "Bật" | `powershell -ExecutionPolicy Bypass -File demo\hot-now.ps1 -Seconds 35` (khoảng 3 giây sau quạt bật; sau 35 giây tự gửi số đo mát, quạt tắt) |
| **2:00** | "Điều khiển tay: quạt 50%, rồi trả về tự động" | Tab Thiết bị → Quạt H1 tầng 2: kéo Level 50 → bấm **Bật** → thấy "Đang bật 50% · Điều khiển tay" → **Trả về tự động** | Thanh trượt chỉ chọn mức; lệnh được gửi khi bấm "Bật" |
| **2:30** | "AI phát hiện rắn trên video thật → cảnh báo có ảnh" | Tab Cảnh báo. Chạy AI; đợi cảnh báo "Mới · Phát hiện rắn…" hiện (không tải lại) → mở → xem ảnh → ghi chú → **Đã xem (ACK)** → **Đã xử lý** | AI thật: `powershell -ExecutionPolicy Bypass -File demo\ai-now.ps1`. Dự phòng: `powershell -ExecutionPolicy Bypass -File demo\predator-now.ps1` |
| **3:30** | "Nghiệp vụ nằm trong CSDL: `sp_SetActuator` ghi lý do vào ControlLogs; trigger `trg_Alerts_History` ghi mọi lần đổi trạng thái, kể cả khi SP tự đóng cảnh báo" | Chạy SQL, chỉ vào dòng "TEMP 31.5 > Max 30" và dòng NEW → ACK → RESOLVED vừa làm | `powershell -ExecutionPolicy Bypass -File demo\run-sql.ps1` |
| **4:30** | Độ trễ đo 08/11 trên cùng máy, loopback: số đo đến web p95 0,79–1,66 s, nhưng 0,8–3,8% mẫu vượt 2 s; cảnh báo đến client Socket.IO tối đa 1,47 s. Chưa đo mobile. Kết luận và hạn chế | Mở `backend/results/latency.md` | — |
| **5:00** | Hết | | |

Sau demo: `powershell -ExecutionPolicy Bypass -File demo\stop-demo.ps1`, rồi `demo\reset-demo.ps1` nếu còn tập tiếp. Nếu tắt AI bằng Ctrl+C trong cửa sổ của nó thì AI tự xóa khóa. Nếu để `stop-demo` tắt cứng thì `stop-demo` xóa khóa thay.

## Cooldown thiên địch và tập nhiều lần

Backend chặn lặp theo **cùng camera + cùng lớp trong ±5 phút**, tính trên các cảnh báo đã lưu trong CSDL. Đã RESOLVED vẫn bị chặn, và **khởi động lại backend không xóa cooldown**. Kết quả trả về là `COOLDOWN`, và `predator-now.ps1` in cảnh báo.

Các cách hợp lệ, không sửa CSDL bằng tay:
1. Giữa hai lần tập, cách nhau hơn 5 phút từ lúc gửi thiên địch. Một lượt kịch bản là 5 phút, nên chừa thêm khoảng 30 giây.
2. Đổi lớp khi tập: `-Class rat` hoặc `-Class owl`. Ảnh vẫn là ảnh rắn, nên **chỉ dùng khi tập**.
3. `demo\reset-demo.ps1` (sau `stop-demo`). Nên làm cách này trước buổi demo thật.

Mỗi cảnh báo thiên địch được tạo sẽ để lại một ảnh trong `backend/storage/snapshots/<yyyy>/<MM>/<dd>/` (gitignore). `reset-demo` không xóa các ảnh này; sau buổi tập có thể xóa thư mục ngày tập.

Lưu ý: nếu AI thật đã tạo cảnh báo rắn cho H1-F0-CAMERA thì `predator-now.ps1 -Class snake` trong 5 phút sau đó sẽ bị `COOLDOWN`. Khi đó cứ dùng cảnh báo của AI, không cần dự phòng.

## Phương án dự phòng

| Bước hỏng | Làm gì |
|---|---|
| AI không ra cảnh báo trong khoảng 20 giây, `ai-now.ps1` báo thiếu file hoặc sai hash, hoặc cửa sổ AI lỗi | `demo\predator-now.ps1` (ảnh mẫu); nói rõ "đây là ảnh mẫu gửi qua đúng API AI dùng" |
| Web treo hoặc mất số đo | F5 tải lại trang; vẫn hỏng thì xem cửa sổ "demo: backend" và `http://localhost:3000/api/health` |
| Quạt không tự bật sau `hot-now` | Chuyển sang điều khiển tay ở mốc 2:00 ngay; nói "vòng tự động đã có trong nhật ký" và cho xem SQL ở 3:30 |
| Cả hệ thống hỏng | Chiếu video quay sẵn; sau đó `stop-demo`, `start-demo` |
| `start-demo` báo cổng bận | Có tiến trình cũ: `stop-demo` (nếu do demo mở), nếu không thì tìm và tắt đúng tiến trình đang giữ cổng |

## KHÔNG nói, KHÔNG làm

- **Không khẳng định AI đếm đúng chim.** Đo của TV3: recall chim 1,54% (imgsz 640), sai số đếm MAE 2 mỗi chiều trên một đoạn V03 dài 25,96 giây (`ai-vision/README.md`, "Hạn chế đã biết"). Video V05/V06 không có chim, nên số đếm bằng 0 là bình thường và không chứng minh gì.
- **Không khẳng định AI không báo nhầm.** V04 và V07 từng sinh cảnh báo rắn sai.
- **Không ACK cảnh báo ngưỡng.** Nó chỉ sống khoảng 50 giây rồi SP tự đóng; chỉ dùng cảnh báo thiên địch để demo ACK/RESOLVED.
- **Không đổi tài khoản trong tab `/admin/tools`.** Dùng cửa sổ ẩn danh riêng.
- Không nói "độ trễ luôn dưới 2 giây" (có 0,8–3,8% mẫu vượt). Không nói đã đo trên mobile.
- Không mở hay chiếu file `.env`, không đọc mật khẩu.
- Không chạy `npm run test:contract` trong lúc demo (spec backend 7.4).
- Huy hiệu OFFLINE của cơ cấu chấp hành có thể chậm tới khoảng 60 giây (chu kỳ tải lại 30 giây); không demo phần này nếu không có thời gian.

## Phần CSDL: chọn truy vấn

Đã có trên `main` trong `database/sql/`:
- **View:** `vw_AlertJson`, `vw_DailyBirdFlow`, `vw_DailyEnvStats`, `vw_LatestReadings`, `vw_OpenAlerts`.
- **SP:** `sp_CreatePredatorAlert`, `sp_DetectAnomalies`, `sp_GetReadingHistory`, `sp_IngestReadings`, `sp_RecordBirdCount`, `sp_RecordHeartbeat`, `sp_Report_EnvStabilityVsYield`, `sp_SetActuator`, `sp_UpdateAlertStatus`.
- **Trigger:** `trg_Alerts_History`, `trg_Devices_Status`.
- **Index:** khai báo trong Prisma; `SensorReadings` có clustered `RecordedAt` và unique `(DeviceId, MetricCode, RecordedAt)`; `Alerts`, `ControlLogs`, `AlertHistory` có index theo nhà/thiết bị và thời gian.

`sql-demo.sql` chọn 2 truy vấn **chỉ đọc**, gắn với việc vừa làm trên web:
1. **`ControlLogs`:** lý do do `sp_SetActuator` ghi ("TEMP 31.5 > Max 30", "Nha chot: TEMP 27.5"), kèm người điều khiển tay.
2. **`AlertHistory`:** do trigger `trg_Alerts_History` ghi, gồm NEW → ACK (kèm ghi chú) → RESOLVED, và dòng "(he thong)" khi SP tự đóng cảnh báo.

Không dùng `vw_DailyEnvStats` ở đây: view này tính `AT TIME ZONE` trên toàn bộ bảng số đo, và chính là phần làm bảng thống kê 7 ngày trên web tải chậm.

**database-advanced:** trên `main` mới có spec và plan (`docs/superpowers/specs/2026-10-17-…`, `plans/2026-10-17-…`). **Chưa có** phần cài đặt: không có script phân quyền hay role, kịch bản đồng thời, sao lưu/phục hồi, index bổ sung, phân vùng hay kết quả đo trong `database/`. Phần này không đưa vào demo.

## Kết quả chạy thử (08/11/2026, máy chạy thử, không phải máy TV3, **không có AI thật**)

Máy chạy thử không có `best.pt` và video. Vì vậy mốc 2:30 dùng `predator-now.ps1`, và `start-demo` chạy với `-SkipAi`; `ai-now.ps1` chưa chạy lần nào. Máy: i7-4810MQ, 32 GB RAM, Windows 10 LTSC, Node 25.8.0, SQL Server Express 17.0, Mosquitto 2.1.2. Chưa chạy trên máy TV3.

Cách đo: một script Playwright (Chromium headless) và các script `demo\*.ps1`.
- Mỗi mốc **bắt đầu đúng giờ** theo kịch bản.
- Mỗi mốc ghi thời gian **từ lúc bắt đầu thao tác đến lúc thấy kết quả trên web hoặc terminal**.
- Không đo thời gian người trình bày nói. Thao tác bằng script nhanh hơn người thật, nhất là ở mốc 2:00 và 2:30.

Đã reset CSDL và bật lại hệ thống trước khi chạy 3 lần liên tiếp. Đơn vị là giây, tính từ khi mốc bắt đầu.

| Mốc (khung) | Lần 1 (10:03Z) | Lần 2 (10:08Z) | Lần 3 (10:14Z) | Ghi chú |
|---|---:|---:|---:|---|
| 0:30 dashboard (45 s) | 12,3 | 6,2 | 0,5 | Ô F1 đổi giá trị mà không tải lại; phụ thuộc nhịp 10 giây |
| 1:15 quạt tự bật (45 s) | 6,1 | 5,6 | 6,1 | Web hiện "Bật" 5,5–6,0 s sau khi gõ lệnh, không tải lại |
| 2:00 tay 50% → AUTO (30 s) | 0,7 | 0,7 | 0,6 | Trước mốc này `hot-now` đã tự làm mát; quạt tắt 2,4–2,6 s sau số đo mát |
| 2:30 thiên địch + ACK/RESOLVED (60 s) | 4,0 | 3,4 | 3,5 | Cảnh báo #5, #7, #9 hiện trên web sau 2,9 / 2,6 / 2,6 s; ảnh hiện; ACK → RESOLVED xong |
| 3:30 SQL (60 s) | 3,0 | 2,7 | 2,6 | 2 truy vấn: 0–2 ms mỗi truy vấn |
| **Tổng** | **300** | **300** | **300** | Không mốc nào vượt khung |

Các lần trước đó, giữ lại vì là phát hiện thật:
- **Mốc 2:30 bị `COOLDOWN`** khi em vừa gửi snake lúc thử script chưa tới 5 phút trước. Đúng hành vi cooldown ở mục trên.
- **Danh sách còn cảnh báo thiên địch cũ chưa xử lý** (từ lúc thử) làm script chạy thử bấm nhầm. Trên web cảnh báo mới nhất nằm trên cùng. Trước demo thật nên `reset-demo` để danh sách sạch.

Nếu buổi thật vượt 5 phút, cắt theo thứ tự:
1. Gộp mốc 4:30 (độ trễ) vào câu kết của mốc 3:30: một câu số liệu, bỏ mở file.
2. Ở 3:30 chỉ chạy truy vấn 1 (ControlLogs).
3. Ở 2:00 bỏ kéo thanh trượt, chỉ bấm "Bật" rồi "Trả về tự động".

Phần AI thật (thời gian từ `ai-now` đến lúc có cảnh báo trên CPU) **chưa đo**. Phải tập trên máy TV3 và ghi số vào đây.
