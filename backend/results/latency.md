# Đo độ trễ số đo (câu 7) — 08/11/2026

Script: `backend/scripts/measure-latency.mjs`, số liệu thô từng mẫu: [latency-20261108-0216.csv](latency-20261108-0216.csv).

## Đo cái gì

Đường đi: **script publish MQTT → Mosquitto → backend (gom lô 1 giây) → `sp_IngestReadings` trên SQL Server → sự kiện `readings.new` qua Socket.IO về script.**

- Script tự gửi từng số đo TEMP (QoS 1) cho 4 cảm biến nhà H1, lần lượt, mỗi lần một mẫu. Thời gian tính từ ngay trước lệnh publish đến lúc nhận đúng số đo đó trong `readings.new`, đo bằng `performance.now()` trong cùng một tiến trình, nên không phụ thuộc đồng hồ hệ thống.
- Mẫu được ghép theo khóa duy nhất của CSDL: thiết bị + chỉ số + giây `at`. Giá trị gửi bằng TEMP simulator vừa gửi cộng 0,01, để không mở cảnh báo hay bật thiết bị.
- Hết 10 giây không thấy sự kiện thì ghi **mất**. Nếu simulator gửi trùng giây đó với giá trị khác, CSDL giữ bản đến trước và bỏ bản còn lại, nên mẫu đó không đo được và ghi **trùng**, tính riêng.
- Giữa hai mẫu nghỉ ngẫu nhiên 200–800 ms, để mẫu rơi vào các pha khác nhau của nhịp gom lô 1 giây.
- Socket.IO đăng nhập bằng `owner1` (mật khẩu dev đọc từ `.env.test`, không in ra). MQTT dùng tài khoản riêng `latency-probe`, client id `latency-probe`.

## Môi trường

| Mục | Giá trị |
|---|---|
| Thời gian | 2026-11-08 02:16:18Z → 02:21:41Z (09:16–09:21 giờ VN), 323 giây |
| Commit | `8cdeee0` cho mã backend (`src/` không đổi); script đo ở commit chứa file này |
| Máy | Laptop Intel Core i7-4810MQ 2,8 GHz, 4 nhân / 8 luồng, RAM 32 GB (lúc kết thúc còn trống 18 GB) |
| Hệ điều hành | Windows 10 IoT Enterprise LTSC, bản 10.0.19044 |
| Phần mềm | Node v25.8.0; Mosquitto 2.1.2; SQL Server Express (`MSSQL$SQLEXPRESS`), CSDL `SwiftletCare_Dev` vừa `deploy.ps1 -Reset`, ngày neo mặc định 2026-10-12 |
| Tiến trình | SQL Server, Mosquitto, simulator (bật trước, kịch bản `normal`, nhịp 10 giây), backend (`node dist/main.js`, `ANOMALY_SCHEDULER=on`), script đo, tất cả trên **cùng một máy** |

## Kết quả

Chỉ tiêu: dashboard ≤ 2 giây (hợp đồng 2.3).

| Đường đo | Gửi | Đo được | Mất | Trùng | p50 | p95 | p99 | max | Vượt 2 s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Script publish → `readings.new`** | 300 | 296 | 0 | 4 | **451 ms** | **912 ms** | **2137 ms** | **2679 ms** | 5 mẫu (1,7%) |
| Số đo simulator: thời điểm nhận − `at` (đối chiếu) | — | 503 | — | — | 1530 ms | 2421 ms | 3103 ms | 3103 ms | — |

Phân bố của 296 mẫu: 39 mẫu dưới 250 ms, 123 mẫu từ 250 đến 499 ms, 99 mẫu từ 500 đến 749 ms, 23 mẫu từ 750 đến 999 ms, 1 mẫu từ 1000 đến 1249 ms, 11 mẫu từ 1500 ms trở lên.

Dòng simulator chỉ dùng để đối chiếu, không dùng để kết luận. `at` do simulator gán và làm tròn xuống giây, nên con số này có thêm tới 1 giây không phải độ trễ thật. Mỗi tin của simulator chứa 4 số đo cùng `at`, nên 503 số đo không phải 503 lần đo độc lập.

## Kết luận so với chỉ tiêu

- **p50 và p95 đạt** chỉ tiêu 2 giây, với khoảng cách lớn: p95 là 0,91 giây.
- **Không đạt nếu yêu cầu mọi mẫu dưới 2 giây.** p99 là 2,14 giây và max là 2,68 giây; 5/296 mẫu vượt 2 giây. Spec không nói chỉ tiêu tính theo percentile nào, nên ghi nguyên số thật.
- Phần 0–1 giây chờ gom lô (`setInterval` 1 giây trong backend) có sẵn trong mọi mẫu. Đây là phần lớn của p50.

## Mẫu chậm và nguyên nhân có thể (chưa kiểm chứng)

12 mẫu trên 1,1 giây dồn thành **5 cụm cách nhau khoảng 60 mẫu**: mẫu 13–14, 73–74, 134–137, 195–196 và 256–257. Mỗi mẫu mất khoảng 1,08 giây, nên các cụm cách nhau khoảng một phút. Nghi vấn chính là **nhịp `sp_DetectAnomalies` mỗi 60 giây** (`ANOMALY_SCHEDULER=on`): khi nhịp này chạy trên cùng SQL Server Express thì lô `sp_IngestReadings` phải chờ. Nhịp không ghi log thời điểm, và chưa đo lại với `ANOMALY_SCHEDULER=off`, nên **đây mới là giả thuyết**. Cụm không trùng chu kỳ 30 giây của heartbeat, nên heartbeat ít có khả năng là nguyên nhân.

## Cảnh báo về phép đo

- **Loopback:** mọi thành phần chạy trên một máy, qua `localhost`. Không có độ trễ mạng LAN. Web, mobile và thông báo đẩy **chưa đo** (hạn chế 10 của spec backend). Thời gian vẽ lên trình duyệt cũng chưa tính.
- **Windows Defender** bật bảo vệ thời gian thực trong lúc đo, tiến trình MsMpEng đang chạy. Các MCP của trình duyệt và điện thoại (Playwright, mobile-mcp) cũng đang chạy nền.
- **Tác dụng phụ lên dữ liệu:** trong lúc đo, backend ghi khoảng 5 dòng "Lo so do: 0 bi SP loai, 1 trung" mỗi phút. Lý do: mẫu của script đến trước nên **một số số đo TEMP của simulator bị CSDL bỏ vì trùng giây**. Vì vậy chỉ đo trên `SwiftletCare_Dev` và reset CSDL sau khi đo.
- Chỉ đo khi tải nhẹ: 6 cảm biến của simulator cộng mỗi lần một mẫu của script. Chưa đo khi tải nặng (lô 200 phần tử).
- Chỉ một lần chạy 300 mẫu. Một lần chạy thử 10 mẫu trước đó cho kết quả cùng mức (p50 544 ms, max 2144 ms) và không giữ lại.

## Chưa làm so với spec 7.3

- **Độ trễ cảnh báo** (publish số đo vượt ngưỡng → `alert.created`, rồi đóng cảnh báo trước mẫu kế tiếp) **chưa đo**. Lần này chỉ đo đường số đo theo yêu cầu.

## Cách chạy lại

1. Từ gốc repo, chạy `deploy.ps1 -Database SwiftletCare_Dev -Reset`.
2. Bật Mosquitto (`infra/mosquitto/README.md`).
3. Bật simulator (`npm start` trong `simulator/`).
4. Bật backend (`.env` có `DB_NAME=SwiftletCare_Dev`).
5. Trong `backend/`, chạy `npm run measure:latency -- 300`.
6. Đo xong thì reset CSDL lại.

Script cần `LATENCY_MQTT_USERNAME` và `LATENCY_MQTT_PASSWORD` trong `backend/.env`, xem `.env.example`. Tài khoản tạo bằng `mosquitto_passwd infra/mosquitto/passwd latency-probe`, không dùng `-c`. Repo chưa có file ACL Mosquitto. Nếu sau này bật ACL dạng `pattern write swiftlet/devices/%c/readings`, client `latency-probe` sẽ bị chặn publish vào topic cảm biến, nên cần thêm luật riêng qua PR hợp đồng (spec backend 7.3, ghi chú ACL).
