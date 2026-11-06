# Kiểm tra đầu-cuối simulator

Chạy lại ngày **06/11/2026** trên nhánh `simulator-fix`, thay kết quả cũ. Bản cũ còn trong lịch sử git (`83f5f59`).

## Cách chạy

- Thành phần thật: SQL Server, Mosquitto, backend (`node dist/main.js`, build từ chính nhánh này), simulator (`node --env-file=.env src/main.mjs`).
- **Mỗi kịch bản chạy riêng:** `deploy.ps1 -Database SwiftletCare_Dev -Reset -AnchorDateVn 2026-11-05`, broker mới không còn tin retained, bật simulator trước, 5 giây sau bật backend.
- Sau mỗi lần reset đều kiểm cột `SensorReadings.Value`: **`DECIMAL(9,2)`**. Không chạy `ALTER` nào.
- Số liệu lấy từ `ControlLogs`, `Alerts`, `SensorReadings`, `Devices`. Giờ dưới đây là UTC.
- Nhiễu bật với `NOISE_SEED=1`, trừ ca `NOISE_SEED=2`.

## Tổng hợp

| Kịch bản | Kết quả | Bằng chứng chính |
|---|---|---|
| `normal`, 10 phút | **Đạt**, có một ghi chú | Không có dòng `ControlLogs` nào; TEMP H1-F2 27,95–28,05 |
| `hot`, 18 phút | **Đạt** | FAN H1-F2 bật, tắt, lặp lại; chu kỳ 7 phút 11 giây và 6 phút 51 giây |
| FAN Level 50 | **Đạt** | TEMP giảm 0,91 °C so với 1,86 °C của Level 100 trong cùng 100 giây |
| `dry`, 15 phút | **Đạt** | MIST H1-F3 bật, tắt, lặp lại; chu kỳ 6 phút 31 giây và 6 phút 30 giây |
| `--drop`, 11 phút | **Đạt** | `DEVICE_OFFLINE` mở rồi đóng; 42 tin gửi bù đủ, không trùng |
| Broker đứt 60 giây | **Đạt** | Không mất mốc nào, khoảng cách lớn nhất 10 giây |
| Tắt simulator | **Đạt**, khác lời mô tả cũ | 26 thiết bị `OFFLINE` sau 5 phút 27 giây |
| `NOISE_SEED=2`, 2 phút | **Đạt** | Chuỗi TEMP khác hạt giống 1 (trùng nhiều nhất 4/13 mốc); cùng hạt giống trùng 22/22 |

## `normal`

- `ControlLogs` từ lúc chạy: **0 dòng**. Không FAN, MIST, HEATER nào bật.
- **Ghi chú:** `Devices` vẫn có `H1-F0-SPEAKER` và `H2-F0-SPEAKER` với `IsOn = 1`. Không có dòng `ControlLogs` nào trong lần chạy, nên trạng thái này có từ trước khi chạy, không do kịch bản bật.
- Mỗi cảm biến 60 mốc từ 03:02:42 tới 03:12:32, khoảng cách lớn nhất 10 giây, không trùng.
- Cảnh báo HUMID của dữ liệu mẫu đóng lúc 03:02:43, đúng checklist spec 2.8.

## `hot`

Simulator bật lúc 03:13:56.

| Giờ | FAN H1-F2 | Lý do trong `ControlLogs` |
|---|---|---|
| 03:16:19 | Bật, Level 100, AUTO | TEMP 30.05 > Max 30 |
| 03:21:20 | Tắt | Nha chot: TEMP 27.98 |
| 03:23:30 | Bật, Level 100, AUTO | TEMP 30.08 > Max 30 |
| 03:28:11 | Tắt | Nha chot: TEMP 28 |
| 03:30:21 | Bật, Level 100, AUTO | TEMP 30.06 > Max 30 |

- Lần bật đầu sau 2 phút 23 giây, spec tính tay ≈ 2,1 phút.
- TEMP H1-F2 trong khoảng 27,98–30,08. Mốc đầu trong CSDL là 28,63 lúc 03:14:38 rồi tăng dần, không nhảy thẳng lên 32 như trước khi sửa.

## FAN Level 50

Cùng lúc 03:35:08 gửi `POST /api/devices/{id}/control` với `mode: "MANUAL"`, dùng `accessToken` của `owner1`: `H1-F1-FAN` Level 50 và `H1-F3-FAN` Level 100. Cả hai trả 200, `ControlLogs` có đúng hai dòng. Ca BLOCKED cũ do đọc sai trường token; dùng `accessToken` thì đăng nhập được.

| Khu vực | Level | TEMP 03:35:09 | TEMP 03:36:50 | Giảm | Tính theo mô hình | CO2 03:36:50 |
|---|---|---:|---:|---:|---:|---:|
| H1-F1 | 50 | 27,90 | 26,99 | **0,91** | 0,96 | 492,66 |
| H1-F3 | 100 | 27,81 | 25,95 | **1,86** | 1,92 | 398,99 |

Chỉ so tới 03:36:50 vì sau đó `H1-F3-HEATER` tự bật (03:36:52, TEMP 25.95 < Min 26), đây là luật AUTO chạy đúng.

## `dry`

| Giờ | MIST H1-F3 | Lý do trong `ControlLogs` |
|---|---|---|
| 03:50:12 | Bật, AUTO | HUMID 74.82 < Min 75 |
| 03:54:02 | Tắt | Nha chot: HUMID 82.05 |
| 03:56:43 | Bật, AUTO | HUMID 74.99 < Min 75 |
| 04:00:32 | Tắt | Nha chot: HUMID 82.14 |

HUMID H1-F3 trong khoảng 74,82–82,14. Mốc đầu trong CSDL là 81,55, giảm dần chứ không bắt đầu từ 70.

## `--drop H1-F1-SENSOR --drop-after 1 --drop-for 7`

- `DEVICE_OFFLINE` của `H1-F1-SENSOR`: **mở 04:10:21, đóng 04:11:49**, trạng thái cuối `RESOLVED`.
- Log simulator: `[RESTORE] H1-F1-SENSOR: 42 queued messages`, rồi `Completed`.
- `H1-F1-SENSOR` có **67 mốc** từ 04:04:28 tới 04:15:28, bằng đúng các cảm biến không bị ngắt. Khoảng cách lớn nhất 10 giây, **không trùng**, nên đủ cả 42 tin.

## Broker đứt 60 giây (không dùng `--drop`)

`taskkill` broker lúc 02:57:51, bật lại lúc 02:58:51. Cả 6 cảm biến có 23 mốc liên tục từ 02:56:43 tới 03:00:23, khoảng cách lớn nhất **10 giây**, không trùng.

## Tắt simulator

Tắt lúc 04:19:03. Lúc 04:24:30 có **26 cảnh báo `DEVICE_OFFLINE`** cùng lúc, sau 5 phút 27 giây. `Devices`: FAN 6, HEATER 6, MIST 6, SENSOR 6, SPEAKER 2 đều `OFFLINE`. 20 cơ cấu chấp hành cũng `OFFLINE` vì trước đó heartbeat đã đưa chúng về `ONLINE`, điều này đồng thời xác nhận heartbeat tới được backend.

## `NOISE_SEED=2`

Chạy `normal` 2 phút, chỉ đổi biến môi trường `NOISE_SEED=2`, bật lúc 04:57:47.

- So chuỗi TEMP H1-F2 với `normal` (hạt giống 1), thử mọi độ lệch từ -40 tới 40 mốc: trùng nhiều nhất **4/13 mốc**.
- Đối chứng cùng hạt giống 1: `outage` trùng `normal` **22/22 mốc** tại độ lệch 2; `npm start` `hot` trùng `hot` **31/31 mốc** tại độ lệch 0.
- Giá trị trong CSDL có nhiễu: TEMP H1-F2 27,95–28,04. `ControlLogs` 0 dòng.

## Giới hạn của lần kiểm này

1. Kiểm trên CSDL, **không mở web** như spec 3.3 mô tả.
2. Broker mới mỗi kịch bản nên backend chưa có phiên; số đo gửi trước khi backend subscribe không vào CSDL. Vì vậy mốc đầu trong CSDL chậm hơn lúc bật simulator từ 20 tới 63 giây, tùy lần chạy. Với broker giữ phiên backend (`clean: false`), các tin này được giữ lại, nhưng lần này chưa kiểm.
3. Cấu hình broker khác `infra/mosquitto/mosquitto.conf` ở thư mục persistence mới và `autosave_interval 1`, để `taskkill` không làm mất phiên.
4. Chỉ kiểm cảm biến với `--drop`. Chưa kiểm `--drop` cho cơ cấu chấp hành, và heartbeat QoS 0 không được gửi bù.
5. Broker đứt chỉ kiểm 60 giây. Giới hạn 1000 tin chỉ kiểm bằng test đơn vị, chưa chạy thật tới mức đầy.
6. Dùng `node` trực tiếp, không qua `npm start`. `npm start` chỉ kiểm ở `spikes/RESULTS.md` S1 và S6.
