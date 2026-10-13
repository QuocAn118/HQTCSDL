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
| ai-vision | Header **`X-Service-Key`** (khóa dịch vụ trong `.env`), không dùng JWT người dùng |
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
2. Repo có cấu hình mẫu `infra/mosquitto/mosquitto.conf` (**không chứa mật khẩu**): `listener 1883`, `allow_anonymous false`, `password_file` trỏ tới `infra/mosquitto/passwd` (file này nằm trong `.gitignore`).
3. Tạo hai tài khoản:
   ```powershell
   mosquitto_passwd -c infra/mosquitto/passwd backend
   mosquitto_passwd infra/mosquitto/passwd simulator
   ```
   Mật khẩu ghi vào `.env` của backend và simulator.
4. Chạy: `mosquitto -c infra/mosquitto/mosquitto.conf -v`.
5. Kiểm tra: `mosquitto_sub -u backend -P <mật khẩu> -t 'swiftlet/#' -v` kết nối được; thử không tài khoản phải bị từ chối.
