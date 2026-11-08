# Đo độ trễ (câu 7) — 08/11/2026

Script: `backend/scripts/measure-latency.mjs` (chế độ `readings`, `rate`, `alerts`). Mỗi lần đo có một CSV từng mẫu trong thư mục này; đầu mỗi CSV ghi tóm tắt.

## Chỉ tiêu (trích nguyên văn)

- **Project.md, mục Hiệu năng:** "Dữ liệu cảm biến được cập nhật trên bảng điều khiển trong vòng 2 giây bằng WebSocket/MQTT; cảnh báo đến thiết bị di động trong vòng 3–5 giây; các truy vấn thống kê lịch sử phản hồi nhanh nhờ chỉ mục và phân vùng hợp lý trong SQL Server."
- **Roadmap, tuần 4:** "**NV6:** đo Precision/Recall, độ trễ (≤ 2 s dashboard, 3–5 s cảnh báo), hiệu năng truy vấn trước/sau chỉ mục".
- **Hợp đồng 2.3:** "gọi `sp_IngestReadings` **mỗi 1 giây hoặc khi đủ 200 phần tử**, tùy cái nào đến trước — giữ mục tiêu dashboard ≤ 2 giây."
- **Spec backend 7.3:** "**Kết quả:** CSV từng mẫu + p50, p95, max, số mẫu, tỷ lệ vượt chỉ tiêu". Mục này không ghi con số chỉ tiêu riêng.
- **Spec backend hạn chế 10:** "Phép đo độ trễ không gồm mobile và thông báo đẩy; chỉ tiêu 3–5 giây trên mobile cần phép đo riêng ở spec mobile."

Đơn vị là giây. **Không văn bản nào nói chỉ tiêu tính theo p95 hay theo mọi mẫu.** Vì vậy kết luận dưới đây ghi cả hai cách đọc. Đường đo của chỉ tiêu 2 giây là dữ liệu cảm biến lên bảng điều khiển. Đường đo của chỉ tiêu 3–5 giây là cảnh báo đến **thiết bị di động**.

## Đo cái gì

- **Số đo:** script publish TEMP qua MQTT → Mosquitto → backend (gom lô 1 giây) → `sp_IngestReadings` → `readings.new` qua Socket.IO về chính script. Thời gian đo bằng `performance.now()` trong cùng một tiến trình, từ ngay trước lệnh publish đến lúc nhận sự kiện.
- **Ghép mẫu:** theo khóa duy nhất trong CSDL (thiết bị + chỉ số + giây `at`). Giá trị gửi bằng giá trị simulator vừa gửi cộng 0,01, nên không mở cảnh báo.
- **Trạng thái mẫu:** hết 10 giây không thấy sự kiện thì ghi **mất**. Trùng giây với simulator thì CSDL giữ bản đến trước, mẫu không đo được và ghi **trùng**, tính riêng.
- **Cảnh báo:** script publish TEMP = Max + 1,5 (31,5 °C; Max của dữ liệu mẫu là 30) và đo đến lúc nhận `alert.created` cùng khu vực, chỉ số và giá trị. Sau đó gửi TEMP = Target (28) ở giây sau và chờ `alert.updated` RESOLVED rồi mới đo lần kế. Bốn khu vực H1 lần lượt.
  - Hai trạng thái riêng của đo cảnh báo: **trung** khi số đo mở cảnh báo bị CSDL bỏ vì trùng giây; **khong-mo** khi số đo tới nơi mà không có cảnh báo.
- **Tài khoản:** Socket.IO đăng nhập `owner1`, mật khẩu dev đọc từ `.env.test`, không in. MQTT dùng tài khoản riêng `latency-probe`.
- **Nhịp gửi:**
  - `readings`: tuần tự, nghỉ ngẫu nhiên 200–800 ms giữa hai mẫu.
  - `rate`: gửi đều theo tần suất cố định, không chờ, quay vòng 16 cặp cảm biến + chỉ số.
  - `alerts`: tuần tự, nghỉ ngẫu nhiên 0–1 s giữa hai lần.

## Môi trường

| Mục | Giá trị |
|---|---|
| Máy | Laptop Intel Core i7-4810MQ 2,8 GHz, 4 nhân / 8 luồng, RAM 32 GB (còn trống khoảng 18 GB lúc đo) |
| Hệ điều hành | Windows 10 IoT Enterprise LTSC 10.0.19044 |
| Phần mềm | Node v25.8.0; Mosquitto 2.1.2; SQL Server Express 17.0.1145.4, CSDL `SwiftletCare_Dev` (recovery SIMPLE, `target_recovery_time` 60 s), `deploy.ps1 -Reset` trước và sau mỗi đợt đo, ngày neo mặc định 2026-10-12 |
| Mã | Backend `src/` tại `8cdeee0` (không đổi trong cả hai đợt). Script đợt 1 ở `0339c41`; script đợt 2 ở commit chứa file này |
| Tiến trình | SQL Server, Mosquitto, simulator (`normal`, nhịp 10 giây, bật trước backend), backend `node dist/main.js`, script đo: **cùng một máy** |

## Kết quả: số đo (publish → `readings.new`)

| Lần (giờ UTC 08/11) | Điều kiện | Gửi | Đo được | Mất | Trùng | p50 | p95 | p99 | max | > 2 s | CSV |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 · 02:16–02:21 | Nhịp bật, simulator bật, tuần tự | 300 | 296 | 0 | 4 | 451 | 912 | 2137 | 2679 | 5 (1,7%) | `latency-20261108-0216.csv` |
| A · 02:49–02:54 | Nhịp bật, simulator bật, tuần tự | 300 | 286 | 0 | 14 | 510 | 870 | 2337 | 2547 | 5 (1,7%) | `latency-readings-20261108-0249.csv` |
| B · 02:55–02:56 | Nhịp bật, simulator bật, **5 mẫu/giây trong 60 giây** (gửi 300 mẫu trong 59,8 s) | 300 | 288 | 0 | 12 | 533 | 1656 | 3185 | 3977 | 11 (3,8%) | `latency-rate-20261108-0255.csv` |
| D · 03:07–03:12 | **Nhịp tắt**, simulator bật, tuần tự | 300 | 284 | 0 | 16 | 511 | 1062 | 2110 | 2506 | 6 (2,1%) | `latency-readings-20261108-0307.csv` |
| E · 03:13–03:18 | **Nhịp tắt, simulator tắt** từ khoảng 03:13:12, tuần tự | 300 | 300 | 0 | 0 | 496 | 793 | 2565 | 2882 | 8 (2,7%) | `latency-readings-20261108-0313.csv` |
| F · 03:20–03:22 | Nhịp tắt, simulator bật, chạy song song phép thử phụ (mục dưới) | 130 | 124 | 0 | 6 | 564 | 1068 | 1594 | 2579 | 1 (0,8%) | `latency-readings-20261108-0320.csv` |

Đơn vị ms. "> 2 s" tính trên số mẫu đo được. "Nhịp" là `sp_DetectAnomalies` mỗi 60 giây (`ANOMALY_SCHEDULER`). Lần D, E, F chạy backend bằng một bản sao `.env` trong thư mục tạm có `ANOMALY_SCHEDULER=off`; `.env` thật không bị sửa, bản sao đã xóa.

**Lần B tách theo khoảng thời gian** (số suy ra từ cùng CSV): 23 mẫu gửi trong khoảng 02:55:57–02:56:01 có p50 1925 ms, max 3977 ms. 265 mẫu còn lại có p50 506, p95 956, p99 1016, max 1050 ms. Ở 5 mẫu/giây, p95 xấu đi (870 → 1656 ms) **vì một cụm chậm rơi vào lúc đo và trúng nhiều mẫu hơn**. Ngoài cụm đó, p95 gần như lần tuần tự (956 so với 870 ms).

Mỗi CSV còn có dòng đối chiếu "Số đo khác" (thời điểm nhận − `at` của số đo simulator). `at` làm tròn xuống giây, nên dòng này không dùng để kết luận.

## Kết quả: cảnh báo (publish số đo vượt ngưỡng → `alert.created`)

| Lần (giờ UTC 08/11) | Điều kiện | Gửi | Đo được | Mất | Trùng | Không mở | p50 | p95 | p99 | max | CSV |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| C2 · 03:03–03:05 | Nhịp bật, simulator bật, 40 lần trên 4 khu vực H1 | 40 | 38 | 0 | 1 | 1 | 542 | 1218 | 1469 | 1469 | `latency-alerts-20261108-0303.csv` |

- **Lần không mở** (lần 40, H1-F3, 03:05:38Z): số đo 31,5 tới nơi nhưng không có `alert.created`. **Chưa rõ nguyên nhân**: có thể một số đo mới hơn của simulator rơi cùng lô, vì SP chỉ xét số đo mới nhất mỗi khu vực, nhưng em chưa kiểm.
- **Lần C1 không hợp lệ** (02:56–03:01, `latency-alerts-20261108-0256.csv`, giữ làm bằng chứng): 25/40 lần "mất" liên tiếp do **lỗi của script đo**, không phải lỗi backend.
  - Simulator gửi TEMP mỗi 10 giây, các cảm biến cùng một giây. Khi mẫu 31,5 trùng giây đó, CSDL bỏ mẫu vì trùng khóa (log backend: "1 trung" đúng mỗi 10 giây).
  - Sau mỗi lần mất, script gửi lại đúng sau 10 giây và không nghỉ ngẫu nhiên, nên lần nào cũng trùng.
  - Đã sửa trước khi đo C2, có test trước: phân loại trung / khong-mo / mat, và luôn nghỉ ngẫu nhiên.

## Kết luận so với chỉ tiêu

| Đường đo | Chỉ tiêu | Đọc theo p95 | Đọc theo mọi mẫu |
|---|---|---|---|
| Số đo → `readings.new` (Socket.IO, trên máy demo) | ≤ 2 s | **Đạt** ở cả 6 lần (p95 793–1656 ms) | **Không đạt**: lần nào cũng có mẫu vượt 2 s (0,8–3,8%, max 2,51–3,98 s) |
| Cảnh báo → `alert.created` (Socket.IO, trên máy demo) | 3–5 s **đến thiết bị di động** | Trên đường đã đo, max 1,47 s < 3 s | Cả 38/38 lần dưới 3 s |

Với cảnh báo, **chưa kết luận được đạt chỉ tiêu**: chỉ tiêu tính đến thiết bị di động, còn phép đo dừng ở client Socket.IO trên cùng máy. Chưa có LAN, app mobile hay thông báo đẩy (hạn chế 10). Số trên chỉ cho biết phần backend chiếm bao nhiêu trong ngân sách 3–5 giây.

Lần đo ít có cụm chậm (F, max 2579 ms) vẫn có một mẫu vượt 2 s. Phần chờ gom lô 0–1 s (`setInterval` 1 giây của backend) có trong mọi mẫu và là phần lớn của p50.

## Cụm chậm: nguyên nhân CHƯA RÕ

Ở mọi lần đo, các mẫu trên khoảng 1,1 s dồn thành cụm, mỗi cụm dài 2–7 giây, **cách nhau khoảng 61–67 giây** (không đúng 60 giây). Thời điểm thật:

| Lần | Thời điểm cụm (UTC) |
|---|---|
| A (nhịp bật) | 02:49:23, 02:50:28, 02:51:35, 02:52:40, 02:53:45 |
| B (nhịp bật) | 02:55:57–02:56:01 |
| D (nhịp tắt) | 03:08:00, 03:09:06, 03:10:12, 03:11:17, 03:12:23 |
| E (nhịp tắt, simulator tắt) | 03:13:30, 03:14:35, 03:15:40, 03:16:45, 03:17:51 |
| F (nhịp tắt) | 03:21:08–13, 03:22:15–20 |

**Đã loại trừ, có số đo:**

- **`sp_DetectAnomalies`:** tắt nhịp (lần D, E) mà cụm vẫn còn. Ở lần A, nhịp chạy 60 giây cố định kể từ khi backend khởi động (02:48:45Z), tức 02:49:45, 02:50:45, …, không trùng các cụm. Cụm đầu (02:49:23) còn xảy ra trước nhịp đầu tiên. Giả thuyết ghi ở đợt 1 là **sai**.
- **Simulator:** tắt simulator (lần E) mà cụm vẫn còn.
- **Mosquitto và mạng loopback:** trong lần F, ping MQTT qua topic `latency/ping` (backend không subscribe) mỗi 200 ms, 737 lần: p50 1,2 ms, max 25,6 ms, không lần nào chậm trong hai cụm.
- **Đường đọc của SQL Server:** cùng lúc đó, `SELECT 1` mỗi 200 ms, 682 lần: p50 5,5 ms. Chỉ có một lần 929 ms lúc 03:20:21, ngay đầu phép thử, khi chưa có cụm. Trong hai cụm, truy vấn đọc vẫn nhanh.
- **Bộ đếm giờ trong backend:** đọc code thì chỉ có gom lô 1 s, heartbeat 1 s, nhịp bất thường 60 s (đã tắt) và timeout điều khiển 5 s. Không có bộ đếm nào khoảng 65 giây.

**Còn lại, chưa kiểm:** tiến trình backend (event loop hoặc GC của Node), hoặc đường ghi của SQL Server khi chạy lô `sp_IngestReadings`. Ví dụ là checkpoint gián tiếp: `target_recovery_time` = 60 s là số thật đọc từ `sys.databases`, nhưng chưa chứng minh có liên quan. Cách kiểm tiếp:

- Đọc `sys.dm_io_virtual_file_stats` hoặc bật trace checkpoint. Cả hai cần quyền **VIEW SERVER STATE**, tài khoản `swiftlet_dev` không có (đã thử, bị từ chối). Không tự cấp quyền; việc này do TV1 quyết.
- Đo thời gian từng lần gọi `sp_IngestReadings` trong backend.
- Đo độ trễ event loop của Node.
- Tắt Defender: **không làm**, vì đó là hạ bảo mật máy và cần quyền admin. Defender bật trong mọi lần đo.

## Cảnh báo về phép đo

- **Cùng một máy, loopback:** mọi thành phần chạy trên một máy, qua `localhost`. Không có độ trễ LAN, không có thời gian vẽ của trình duyệt. Web, mobile và thông báo đẩy chưa đo (hạn chế 10).
- **Windows Defender** bật bảo vệ thời gian thực trong mọi lần đo. Các MCP Playwright và mobile-mcp chạy nền.
- **Tác dụng phụ lên dữ liệu:** mẫu của script làm một số số đo TEMP của simulator bị CSDL bỏ vì trùng giây (log "Lo so do: 0 bi SP loai, 1 trung"). Đo cảnh báo thì mở và đóng 38 cảnh báo thật, và có thể làm vòng điều khiển bật/tắt FAN. Vì vậy chỉ đo trên `SwiftletCare_Dev` và reset CSDL sau khi đo.
- **Tải:** tải nặng nhất đã đo là 5 mẫu/giây cộng 6 cảm biến simulator. Chưa đo lô 200 phần tử.
- **Lần E:** 300 mẫu đều đo được (không trùng), vì simulator đã tắt. Các thiết bị không bị đánh dấu OFFLINE vì nhịp đã tắt.

## Lần đo đầu (đợt 1, 02:16–02:21Z)

Lần đo đầu là dòng "1" trong bảng số đo. Phân bố 296 mẫu:

| Khoảng | Số mẫu |
|---|---:|
| < 250 ms | 39 |
| 250–499 ms | 123 |
| 500–749 ms | 99 |
| 750–999 ms | 23 |
| 1000–1249 ms | 1 |
| ≥ 1500 ms | 11 |

Khi đó em ghi nghi vấn cụm chậm do `sp_DetectAnomalies`. Đợt 2 đã bác bỏ nghi vấn này (xem mục "Cụm chậm" ở trên). Lần chạy thử 10 mẫu trước đợt 1 không giữ lại.

## Cách chạy lại

1. Chạy `deploy.ps1 -Database SwiftletCare_Dev -Reset`.
2. Bật Mosquitto (`infra/mosquitto/README.md`).
3. Bật simulator.
4. Bật backend.
5. Trong `backend/`, chạy một trong các lệnh:
   ```
   npm run measure:latency -- readings 300
   npm run measure:latency -- rate 5 60
   npm run measure:latency -- alerts 40
   ```
   Biến môi trường `LATENCY_NOTE` (tùy chọn) được ghi vào đầu CSV.
6. Đo xong thì reset CSDL lại.

Script cần `LATENCY_MQTT_USERNAME` và `LATENCY_MQTT_PASSWORD` trong `backend/.env` (xem `.env.example`). Tài khoản tạo bằng `mosquitto_passwd infra/mosquitto/passwd latency-probe`, không dùng `-c`. Repo chưa có file ACL Mosquitto. Nếu sau này bật ACL dạng `pattern write swiftlet/devices/%c/readings`, client `latency-probe` sẽ bị chặn, nên cần thêm luật riêng qua PR hợp đồng (spec backend 7.3, ghi chú ACL).
