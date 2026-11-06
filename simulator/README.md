# SwiftletCare Simulator

Giả lập 26 thiết bị MQTT của dữ liệu mẫu: 6 cảm biến gửi số đo, 20 cơ cấu chấp hành nhận lệnh. Trạng thái thiết bị tác động lên số đo, nên demo thấy được vòng điều khiển của backend. Không có CAMERA: camera do `ai-vision` gửi qua HTTP.

Spec: `docs/superpowers/specs/2026-10-16-swiftletcare-simulator-design.md`. Plan: `docs/superpowers/plans/2026-10-16-swiftletcare-simulator.md`.

## Yêu cầu

- Node.js theo bảng phiên bản ở `AGENTS.md` (`^20.19 || ^22.12 || >=24`).
- Mosquitto 2.x đang chạy và đã có tài khoản `simulator`: làm theo `infra/mosquitto/README.md`.

## Cài đặt

```powershell
cd simulator
npm ci
Copy-Item .env.example .env
```

Điền vào `.env`:

| Biến | Ý nghĩa |
|---|---|
| `MQTT_URL` | Địa chỉ broker, mặc định `mqtt://localhost:1883` |
| `MQTT_USERNAME` | `simulator` |
| `MQTT_PASSWORD` | Mật khẩu tài khoản `simulator`. Rỗng thì simulator dừng và báo lỗi |
| `READING_INTERVAL_SECONDS` | Nhịp gửi số đo, mặc định 10 |
| `NOISE_SEED` | Hạt giống nhiễu; cùng hạt giống cho cùng dãy nhiễu |

Không commit `.env`. Thiếu file này thì `npm start` dừng với câu `Chua co simulator/.env, chep tu .env.example`.

## Chạy

```powershell
npm start                          # kịch bản normal
npm start -- --scenario hot
npm start -- --scenario dry
npm test
```

**Chỉ chạy một simulator trên một broker.** Client id là mã thiết bị, hai simulator sẽ ngắt kết nối của nhau liên tục.

Ctrl+C dừng simulator. Khi chạy qua `npm start`, Windows có thể hỏi `Terminate batch job (Y/N)?`: simulator đã dừng rồi, trả lời `Y`.

### Kịch bản

Mọi khu vực khởi động ở mức `normal`, rồi trôi dần về nền của kịch bản.

| Kịch bản | Khác `normal` | Mong đợi (τ = 3 phút) |
|---|---|---|
| `normal` | Không. TEMP 28, HUMID 82, CO2 600, LIGHT 2 | Không thiết bị nào bật |
| `hot` | H1-F2 TEMP nền 32 | FAN H1-F2 bật khi TEMP > 30, tắt khi TEMP ≤ 28, chu kỳ tính tay ≈ 7 phút |
| `dry` | H1-F3 HUMID nền 70 | MIST H1-F3 bật khi HUMID < 75, tắt khi HUMID ≥ 82, chu kỳ tính tay ≈ 6 phút |

### Mất kết nối `--drop`

```powershell
npm start -- --drop H1-F1-SENSOR --drop-after 1 --drop-for 7
```

- Sau `--drop-after` phút, simulator ngắt thật kết nối của các mã đã nêu (nhiều mã cách nhau dấu phẩy). Mã không tồn tại, kể cả CAMERA, thì dừng ngay lúc khởi động.
- Trong lúc ngắt, cảm biến vẫn sinh số đo. Hết `--drop-for` phút, simulator kết nối lại và gửi bù theo thứ tự, giữ `at` gốc.
- Nên đặt `--drop-for` từ 7 phút: ngưỡng mất kết nối 5 phút cộng nhịp kiểm tra 60 giây, mới chắc thấy `DEVICE_OFFLINE`. Simulator không cảnh báo khi đặt ngắn hơn.

### Khi broker đứt

Số đo vào hàng đợi trong bộ nhớ và được gửi bù theo thứ tự khi kết nối lại. Hàng đợi giữ tối đa **1000 tin mỗi thiết bị** (khoảng 2,8 giờ ở nhịp 10 giây). Đầy thì bỏ tin cũ nhất và cảnh báo một lần. Hàng đợi mất khi tắt simulator.

### Heartbeat

**Luôn chạy, không có cờ tắt.** 20 cơ cấu chấp hành gửi `swiftlet/devices/{code}/heartbeat` mỗi 30 giây, QoS 0, nên tin trong lúc mất kết nối không được gửi bù. Cảm biến không gửi heartbeat vì số đo đã cập nhật `LastSeenAt`.

## Checklist demo

1. Thứ tự bật: SQL Server, Mosquitto, **simulator, rồi mới backend**. Dữ liệu mẫu có `LastSeenAt` cũ, bật backend trước sẽ thấy cảnh báo mất kết nối giả.
2. **Không chạy `test:contract` của backend lúc demo.** Test này dùng chung Mosquitto, backend của test publish lại lệnh retained từ `SwiftletCare_Test` và ghi đè trạng thái simulator đang dùng.
3. Tắt simulator thì **cả 26 thiết bị** (6 cảm biến và 20 cơ cấu chấp hành) chuyển `OFFLINE` sau khoảng 5 phút (cộng nhịp kiểm tra 60 giây), mỗi thiết bị một cảnh báo `DEVICE_OFFLINE`. Đo thật ngày 06/11: 5 phút 27 giây.
4. Dữ liệu mẫu dừng ở 19:55 giờ VN ngày neo, simulator gửi từ hiện tại, nên biểu đồ lịch sử có khoảng trống. Đặt ngày neo là hôm qua để khoảng trống ngắn nhất.
5. Số đo đầu tiên của H1-F3 (HUMID 82) đóng cảnh báo HUMID đang mở của dữ liệu mẫu. Đây là hành vi mong đợi.
6. Sau `--drop`, một loạt số đo cũ đến cùng lúc. Số đo cũ hơn 2 phút (`@StaleMinutes`) chỉ được lưu, không mở hay đóng cảnh báo. Nói trước với người xem.

## MQTT Topics

- `swiftlet/devices/{code}/readings`: QoS 1, không retained.
- `swiftlet/devices/{code}/command`: QoS 1, simulator subscribe, tin retained là trạng thái mong muốn.
- `swiftlet/devices/{code}/heartbeat`: QoS 0.

## Hạn chế

- Từ lúc khởi động đến lúc tin retained đến, thiết bị coi như tắt.
- Không có tương tác giữa các khu vực, MIST không tác động lên TEMP, FAN không tác động lên HUMID.
- Hằng số mô hình chỉ đúng với ngưỡng của dữ liệu mẫu. Đổi ngưỡng giữa demo thì chu kỳ đổi theo.

Kết quả kiểm chứng: `spikes/RESULTS.md` và `result/e2e.md`.
