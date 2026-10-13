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

## Phần 3 — REST API và bảng đổi mã lỗi (đã duyệt)

### 3.1 Quy tắc chung

- **Quyền sở hữu:** mọi route có `houseId` / `zoneId` / `deviceId` / `alertId` được backend truy ra nhà; OWNER không sở hữu → **404** (không 403, không lộ sự tồn tại). ADMIN thấy tất cả.
- **Guard xác thực đọc lại Users mỗi request** (tra theo khóa chính, rẻ): `IsActive = 0` → 401; dùng `Role` trong CSDL, không tin `role` trong token. Tài khoản bị khóa hoặc đổi vai trò có hiệu lực ngay, không chờ token hết hạn.
- **Không xóa cứng:** ngừng dùng bằng `PATCH {isActive:false}`; không có route DELETE.
- **Phân trang theo con trỏ id:** `?limit=50&before=<id>` (`limit` ≤ 200), sắp xếp theo id giảm dần; phản hồi `{items:[...], nextBefore:<id>|null}`. Không dùng `createdAt` làm con trỏ: `DATETIME2(0)` chỉ chính xác đến giây, nhiều dòng cùng giây sẽ bị sót hoặc trùng.
- **Kiểm tra đầu vào bằng DTO** (class-validator), gồm quy tắc mốc thời gian có `Z`.

### 3.2 Ghi bảng Devices

Database-core quy ước không ghi bảng có trigger bằng `prisma.<model>.create/update` (R1). Devices không có SP CRUD, nên:

- **UPDATE Devices** (đổi tên, `isActive`): bắt buộc qua `$executeRaw` có tham số, **không có `OUTPUT`**.
- **INSERT Devices** phụ thuộc kết quả kiểm chứng R1 (làm sớm, ngày đầu plan database-core): `trg_Devices_Status` chỉ là `AFTER UPDATE`.
  - Nếu SQL Server cho phép `OUTPUT` không `INTO` khi bảng chỉ có trigger UPDATE → INSERT dùng `prisma.devices.create`.
  - Nếu không → INSERT cũng qua `$executeRaw`, lấy id mới bằng `SCOPE_IDENTITY()` trong cùng câu lệnh.
- Kết luận cuối ghi lại vào database-core sau khi kiểm chứng.

### 3.3 Endpoint

| Nhóm | Endpoint | Quyền | Gọi tới |
|---|---|---|---|
| Sức khỏe | `GET /api/health` → `{status, db, mqtt}`; 200 khi tất cả `ok`/`connected`, ngược lại 503 | Công khai | `SELECT 1`, trạng thái client MQTT. Không trả chi tiết khác |
| Xác thực | `POST /api/auth/login` `{username,password}` → `{accessToken, expiresIn, user}` | Công khai | Prisma đọc Users, bcrypt |
| | `GET /api/auth/me` | Đã đăng nhập | |
| Người dùng | `GET/POST /api/users`, `GET/PATCH /api/users/:userId` (`fullName`, `email`, `phone`, `role`, `isActive`) | ADMIN | Prisma |
| | `POST /api/users/:userId/reset-password` `{newPassword}` | ADMIN | bcrypt |
| Nhà | `GET/POST /api/houses`, `GET/PATCH /api/houses/:houseId` | OWNER (nhà mình), ADMIN | Prisma |
| Khu vực | `GET/POST /api/houses/:houseId/zones`, `PATCH /api/zones/:zoneId` | như trên | Prisma |
| Thiết bị | `GET /api/houses/:houseId/devices`, `POST /api/zones/:zoneId/devices`, `PATCH /api/devices/:deviceId` (`name`, `isActive`) | như trên | Theo 3.2 |
| Chỉ số | `GET /api/metrics` | Đã đăng nhập | Prisma |
| Ngưỡng | `GET /api/zones/:zoneId/thresholds`, `PUT /api/zones/:zoneId/thresholds/:metricCode` `{minValue,maxValue,targetValue}` | như trên | Prisma; `UpdatedBy` từ JWT |
| Số đo | `GET /api/houses/:houseId/latest-readings` | như trên | `vw_LatestReadings` |
| | `GET /api/zones/:zoneId/readings?metric=&from=&to=&bucketMinutes=` | | `sp_GetReadingHistory` |
| | `GET /api/zones/:zoneId/daily-stats?fromVnDate=&toVnDate=` | | `vw_DailyEnvStats` |
| Điều khiển | `POST /api/devices/:deviceId/control` `{isOn?, level?, mode?, reason?}` → `{changed, deviceCode, mode, isOn, level}` | như trên | `sp_SetActuator` (`Source='MANUAL'`, `UserId` từ JWT) |
| | `GET /api/devices/:deviceId/control-logs?limit=&before=` | | Prisma |
| Cảnh báo | `GET /api/alerts?houseId=&status=NEW,ACK&type=&limit=&before=` | như trên | Prisma đọc / `vw_OpenAlerts` |
| | `GET /api/alerts/:alertId` (kèm `history`) | | Prisma đọc |
| | `PATCH /api/alerts/:alertId` `{status, note?}` | | `sp_UpdateAlertStatus` |
| | `GET /api/alerts/:alertId/snapshot` → `image/jpeg` | | Kiểm quyền theo cảnh báo rồi đọc file; **không bao giờ nhận đường dẫn từ client** |
| Đếm chim | `GET /api/houses/:houseId/bird-flow?fromVnDate=&toVnDate=` | như trên | `vw_DailyBirdFlow` |
| | `GET /api/devices/:deviceId/bird-counts?from=&to=` | | Prisma đọc BirdCounts |
| AI | `POST /api/ai/bird-counts`, `/predator-detections`, `/heartbeat` (Phần 2) | `X-Service-Key` | |
| *Dưới ranh giới cắt* | `GET/POST /api/zones/:zoneId/harvests`; `GET /api/houses/:houseId/reports/env-vs-yield?fromVnDate=&toVnDate=` | như trên | Prisma; `sp_Report_EnvStabilityVsYield` |

**Người dùng**

- Mật khẩu do **backend băm bằng bcrypt**; `passwordHash` **không bao giờ** xuất hiện trong phản hồi hay log.
- Mật khẩu mới tối thiểu 8 ký tự.
- **Không cho ADMIN tự khóa mình** (`isActive:false` hoặc hạ vai trò chính mình) → 409 `CANNOT_MODIFY_SELF`.
- **Không khóa hoặc hạ vai trò ADMIN đang hoạt động cuối cùng** → 409 `LAST_ADMIN`. Kiểm tra và cập nhật trong cùng một transaction, đếm ADMIN với `UPDLOCK, HOLDLOCK` — hai ADMIN hạ nhau cùng lúc không làm hệ thống mất hết ADMIN.
- Đăng nhập sai mật khẩu và tài khoản bị khóa trả **cùng một lỗi 401** (không dò được tên tài khoản).
- JWT hạn 8 giờ, **không có refresh token** (YAGNI).

**Điều khiển**

- `mode = 'AUTO'` (trả quyền cho bộ điều khiển): `isOn` **không bắt buộc**; backend tự điền giá trị hiện tại của thiết bị trước khi gọi SP. Các trường hợp khác `isOn` bắt buộc.
- SP commit xong mới publish MQTT (`changed = true`). **Publish lỗi** → ghi log mức error, vẫn trả 200 với kết quả SP (CSDL là nguồn sự thật); trạng thái được đồng bộ lại lên broker ở lần khởi động backend kế tiếp (Phần 2).

**Ảnh chụp** — thẻ `<img>` không gửi được header `Authorization`, nên:

- **Web:** `fetch` kèm token → `blob` → `URL.createObjectURL(blob)` gán cho `<img>`; thu hồi bằng `URL.revokeObjectURL` khi component gỡ.
- **Mobile:** `<Image source={{ uri, headers: { Authorization: 'Bearer …' } }} />` (React Native `Image` và `expo-image` đều hỗ trợ).
- Backend không cần cơ chế riêng. Không dùng đường dẫn có chữ ký: tốn khóa HMAC, mốc hết hạn, endpoint cấp chữ ký chỉ để có cache trình duyệt — không cần với lượng ảnh nhỏ.

### 3.4 Định dạng lỗi

```json
{"error":{"code":"ALERT_INVALID_TRANSITION","message":"…","sqlNumber":50021,"details":null}}
```

`sqlNumber` = `null` khi lỗi không đến từ SQL. **Không bao giờ trả nguyên văn thông báo lỗi SQL** cho client.

### 3.5 Bảng đổi mã lỗi SQL → HTTP

| Mã SQL | HTTP | `code` | Ghi chú |
|---|---|---|---|
| 50001, 50002 | 500 | `INTERNAL` | Backend tự đặt Source/UserId → gặp là **lỗi backend**, log mức error |
| 50003 | 409 | `DEVICE_NOT_CONTROLLABLE` | Đã qua kiểm quyền nên thiết bị tồn tại → ngừng dùng hoặc không phải cơ cấu chấp hành |
| 50010 | 404 | `CAMERA_NOT_FOUND` | Endpoint AI |
| 50012, 50013, 50014 | 400 | `VALIDATION_ERROR` | `details` nêu trường sai |
| 50020 | 404 | `ALERT_NOT_FOUND` | |
| 50021 | 409 | `ALERT_INVALID_TRANSITION` | |
| 50030 | 400 | `INVALID_JSON` | |
| 50040, 50041, 50042 | 400 | `INVALID_PARAMETER` | |
| 547 (vi phạm CHECK/khóa ngoại) | 400 | `CONSTRAINT_VIOLATION` | VD ngưỡng Min ≥ Max |
| 2627, 2601 (trùng UQ) | 409 | `DUPLICATE` | VD trùng tên khu vực trong nhà |
| 1205 (nạn nhân deadlock) | 503 | `RETRY_LATER` | Backend **tự thử lại 1 lần** rồi mới trả 503 |
| Lỗi SQL khác | 500 | `INTERNAL` | |

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ERROR` | DTO sai, gồm mốc thời gian thiếu `Z` / sai múi giờ |
| 401 | `UNAUTHENTICATED` | Thiếu/sai JWT, tài khoản bị khóa, sai `X-Service-Key`, đăng nhập sai |
| 403 | `FORBIDDEN` | Sai vai trò (VD OWNER gọi `/api/users`) |
| 404 | `NOT_FOUND` | Không tồn tại hoặc không thuộc quyền sở hữu |
| 409 | `CANNOT_MODIFY_SELF`, `LAST_ADMIN` | Quy tắc người dùng ở 3.3 |
| 413 | `PAYLOAD_TOO_LARGE` | Ảnh vượt `SNAPSHOT_MAX_BYTES`, lô AI vượt 500 phần tử |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Ảnh không phải JPEG thật |

**Nên có:** giới hạn tần suất `/api/auth/login`.

### 3.6 Checklist thiết lập mạng

1. Backend lắng nghe **`0.0.0.0`** (biến `HOST`, cổng `PORT` mặc định 3000), không chỉ `localhost` — điện thoại thật mới gọi được.
2. Mở cổng backend trong **Windows Defender Firewall** (mạng Private).
3. App Expo lấy địa chỉ backend từ biến cấu hình **`EXPO_PUBLIC_API_URL`** = IP mạng LAN của máy chạy backend (VD `http://192.168.1.10:3000`), **không dùng `localhost`** (trên điện thoại `localhost` là chính điện thoại).
4. **CORS:** biến `CORS_ORIGINS` liệt kê địa chỉ web (VD `http://localhost:3001`); áp dụng cho cả REST và Socket.IO.
5. Kiểm tra: từ điện thoại mở `http://<IP LAN>:3000/api/health` thấy `{"status":"ok",…}`.
