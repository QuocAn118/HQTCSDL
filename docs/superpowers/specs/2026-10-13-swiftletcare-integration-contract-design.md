# SwiftletCare — integration-contract: hợp đồng tích hợp giữa các module

- **Ngày:** 2026-10-13
- **Trạng thái:** Đang thiết kế (duyệt từng phần)
- **Chủ module:** TV2 (TV1 cùng duyệt)
- **Nguồn:** [Roadmap](2026-10-12-swiftletcare-roadmap.md) · [database-core](2026-10-12-swiftletcare-database-core-design.md)

## Phần 1 — Kênh giao tiếp và quy ước chung (đã duyệt)

### 1.1 Kênh

```
simulator ──MQTT──► Mosquitto ──MQTT──► backend ──SP──► SQL Server
          ◄─MQTT──            ◄─MQTT──     │
                                           ├──REST + WebSocket──► web, mobile
ai-vision ─────────HTTP (REST)────────────►┘
```

| Kênh | Hai đầu | Dùng cho |
|---|---|---|
| **MQTT** (Mosquitto, cổng 1883) | simulator ↔ backend | Số đo cảm biến, lệnh cơ cấu chấp hành, tín hiệu sống của thiết bị |
| **REST** (`/api/...`) | web/mobile → backend; **ai-vision → backend** | CRUD, điều khiển tay, cảnh báo, lịch sử, báo cáo; nhận kết quả AI |
| **WebSocket** (Socket.IO) | backend → web/mobile | Số đo trực tiếp, cảnh báo mới/đổi trạng thái, trạng thái thiết bị |

**AI gửi kết quả qua HTTP, không qua MQTT:** ảnh chụp gửi bằng multipart (không base64 qua MQTT); AI là tiến trình xử lý video, không phải thiết bị, HTTP trả kết quả ngay nên lỗi hiện rõ; gửi lại an toàn (đếm chim lấy giá trị lớn hơn; thiên địch có cooldown và tên file ảnh cố định). MQTT chỉ dành cho thiết bị.

### 1.2 Xác thực

| Bên gọi | Cách xác thực |
|---|---|
| web, mobile | JWT `Authorization: Bearer`, claim `sub` = UserId, `role` ∈ {ADMIN, OWNER}. Socket.IO gửi token lúc bắt tay |
| ai-vision | Header **`X-Service-Key`** (khóa dịch vụ trong `.env`), không dùng JWT người dùng. So sánh bằng `crypto.timingSafeEqual` (chống dò theo thời gian), **không bao giờ ghi khóa vào log** (kể cả log request/lỗi) |
| simulator, backend ↔ Mosquitto | `allow_anonymous false`; tài khoản MQTT riêng `backend`, `simulator` trong file mật khẩu Mosquitto |

### 1.3 Quy ước dữ liệu

1. **Tên trường camelCase.** Payload MQTT và payload AI dùng **đúng khóa JSON mà SP đọc** (`device`, `metric`, `value`, `at`, `camera`, `windowStart`, `in`, `out`, `class`, `confidence`); backend chuyển nguyên văn vào SP.
   - **`snapshot` không do AI gửi.** AI chỉ gửi ảnh (multipart); backend tự sinh đường dẫn và thêm khóa `snapshot` trước khi gọi `sp_CreatePredatorAlert` (Phần 2).
   - Cột kết quả SP dạng PascalCase (`AlertId`, `NewAlertsJson`) được backend đổi sang camelCase (`alertId`) trước khi trả qua REST/WebSocket.
   - Bảng đối chiếu trường ↔ tham số/khóa JSON của SP ↔ cột nằm trong từng phần.
2. **Thời gian:**
   - Mốc thời gian là ISO 8601 UTC **bắt buộc có hậu tố `Z`**: `YYYY-MM-DDTHH:mm:ss(.sss)?Z`. Chuỗi **không có `Z` hoặc có múi giờ khác** (`+07:00`) bị **từ chối**: REST trả **400**, MQTT loại bản ghi (Phần 2). Lý do: `OPENJSON … WITH (at DATETIME2)` bỏ qua phần múi giờ mà không báo lỗi — nếu để lọt, dữ liệu lệch giờ âm thầm.
   - Phần lẻ dưới giây bị cắt (cột `DATETIME2(0)`). Trả ra bằng `toISOString()` → `2026-10-12T10:40:00.000Z`.
   - **Ngoại lệ:** ngày nghiệp vụ giờ Việt Nam (`harvestDate`, `fromVnDate`, `toVnDate`) dạng `YYYY-MM-DD`, không `Z`.
3. **Định danh:** MQTT và AI dùng **mã thiết bị** (`Code`, VD `H1-F2-FAN`); REST dùng **id số INT**, thiết bị trả kèm `code`.
4. **Kiểu số:**
   - **BIGINT** luôn chuyển sang **chuỗi** khi trả ra (hiện không cột nào lộ ra API — database-core Phần 2).
   - **DECIMAL:** Prisma trả đối tượng `Decimal`, `JSON.stringify` ra **chuỗi** (`"28.5"`). Backend đổi sang `number` **ở một chỗ chung** (bộ tuần tự hóa dùng cho mọi phản hồi REST và sự kiện WebSocket), không đổi rải rác. `DECIMAL(9,2)` vừa `number` của JS.
5. **Không bỏ trường:** trường không có giá trị trả **`null`**, không bỏ khóa.
6. **Không đánh phiên bản** topic/API (`/v1`): một nhóm dùng, không có client bên ngoài (YAGNI).

### 1.4 Ảnh chụp thiên địch

- Chỉ nhận **JPEG**. Backend kiểm tra **loại file thật bằng chữ ký đầu file** (`FF D8 FF`), không tin phần mở rộng hay `Content-Type` client gửi.
- Kích thước tối đa cấu hình được qua `.env` (`SNAPSHOT_MAX_BYTES`), **mặc định 2 MB**; vượt → 413.
- **Không bao giờ dùng tên file do client gửi.** Backend tự sinh đường dẫn cố định theo camera + loài + thời điểm (chi tiết Phần 2).

### 1.5 Fixture

- Thư mục `contracts/fixtures/` ở gốc repo, chia `mqtt/`, `rest/`, `ws/`, `ai/`. Mỗi payload ít nhất một file hợp lệ; payload có ràng buộc kèm file **không hợp lệ** `*.invalid-<lý do>.json` — bắt buộc có trường hợp **mốc thời gian thiếu `Z`** và **có múi giờ `+07:00`**.
- Cách dùng: simulator và AI kiểm payload tự tạo có cùng cấu trúc với fixture; backend dùng fixture làm đầu vào test tích hợp tới SP; web/mobile dùng làm dữ liệu giả ở tuần 1.
- Danh sách đầy đủ: Phần 4.
- **Nếu còn thời gian:** JSON Schema cho từng payload và một test kiểm mọi fixture hợp lệ khớp schema (fixture không hợp lệ phải không khớp).

### 1.6 Quy tắc thay đổi hợp đồng

- Mỗi thành viên làm việc với agent riêng → **mọi thay đổi hợp đồng đi qua Pull Request**, sửa spec này và fixture trong **cùng một PR**.
- **Người phụ trách hợp đồng (TV2) duyệt**; thay đổi đụng SP thì TV1 cùng duyệt.
- Merge xong **báo cả nhóm** (nêu trường/topic/endpoint đổi và module bị ảnh hưởng). Module chỉ sửa theo sau khi PR hợp đồng đã merge.

### 1.7 Checklist thiết lập Mosquitto

Mỗi thành viên **chạy Mosquitto riêng trên máy mình** (cùng SQL Server cục bộ), không dùng chung broker.

1. Cài Mosquitto cho Windows.
2. Repo có cấu hình mẫu `infra/mosquitto/mosquitto.conf` (**không chứa mật khẩu**):
   - `listener 1883`, `allow_anonymous false`, `password_file` trỏ tới `infra/mosquitto/passwd` (file này nằm trong `.gitignore`).
   - `persistence true`, `persistence_location infra/mosquitto/data/` (trong `.gitignore`) — tin QoS 1 đang chờ và tin retained còn sau khi broker khởi động lại.
   - `max_queued_messages 10000` (mặc định 1000): với 6 cảm biến × 1 tin/10 giây, đủ giữ số đo khoảng 4,5 giờ khi backend tắt.
   - **Lưu ý:** backend dùng client id cố định `swiftlet-backend` → **không chạy hai backend cùng lúc trên một broker** (broker sẽ ngắt kết nối cũ, hai bên tranh nhau liên tục).
3. Tạo hai tài khoản:
   ```powershell
   mosquitto_passwd -c infra/mosquitto/passwd backend
   mosquitto_passwd infra/mosquitto/passwd simulator
   ```
   Mật khẩu ghi vào `.env` của backend và simulator.
4. Chạy: `mosquitto -c infra/mosquitto/mosquitto.conf -v`.
5. Kiểm tra: `mosquitto_sub -u backend -P <mật khẩu> -t 'swiftlet/#' -v` kết nối được; thử không tài khoản phải bị từ chối.

## Phần 2 — MQTT và kết quả AI (đã duyệt)

### 2.1 Topic MQTT

| Topic | Chiều | QoS | Retained | Payload |
|---|---|---|---|---|
| `swiftlet/devices/{code}/readings` | cảm biến → backend | 1 | Không | Mảng số đo |
| `swiftlet/devices/{code}/heartbeat` | cơ cấu chấp hành → backend | 0 | Không | Tín hiệu sống |
| `swiftlet/devices/{code}/command` | backend → cơ cấu chấp hành | 1 | **Có** | Trạng thái mong muốn |

`{code}` = `Devices.Code` = MQTT client id của thiết bị; simulator mở **một kết nối cho mỗi thiết bị** (28 kết nối với dữ liệu mẫu).

**readings** — mỗi cảm biến gửi 4 chỉ số trong một tin, mặc định **10 giây/lần** (cấu hình được). Payload là mảng **đúng các phần tử `sp_IngestReadings` đọc**, backend chuyển nguyên văn:

```json
[{"device":"H1-F1-SENSOR","metric":"TEMP","value":28.5,"at":"2026-10-12T10:40:00Z"},
 {"device":"H1-F1-SENSOR","metric":"HUMID","value":82.1,"at":"2026-10-12T10:40:00Z"}]
```

Backend kiểm tra **`device` trùng `{code}` của topic** — một thiết bị không gửi giả số đo cho thiết bị khác.

**heartbeat** — mỗi 30 giây: `{"device":"H1-F1-FAN","at":"2026-10-12T10:40:00Z"}`. QoS 0 vì mất một nhịp vô hại (ngưỡng mất kết nối 5 phút ≈ 10 nhịp). Mục 11 (dưới ranh giới cắt).

**command** — **trạng thái mong muốn**, không phải lệnh đảo trạng thái:

```json
{"isOn":true,"level":80,"mode":"MANUAL","issuedAt":"2026-10-12T10:40:00Z"}
```

- Lấy từ kết quả `sp_SetActuator` (`IsOn`, `Level`, `Mode`; topic từ `DeviceCode`); chỉ publish khi `Changed = 1`.
- **Retained**: thiết bị kết nối lại nhận ngay trạng thái mới nhất.
- Simulator **bỏ qua tin có `issuedAt` cũ hơn** tin đã áp dụng gần nhất (tin đến sai thứ tự).
- **Khi backend khởi động**, publish lại (retained) trạng thái hiện tại của **mọi cơ cấu chấp hành `IsActive = 1`** đọc từ CSDL, `issuedAt` = thời điểm khởi động — broker không lệch CSDL sau khi reset hoặc nạp lại dữ liệu mẫu.

### 2.2 Tin giao lặp, tin mất

| Tình huống | Xử lý |
|---|---|
| readings giao lặp (QoS 1 = ít nhất một lần) | UQ(DeviceId, MetricCode, RecordedAt) + `NOT EXISTS` trong SP → tính vào `duplicates`, không ghi trùng |
| command giao lặp | Vô hại — áp cùng trạng thái mong muốn hai lần cho cùng kết quả |
| heartbeat mất | Vô hại — `LastSeenAt` lấy giá trị lớn hơn |
| Backend khởi động lại | Client id cố định `swiftlet-backend`, `clean: false`; broker (có persistence) giữ tin QoS 1 trong lúc backend tắt |
| Simulator mất kết nối | Hàng đợi offline của mqtt.js, gửi bù khi kết nối lại (chi tiết ở spec simulator) |
| Lô bù đến muộn | Vẫn lưu, nhưng số đo cũ hơn `@StaleMinutes` (mặc định 2 phút) không dùng để mở/đóng cảnh báo ngưỡng (database-core, `sp_IngestReadings`) |

### 2.3 Backend kiểm tra tin MQTT trước khi gọi SP

- Tin không parse được hoặc không phải mảng → bỏ cả tin.
- **Từng phần tử** thiếu trường, sai kiểu, `at` không có `Z` / có múi giờ khác, `device` khác topic → **bỏ phần tử đó**, ghi log cảnh báo kèm lý do (MQTT không có phản hồi 400).
- Phần tử hợp lệ được **gom lô**: gọi `sp_IngestReadings` **mỗi 1 giây hoặc khi đủ 200 phần tử**, tùy cái nào đến trước — giữ mục tiêu dashboard ≤ 2 giây.

### 2.4 Kết quả AI qua HTTP (header `X-Service-Key`)

**`POST /api/ai/bird-counts`** — body là mảng **đúng các phần tử `sp_RecordBirdCount` đọc**:

```json
[{"camera":"H1-F0-CAMERA","windowStart":"2026-10-12T10:00:00Z","in":5,"out":1}]
```

- AI gửi **tổng tạm của cửa sổ hiện tại mỗi phút** và tổng cuối khi cửa sổ đóng; gửi lại an toàn (SP lấy giá trị lớn hơn).
- Tối đa 500 phần tử/lần.
- Phản hồi 200: `{"windowsUpserted":1,"windowsUnchanged":0}`.

**`POST /api/ai/predator-detections`** — `multipart/form-data`:

- `metadata` (chuỗi JSON): `{"camera":"H1-F0-CAMERA","class":"snake","confidence":0.87,"at":"2026-10-12T10:40:00Z"}`
- `image`: file JPEG (quy định ở 1.4).

Backend xử lý theo thứ tự:

1. Kiểm tra `metadata` (đủ trường, đúng kiểu, `at` có `Z`).
2. **Kiểm tra trước khi dựng đường dẫn:** `camera` tồn tại trong CSDL, `IsActive = 1`, đúng là `CAMERA`; `class` ∈ {rat, snake, owl}. Sai → 400/404, không ghi file nào. **Không bao giờ nối chuỗi client gửi vào đường dẫn khi chưa kiểm tra** — chặn path traversal (`../`).
3. Kiểm tra ảnh: chữ ký `FF D8 FF`, kích thước ≤ `SNAPSHOT_MAX_BYTES`.
4. Sinh đường dẫn cố định: `snapshots/{yyyy}/{MM}/{dd}/{camera}_{class}_{yyyyMMddTHHmmss}Z.jpg` theo `at` (UTC), chỉ từ giá trị đã kiểm ở bước 2.
5. Ghi ảnh ra **file tạm** (`storage/tmp/`, tên ngẫu nhiên do backend sinh).
6. Gọi `sp_CreatePredatorAlert` với metadata + khóa `snapshot`.
7. `Created = 1` → **đổi tên file tạm thành file chính thức**; ngược lại → **xóa file tạm**. Không lưu ảnh của phát hiện bị bỏ qua.
8. Đổi tên lỗi sau khi cảnh báo đã tạo → ghi log lỗi; cảnh báo vẫn còn, giao diện hiện ảnh thay thế.

- **Khi khởi động**, backend xóa mọi file trong `storage/tmp/` (file tạm mồ côi do sập giữa chừng).
- Gửi lại cùng phát hiện → SP trả `COOLDOWN`, file tạm bị xóa; đường dẫn cố định nên không có hai file cho một phát hiện.
- Ảnh lưu tại `backend/storage/snapshots/` (trong `.gitignore`); endpoint đọc ảnh kiểm quyền sở hữu nhà (Phần 3).
- Phản hồi 200: `{"created":true,"alertId":12,"skipReason":null}`.

**`POST /api/ai/heartbeat`** — `{"device":"H1-F0-CAMERA","at":"…Z"}`, AI gửi mỗi 30 giây khi đang xử lý video; backend gọi `sp_RecordHeartbeat`. Mục 11.

### 2.5 Bảng đối chiếu

| Trường hợp đồng | Khóa JSON / tham số SP | Cột |
|---|---|---|
| readings `device`, `metric`, `value`, `at` | `sp_IngestReadings`: cùng tên | Devices.Code → DeviceId; MetricCode; Value; RecordedAt |
| command `isOn`, `level`, `mode` | Kết quả `sp_SetActuator`: `IsOn`, `Level`, `Mode`; topic từ `DeviceCode` | Devices.IsOn, Level, Mode |
| heartbeat `device`, `at` | `sp_RecordHeartbeat`: cùng tên | Devices.LastSeenAt, Status |
| bird-counts `camera`, `windowStart`, `in`, `out` | `sp_RecordBirdCount`: cùng tên | BirdCounts.CameraId, WindowStart, InCount, OutCount |
| predator `camera`, `class`, `confidence`, `at` + `snapshot` (**backend sinh**) | `sp_CreatePredatorAlert`: cùng tên | Alerts.DeviceId, DetectedClass, Confidence, SnapshotPath |
| phản hồi `windowsUpserted`, `windowsUnchanged`, `created`, `alertId`, `skipReason` | Cột kết quả SP (PascalCase) | — |

### 2.6 Giới hạn đã biết

- **Số đo đang gom trong bộ nhớ backend** (tối đa khoảng 1 giây) **mất nếu backend sập** — tin đã được xác nhận với broker nên broker không giao lại.
- AI khởi động lại giữa cửa sổ đếm → cửa sổ đó thiếu phần đếm trước khởi động lại (≤ 5 phút mỗi lần); AI không phải lưu trạng thái cửa sổ.

**Nên có:** file ACL Mosquitto — `simulator` chỉ publish `readings`/`heartbeat`, chỉ subscribe `command`; `backend` ngược lại.
