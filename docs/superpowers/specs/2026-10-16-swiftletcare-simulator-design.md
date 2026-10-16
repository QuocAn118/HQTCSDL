# SwiftletCare — spec simulator

- **Chủ module:** TV5
- **Trạng thái:** Đã duyệt
- **Đọc trước:** [roadmap](2026-10-12-swiftletcare-roadmap.md) (mục simulator), [integration-contract](2026-10-13-swiftletcare-integration-contract-design.md) Phần 2 (MQTT), [backend](2026-10-15-swiftletcare-backend-design.md) mục 4.4 (vòng điều khiển) và 7.4 (checklist demo).

## Phần 1 — Phạm vi, môi trường, cấu trúc

### 1.1 Mục tiêu

Giả lập **26 thiết bị MQTT** của dữ liệu mẫu:
- **6 SENSOR** gửi số đo (TEMP, HUMID, CO2, LIGHT).
- **20 cơ cấu chấp hành** nhận lệnh: 18 MIST/FAN/HEATER và 2 SPEAKER.
- Không có CAMERA: camera là việc của ai-vision, gửi qua HTTP.

Trạng thái cơ cấu chấp hành **tác động lên số đo**. Nhờ vậy demo chứng minh được vòng điều khiển của backend: FAN giảm TEMP và CO2, MIST tăng HUMID, HEATER tăng TEMP.

| Mức | Mục (đánh số theo roadmap simulator) |
|---|---|
| Bắt buộc 1 | Cảm biến theo khu vực gửi số đo qua MQTT |
| Bắt buộc 2 | Kịch bản `normal`, `hot`, `dry` |
| Bắt buộc 3 | Nhận lệnh, phản ánh lên số đo (mô hình bậc một có quán tính) |
| Dưới ranh giới cắt 4 | `--drop` (mất kết nối thật); heartbeat 30 giây cho 20 cơ cấu chấp hành |
| Nên có | Nhiễu dùng hạt giống cố định |
| Nếu còn thời gian | Giao diện chọn kịch bản |

### 1.2 Môi trường

- **Node.js, ESM thuần (`.mjs`), không TypeScript.** Phiên bản Node theo CLAUDE.md. Lý do: import thẳng được `contracts/lib/seed-refs.mjs` và `contracts/lib/fixtures.mjs`.
- Phụ thuộc duy nhất: **`mqtt` 5.16.1**, ghim chính xác (giống backend).
- Đọc `.env` bằng cờ có sẵn `node --env-file=.env`; không cần `dotenv`.
- Test chạy bằng `node --test`.

### 1.3 Cấu trúc

```
simulator/
  package.json  package-lock.json  .env.example  README.md
  src/main.mjs        đọc tham số, mở 26 kết nối, nhịp gửi, --drop, Ctrl+C
  src/devices.mjs     danh sách thiết bị từ contracts/lib/seed-refs.mjs; bỏ CAMERA; loại = đoạn cuối của mã
  src/model.mjs       hàm thuần step(state, actuators, scenario, dtSeconds) → state mới
  src/scenarios/      normal.json, hot.json, dry.json
  test/*.test.mjs
  test/rules-copy.mjs bản sao công thức h/offHi/offLo của backend, chỉ dùng trong test (mục 3.2)
```

### 1.4 `.env.example`

```
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=simulator
MQTT_PASSWORD=
READING_INTERVAL_SECONDS=10
NOISE_SEED=1
```

- Mật khẩu để trống trong `.env.example`; mỗi máy tự điền vào `.env` (đã gitignore ở gốc repo). Mật khẩu **không bao giờ xuất hiện trong log**.
- `NOISE_SEED` thuộc mục Nên có.

### 1.5 Phụ thuộc vào đường dẫn khác

- **`contracts/lib/seed-refs.mjs`** (`SEED_REFS.device`). Seed đổi thì `seed-refs.mjs` đổi theo; hợp đồng đã có test đối chiếu hai bên.
- **Ngưỡng và Hysteresis** dùng trong test (mục 3.2) chép từ seed: TEMP 26–30, Target 28, h 0,5; HUMID 75–90, Target 82, h 2; CO2 Max 1000, h 50. Seed đổi ngưỡng thì cập nhật test.
- **Công thức ngưỡng của backend** (`h`, `offHi`, `offLo`, backend 4.4): simulator giữ bản sao trong test (mục 3.2), **không import mã backend**.

### 1.6 Quy tắc vận hành

- **Chỉ chạy một simulator trên một broker.** Client id = mã thiết bị (hợp đồng 2.1); hai simulator trùng client id thì broker ngắt kết nối cũ, hai bên ngắt nhau liên tục.
- Ctrl+C gọi `end()` trên từng kết nối để ngắt đúng cách, rồi thoát.

## Phần 2 — Số đo, lệnh, kịch bản, mất kết nối

### 2.1 Mô hình

`model.mjs` là hàm thuần. Mỗi cặp (khu vực, chỉ số) có trạng thái `x` (số thực, **không làm tròn bên trong**).

**Đơn vị:**
- Tác động tính **theo phút** (VD °C/phút).
- `τ` tính **theo phút**, đề xuất **τ = 3 phút**.
- `dt` tính **bằng giây** và **đo bằng đồng hồ thật** giữa hai lần đo liên tiếp của cùng cảm biến; không giả định đúng `READING_INTERVAL_SECONDS`. `dt ≤ 0` (đồng hồ lùi) → coi là 0.

**Công thức** (nghiệm chính xác của phương trình bậc một, nên chia nhỏ hay gộp bước đều cho cùng kết quả):

```
cân_bằng = nền + τ · Σ tác_động
x ← cân_bằng + (x − cân_bằng) · exp(−(dt/60) / τ)
```

| Thiết bị bật | Tác động mỗi phút (nhân `Level/100` nếu có Level) |
|---|---|
| FAN | TEMP −1,5 °C; CO2 −150 ppm |
| HEATER | TEMP +1,5 °C |
| MIST | HUMID +5 % |
| SPEAKER | Không tác động |

- MIST, HEATER có Level NULL → hệ số 1. FAN qua AUTO luôn Level 100 (backend 4.4); Level khác chỉ có khi điều khiển tay.
- Giá trị gửi đi **kẹp trong [ValidMin, ValidMax]** của seed (TEMP −10…60, HUMID 0…100, CO2 0…10000, LIGHT 0…100000), rồi **làm tròn 2 chữ số thập phân**. Kẹp và làm tròn chỉ áp lên giá trị gửi đi.

**Đối chiếu với luật backend** (ngưỡng seed, công thức offHi/offLo ở backend 4.4):

| Kịch bản | Khu vực | Nền | Bật khi | Cân bằng khi thiết bị bật | Ngưỡng nhả | Kết luận |
|---|---|---|---|---|---|---|
| `hot` | H1-F2 | TEMP 32 | > Max 30 → FAN | 32 − 3·1,5 = **27,5** | offHi = min(28; 29,5) = **28** | 27,5 < 28 → FAN tắt được |
| `dry` | H1-F3 | HUMID 70 | < Min 75 → MIST | 70 + 3·5 = **85** | offLo = max(82; 77) = **82** | 85 > 82 → MIST tắt được |

Chu kỳ tính tay (τ = 3, chưa tính độ trễ nhịp đo và nhịp backend):
- `hot`: lần bật đầu sau ≈ 2,1 phút; bật ≈ 4,8 phút; tắt ≈ 2,1 phút → **chu kỳ ≈ 7 phút**.
- `dry`: lần bật đầu sau ≈ 2,6 phút; bật ≈ 3,6 phút; tắt ≈ 2,6 phút → **chu kỳ ≈ 6,2 phút**.

Nếu chọn MIST chỉ +3 %/phút thì cân bằng là 79 < 82, phun sương bật mãi. Vì vậy có test bất đẳng thức ở mục 3.2.

**Các hằng số (nền kịch bản, τ, tác động) chỉ đúng với ngưỡng seed.** Chủ nhà đổi ngưỡng giữa demo thì chu kỳ đổi theo; ngưỡng nhả vượt quá mức cân bằng thì thiết bị bật mãi.

### 2.2 Kịch bản

- Mỗi file JSON có **mức nền mặc định** cho mọi khu vực và **phần ghi đè** cho từng khu vực.
- `normal`: nền bằng Target (TEMP 28, HUMID 82), CO2 600, LIGHT 2.
- `hot`: như `normal`, riêng **H1-F2** TEMP nền 32 (khớp đoạn nóng của seed).
- `dry`: như `normal`, riêng **H1-F3** HUMID nền 70 (khớp câu chuyện HUMID giảm của seed).
- Lúc khởi động mọi giá trị bắt đầu từ mức `normal`, rồi **trôi dần** về nền của kịch bản, để người xem thấy được quá trình.
- Chọn bằng tham số: `npm start -- --scenario hot`. Mặc định `normal`.
- **Nhiễu** (Nên có): nhiễu đều ± nhỏ cộng vào giá trị gửi đi (không cộng vào trạng thái), sinh bằng bộ sinh số giả ngẫu nhiên đơn giản với hạt giống `NOISE_SEED`; chạy lại cho cùng dãy nhiễu.

### 2.3 Gửi số đo

- Topic `swiftlet/devices/{code}/readings`, QoS 1, không retained.
- Mỗi `READING_INTERVAL_SECONDS` giây, mỗi SENSOR gửi **một tin chứa 4 chỉ số cùng một `at`**, đúng fixture `mqtt/readings.json`.
- **`at` = giờ UTC làm tròn xuống giây**, dạng ISO 8601 có `Z`.
- Với từng cảm biến, `at` **tăng dần, không trùng**: nếu bằng hoặc nhỏ hơn lần trước thì lấy lần trước + 1 giây.

### 2.4 Nhận lệnh

- Mỗi cơ cấu chấp hành subscribe `swiftlet/devices/{code}/command`, QoS 1.
- **Trạng thái ban đầu là tắt**, cho tới khi tin retained đến.
- Chỉ áp dụng tin có **`issuedAt` mới hơn** tin đã áp dụng gần nhất; tin cũ hơn hoặc bằng thì bỏ qua (hợp đồng 2.1).
- Payload sai (không phải JSON, thiếu trường, `issuedAt` thiếu `Z`) → log cảnh báo, bỏ qua.

### 2.5 Heartbeat (dưới ranh giới cắt)

- Mỗi 30 giây, **20 cơ cấu chấp hành** gửi `{"device":"<mã>","at":"…Z"}` lên `swiftlet/devices/{code}/heartbeat`, QoS 0.
- Cảm biến **không** gửi heartbeat; số đo đã cập nhật `LastSeenAt`.

### 2.6 Mất kết nối `--drop` (dưới ranh giới cắt)

Cú pháp: `--drop <mã>[,<mã>…] --drop-after <phút> --drop-for <phút>`.

- Tới `--drop-after`, simulator **ngắt thật** kết nối của các thiết bị đó và tạm tắt tự kết nối lại. Trong thời gian ngắt, số đo **vẫn sinh ra**.
- Hết `--drop-for`, kết nối lại và **gửi bù** số đo đã sinh.
- **Khuyến nghị `--drop-for` ≥ 7 phút**: ngưỡng mất kết nối 5 phút cộng nhịp kiểm tra 60 giây, mới chắc thấy `DEVICE_OFFLINE`.

Hai cách giữ số đo trong lúc ngắt; **bước 1 của plan thử cách A trước**:

| Cách | Làm | Khi nào dùng |
|---|---|---|
| A | Hủy luồng mạng của client mqtt.js, để **hàng đợi offline của mqtt.js** giữ tin QoS 1; hết thời gian gọi `reconnect()` | Nếu thử thực tế thấy tin được giữ và gửi bù đủ, đúng thứ tự |
| B | Simulator `end()` kết nối, **tự giữ hàng đợi trong bộ nhớ** các tin số đo của thiết bị bị ngắt; kết nối lại thì publish lần lượt rồi xóa hàng đợi | Nếu cách A mất tin, gửi trùng sai thứ tự, hoặc không ngắt được thật |

Gửi bù trùng vô hại: SP khử trùng theo (thiết bị, chỉ số, `at`).

### 2.7 Hạn chế

1. Từ lúc khởi động đến lúc tin retained đến, cơ cấu chấp hành **coi như tắt**, nên số đo trong vài giây đầu bị tính sai tác động.
2. Mô hình không có tương tác giữa các khu vực, không có tác động của MIST lên TEMP hay của FAN lên HUMID.
3. Bản sao công thức trong test (mục 3.2) có thể lệch nếu backend đổi công thức mà không báo; test đối chiếu chỉ bắt được lệch so với các ca đã chép.
4. Hằng số mô hình chỉ đúng với ngưỡng seed (mục 2.1).

### 2.8 Checklist demo (gộp vào checklist backend 7.4)

1. **Bật simulator trước backend** (backend 7.4).
2. Seed dừng ở **19:55 giờ VN ngày neo**, simulator gửi từ thời điểm hiện tại → **biểu đồ lịch sử có khoảng trống** giữa hai mốc. Đặt ngày neo = **hôm qua** để khoảng trống ngắn nhất.
3. Mọi khu vực khởi động ở mức `normal`, nên số đo đầu tiên của H1-F3 (HUMID 82) **đóng cảnh báo HUMID đang mở của seed**. Đây là hành vi mong đợi.
4. **Tắt simulator thì 5 phút sau** (cộng nhịp 60 giây) xuất hiện `DEVICE_OFFLINE`.
5. Sau `--drop`, **một loạt số đo cũ đến cùng lúc**; số đo cũ hơn `@StaleMinutes` (2 phút) chỉ được lưu, không mở hay đóng cảnh báo. Người trình bày nói trước.

## Phần 3 — Test và việc cần sửa hợp đồng

### 3.1 Test đơn vị (`node --test`)

| Test | Khẳng định |
|---|---|
| Danh sách thiết bị | Đúng **26**: 6 SENSOR, 18 MIST/FAN/HEATER, 2 SPEAKER; không CAMERA |
| Đơn vị thời gian | Với **trạng thái thiết bị cố định** suốt phút đó: **6 bước 10 giây cho cùng kết quả với 1 bước 60 giây** (sai số ≤ 1e-9); FAN bật 1 phút với `x` ở nền và τ rất lớn → TEMP giảm ≈ 1,5 |
| `dt` thật | `dt` lấy từ hai mốc đồng hồ; `dt ≤ 0` → giá trị không đổi |
| Cân bằng | Thiết bị bật lâu → `x` dừng ở nền + τ·tác động |
| Kẹp, làm tròn | Giá trị gửi đi luôn trong [ValidMin, ValidMax], 2 chữ số thập phân; trạng thái bên trong không bị làm tròn |
| Nhiễu (Nên có) | Cùng hạt giống → cùng dãy |
| Level FAN | FAN **Level 50, `mode: "MANUAL"`** (điều khiển tay; vòng tự động chỉ gửi 100) → tác động bằng một nửa Level 100 |
| Payload | Tin số đo khớp fixture `mqtt/readings.json` khi so bằng `expand` + `match` của `contracts/lib/fixtures.mjs`; 4 chỉ số cùng `at`; `at` có `Z`, tăng dần kể cả khi đồng hồ lùi |
| Lệnh | `issuedAt` cũ hơn hoặc bằng → bỏ qua; chưa có tin retained → tắt; payload sai → bỏ qua, không dừng chương trình |

### 3.2 Test bất đẳng thức với bản sao công thức

- `test/rules-copy.mjs`: bản sao **chỉ công thức** `h`, `offHi`, `offLo` của backend 4.4 (vài dòng). Không import mã backend.
- **Test đối chiếu bản sao:** chép các ca của bảng ca `decide()` (backend 4.5) liên quan tới công thức: Target = Max, chỉ Max (CO2), không Target, `h` bị chặn bởi `(Max − Min)/4`. Cùng đầu vào phải ra cùng ngưỡng như bảng ca backend.
- **Test bất đẳng thức** (ngưỡng seed, cân bằng = nền + τ·tác động ở Level 100):
  - `hot`, H1-F2: **nền TEMP > Max** và **cân bằng khi FAN bật < offHi**.
  - `dry`, H1-F3: **nền HUMID < Min** và **cân bằng khi MIST bật > offLo**.
- Không có test mô phỏng chu kỳ; việc thấy thiết bị bật tắt thật nằm ở kiểm tay 3.3.
- Backend đổi công thức hay bảng ca → **TV2 báo TV5** cập nhật bản sao (CLAUDE.md: không tự đổi spec module khác).

### 3.3 Kiểm tra tay đầu-cuối

Chạy cùng Mosquitto và backend thật:
1. `--scenario hot`: trên web thấy FAN H1-F2 **bật rồi tắt, lặp lại** (chu kỳ tính tay ≈ 7 phút), TEMP lên xuống quanh 28–30.
2. `--scenario dry`: MIST H1-F3 bật rồi tắt, lặp lại (≈ 6 phút).
3. `--scenario normal`: không thiết bị nào bật trong 10 phút.
4. Điều khiển tay FAN Level 50: TEMP giảm chậm hơn.
5. `--drop H1-F1-SENSOR --drop-after 1 --drop-for 7`: thấy `DEVICE_OFFLINE` mở, rồi đóng sau khi kết nối lại; số đo bù có trong lịch sử, không trùng.

### 3.4 Việc cần sửa hợp đồng

Thêm vào cùng PR hợp đồng ở backend 7.6:
- Hợp đồng 2.1 ghi "28 kết nối với dữ liệu mẫu" → sửa thành **26** (không có CAMERA).
- Kiểm tra tài khoản `simulator` và ACL (Nên có) không giới hạn số kết nối.

### 3.5 Chưa kiểm chứng

- Cách A ở mục 2.6: hành vi hàng đợi offline của mqtt.js 5.16.1 khi hủy luồng mạng rồi `reconnect()`.
- Hằng số τ = 3 phút và mức tác động: test bất đẳng thức xác nhận thiết bị tắt được; độ dài chu kỳ mới tính tay, xác nhận ở kiểm tay 3.3.
- Mở 26 kết nối cùng lúc tới Mosquitto bằng cùng một tài khoản.
