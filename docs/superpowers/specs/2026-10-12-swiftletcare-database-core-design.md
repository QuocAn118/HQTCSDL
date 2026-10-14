# SwiftletCare — database-core: thiết kế CSDL SQL Server

- **Ngày:** 2026-10-12
- **Trạng thái:** Đã duyệt
- **Chủ module:** TV1
- **Nguồn:** [Roadmap](2026-10-12-swiftletcare-roadmap.md) · [Project.md](../../../Project.md)

## Phần 1 — Phạm vi, cấu trúc, môi trường, quy ước (đã duyệt)

### Phạm vi

Các mục 1–11 của `database-core` trong roadmap, giữ nguyên thứ tự ưu tiên và ranh giới cắt. Phân quyền SQL Server, demo transaction/đồng thời, sao lưu/phục hồi, tối ưu truy vấn và script sinh dữ liệu lớn thuộc `database-advanced`, không nằm trong spec này.

### Cấu trúc thư mục

Package `database/` riêng ở gốc repo, TV1 làm chủ. TV1 làm được ngay tuần 1 mà không phụ thuộc khung NestJS của TV2.

```
database/
  prisma/schema.prisma        # nơi duy nhất định nghĩa bảng
  prisma/migrations/          # migration Prisma + SQL viết tay (CHECK, clustered, ...)
  sql/
    01-views/
    02-functions-procs/
    03-triggers/              # CREATE OR ALTER, chạy lại an toàn
    seed/                     # dữ liệu mẫu cố định
  tests/                      # script kiểm thử T-SQL
  scripts/deploy.ps1          # migrate deploy → sql/ theo thứ tự → seed
  .env.example                # mẫu chuỗi kết nối; .env thật không commit
```

- Backend dùng chung schema: `prisma generate --schema ../database/prisma/schema.prisma`.
- `.env` (chuỗi kết nối, mật khẩu) nằm trong `.gitignore`; chỉ commit `.env.example`.

### Công cụ cần cài trên máy mọi thành viên

| Công cụ | Ghi chú |
|---|---|
| SQL Server Express, **tối thiểu 2016 SP1** (máy hiện có: 2025) | Bật Mixed Mode, TCP/IP cổng 1433 |
| `sqlcmd` | Chạy script SQL và test |
| Node.js 25 | Prisma CLI, `npm test` |
| PowerShell | Chạy `scripts/deploy.ps1` |

Cả 5 thành viên dùng Windows → chỉ cần `scripts/deploy.ps1`, không làm `deploy.sh`.

### Checklist thiết lập môi trường

1. Bật **Mixed Mode** (SQL Server + Windows authentication), khởi động lại dịch vụ SQL Server.
2. Bật **TCP/IP**, đặt cổng cố định **1433** trong SQL Server Configuration Manager (Express tắt TCP/IP mặc định), khởi động lại dịch vụ.
3. Tạo login SQL `swiftlet_dev`, là `db_owner` của CSDL phát triển **`SwiftletCare_Dev`** (và `SwiftletCare_Test` do test tạo) và có server role **`dbcreator`** — `prisma migrate dev` cần tạo **shadow database**. (Thay thế: khai báo `shadowDatabaseUrl` trỏ tới một CSDL shadow tạo sẵn.)
4. Sao chép `.env.example` → `.env`, điền mật khẩu.
5. Kiểm tra: `sqlcmd -S localhost,1433 -U swiftlet_dev -Q "SELECT @@VERSION"` trả về phiên bản.
6. Kiểm tra phiên bản: `SELECT SERVERPROPERTY('ProductVersion')` phải **≥ 13.0.4001** (SQL Server 2016 SP1 — cần cho `CREATE OR ALTER`, `OPENJSON`, `SESSION_CONTEXT`, `AT TIME ZONE`).
7. Kiểm tra mức tương thích: `SELECT compatibility_level FROM sys.databases WHERE name = 'SwiftletCare_Dev'` phải **≥ 130** (`OPENJSON`).
8. `deploy.ps1` tự kiểm tra bước 6–7 và dừng với thông báo lỗi nếu không đạt.

**Tên CSDL:** `SwiftletCare_Dev` (phát triển), `SwiftletCare_Test` (test, tạo lại mỗi lần chạy), `SwiftletCare` (bản demo, không bao giờ reset).

**`deploy.ps1 -Reset`** (xóa và tạo lại CSDL) **chỉ chạy khi tên CSDL kết thúc bằng `_Test` hoặc `_Dev`** (không phân biệt hoa thường). Tên khác → từ chối, báo lỗi, thoát mã khác 0 **trước khi gửi bất kỳ lệnh SQL nào**. Không có cờ nào bỏ qua kiểm tra này.

**Hàm T-SQL bị cấm** vì chỉ có từ SQL Server 2022 (máy thành viên có thể cũ hơn): `GREATEST`, `LEAST`, `DATE_BUCKET`, `DATETRUNC`, `GENERATE_SERIES`, `STRING_SPLIT(…, enable_ordinal)`. Dùng `CASE WHEN`, `DATEADD`/`DATEDIFF`, bảng số sinh bằng `CROSS JOIN` thay thế.

**Vì sao dùng SQL login:** mỗi thành viên có máy và tài khoản Windows riêng; SQL login cho cả nhóm dùng chung một dạng chuỗi kết nối, đồng nhất giữa các máy. `swiftlet_dev` chỉ dùng khi phát triển; `database-advanced` thay bằng các login quyền tối thiểu.

### Kiểm thử SP

- Script T-SQL thuần, không dùng tSQLt (cần bật CLR, cài thêm framework).
- Mỗi SP một file trong `tests/`: chuẩn bị dữ liệu → `EXEC` → so kết quả, sai thì `THROW`.
- Test chạy trên `SwiftletCare_Test` (tạo lại mỗi lần), không đụng dữ liệu dev.
- Mỗi file bắt đầu bằng `SET XACT_ABORT ON`; **mỗi ca test một transaction riêng** `BEGIN TRAN … ROLLBACK`, bọc `TRY/CATCH` để **luôn ROLLBACK** kể cả khi test lỗi. Ca mong đợi lỗi: `CATCH` kiểm `ERROR_NUMBER()`, `ROLLBACK` (transaction đã bị `XACT_ABORT` hủy), rồi mới kiểm trạng thái sau lỗi.
- `npm test` gọi `sqlcmd -b` cho từng file: lỗi trả mã thoát khác 0, `npm test` thất bại.
- Chi tiết bộ test: Phần 4.

### Dữ liệu mẫu

- **Cố định, không ngẫu nhiên**: mọi máy chạy seed ra cùng dữ liệu, test và demo cho cùng kết quả.
- Script sinh vài triệu dòng cho phần tối ưu là riêng, thuộc `database-advanced`.

### Quy ước

- Thời gian: `DATETIME2(0)` lưu UTC; mặc định `@default(dbgenerated("sysutcdatetime()"))`; SP/trigger dùng `SYSUTCDATETIME()`. JSON dùng ISO 8601 có hậu tố `Z`.
- SP nhận JSON qua `OPENJSON` (không TVP); backend gọi bằng `$queryRaw`/`$executeRaw` có tham số.
- **Mỗi SP trả đúng 1 tập kết quả.**
- Lỗi nghiệp vụ: `THROW` mã 5xxxx; backend đổi sang HTTP 400/409.
- Không ghi bảng có trigger bằng `prisma.<model>.create/update` (R1): `Alerts` chỉ ghi qua SP; `Devices` ghi qua SP hoặc `$executeRaw` có tham số **không có `OUTPUT`** — UPDATE luôn theo cách này, INSERT được dùng `prisma.devices.create` nếu kiểm chứng R1 (ngày đầu plan) cho thấy trigger chỉ-`AFTER UPDATE` không chặn INSERT có `OUTPUT` (integration-contract 3.2).
- Miền giá trị bằng ràng buộc `CHECK` viết tay trong file migration (`prisma migrate dev --create-only` → thêm SQL → áp dụng).
- Khóa ngoại `NO ACTION`; ngừng dùng bằng `IsActive = 0`, không xóa.

### Mốc 20/10

Migration bảng lõi + `sp_IngestReadings` + `sp_SetActuator` + test của hai SP chạy được bằng `scripts/deploy.ps1` và `npm test` trên máy sạch.

## Phần 2 — ERD và các bảng (đã duyệt)

```mermaid
erDiagram
    Users ||--o{ Houses : "sở hữu"
    Houses ||--o{ Zones : "gồm"
    Zones ||--o{ Devices : "lắp đặt"
    Zones ||--o{ Thresholds : "đặt ngưỡng"
    Metrics ||--o{ Thresholds : ""
    Devices ||--o{ SensorReadings : "đo"
    Metrics ||--o{ SensorReadings : ""
    Devices ||--o{ ControlLogs : "được điều khiển"
    Users |o--o{ ControlLogs : "ghi đè"
    Houses ||--o{ Alerts : ""
    Zones |o--o{ Alerts : ""
    Devices |o--o{ Alerts : ""
    Alerts ||--o{ AlertHistory : "lịch sử"
    Users |o--o{ AlertHistory : "xử lý"
    Devices ||--o{ BirdCounts : "camera đếm"
    Zones ||--o{ Harvests : "thu hoạch"
```

### Kiểu khóa: INT hay BIGINT

Prisma trả cột `BIGINT` về JS dạng `BigInt`, `JSON.stringify` sẽ lỗi. Quy ước:

- Khóa lộ ra qua API/WebSocket dùng **INT**.
- **BIGINT chỉ cho bảng rất lớn** và không lộ ra API. Nếu buộc phải trả ra, backend chuyển sang chuỗi.
- Cột kết quả SP dùng INT (`COUNT`, không `COUNT_BIG`).

Rà soát: chỉ **`SensorReadings.ReadingId`** là BIGINT, không lộ ra API (lịch sử trả số tổng hợp, `vw_LatestReadings` không chọn cột này). `ControlLogs.LogId`, `AlertHistory.HistoryId`, `BirdCounts.CountId` dùng INT: lượng dữ liệu nhỏ (nhật ký chỉ ghi khi trạng thái đổi; đếm chim 288 cửa sổ/ngày/camera) và có thể lộ ra API.

### Bảng lõi (mục 1, xong 20/10)

| Bảng | Cột chính (kiểu) | Ràng buộc |
|---|---|---|
| **Users** | UserId INT, Username VARCHAR(50), PasswordHash VARCHAR(255) (bcrypt, backend băm), FullName NVARCHAR(100), Email VARCHAR(255), Phone VARCHAR(20)?, Role VARCHAR(10), IsActive, CreatedAt | UQ Username, UQ Email; CK Role ∈ {ADMIN, OWNER} |
| **Houses** | HouseId INT, OwnerId→Users, Name NVARCHAR(100), Address NVARCHAR(255)?, IsActive, CreatedAt | UQ(OwnerId, Name) |
| **Zones** | ZoneId INT, HouseId→Houses, Name NVARCHAR(50), FloorNo TINYINT | UQ(HouseId, Name); **UQ(ZoneId, HouseId)** (đích của khóa ngoại ghép từ Alerts); FloorNo 0 = lối vào (nơi đặt camera) |
| **Devices** | DeviceId INT, ZoneId→Zones, Code VARCHAR(50), Name NVARCHAR(100), DeviceType VARCHAR(10), Status VARCHAR(10) (mặc định OFFLINE), LastSeenAt?, Mode VARCHAR(6)?, IsOn BIT?, Level TINYINT?, IsActive, CreatedAt | UQ Code (= MQTT client id, dạng `H1-F2-FAN`); CK DeviceType ∈ {SENSOR, MIST, FAN, HEATER, SPEAKER, CAMERA}; CK Status ∈ {ONLINE, OFFLINE, ERROR}; **CK Mode ∈ {AUTO, MANUAL}**; CK cơ cấu chấp hành (MIST/FAN/HEATER/SPEAKER) ⇒ Mode, IsOn NOT NULL; SENSOR/CAMERA ⇒ Mode, IsOn, Level đều NULL; CK Level 0–100 |
| **Metrics** | MetricCode VARCHAR(10) PK, Name NVARCHAR(50), Unit NVARCHAR(10), ValidMin, ValidMax, Hysteresis DECIMAL(9,2) | Bảng tra: TEMP, HUMID, CO2, LIGHT; CK ValidMin < ValidMax; CK Hysteresis ≥ 0; khoảng hợp lệ dùng lọc dữ liệu hỏng khi thu nhận; Hysteresis là vùng đệm đóng cảnh báo (Phần 3) |
| **Thresholds** | PK(ZoneId, MetricCode), MinValue?, MaxValue?, TargetValue? DECIMAL(9,2), UpdatedBy?→Users, UpdatedAt | CK có ít nhất Min hoặc Max; CK Min < Max; CK Target ∈ [Min, Max] |
| **SensorReadings** | ReadingId BIGINT, DeviceId, MetricCode, Value DECIMAL(9,2), RecordedAt | **UQ(DeviceId, MetricCode, RecordedAt)** chống bản ghi trùng do MQTT giao lại (QoS 1 giao ít nhất một lần); `sp_IngestReadings` bỏ qua dòng trùng bằng `NOT EXISTS`, không báo lỗi. Clustered/nonclustered: Phần 4 |
| **ControlLogs** | LogId INT, DeviceId, IsOn BIT, Level TINYINT?, Mode VARCHAR(6), Source VARCHAR(6), UserId?, Reason NVARCHAR(200)?, CreatedAt | **CK Mode ∈ {AUTO, MANUAL}**; CK Source ∈ {AUTO, MANUAL}; MANUAL ⇒ UserId NOT NULL |
| **Alerts** | AlertId INT, HouseId, ZoneId?, DeviceId?, AlertType, Severity, MetricCode?, Value?, DetectedClass?, Confidence?, SnapshotPath?, Message NVARCHAR(500), Status, CreatedAt, ResolvedAt?, ResolvedBy? | Xem bên dưới |
| **AlertHistory** | HistoryId INT, AlertId, OldStatus?, NewStatus, UserId?, Note NVARCHAR(500)?, ChangedAt | Do trigger ghi; UserId NULL = hệ thống |

**Ràng buộc trên Alerts**

- CK AlertType ∈ {THRESHOLD, PREDATOR, DEVICE_OFFLINE, POPULATION_DROP}; Severity ∈ {INFO, WARNING, CRITICAL}; Status ∈ {NEW, ACK, RESOLVED}; RESOLVED ⇔ ResolvedAt NOT NULL.
- Theo loại:

| AlertType | Bắt buộc có | Bắt buộc NULL |
|---|---|---|
| THRESHOLD | ZoneId, MetricCode, Value | DetectedClass, Confidence, SnapshotPath |
| PREDATOR | DeviceId, ZoneId, DetectedClass ∈ {rat, snake, owl}, Confidence ∈ [0,1], SnapshotPath | MetricCode, Value |
| DEVICE_OFFLINE | DeviceId, ZoneId | MetricCode, Value, DetectedClass, Confidence, SnapshotPath |
| POPULATION_DROP | — | **ZoneId, DeviceId**, MetricCode, Value, DetectedClass, Confidence, SnapshotPath |

- Cảnh báo gắn thiết bị (PREDATOR, DEVICE_OFFLINE) lưu ZoneId = khu vực của thiết bị (SP điền), để lọc theo khu vực được.
- **Khóa ngoại ghép `Alerts(ZoneId, HouseId) → Zones(ZoneId, HouseId)`**: CSDL tự đảm bảo HouseId khớp ZoneId. Khi ZoneId NULL (POPULATION_DROP), SQL Server không kiểm khóa ngoại ghép — đúng ý muốn. Khóa ngoại `Alerts(HouseId) → Houses` vẫn giữ. Phụ thuộc R5.
- **Chống mở trùng cảnh báo ngưỡng** khi hai lô số đo đến cùng lúc — dùng cả hai lớp:
  1. **Cơ chế chính:** `sp_IngestReadings` đọc cảnh báo đang mở với `UPDLOCK, HOLDLOCK`, duyệt các cặp (ZoneId, MetricCode) theo thứ tự cố định để tránh deadlock giữa hai lô.
  2. **Lưới an toàn ở tầng CSDL:** chỉ mục unique có lọc `UX_Alerts_OpenThreshold ON Alerts(ZoneId, MetricCode) WHERE AlertType = 'THRESHOLD' AND Status <> 'RESOLVED'`, viết tay trong migration (phụ thuộc R2). Bộ lọc **phải có `AlertType = 'THRESHOLD'`**: chỉ mục unique coi các NULL là bằng nhau, thiếu điều kiện này thì các cảnh báo có MetricCode NULL (thiên địch, giảm đàn…) chặn lẫn nhau. Chỉ mục này cũng phục vụ truy vấn dò cảnh báo đang mở.
  - Vì sao không chỉ dùng một lớp: chỉ có chỉ mục thì va chạm gây lỗi 2601, với `XACT_ABORT` sẽ hủy cả lô số đo; chỉ có khóa thì không chặn được ghi vòng qua SP.

### Bắt buộc, trên ranh giới cắt (mục 6)

- **BirdCounts**: CountId INT, CameraId→Devices, WindowStart DATETIME2(0), InCount INT, OutCount INT.
  - UQ(CameraId, WindowStart); CK số đếm ≥ 0.
  - CK WindowStart đúng mốc 5 phút: `DATEPART(MINUTE, WindowStart) % 5 = 0 AND DATEPART(SECOND, WindowStart) = 0`.
  - "CameraId là thiết bị CAMERA" không viết được bằng CHECK (cần đọc bảng khác) → SP kiểm tra.
  - Chỉ lưu số tổng hợp theo cửa sổ 5 phút, không lưu video.

### Dưới ranh giới cắt (mục 10)

- **Harvests**: HarvestId INT, ZoneId→Zones, HarvestDate **DATE**, NestCount INT, WeightGram DECIMAL(9,1), Grade CHAR(1)?, RecordedBy→Users, CreatedAt.
  - UQ(ZoneId, HarvestDate); CK Grade ∈ {A, B, C}; CK NestCount, WeightGram ≥ 0.
  - **HarvestDate là ngày theo giờ Việt Nam** — ngày nghiệp vụ do người nhập, không phải mốc thời gian; ngoại lệ có chủ ý của quy ước UTC.

### Nên có

- **NestLogs**: PK(ZoneId, WeekStart DATE — thứ Hai, giờ Việt Nam), ActiveNests INT, NewNests INT, Note NVARCHAR(500)?.

### Đã loại (YAGNI)

Vai trò STAFF và bảng thành viên nhà; tọa độ nhà yến; bảng lưu thông báo đã gửi; bảng phiên đăng nhập (dùng JWT); lưu video.

### Quyết định thiết kế

1. **`Alerts.HouseId` dư thừa có chủ ý** (không đạt 3NF chặt khi đã có ZoneId): cảnh báo giảm đàn là cấp nhà, không có khu vực; mọi truy vấn cảnh báo lọc theo nhà. Tính nhất quán do **khóa ngoại ghép** đảm bảo, không phụ thuộc SP. Ghi vào báo cáo như một đánh đổi.
2. **Alerts là một bảng chung**, cột riêng từng loại ràng buộc bằng CHECK theo AlertType; không tách bảng con vì 4 loại chung vòng đời NEW → ACK → RESOLVED và chung màn hình.
3. **Khóa ngoại `NO ACTION`**: giữ lịch sử, tránh lỗi "multiple cascade paths".
4. **Quyền sở hữu** theo chuỗi `Devices → Zones → Houses.OwnerId`; backend kiểm tra OWNER trước khi gọi SP, SP không kiểm tra quyền.

## Phần 3 — Stored procedure, trigger, view (đã duyệt)

### Quy ước chung

- **Mỗi SP trả đúng 1 tập kết quả.** Danh sách lồng (VD cảnh báo mới) là một **cột** JSON của dòng tóm tắt.
- **`FOR JSON` chỉ dùng trong truy vấn con** trả về như một cột: `(SELECT … FOR JSON PATH) AS NewAlertsJson`. Không đặt `FOR JSON` ở tầng ngoài cùng — SQL Server cắt kết quả thành nhiều dòng (~2033 ký tự/dòng), client chỉ đọc dòng đầu sẽ nhận JSON hỏng. Test phải kiểm với lô lớn (Phần 4).
- **Cột JSON do SP trả** (hợp đồng với backend — integration-contract 4.2):
  - Luôn `FOR JSON PATH, INCLUDE_NULL_VALUES` — mặc định `FOR JSON` **bỏ khóa có giá trị NULL**, trái quy ước "không bỏ trường" của hợp đồng. Một đối tượng đơn (`AlertJson`) thêm `WITHOUT_ARRAY_WRAPPER`.
  - Cột thời gian trong JSON ghi **có hậu tố `Z`**: `CONCAT(CONVERT(CHAR(19), col, 126), 'Z')` — mặc định `FOR JSON` ghi `DATETIME2` không có `Z`, client sẽ hiểu là giờ địa phương.
  - **Danh sách trường cảnh báo** (dùng chung cho `NewAlertsJson`, `AlertJson`): `AlertId, HouseId, ZoneId, DeviceId, AlertType, Severity, MetricCode, Value, DetectedClass, Confidence, HasSnapshot, Message, Status, CreatedAt` (14 khóa; `HasSnapshot` = `CAST(CASE WHEN SnapshotPath IS NOT NULL THEN 1 ELSE 0 END AS BIT)`). Không có `SnapshotPath` (ảnh lấy qua endpoint riêng).
- Mỗi SP bắt đầu bằng `SET NOCOUNT ON; SET XACT_ABORT ON;`.
- Mọi thay đổi trên `Alerts` chỉ qua SP/trigger; Prisma chỉ đọc bảng này.
- **SP hệ thống** (`sp_IngestReadings`, `sp_CreatePredatorAlert`, `sp_DetectAnomalies`, `sp_RecordHeartbeat`) đặt `SESSION_CONTEXT` UserId/Note = NULL trước khi ghi `Alerts`, để trigger không nhận nhầm người thao tác còn sót trên kết nối dùng lại trong pool.
- SP không kiểm tra quyền sở hữu nhà; backend kiểm tra trước khi gọi.
- Kết quả AI đi qua backend → mọi SP nhận dữ liệu AI do backend gọi.

### Mã lỗi (`THROW`)

Backend đổi thành HTTP 400/409.

| Mã | Ý nghĩa |
|---|---|
| 50001 | `@Source` không phải AUTO/MANUAL |
| 50002 | Điều khiển MANUAL thiếu `@UserId` |
| 50003 | Thiết bị không tồn tại, ngừng dùng hoặc không phải cơ cấu chấp hành |
| 50010 | Camera không tồn tại, ngừng dùng hoặc không phải CAMERA |
| 50012 | Số đếm chim âm |
| 50013 | Loài thiên địch không thuộc {rat, snake, owl} |
| 50014 | `windowStart` không đúng mốc 5 phút |
| 50020 | Cảnh báo không tồn tại |
| 50021 | Chuyển trạng thái cảnh báo không hợp lệ |
| 50030 | Chuỗi JSON không hợp lệ |
| 50040 | `@BucketMinutes` ≤ 0 |
| 50041 | Khoảng thời gian/ngày không hợp lệ (From ≥ To) |
| 50042 | Tham số ngoài miền cho phép (kể cả vượt 2000 bucket) |

### SP (theo thứ tự ưu tiên trong roadmap)

**Mục 2 — `sp_IngestReadings(@Json NVARCHAR(MAX), @StaleMinutes = 2)`** — xong 20/10

- Đầu vào: `[{"device":"H1-F1-SENSOR","metric":"TEMP","value":28.5,"at":"2026-10-12T10:40:00Z"}, ...]`. JSON sai → 50030.
- **Khử trùng hai tầng:** trùng trong lô lọc bằng `ROW_NUMBER`; trùng với bảng lọc bằng `NOT EXISTS` trên UQ(DeviceId, MetricCode, RecordedAt). Dòng trùng tính vào `Duplicates`, không báo lỗi.
- Loại bỏ (không lỗi), tính vào `Rejected`: thiết bị không tồn tại / không phải SENSOR / `IsActive = 0`; giá trị ngoài [ValidMin, ValidMax]; `at` lớn hơn hiện tại quá 5 phút.
- Trong 1 transaction:
  1. Chèn bản ghi hợp lệ.
  2. Cập nhật `LastSeenAt`; đặt `Status = ONLINE` **chỉ khi đang khác ONLINE** (không kích hoạt trigger thừa).
  3. **Bỏ qua số đo cũ khi xét cảnh báo:** số đo có `at` cũ hơn `@StaleMinutes` phút (mặc định 2, ≤ 0 → 50042) so với hiện tại **vẫn được lưu** ở bước 1 nhưng **không dùng để mở hoặc đóng cảnh báo ngưỡng** — lô bù đến muộn (simulator gửi lại sau mất kết nối) không mở/đóng cảnh báo theo trạng thái đã qua. Lô toàn số đo cũ → không xét cảnh báo.
  4. Lấy giá trị mới nhất của mỗi (khu vực, chỉ số) **trong các số đo không cũ** của lô, so với Thresholds. Đọc cảnh báo đang mở với `UPDLOCK, HOLDLOCK`, duyệt theo thứ tự (ZoneId, MetricCode).
     - **Mở** khi giá trị ra ngoài [Min, Max] và chưa có THRESHOLD đang mở. Lệch > 10% so với ngưỡng bị vượt = CRITICAL, còn lại WARNING.
     - **Đóng** (tự động, người thao tác = hệ thống) khi giá trị vào **vùng đóng**:

       | Ngưỡng có | h | Mở khi | Vùng đóng |
       |---|---|---|---|
       | Min và Max | `CASE WHEN Hysteresis < (Max − Min) / 4 THEN Hysteresis ELSE (Max − Min) / 4 END` | < Min hoặc > Max | [Min + h, Max − h] |
       | Chỉ Max (VD CO2, LIGHT) | `Hysteresis` | > Max | ≤ Max − h |
       | Chỉ Min | `Hysteresis` | < Min | ≥ Min + h |

       Giới hạn h ≤ (Max − Min)/4 khi có cả hai đầu để vùng đóng không bao giờ rỗng.
     - Giá trị nằm giữa ngưỡng và vùng đóng: giữ nguyên trạng thái — **chống cảnh báo nhấp nháy** khi giá trị dao động quanh ngưỡng.
- Trả 1 dòng: `Received, Accepted, Duplicates, Rejected, AcceptedJson, NewAlertsJson, ResolvedAlertIdsJson`. `ResolvedAlertIdsJson` gồm cảnh báo ngưỡng tự đóng và (mục 11) `DEVICE_OFFLINE` do trigger đóng khi thiết bị về ONLINE.
  - **`AcceptedJson`**: mảng các số đo **đã chèn** trong lần gọi này (không gồm dòng trùng/bị loại): `DeviceId, DeviceCode, HouseId, ZoneId, MetricCode, Value, RecordedAt` — backend dùng để phát `readings.new` vào đúng phòng nhà.

**Mục 3 — `sp_SetActuator(@DeviceId, @IsOn, @Level = NULL, @Source, @Mode = NULL, @UserId = NULL, @Reason = NULL)`** — xong 20/10

- Khóa dòng thiết bị (`UPDLOCK`). Lệnh AUTO bị bỏ qua khi thiết bị đang MANUAL. MANUAL kèm `@Mode = 'AUTO'` = trả quyền cho bộ điều khiển.
- Trạng thái không đổi → không ghi gì. Có thay đổi → cập nhật Devices + ghi ControlLogs trong 1 transaction.
- Trả 1 dòng: `Changed, DeviceCode, Mode, IsOn, Level`. Backend dùng `DeviceCode` để publish MQTT, chỉ publish khi `Changed = 1`.
- **Nếu còn thời gian:** ghi đè MANUAL tự hết hạn sau một khoảng cấu hình được (trả về AUTO).

**Mục 4 — `sp_UpdateAlertStatus(@AlertId, @Status, @UserId, @Note = NULL)`**

- Chỉ cho NEW → ACK, NEW → RESOLVED, ACK → RESOLVED; RESOLVED thì điền `ResolvedAt`, `ResolvedBy`.
- Đặt `SESSION_CONTEXT` (UserId, Note) cho trigger rồi **xóa ngay sau đó, kể cả khi lỗi** — kết nối được dùng lại trong pool.
- Trả: dòng cảnh báo sau cập nhật.

**Mục 5 — `sp_GetReadingHistory(@ZoneId, @MetricCode, @FromUtc, @ToUtc, @BucketMinutes = 60)`**

- Trả nhiều dòng: `BucketUtc, AvgValue, MinValue, MaxValue`. Điều kiện thời gian so trực tiếp với cột (SARGable).
- Số bucket `(To − From) / BucketMinutes` **tối đa 2000**, vượt → 50042.

**Mục 6 — `sp_RecordBirdCount(@Json)`**

- Đầu vào: AI (qua backend) gửi **tổng của cả cửa sổ**: `[{"camera":"H1-F0-CAMERA","windowStart":"2026-10-12T10:00:00Z","in":5,"out":1}, ...]`. Được gửi tổng tạm khi cửa sổ chưa đóng; lần sau thay lần trước.
- Upsert (`UPDLOCK, SERIALIZABLE`) theo (CameraId, WindowStart), **lấy giá trị lớn hơn cho từng cột** bằng `CASE WHEN` (không dùng `GREATEST` — xem Phần 1): `InCount = CASE WHEN mới.InCount > cũ.InCount THEN mới.InCount ELSE cũ.InCount END`, tương tự `OutCount`:
  - **Idempotent:** gửi lại cùng tin bao nhiêu lần cũng đúng.
  - Chặn giảm số khi MQTT giao lại tin tổng tạm cũ sau tin mới, hoặc AI khởi động lại giữa cửa sổ gửi tổng nhỏ hơn.
  - **Giới hạn đã chấp nhận:** AI khởi động lại giữa cửa sổ → thiếu phần đếm trước khởi động lại của cửa sổ đó (≤ 1 cửa sổ 5 phút mỗi lần). AI không phải lưu trạng thái cửa sổ. Ghi rõ trong `integration-contract`.
  - Không sửa giảm được số đã ghi — chấp nhận vì số đếm trong một cửa sổ chỉ tăng.
- Cả lô nguyên tử: camera không hợp lệ → 50010, số âm → 50012, `windowStart` sai mốc → 50014.
- Trả 1 dòng: `WindowsUpserted, WindowsUnchanged`.

**Mục 7 — `sp_CreatePredatorAlert(@Json, @MinConfidence = 0.5, @CooldownMinutes = 5)`**

- Đầu vào: `{"camera":"H1-F0-CAMERA","class":"snake","confidence":0.87,"snapshot":"snapshots/2026/10/12/H1-F0-CAMERA_104000.jpg","at":"2026-10-12T10:40:00Z"}`. Ảnh do backend lưu; SP chỉ giữ đường dẫn.
- Bỏ qua nếu độ tin cậy < ngưỡng, hoặc cùng loài trên cùng camera đã báo trong `@CooldownMinutes` (kiểm tra với `UPDLOCK, HOLDLOCK` — hai phát hiện đồng thời không tạo hai cảnh báo).
- ZoneId, HouseId lấy theo camera. Loài lạ → 50013, camera không hợp lệ → 50010.
- Trả 1 dòng: `Created, AlertId, SkipReason, AlertJson` (`SkipReason` ∈ `LOW_CONFIDENCE` / `COOLDOWN` / NULL). `AlertJson` = đối tượng cảnh báo vừa tạo theo danh sách trường chung (NULL khi `Created = 0`) — backend phát `alert.created` không phải đọc lại.

**Mục 8 (giảm đàn) và 11 (OFFLINE) — `sp_DetectAnomalies(@OfflineMinutes = 5, @DropPercent = 20, @CutoffHourVn = 20, @NowUtc = NULL)`** — backend gọi mỗi phút

- **Giảm đàn (mục 8):**
  - Chỉ đánh giá khi giờ Việt Nam hiện tại ≥ `@CutoffHourVn`; trước đó không đánh giá → không báo giả buổi sáng.
  - **So cùng khung giờ:** tổng `InCount` hôm nay từ 00:00 đến giờ chốt (giờ Việt Nam) so với trung bình tổng cùng khung 00:00 → giờ chốt của 7 ngày trước. Thấp hơn quá `@DropPercent` → `POPULATION_DROP` (CRITICAL).
  - Tối đa 1 cảnh báo/nhà/ngày. Bỏ qua nếu nhà có < 3 ngày dữ liệu trong 7 ngày trước.
- **OFFLINE (mục 11, dưới ranh giới cắt):** thiết bị `IsActive = 1` có `LastSeenAt` quá `@OfflineMinutes` → đánh dấu OFFLINE.
- `@NowUtc` (mặc định `SYSUTCDATETIME()`) để kiểm thử theo giờ. `@DropPercent` ngoài (0, 100) hoặc `@CutoffHourVn` ngoài [0, 23] → 50042.
- Trả 1 dòng: `NewAlertsJson` — gồm cả cảnh báo `DEVICE_OFFLINE` do `trg_Devices_Status` tạo khi SP đánh dấu OFFLINE (SP đọc lại các cảnh báo tạo trong lần gọi này của các thiết bị vừa đánh dấu).

**Mục 11 (dưới ranh giới cắt) — `sp_RecordHeartbeat(@Json)`** — tín hiệu sống của thiết bị không phải cảm biến (cơ cấu chấp hành qua MQTT, camera qua AI); backend gọi.

- Đầu vào: `[{"device":"H1-F1-FAN","at":"2026-10-12T10:40:00Z"}, ...]`. JSON sai → 50030.
- `LastSeenAt` = giá trị lớn hơn giữa cũ và `at` (`CASE WHEN`, không `GREATEST`); `Status = ONLINE` chỉ khi đang khác ONLINE (trigger tự đóng `DEVICE_OFFLINE`).
- Thiết bị không tồn tại / `IsActive = 0` / `at` lớn hơn hiện tại quá 5 phút → bỏ qua, tính vào `Rejected`, không lỗi.
- Đặt `SESSION_CONTEXT` UserId/Note = NULL trước khi cập nhật (như các SP hệ thống khác).
- Trả 1 dòng: `Accepted, Rejected, ResolvedAlertIdsJson` — `ResolvedAlertIdsJson` chứa các `DEVICE_OFFLINE` trigger vừa tự đóng (cùng dạng với `sp_IngestReadings`), để backend phát `alert.updated`.
- Nếu mục 11 bị cắt: không có SP này; web/mobile **ẩn trạng thái online** của cơ cấu chấp hành và camera thay vì hiện OFFLINE sai (cột Status mặc định OFFLINE).

**Mục 10 (dưới ranh giới cắt) — `sp_Report_EnvStabilityVsYield(@HouseId, @FromVnDate, @ToVnDate)`**

- Trả nhiều dòng theo khu vực × tháng: `AvgTemp, StdevTemp, AvgHumid, StdevHumid, PctInRange, NestCount, WeightGram`. From ≥ To → 50041.

### Trigger

| Tên | Mục | Hành vi |
|---|---|---|
| `trg_Alerts_History` | 4 | AFTER INSERT, UPDATE trên Alerts. Ghi AlertHistory khi cảnh báo được tạo hoặc đổi Status. **Viết theo tập hợp** (`inserted` ⋈ `deleted`). Người thao tác/ghi chú lấy từ `SESSION_CONTEXT('UserId'/'Note')`; NULL = hệ thống. |
| `trg_Devices_Status` | 11 (dưới ranh giới cắt) | AFTER UPDATE trên Devices. Thoát ngay nếu `NOT UPDATE(Status)`. Theo tập hợp: chỉ xử lý dòng có `deleted.Status <> inserted.Status`. ONLINE → OFFLINE/ERROR: tạo `DEVICE_OFFLINE` (ERROR = CRITICAL, OFFLINE = WARNING), điền DeviceId, ZoneId, HouseId theo thiết bị. Về ONLINE: tự đóng `DEVICE_OFFLINE` đang mở. |

**Dự phòng nếu R1 xảy ra:** bỏ `trg_Devices_Status`; `sp_DetectAnomalies` tạo cảnh báo khi đánh dấu OFFLINE, `sp_IngestReadings` và `sp_RecordHeartbeat` tự đóng khi thiết bị gửi dữ liệu/tín hiệu sống trở lại. `trg_Alerts_History` không bị ảnh hưởng vì Alerts chỉ ghi qua SP.

### View

| Tên | Mục | Nội dung |
|---|---|---|
| `vw_LatestReadings` | 5 | Giá trị mới nhất mỗi chỉ số × cảm biến, kèm tên nhà/khu vực, trạng thái thiết bị (`CROSS APPLY TOP 1`). Không chọn `ReadingId`. |
| `vw_OpenAlerts` | 5 | Cảnh báo chưa đóng, kèm tên nhà/khu vực. |
| `vw_DailyEnvStats` | 5 | Avg/Min/Max theo khu vực × chỉ số × ngày giờ Việt Nam. |
| `vw_DailyBirdFlow` | 6 | Số chim ra/về/chênh lệch theo nhà × ngày giờ Việt Nam. |

## Phần 4 — Chỉ mục, dữ liệu mẫu, kiểm thử (đã duyệt)

### 4.1 Chỉ mục

**SensorReadings**

- PK `ReadingId` **nonclustered**; **clustered index trên `RecordedAt`** — ghi nối đuôi theo thời gian, hợp truy vấn theo khoảng, dễ phân vùng sau này. Phụ thuộc R4.
- `UQ(DeviceId, MetricCode, RecordedAt)` — chống trùng, phục vụ lịch sử và giá trị mới nhất.
- **Không có `INCLUDE (Value)` trong core** (Prisma không biểu diễn được; viết tay vướng R2; lịch sử 24 giờ chỉ vài nghìn dòng nên key lookup chấp nhận được). Thêm `INCLUDE (Value)` là **bài demo trước/sau của `database-advanced`**: plan có Key Lookup → thêm INCLUDE → lookup biến mất, đo trên vài triệu dòng.

**Bảng khác**

| Chỉ mục | Khai báo | Phục vụ |
|---|---|---|
| `Alerts(HouseId, Status, CreatedAt DESC)` | Prisma | Danh sách cảnh báo theo nhà |
| `UX_Alerts_OpenThreshold` (unique có lọc, Phần 2) | Viết tay trong migration (R2) | Chống mở trùng + dò cảnh báo đang mở trong `sp_IngestReadings` |
| `Alerts(DeviceId, AlertType, DetectedClass, CreatedAt DESC)` | Prisma | Kiểm tra cooldown thiên địch |
| `ControlLogs(DeviceId, CreatedAt DESC)` | Prisma | Lịch sử điều khiển |
| `Devices(ZoneId)`, `AlertHistory(AlertId)` | Prisma | Khóa ngoại được join từ phía cha (Prisma không tự tạo trên SQL Server) |

- Khóa ngoại tới bảng tra (`MetricCode`, `UserId` trong nhật ký) không đánh chỉ mục: không truy vấn/xóa từ phía cha.
- `Houses(OwnerId)`, `Zones(HouseId)`, BirdCounts, Harvests đã có chỉ mục từ UQ.

### 4.2 Dữ liệu mẫu

- **Cố định:** sinh bằng công thức xác định (VD nhiệt độ = 28 + 1,5·sin(giờ)), không `RAND()`/`NEWID()`; theo tập hợp, không vòng lặp; bảng số sinh bằng `CROSS JOIN` (không `GENERATE_SERIES`).
- **Neo theo `@AnchorDateVn`**, mặc định `2026-10-12`. Cùng ngày neo → mọi máy ra cùng dữ liệu; test luôn dùng mặc định. Dữ liệu kết thúc **20:00 ngày neo (giờ Việt Nam)**. Demo trực tiếp: neo = **hôm qua**, để mọi dữ liệu mẫu nằm trong quá khứ; simulator nối tiếp từ hôm nay.
- **Mật khẩu:** seed chỉ chứa **hash bcrypt tính sẵn** của một mật khẩu dev tạm. README ghi mật khẩu dev đó và ghi rõ **chỉ dùng phát triển, không dùng mật khẩu thật**.

| Nhóm | Nội dung |
|---|---|
| Người dùng | `admin` (ADMIN), `owner1`, `owner2` (OWNER — test cách ly giữa các chủ) |
| Nhà, khu vực | **H1** (owner1): F0 lối vào + F1–F3 = **4 tầng**. **H2** (owner2): F0 + F1 = **2 tầng** |
| Thiết bị | Mỗi tầng: SENSOR, MIST, FAN, HEATER; mỗi nhà: 1 SPEAKER, 1 CAMERA ở F0 → H1 18, H2 10, **tổng 28** |
| Chỉ số | TEMP (Hysteresis 0,5 °C), HUMID (2 %), CO2 (50 ppm), LIGHT (2 lux) |
| Ngưỡng (mọi khu vực) | TEMP 26–30, đích 28; HUMID 75–90, đích 82; CO2 chỉ Max 1000; LIGHT chỉ Max 10 |
| Số đo | **6 cảm biến** × 4 chỉ số, mỗi 5 phút, từ 00:00 ngày neo−7 đến 20:00 ngày neo: 7 × 288 + 240 = 2256 mốc × 24 chuỗi = **54.144 dòng**. H1-F2 có đoạn nóng 13:00–15:00 ngày neo−2; H1-F3 HUMID giảm dần, xuống dưới 75 lúc 14:00 ngày neo (74,97 %), cuối dữ liệu ở 72 % |
| Đếm chim | 8 ngày, cửa sổ 5 phút; ra 05:00–07:00, về 17:00–19:30 (giờ Việt Nam). H1 bình thường; **H2 ngày neo về ít hơn 40 %** → `sp_DetectAnomalies @NowUtc = <ngày neo 20:30 VN>` tạo `POPULATION_DROP` |
| Cảnh báo | H1-F2 TEMP THRESHOLD **RESOLVED** (đoạn nóng, đóng bởi hệ thống); H1-F3 HUMID THRESHOLD **NEW** (tạo lúc 14:00 ngày neo, khớp số đo đầu tiên dưới ngưỡng 74,97 %; số đo cuối 72 % vẫn ngoài ngưỡng nên chưa đóng); PREDATOR snake ở H1-F0 **ACK** bởi owner1 (đường dẫn ảnh mẫu); kèm AlertHistory. Hai cảnh báo THRESHOLD khác (khu vực, chỉ số) và chỉ một đang mở → **thỏa `UX_Alerts_OpenThreshold`** |
| Thu hoạch (mục 10) | 3 tháng cho H1, **file seed riêng** để bỏ được nếu cắt |

- Seed ghi `Alerts` qua SP khi có SP phù hợp (`sp_CreatePredatorAlert`, `sp_UpdateAlertStatus`); cảnh báo ngưỡng lịch sử được chèn trực tiếp (ngoại lệ có chủ ý của seed, chạy bằng `db_owner`; trigger vẫn sinh AlertHistory).

### 4.3 Kiểm thử

`npm test` = `deploy.ps1 -Database SwiftletCare_Test -Reset` → `sqlcmd -b` chạy lần lượt các file:

| File | Kiểm |
|---|---|
| `tests/deploy-guard.ps1` | `deploy.ps1 -Database SwiftletCare -Reset` (và tên không kết thúc `_Test`/`_Dev`) thoát mã khác 0, CSDL không bị đụng tới |
| `tests/constraints.test.sql` | Chèn dữ liệu vi phạm từng CHECK / UQ / khóa ngoại (kể cả khóa ngoại ghép Alerts → Zones, CHECK mốc 5 phút) → lỗi 547 / 2627 / 2601 |
| `tests/seed.test.sql` | Không có hai cảnh báo THRESHOLD đang mở trùng (ZoneId, MetricCode); số dòng từng bảng đúng như 4.2 (VD 54.144 số đo, 28 thiết bị); cảnh báo NEW khớp số đo cuối ngoài ngưỡng |
| `tests/sp_<tên>.test.sql` | Mỗi SP: ca đúng + từng mã lỗi của SP đó |
| `tests/sp_json-columns.test.sql` | `AcceptedJson` chỉ chứa dòng đã chèn (lô có dòng trùng và dòng bị loại → không xuất hiện); `NewAlertsJson`, `AlertJson` có **đủ 14 khóa** của danh sách trường cảnh báo, **kể cả khóa giá trị NULL** (VD `DetectedClass` của THRESHOLD); mọi mốc thời gian trong JSON kết thúc bằng `Z`; `AlertJson` NULL khi `Created = 0` |
| `tests/sp_IngestReadings.test.sql` (thêm) | Khử trùng trong lô và với bảng; **lô 1000 số đo** làm nhiều khu vực vượt ngưỡng → `NewAlertsJson` > 2033 ký tự, SP trả **đúng 1 dòng**, `ISJSON(NewAlertsJson) = 1`; **hysteresis**: TEMP 30,2 → 29,8 → 29,4 với Max 30, h 0,5 → mở, vẫn mở ở 29,8, đóng ở 29,4; ngưỡng chỉ Max (CO2 1050 → 980 → 940, h 50 → đóng ở 940) |
| `tests/sp_IngestReadings.test.sql` (lô bù đến muộn) | Lô có `at` = hiện tại − 10 phút, TEMP 35 (ngoài ngưỡng) → `Accepted` đúng, số đo có trong bảng, **không mở cảnh báo**; khi đang có cảnh báo mở, lô cũ mang giá trị trong vùng đóng → **không đóng**; lô trộn số đo cũ (ngoài ngưỡng) và mới (trong ngưỡng) → chỉ số đo mới được xét; `@StaleMinutes = 0` → 50042 |
| `tests/sp_RecordHeartbeat.test.sql` (mục 11) | Cập nhật `LastSeenAt`, `Status` OFFLINE → ONLINE; `at` cũ hơn `LastSeenAt` → giữ giá trị lớn hơn; thiết bị lạ / ngừng dùng → `Rejected`, không lỗi; về ONLINE → `DEVICE_OFFLINE` vừa đóng nằm trong `ResolvedAlertIdsJson` |
| `tests/sp_RecordBirdCount.test.sql` (thêm) | Gửi lại cùng tin → không đổi; gửi tổng nhỏ hơn → giữ số lớn; mỗi cột lấy lớn hơn độc lập |
| `tests/trg_Alerts_History.test.sql` | Tạo cảnh báo → đúng 1 dòng AlertHistory (OldStatus NULL, NewStatus NEW, UserId NULL); `sp_UpdateAlertStatus` ACK với UserId 2, Note `N'x'` → thêm đúng 1 dòng với UserId 2, Note `N'x'`; **sau đó `SESSION_CONTEXT(N'UserId')` và `(N'Note')` là NULL**; chuyển trạng thái sai → lỗi 50021, AlertHistory không thêm dòng, **SESSION_CONTEXT vẫn NULL**; một lệnh UPDATE đổi 2 cảnh báo → đúng 2 dòng (trigger theo tập hợp) |

Khóa đồng thời (hai phiên) không test ở đây — `sqlcmd` chỉ có một phiên; kịch bản hai phiên thuộc `database-advanced`.

## Rủi ro cần kiểm chứng

Kiểm chứng ở bước lập kế hoạch, trước khi triển khai phần liên quan.

| # | Rủi ro | Cách kiểm | Nếu xảy ra |
|---|---|---|---|
| R1 | Prisma `create`/`update` trên SQL Server sinh `OUTPUT INSERTED` không kèm `INTO`; SQL Server từ chối với bảng có trigger (`Alerts`, `Devices`). | Tạo bảng thử có trigger, gọi `prisma.x.create()` / `update()`. | Quy ước chỉ ghi các bảng có trigger qua SP; dự phòng của `trg_Devices_Status` ở Phần 3. |
| R2 | Chỉ mục lọc (`UX_Alerts_OpenThreshold`) và SQL viết tay khác trong migration bị `prisma migrate dev` coi là lệch (drift) so với schema. | Thêm chỉ mục lọc vào migration, chạy lại `prisma migrate dev`, xem có đòi reset hoặc sinh lệnh xóa không. | Đưa phần đó ra file `.sql` chạy sau migrate, ghi rõ ngoại lệ. |
| R3 | `$queryRaw` chỉ đọc tập kết quả đầu tiên của SP. | Gọi một SP thử trả 2 tập kết quả. | Đã phòng sẵn bằng quy ước một tập kết quả / SP. |
| R4 | Prisma không hỗ trợ thuộc tính `clustered` cho `@id`/`@@index` trên SQL Server. | Khai báo `@id(clustered: false)` + `@@index([recordedAt], clustered: true)`, chạy `prisma migrate dev --create-only`, đọc SQL sinh ra. | Viết tay phần clustered/nonclustered vào migration (cơ chế Phần 1). |
| R5 | Prisma không chấp nhận quan hệ ghép `Alerts(ZoneId, HouseId) → Zones(ZoneId, HouseId)` có một cột tùy chọn (ZoneId) và một cột bắt buộc (HouseId), hoặc dùng chung cột HouseId với quan hệ tới Houses. | Khai báo quan hệ trong `schema.prisma`, chạy `prisma validate` và `prisma migrate dev --create-only`, xem SQL sinh ra. | Viết khóa ngoại ghép bằng SQL tay trong migration (theo cơ chế Phần 1); nếu tiếp tục lệch theo R2 thì xử lý như R2. |
| R6 | Giá trị `DATETIME2` (không mang múi giờ) bị đọc/ghi lệch 7 giờ theo giờ máy. Đã tra: Prisma 7 kết nối SQL Server qua driver adapter `@prisma/adapter-mssql`, adapter này bọc thư viện `mssql` (chạy trên `tedious`); tùy chọn `options.useUTC` của `mssql`/`tedious` quyết định cách hiểu `DATETIME2`. | Ghi `2026-10-12T10:00:00Z` qua `sp_IngestReadings`, đọc lại bằng Prisma và bằng `sqlcmd`: Prisma phải trả `2026-10-12T10:00:00.000Z`, `sqlcmd` phải hiện `2026-10-12 10:00:00`. Thêm thành test tích hợp ở backend. | Backend dùng `mssql` (qua adapter) → khai báo **`options.useUTC: true`** tường minh trong cấu hình adapter; `.env.example` ghi chú dòng này kèm lý do. Nếu nhóm dùng Prisma 6 (engine Rust, không có `useUTC`) thì chỉ giữ bước kiểm tra trên. **Chốt phiên bản Prisma 7** trong `package.json`. |
