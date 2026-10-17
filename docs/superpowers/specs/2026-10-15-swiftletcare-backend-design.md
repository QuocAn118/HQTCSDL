# SwiftletCare — backend: NestJS nối MQTT, AI, web, mobile với SQL Server

- **Ngày:** 2026-10-15
- **Trạng thái:** Đã duyệt
- **Chủ module:** TV2
- **Nguồn:** [Roadmap](2026-10-12-swiftletcare-roadmap.md) · [database-core](2026-10-12-swiftletcare-database-core-design.md) · [integration-contract](2026-10-13-swiftletcare-integration-contract-design.md) · [ai-vision](2026-10-15-swiftletcare-ai-vision-design.md)

## Phần 1 — Phạm vi, mức ưu tiên, mốc, hạn chế (đã duyệt)

### 1.1 Mục tiêu

Backend NestJS là cầu nối duy nhất giữa simulator (MQTT), ai-vision (HTTP), web và mobile (REST + Socket.IO) với SQL Server. **Nghiệp vụ dữ liệu nằm trong SP/trigger/view** của database-core; backend chỉ:

- Kiểm tra đầu vào, gọi SP, đổi dữ liệu thành JSON đúng hợp đồng, phát sự kiện.
- Chạy **vòng điều khiển theo luật**: logic nghiệp vụ duy nhất nằm ở backend.

Mọi giao diện bên ngoài (topic, endpoint, sự kiện, mã lỗi, fixture) **đã chốt trong integration-contract**; spec này dẫn lại, không tự đổi. Thay đổi cần thiết liệt kê ở Phần 7 và đi qua PR hợp đồng.

### 1.2 Mức ưu tiên

Trong spec này, **"mục X của backend"** đánh số **trùng với danh sách backend trong roadmap** (Phần 4, mục "backend (TV2)"). Không nhầm với số mục của database-core (VD "mục 11 của database-core" = mất kết nối thiết bị).

| Mục của backend (= roadmap backend) | Nội dung | Mức |
|---|---|---|
| 1 | Khung NestJS + Prisma + gọi SP; JWT ADMIN/OWNER; kiểm tra quyền sở hữu nhà | Bắt buộc |
| 2 | MQTT → `sp_IngestReadings` → phát `readings.new` | Bắt buộc |
| 3 | CRUD nhà, khu vực, thiết bị, ngưỡng; quản lý người dùng | Bắt buộc |
| 4 | Vòng điều khiển theo luật → `sp_SetActuator` → publish MQTT; điều khiển tay | Bắt buộc |
| 5 | Cảnh báo: đọc, ACK/RESOLVED, phát sự kiện | Bắt buộc |
| 6 | Endpoint AI → `sp_RecordBirdCount` / `sp_CreatePredatorAlert`; lưu ảnh | Bắt buộc |
| 7 | Gọi `sp_DetectAnomalies` **mỗi phút**; endpoint admin kiểm tra sụt đàn cho demo | Bắt buộc |
| 8 | API lịch sử số đo và đếm chim | Bắt buộc |
| *Ranh giới cắt* | | |
| 9 | API thu hoạch và báo cáo sản lượng | Dưới ranh giới |
| 10 | Heartbeat (MQTT từ cơ cấu chấp hành, HTTP từ AI) → `sp_RecordHeartbeat`; phát `alert.updated` khi `DEVICE_OFFLINE` tự đóng | Dưới ranh giới |
| — | Giới hạn tần suất đăng nhập (hợp đồng 3.5); điều khiển PID | Nên có |
| — | Email, Zalo; loa bật theo giờ | Nếu còn thời gian |
| — | Thông báo đẩy Expo (chờ spec mobile); chạy nhiều backend cùng lúc; phiên bản hóa API | Ngoài phạm vi |

**Mục 7 và mất kết nối thiết bị:** gọi `sp_DetectAnomalies` mỗi phút là **Bắt buộc** (phần sụt đàn). Phần đánh dấu OFFLINE và tạo `DEVICE_OFFLINE` nằm **trong code của database-core** (mục 11 của database-core: SP + `trg_Devices_Status`); backend chỉ phát lại `NewAlertsJson` mà SP trả. Cắt mục 11 của database-core **không làm đổi lời gọi `sp_DetectAnomalies`** của backend. Riêng mục 10 của backend gọi `sp_RecordHeartbeat` (cũng thuộc mục 11 của database-core), nên cắt mục 11 của database-core thì **cắt luôn mục 10 của backend**.

### 1.3 Mốc (theo roadmap, TV2)

| Mốc | Backend phải có |
|---|---|
| **18/10 (M1)** | Khung NestJS chạy được; bước 1 của plan xong (phiên bản, bcryptjs, import Prisma, Node 25, kết nối lại) |
| **20/10** | database-core giao `sp_IngestReadings`, `sp_SetActuator`; backend nối vào ngay |
| **25/10 (M2)** | Luồng simulator → MQTT → backend → SP → SQL Server → web: mục 1, 2 của backend, phần đọc của mục 3, đăng nhập |
| **Trước 29/10** (đề xuất, roadmap không có) | **Endpoint AI** (mục 6 của backend) xong để TV3 kịp kiểm tra tay đầu-cuối (spec ai-vision 7.5) |
| **01/11 (M3)** | Mục 1–8 của backend chạy đầu-cuối; quyết định giữ/cắt mục 9, 10 |
| Tuần 4 | Sửa lỗi; mục dưới ranh giới nếu còn sức; đo độ trễ cho NV6 |

**Nếu SP của database-core trễ:** mốc 20/10 phụ thuộc TV1 giao `sp_IngestReadings` và `sp_SetActuator` (plan database-core: hết 17/10 mà Task 4–5 chưa xong thì TV1 báo nhóm và chuyển người hỗ trợ). Backend **không đứng chờ**: viết sẵn lớp gọi SP (tên SP, tham số, đọc 1 dòng kết quả theo database-core Phần 3) và test lớp đó bằng **SP giả** (một SP cùng tên, cùng chữ ký, trả dòng kết quả cố định, tạo trong `SwiftletCare_Dev`; không commit vào `database/sql/`). Khi SP thật về, xóa SP giả và chạy lại test.

**Chỉ số thành công của M3:**
1. Chạy hết các chuỗi fixture hợp đồng trên `SwiftletCare_Test` (test hộp đen, Phần 7) đều đạt.
2. Bước kiểm tra tay đầu-cuối của ai-vision (spec ai-vision 7.5) thành công với backend này.

### 1.4 Hạn chế đã biết

1. Backend sập → mất số đo đang gom trong bộ nhớ, tối đa khoảng 1 giây (hợp đồng 2.6).
2. CSDL lỗi lâu → hàng chờ thử lại có giới hạn (`.env`); vượt thì bỏ số đo cũ nhất, ghi log.
3. Khi CSDL lỗi, **thiết bị giữ nguyên trạng thái**, không có lệnh mới.
4. Cảm biến mất kết nối → vòng điều khiển không chạy, **thiết bị giữ nguyên trạng thái**. Nếu cắt mục 11 của database-core thì **không có cảnh báo nào** cho trường hợp này.
5. **Không có thông báo đẩy**: app đã tắt không nhận được cảnh báo. Project.md có nhắc push/email/Zalo; báo cáo nói rõ phần này để lại. Nếu sau này làm: một PR hợp đồng (endpoint đăng ký token) và một PR database-core (bảng `PushTokens`), riêng nhau. Gợi ý cho spec mobile: thông báo cục bộ khi app đang mở (không cần backend).
6. Mỗi nhà tối đa 1 cảnh báo sụt đàn mỗi ngày → endpoint admin **chỉ demo được một lần cho mỗi CSDL**. Muốn làm lại thì **triển khai một CSDL mới**; có trong checklist demo (Phần 7).
7. Một broker chỉ chạy một backend (client id cố định `swiftlet-backend`, hợp đồng 1.7).
8. Điều khiển bật/tắt có vùng trễ, không phải PID. Level chỉ dùng cho FAN (100). Loa chỉ điều khiển tay.
9. Bộ nhớ đệm (giá trị mới nhất, ngưỡng, trạng thái thiết bị) nằm trong một tiến trình; không dùng được cho nhiều tiến trình backend.
10. Phép đo độ trễ không gồm mobile và thông báo đẩy; chỉ tiêu 3–5 giây trên mobile cần phép đo riêng ở spec mobile.

### 1.5 Câu hỏi mở (đã trả lời)

- **Backend chạy trên máy nào khi demo?** Web và mobile truy cập qua mạng LAN, còn độ trễ đo khi mọi thành phần chạy trên cùng một máy. **Trả lời ở 7.4:** một máy demo chạy mọi thành phần trừ mobile.

**Chưa kiểm chứng:**
- Mốc 18/10 có kịp bước 1 của plan không (spec/plan backend viết từ 15/10).
- Mốc "endpoint AI trước 29/10": đề xuất, roadmap không có.
- Cách tạo SP giả trong `SwiftletCare_Dev` mà không đụng file của database-core: viết cụ thể trong plan.

## Phần 2 — Môi trường, phiên bản, cấu trúc thư mục và module, `.env` (đã duyệt)

### 2.1 Phiên bản

Tra bằng `npm view` ngày **15/10/2026**. Mọi gói ghim chính xác (không `^`), commit `package-lock.json`.

| Gói | Bản | Ghi chú |
|---|---|---|
| `@nestjs/core`, `common`, `platform-express`, `websockets`, `platform-socket.io`, `testing` | **11.2.7** | Bản mới nhất nhánh 11; `engines.node >= 20` |
| `@nestjs/cli` | 11.0.24 | |
| `@nestjs/jwt` | 12.0.3 | peerDependencies nhận `@nestjs/common ^11` |
| `@nestjs/schedule` | 12.0.2 | peerDependencies nhận `@nestjs/core`, `@nestjs/common ^11` |
| `prisma`, `@prisma/client`, `@prisma/adapter-mssql` | **7.10.0** | Theo CLAUDE.md |
| `mqtt` | 5.16.1 | |
| `socket.io` | **không cài riêng** | `@nestjs/platform-socket.io@11.2.7` kèm `socket.io` 4.8.3 |
| `socket.io-client` (test, script) | **4.8.3** | Cùng bản server, không dùng 4.8.4 |
| `bcryptjs` | 3.0.3 | |
| `class-validator`, `class-transformer` | 0.15.1, 0.5.1 | |
| `jest`, `ts-jest`, TypeScript | Theo bản `nest new` (CLI 11.0.24) sinh ra, rồi ghim | `ts-jest` 29.4.15 nhận `jest` 29 hoặc 30 |

- **Quy tắc lùi bản:** nếu bước 1 thấy **cảnh báo peer dependency hoặc lỗi** với `@nestjs/jwt` 12 / `@nestjs/schedule` 12 trên NestJS 11 thì **lùi về bản 11 mới nhất** của hai gói đó và ghi lại bản đã dùng vào spec.
- **Không thêm** `@nestjs/config` (dùng `loadConfig()` tự viết, mục 2.3), `pino` (dùng Logger của Nest), `multer` riêng (`platform-express` đã kèm).

**Bước 1 của plan:**
1. `nest new`, ghim phiên bản; kiểm cảnh báo peer.
2. Chạy được trên Node 25; lỗi thì lùi Node LTS 24 theo CLAUDE.md.
3. Import được client Prisma sinh ra ở `database/generated/prisma`; lỗi định dạng module thì sinh client riêng trong `backend/` từ `database/prisma/schema.prisma`.
4. Kiểm tiền tố hash trong seed (`$2a$10$` theo plan database-core) và `bcryptjs.compareSync(<mật khẩu dev ghi trong README database>, <hash thật trong seed>)` trả `true`.
5. Prisma tự kết nối lại sau khi **khởi động lại dịch vụ SQL Server** và sau **`RESTORE`** giữa các chuỗi fixture; không thì backend tự tạo lại client.

### 2.2 Cấu trúc thư mục và module

```
backend/
  package.json  package-lock.json  tsconfig.json  nest-cli.json
  .env.example  .env.test.example  README.md
  src/
    main.ts  app.module.ts
    config/        loadConfig(): đọc + kiểm .env, lỗi chỉ nêu TÊN biến
    db/            PrismaService (adapter mssql, useUTC), cổng sẵn sàng CSDL,
                   sp.ts (mỗi SP một hàm có kiểu), sql-errors.ts (bảng đổi mã lỗi hợp đồng 3.5)
    common/        serialize.ts (đổi kiểu + camelCase), pickers.ts (hàm chọn trường từng loại),
                   lọc lỗi toàn cục, guard JWT / vai trò / X-Service-Key, tra quyền sở hữu
    health/        GET /api/health
    auth/  users/  houses/ (nhà, khu vực, thiết bị, ngưỡng, chỉ số)
    readings/  control/  alerts/  birds/  ai/  admin/  harvests/ (mục 9)
    mqtt/          client, ingest (gom lô + thử lại), publish lệnh, đồng bộ lại
    control-loop/  rules.ts (hàm thuần), bộ nhớ đệm, runner
    realtime/      gateway Socket.IO, hàm phát sự kiện chung (qua serialize)
    scheduler/     nhịp sp_DetectAnomalies mỗi phút, không chạy chồng
    **/*.spec.ts   test Jest cạnh mã (quy ước Nest)
  test-contract/   node --test (*.test.mjs): chạy chuỗi fixture hộp đen
  scripts/         measure-latency.mjs
  results/         CSV đo độ trễ (7.3), commit
  storage/         snapshots/, tmp/   (gitignore)
```

- **Ranh giới:** chỉ `db/sp.ts` gọi SP; chỉ `mqtt/` nói chuyện với broker; chỉ `realtime/` phát Socket.IO; `control-loop/rules.ts` **không import gì từ Nest, Prisma, MQTT**. Module nghiệp vụ đi qua ba cửa đó.
- Schema Prisma **thuộc database-core**; backend chỉ dùng client sinh ra, không sửa schema.
- **`storage/`:** lúc khởi động kiểm `storage/snapshots/` và `storage/tmp/` tồn tại hoặc tạo được, **xóa mọi file trong `storage/tmp/`** của lần chạy trước (hợp đồng 2.4). Không tạo/ghi được thì **dừng** với thông báo nêu thư mục và lý do.

### 2.3 `.env`

`.env.example` (chỉ tên biến; mật khẩu, khóa để trống):

```dotenv
HOST=0.0.0.0
PORT=3000
# Giữ chỗ: cổng web chốt ở spec web (Next.js mặc định cũng là 3000, trùng backend).
# Demo qua LAN: thêm http://<IP LAN máy chạy web>:<cổng>.
CORS_ORIGINS=http://localhost:3001
# Cùng tên biến với database/.env.example
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=SwiftletCare_Dev
DB_USER=swiftlet_dev
DB_PASSWORD=
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=backend
MQTT_PASSWORD=
JWT_SECRET=
AI_SERVICE_KEY=
SNAPSHOT_MAX_BYTES=2097152
INGEST_RETRY_MAX_ITEMS=10000
DEMO_TOOLS=false
# on: nhịp sp_DetectAnomalies mỗi phút chạy; off: tắt (chỉ dùng trong test, Phần 7)
ANOMALY_SCHEDULER=on
```

- **Kết nối CSDL:** backend nhận **từng thành phần** (`DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) và truyền vào `PrismaMssql({...})` để adapter tự dựng kết nối; **không tự ghép chuỗi kết nối** (mật khẩu có thể chứa ký tự đặc biệt). `DATABASE_URL` chỉ dùng cho Prisma CLI ở `database/`.
- **MQTT:** backend dùng tài khoản **`backend`**; test hợp đồng giả lập thiết bị dùng tài khoản **`simulator`** (lấy từ `.env.test`), để ACL của hợp đồng (Nên có) không từ chối.
- **Kiểm lúc khởi động:** `JWT_SECRET`, `AI_SERVICE_KEY` ≥ 32 ký tự; số phải dương; `DEMO_TOOLS` ∈ {`true`, `false`}; `ANOMALY_SCHEDULER` ∈ {`on`, `off`}. Sai thì dừng, thông báo **chỉ nêu tên biến và lý do, không in giá trị** (kể cả `JWT_SECRET`, `AI_SERVICE_KEY`, mật khẩu, chuỗi kết nối).
- **Cố định trong code, không đưa vào `.env`:** JWT hạn 8 giờ (hợp đồng 3.3); client id MQTT `swiftlet-backend` (hợp đồng 2.2); thư mục `backend/storage/` (hợp đồng 2.4); adapter `useUTC: true` (database-core R6); lỗi cấu hình CSDL lặp 5 lần thì dừng (Phần 3).
- `SNAPSHOT_MAX_BYTES=2097152` phải bằng giá trị của ai-vision (spec ai-vision 3.3).
- **`INGEST_RETRY_MAX_ITEMS`** là giới hạn **bộ nhớ của backend, tính theo phần tử số đo**; khác đơn vị với `max_queued_messages` của Mosquitto (tính theo tin).

**`.env.test.example`:** giống trên, khác `DB_NAME=SwiftletCare_Test`, `DEMO_TOOLS=true`, `PORT=3100`, `ANOMALY_SCHEDULER=off`, thêm `DEV_SEED_PASSWORD=` (mật khẩu dev của seed, để đăng nhập tài khoản seed trong test; cùng tên biến plan hợp đồng dùng). Ghi kèm cách tạo `JWT_SECRET` và `AI_SERVICE_KEY`:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Log:** không bao giờ chứa header `Authorization`, `X-Service-Key`, mật khẩu, body của `POST /api/auth/login` hay `reset-password`. Backend không log header hay body request; lỗi chỉ log mã, đường dẫn route, `error.code`.

### 2.4 Test hợp đồng dùng chung broker

- Test hợp đồng dùng **chính Mosquitto trên máy**. Backend của test publish lại lệnh *retained* từ `SwiftletCare_Test`, ghi đè trạng thái simulator đang dùng, nên:
  - **Trước khi test, tắt backend dev và simulator.** Trình chạy kiểm `http://localhost:3000/api/health` phải **không** trả lời; có trả lời thì dừng và báo.
  - Sau khi test, bật lại backend dev: lúc khởi động backend publish lại trạng thái từ `SwiftletCare_Dev` (Phần 3), broker trở về đúng.
  - **README test dặn: không chạy test lúc đang demo hay tập demo.**
- Không dùng broker riêng cổng 1884 (cần thêm file trong `infra/mosquitto/`, thuộc hợp đồng).

**Chưa kiểm chứng:**
- Bộ phiên bản cài được cùng nhau và chạy trên Node 25 (bước 1).
- Bản `jest`, TypeScript mà `nest new` sinh ra.
- Logger có sẵn của Nest 11 có chế độ JSON không; không có thì dùng dạng văn bản.
- Quyền của tài khoản `swiftlet_dev`; quyền tối thiểu cho backend thuộc database-advanced nếu có làm.
- Trình chạy test chỉ phát hiện được backend dev còn chạy; simulator thì không, README phải dặn.
- **Cổng test 3100:** đã tìm trong `docs/superpowers/` (15/10/2026): hợp đồng chỉ nhắc cổng 3000 (mục 3.6) và web `localhost:3001` (ví dụ CORS); chưa thấy nơi nào giả định cổng test. Khi viết plan kiểm lại `contracts/README.md` và `infra/mosquitto/README.md` (chưa tồn tại).

## Phần 3 — Khởi động, kết nối, trạng thái sẵn sàng, `/api/health` (đã duyệt)

### 3.1 Thứ tự khởi động

1. **Cấu hình** (`loadConfig`): sai thì dừng ngay, chỉ nêu tên biến.
2. **`storage/`**: kiểm, dọn `storage/tmp/`; không ghi được thì dừng.
3. **Mở cổng HTTP ngay** để `/api/health` luôn trả lời; endpoint cần CSDL trả **503** tới khi CSDL sẵn sàng (3.3).
4. **CSDL** (nền): `SELECT 1`; lần đầu thành công thì **nạp bộ nhớ đệm**:
   - Giá trị mới nhất mỗi (khu vực, chỉ số) từ `vw_LatestReadings`.
   - Ngưỡng mỗi khu vực và `Hysteresis` mỗi chỉ số (`Metrics`).
   - Trạng thái cơ cấu chấp hành `IsActive = 1` (`Mode`, `IsOn`, `Level`).

   Nạp xong mới tính **CSDL sẵn sàng**. Quy tắc nạp:
   - **Không ghi đè giá trị mới hơn:** mỗi ô (khu vực, chỉ số) chỉ thay khi giá trị nạp có `at` **mới hơn** giá trị đang có; số đo được ghi trong lúc đang nạp vẫn được áp dụng vào bộ nhớ đệm.
   - **Mỗi truy vấn nạp có thời hạn** (đề xuất 10 giây); hết hạn thì tính là chưa sẵn sàng và thử lại theo lịch 3.2, không treo.
5. **MQTT** (song song bước 4): client id `swiftlet-backend`, `clean: false`, tài khoản `backend`, tự kết nối lại (mqtt.js). Mỗi lần kết nối:
   - Subscribe `swiftlet/devices/+/readings` (QoS 1), `swiftlet/devices/+/heartbeat` (QoS 0, **chỉ khi làm mục 10 của backend**).
   - **Publish lại trạng thái** mọi cơ cấu chấp hành (retained, `issuedAt` = lúc publish), **chỉ sau khi bộ nhớ đệm trạng thái đã nạp xong**. MQTT kết nối trước CSDL thì hoãn tới lúc nạp xong. **Chạy lại mỗi lần MQTT kết nối lại** (broker có thể đã mất tin retained), nhưng **không quá một lần mỗi 5 giây** khi MQTT chập chờn; simulator đã bỏ qua tin có `issuedAt` cũ (hợp đồng 2.1).
6. **Số đo đến khi CSDL chưa sẵn sàng** vào hàng chờ thu nhận (Phần 4, giới hạn `INGEST_RETRY_MAX_ITEMS`), ghi khi CSDL sẵn sàng. Vòng điều khiển **chưa chạy** tới khi CSDL sẵn sàng.
7. **Nhịp `sp_DetectAnomalies`** bắt đầu ngay, **bỏ lượt** khi CSDL chưa sẵn sàng; chỉ log khi trạng thái đổi.
8. **Socket.IO:** bắt tay cần đọc lại Users (hợp đồng 4.1); CSDL chưa sẵn sàng thì **từ chối kết nối** với lỗi `RETRY_LATER`, client tự kết nối lại.

**Bộ nhớ đệm trạng thái thiết bị** chỉ cập nhật từ **kết quả của `sp_SetActuator`** (`Mode`, `IsOn`, `Level` SP trả về), không từ lệnh vừa gửi. **Giả định chỉ có một backend** ghi `Devices` (hạn chế 7, 9 ở Phần 1).

### 3.2 "Chưa sẵn sàng" khác "cấu hình sai"

| Loại | Ví dụ | Xử lý |
|---|---|---|
| **Chưa sẵn sàng** | SQL Server chưa chạy, mất kết nối, hết thời gian; truy vấn nạp quá hạn; broker chưa chạy | Thử lại tăng dần **1, 2, 5, 10, 30 giây**, rồi mỗi 30 giây; **không giới hạn số lần**; log khi trạng thái đổi |
| **Cấu hình sai** | SQL đăng nhập sai (lỗi **18456**), CSDL không tồn tại (lỗi **4060**); broker từ chối tài khoản (CONNACK 4 "Bad username or password" / 5 "Not authorized") | **5 lần liên tiếp** → log rõ (VD "đăng nhập SQL Server bị từ chối, kiểm tra `DB_USER`/`DB_PASSWORD`") rồi **dừng, mã thoát khác 0**. **Không in** mật khẩu hay chuỗi kết nối |

Lỗi khác tính là "chưa sẵn sàng".

**Hạn chế:** lỗi 18456/4060 **tạm thời** khi SQL Server khởi động chậm (CSDL đang phục hồi) có thể bị coi là cấu hình sai sau 5 lần liên tiếp; khi đó chạy lại backend sau khi SQL Server đã lên hẳn.

### 3.3 Khi CSDL mất kết nối giữa chừng

- Lỗi kết nối/hết thời gian khi gọi CSDL → REST trả **503 `RETRY_LATER`** (`sqlNumber: null`), không treo, không 500. Lỗi 1205 giữ nguyên hợp đồng 3.5 (tự thử lại 1 lần rồi mới 503).
- Thu nhận MQTT: Phần 4. Nhịp `sp_DetectAnomalies`: log và chạy lượt sau.
- Kết nối lại được → **nạp lại bộ nhớ đệm** (theo quy tắc không ghi đè giá trị mới hơn ở 3.1).
- Lỗi CSDL không bao giờ làm sập tiến trình.

### 3.4 Đọc số lỗi SQL

Bảng đổi mã lỗi (hợp đồng 3.5) và mục 3.2 cần **số lỗi SQL** (1205, 547, 2627, 2601, 50xxx từ `THROW`, 18456, 4060).

- **Cách chính:** đọc số lỗi từ lỗi Prisma trả về khi gọi qua adapter-mssql (trường cụ thể xác định ở bước 1).
- **Dự phòng** nếu Prisma/adapter không giữ số lỗi: gọi SP và ghi bằng `$queryRaw`/`$executeRaw` rồi đọc số lỗi từ lỗi của driver `mssql` (thuộc tính `number` của lỗi request) nếu lỗi đó còn đi kèm; không có thì **phân tích thông báo lỗi** (thông báo `THROW` của database-core viết ASCII, có quy ước riêng từng mã). Cách dự phòng nằm gọn trong `db/sql-errors.ts`, nơi khác không biết.
- **Bước 1 của plan kiểm chứng:** (a) lỗi từ SP gọi bằng `$queryRaw` có mang số 50xxx không, ở trường nào; (b) lỗi 547, 2627/2601 khi ghi; (c) lỗi 18456, 4060 khi kết nối; (d) lỗi 1205 (dựng deadlock thử hoặc ghi nhận "chưa kiểm được" nếu không dựng nổi).

### 3.5 `GET /api/health`

| Tình trạng | Mã | Body |
|---|---|---|
| CSDL sẵn sàng **và** MQTT kết nối | 200 | `{"status":"ok","db":"ok","mqtt":"connected"}` (fixture `rest/health.json`) |
| Thiếu một trong hai | 503 | `{"status":"error","db":"ok"\|"down","mqtt":"connected"\|"disconnected"}` |

- Công khai, **không trả chi tiết nào khác** (hợp đồng 3.3).
- `db = "ok"` nghĩa là CSDL sẵn sàng **và** bộ nhớ đệm đã nạp. Kết quả `SELECT 1` gần nhất lưu tạm 5 giây để gọi health liên tục không dồn tải.

### 3.6 Tắt backend (Ctrl+C / SIGINT, SIGTERM)

1. Ngừng nhận request mới, ngừng nhịp định kỳ.
2. Cố ghi nốt lô số đo đang gom, **tối đa 5 giây**; **CSDL đang lỗi thì bỏ qua bước này**, không chờ. Không kịp thì log số phần tử bị mất.
3. Ngắt MQTT **giữ phiên** (`clean: false`) để broker giữ tin QoS 1.
4. Đóng Prisma, thoát mã 0.
5. **Ctrl+C lần hai: thoát ngay**, không chờ bước nào.

### 3.7 Việc cần thêm vào PR hợp đồng

Cùng PR với endpoint admin (mục 7.6):
- Body `/api/health` khi 503: giá trị `"error"`, `"down"`, `"disconnected"`.
- `503 RETRY_LATER` khi CSDL chưa sẵn sàng hoặc mất kết nối (hiện hợp đồng chỉ dùng cho 1205).
- **Fixture mới** để test hợp đồng không bỏ trống: `rest/health.invalid-db-down.json` (503) và một endpoint cần CSDL trả 503 `RETRY_LATER` khi CSDL chưa sẵn sàng (tên file chốt trong PR). Không đổi `rest/health.json` hiện có.

**Chưa kiểm chứng:**
- Số lỗi SQL đi qua Prisma/adapter-mssql ra sao (3.4, bước 1).
- mqtt.js 5 báo lỗi sai tài khoản qua sự kiện nào, có dừng tự kết nối lại không.
- Prisma tự kết nối lại (bước 1).
- Ctrl+C trên Windows đến Node dưới dạng SIGINT khi chạy bằng `npm run start`.
- Thời hạn 10 giây cho truy vấn nạp, 5 giây khi tắt, 5 giây lưu tạm health, 5 giây giữa hai lần publish lại: đề xuất.
- Cách dựng fixture "CSDL chưa sẵn sàng" trong test hộp đen (VD khởi động backend trỏ cổng SQL không có ai nghe): chốt trong plan.

## Phần 4 — Thu nhận MQTT và vòng điều khiển (đã duyệt)

### 4.1 Nhận tin `readings`

- Lấy `{code}` từ topic `swiftlet/devices/{code}/readings`. Payload không parse được hoặc không phải mảng → bỏ cả tin (hợp đồng 2.3).
- **Kiểm từng phần tử:** đủ `device`, `metric`, `value`, `at`; đúng kiểu; `at` là UTC có `Z`; `device === {code}`. Sai thì bỏ phần tử đó.
- **Log gộp:** mỗi nhịp gom **một dòng cảnh báo** (số phần tử bị bỏ theo lý do + một ví dụ mỗi lý do), không mỗi phần tử một dòng.
- Phần tử hợp lệ vào **hàng chờ thu nhận**.

### 4.2 Gom lô và gọi `sp_IngestReadings`

- Mỗi **1 giây** hoặc khi đủ **200 phần tử** (hợp đồng 2.3): gọi SP, tối đa 200 phần tử mỗi lần; hàng chờ dài hơn thì gọi nhiều lần liên tiếp.
- **Mỗi lúc chỉ một lần gọi `sp_IngestReadings`**: giữ thứ tự, không ghi hai lô song song.

**Thành công** (1 dòng `Received, Accepted, Duplicates, Rejected, AcceptedJson, NewAlertsJson, ResolvedAlertIdsJson`), làm lần lượt:

1. Cập nhật bộ nhớ đệm giá trị mới nhất từ `AcceptedJson` (chỉ khi `at` mới hơn).
2. Phát `readings.new`, mỗi nhà một sự kiện (nhóm theo `HouseId`).
3. Phát `alert.created` cho `NewAlertsJson`; `alert.updated` cho `ResolvedAlertIdsJson` (SP chỉ trả `AlertId` → backend đọc dòng cảnh báo để lấy `houseId`, `status`, `resolvedAt`, `resolvedBy`; hợp đồng 2.1).
4. **Chạy vòng điều khiển** cho các khu vực trong `AcceptedJson` (4.4).
5. `Rejected > 0` hoặc `Duplicates > 0` → một dòng log gộp.

**Mỗi bước tự bắt lỗi và log**; lỗi ở một bước (VD không phát được Socket.IO) **không làm bỏ qua các bước sau**. Lô đã ghi thành công thì không bao giờ bị gửi lại vì lỗi ở bước sau.

**Thất bại:**

| Lỗi | Xử lý |
|---|---|
| Mất kết nối, hết thời gian, **1205** | **Giữ lô ở đầu hàng chờ**, thử lại tăng dần 1, 2, 5, 10, 30 giây (như 3.2). Số đo mới nối vào cuối. Vượt `INGEST_RETRY_MAX_ITEMS` → **bỏ phần cũ nhất**, log số phần tử bị bỏ. Log khi trạng thái chuyển tốt ↔ lỗi |
| **50030, 50042, 547** | **Không thử lại**: bỏ lô, log error kèm số phần tử và phần tử đầu (số đo không chứa bí mật) |
| Lỗi khác, chưa biết | **Thử lại có giới hạn: 3 lần theo lịch 1, 2, 5 giây**; vẫn lỗi thì bỏ lô, log error như trên |

- Gửi lại an toàn: SP khử trùng theo UQ(DeviceId, MetricCode, RecordedAt). Số đo cũ hơn `@StaleMinutes` được lưu nhưng không mở/đóng cảnh báo (SP xử lý).
- **Vòng điều khiển chỉ chạy sau khi lô ghi thành công**; số đo còn trong hàng chờ không kích hoạt luật.

### 4.3 Heartbeat (mục 10 của backend, dưới ranh giới)

- Topic `swiftlet/devices/{code}/heartbeat`; kiểm `{device, at}` (có `Z`, `device === {code}`).
- Gom cùng nhịp 1 giây, **hàng chờ riêng**, gọi `sp_RecordHeartbeat`. **Lỗi thì bỏ, không thử lại** (mất một nhịp vô hại, hợp đồng 2.2).
- `ResolvedAlertIdsJson` → `alert.updated` như 4.2. Heartbeat HTTP của AI (Phần 5) gọi cùng SP.

### 4.4 Vòng điều khiển

**Ai gọi:**
- Sau mỗi lô số đo ghi thành công: các khu vực vừa có số đo.
- Sau khi **đổi ngưỡng** qua REST: làm mới bộ nhớ đệm ngưỡng rồi chạy cho khu vực đó.
- Sau khi thiết bị **trả về AUTO** qua REST: chạy cho khu vực của thiết bị.

Mọi lần chạy đi qua **một hàng đợi tuần tự duy nhất**: hai lần chạy không chồng nhau, không sinh lệnh trùng. Mỗi lệnh `sp_SetActuator` có **thời hạn** (đề xuất 5 giây); **lỗi hoặc quá hạn ở một lệnh không chặn các lệnh khác** trong cùng lượt (log error, lượt sau tính lại từ trạng thái trong bộ nhớ đệm). Mỗi khu vực tính **độc lập**: kết quả khu vực này không ảnh hưởng khu vực kia.

**Hàm thuần** `decide(input) → { commands, latches }` (`control-loop/rules.ts`, không import Nest/Prisma/MQTT). Đầu vào cho một khu vực: giá trị mới nhất từng chỉ số (`value`, `at`); `Min`, `Max`, `Target` (có thể trống); `Hysteresis` từng chỉ số; trạng thái FAN, HEATER, MIST (`Mode`, `IsOn`, `Level`); **chốt từng luật**; `nowUtc`, `staleMinutes`. Đầu ra: lệnh `{deviceId, isOn, level, reason}` và chốt mới.

**Hằng số:**
- `h = MIN(Hysteresis, (Max − Min)/4)` khi có cả Min và Max; một đầu thì `h = Hysteresis` (database-core). Không đặt số riêng.
- `offHi = Target có ? MIN(Target, Max − h) : Max − h`
- `offLo = Target có ? MAX(Target, Min + h) : Min + h`

Lấy mức **chặt hơn** vì ràng buộc cho phép `Target = Max` (hoặc `= Min`); dùng thẳng Target thì quạt bật tắt liên tục quanh Max.

| Luật | Bật chốt khi | Nhả chốt khi | Thiết bị |
|---|---|---|---|
| TEMP cao | TEMP > Max | TEMP ≤ offHi | FAN |
| TEMP thấp | TEMP < Min | TEMP ≥ offLo | HEATER |
| HUMID thấp | HUMID < Min | HUMID ≥ offLo | MIST |
| HUMID cao | HUMID > Max | HUMID ≤ offHi | FAN |
| CO2 cao | CO2 > Max | CO2 ≤ offHi (= Max − h, không có Target) | FAN |

LIGHT chỉ có cảnh báo, không có thiết bị. SPEAKER chỉ điều khiển tay (bật theo giờ: Nếu còn thời gian).

**Quy tắc:**
- **Mỗi luật một chốt riêng** trong bộ nhớ, không suy ra từ trạng thái thiết bị (FAN bật vì CO2 không làm luật TEMP tự giữ FAN).
- **Thiết bị cần bật** khi **ít nhất một** chốt của nó bật (FAN có ba luật).
- Thiếu ngưỡng luật cần (VD không có Min) → **luật đó tắt hẳn**.
- Giá trị **cũ hơn `staleMinutes`** → luật bỏ qua, **giữ nguyên chốt**, thiết bị giữ trạng thái (hạn chế 4).
- **Chỉ sinh lệnh** khi trạng thái cần khác bộ nhớ đệm **và** thiết bị đang `AUTO` (MANUAL bỏ qua; SP cũng bỏ qua lệnh AUTO). Với **FAN** so cả `IsOn` **và** `Level`.
- **Level:**
  - FAN: bật qua AUTO → **100**, tắt qua AUTO → **0** (khớp seed `H1-F1-FAN`: tắt, Level 0). Sau điều khiển tay (Level tùy ý) rồi trả về AUTO: lượt kế tiếp đưa FAN về đúng 100 (cần bật) hoặc 0 (cần tắt).
  - MIST, HEATER: gửi `@Level = NULL`; SP giữ mức hiện tại (NULL) — xem kết luận dưới.
- `reason` ghi luật và giá trị (VD `TEMP 30.6 > Max 30`) vào `ControlLogs.Reason` để báo cáo truy được.

**Khởi tạo chốt** (khởi động hoặc nạp lại bộ nhớ đệm):
- Giá trị **không cũ** và đã vượt ngưỡng bật → chốt bật.
- Giá trị **không cũ**, nằm giữa ngưỡng bật và ngưỡng nhả, **thiết bị đang bật** → chốt bật.
- Còn lại → chốt tắt.
- **Ca khó (hành vi thiết kế):** thiết bị đang bật mà cảm biến của khu vực mất kết nối lúc khởi động → chốt **tắt** nhưng thiết bị **vẫn bật**, vì luật bỏ qua giá trị cũ và giữ nguyên trạng thái. Thiết bị chỉ đổi khi có số đo mới. Kèm hạn chế 4.

**Kết luận về `sp_SetActuator`** (đã tra plan database-core, Task 5, 15/10/2026):
- SP **luôn** `SELECT Changed, DeviceCode, Mode, IsOn, Level` ở cuối, **kể cả khi `Changed = 0`**; khi lệnh AUTO gặp thiết bị MANUAL, trả trạng thái hiện tại.
- `@Level = NULL` → **giữ mức hiện tại** (`CASE WHEN @Level IS NULL THEN @CurLevel`). MIST/HEATER có Level NULL nên giữ NULL.

**Thực thi lệnh:** gọi `sp_SetActuator(@Source='AUTO', @Reason)`, rồi:
- **Cập nhật bộ nhớ đệm từ kết quả SP**, cả khi `Changed = 0`.
- `Changed = 1` → **publish retained** `{isOn, level, mode, issuedAt}` lên `swiftlet/devices/{DeviceCode}/command` (QoS 1) và phát `device.state` (`source: "AUTO"`).
- Publish lỗi → log error; đồng bộ lại khi MQTT kết nối lại (Phần 3).
- **Điều khiển tay** (Phần 5) dùng **chung bước thực thi**, khác `Source = 'MANUAL'`.

### 4.5 Test

**Bảng ca `decide()`** (Jest, không CSDL, không MQTT):
- Bật/nhả từng luật.
- **FAN do hai luật cùng cần**: nhả một luật FAN vẫn bật; nhả cả hai mới tắt.
- **Target = Max**: không bật tắt liên tục.
- Chỉ Max (CO2); chỉ Min; không Target.
- Giá trị cũ; thiết bị MANUAL; giá trị trong vùng trễ.
- `h` bị chặn bởi `(Max − Min)/4`.
- FAN trả về AUTO với Level 80 → lệnh Level 100 (cần bật) hoặc 0 (cần tắt).
- Khởi tạo chốt, gồm **cảm biến mất kết nối lúc khởi động** (thiết bị đang bật giữ nguyên).
- **Hai khu vực cùng có số đo trong một lô**: kết quả khu vực này không ảnh hưởng khu vực kia.

**Hàng chờ thu nhận** (Jest, SP giả): lỗi thử lại được → giữ lô, đúng thứ tự; vượt giới hạn → bỏ phần cũ nhất; 50030/50042/547 → bỏ, không thử lại; lỗi chưa biết → 3 lần rồi bỏ; không bao giờ hai lần gọi SP song song; lỗi phát Socket.IO không chặn vòng điều khiển.

**Vòng điều khiển:** một lệnh lỗi/quá hạn không chặn lệnh khác cùng lượt.

**Câu 6.6** (test hộp đen, Phần 7): CSDL lỗi trong lúc gửi số đo → hồi phục không mất số đo, không bản ghi trùng.

**Chưa kiểm chứng:**
- Tần suất số đo thực tế (6 cảm biến × 4 chỉ số / 10 giây ≈ 2,4 phần tử/giây): mỗi nhịp thường chỉ một lần gọi SP.
- Thời hạn 5 giây cho mỗi lệnh `sp_SetActuator`: đề xuất.

## Phần 5 — REST (đã duyệt)

Danh sách endpoint đầy đủ: hợp đồng 3.3. Phần này chỉ ghi cách làm và điểm riêng.

### 5.1 Xác thực

- **`POST /api/auth/login`:** đọc Users theo `Username`, so bằng `bcryptjs.compare`. Không có tài khoản, sai mật khẩu, `IsActive = 0` → **cùng một lỗi 401** `UNAUTHENTICATED`.
  - Không có tài khoản vẫn so với một **hash giả** để thời gian phản hồi như nhau. Hash giả là **hash bcrypt hợp lệ cost 10**, tạo **một lần lúc khởi động** (băm một chuỗi ngẫu nhiên).
  - JWT ký **HS256** bằng `JWT_SECRET`: `{sub: UserId, role}`, hạn 8 giờ. Phản hồi `{accessToken, expiresIn: 28800, user}` (fixture `rest/auth-login.json`).
- **Guard JWT:** xác thực với `algorithms: ['HS256']` (**chỉ nhận HS256**), kiểm hạn, **đọc lại Users theo khóa chính mỗi request**; `IsActive = 0` → 401; vai trò lấy từ CSDL (hợp đồng 3.1).
- **Guard vai trò:** OWNER gọi route ADMIN → 403 `FORBIDDEN`.
- **Guard `X-Service-Key`** (`/api/ai/*`): băm SHA-256 cả khóa nhận được và `AI_SERVICE_KEY` rồi so bằng `crypto.timingSafeEqual` (hai giá trị băm cùng độ dài). Thiếu/sai → 401. Không log khóa.
- Mật khẩu mới ≥ 8 ký tự, băm bcryptjs **cost 10** (cùng seed `$2a$10$`).

### 5.2 Quyền sở hữu

- **Một `OwnershipGuard`** đọc tham số route (`houseId`, `zoneId`, `deviceId`, `alertId`), **một truy vấn** lần ra nhà (khu vực → nhà; thiết bị → khu vực → nhà; cảnh báo → nhà).
- ADMIN qua. OWNER không sở hữu, hoặc không tồn tại → **404 `NOT_FOUND`** (hợp đồng 3.1).
- Lọc qua query (`GET /api/alerts?houseId=`): OWNER không truyền `houseId` → chỉ nhà mình; truyền nhà người khác → 404.
- `/api/ai/*` không qua guard này.

### 5.3 Kiểm tra đầu vào

- `ValidationPipe` toàn cục với `whitelist` + `forbidNonWhitelisted` (trường lạ → 400).
- Validator: `IsUtcIso` (`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$` + ngày hợp lệ), `IsVnDate` (`YYYY-MM-DD`).
- Lỗi → 400 `VALIDATION_ERROR`, `details: {"fields": [...]}` theo fixture.
- Phân trang: `limit` mặc định 50, tối đa 200; `before` = id (hợp đồng 3.1).
- **Endpoint AI:** DTO **chỉ kiểm kiểu, `Z`, `class` ∈ {rat, snake, owl}**; **không** kiểm số âm và mốc 5 phút, để SP báo. Fixture `bird-counts.invalid-negative` / `invalid-window-not-aligned` chờ `sqlNumber` **50012** / **50014**; fixture thiếu `Z` và lớp lạ chờ `sqlNumber: null` (DTO chặn).

**Chống gán trường không được phép:**

| Endpoint | Trường nhận |
|---|---|
| `POST /api/houses` | `name`, `address`; `ownerId` **chỉ ADMIN được chỉ định**; OWNER thì `ownerId` lấy từ JWT (gửi `ownerId` → 400) |
| `PATCH /api/houses/:houseId` | `name`, `address`, `isActive` (không `ownerId`) |
| `POST /api/zones/:zoneId/devices` | `code`, `name`, `deviceType`; **`code` khớp `^[A-Z0-9-]{3,50}$`** (khớp biểu thức topic `([A-Z0-9-]+)` trong test hợp đồng), vì `Code` nối vào topic MQTT và là client id |
| `PATCH /api/devices/:deviceId` | `name`, `isActive` |

**Trạng thái đầu khi INSERT thiết bị** (thỏa `CK_Devices_ActuatorState`):

| Loại | `Mode` | `IsOn` | `Level` |
|---|---|---|---|
| FAN | `AUTO` | 0 | 0 |
| MIST, HEATER, SPEAKER | `AUTO` | 0 | NULL |
| SENSOR, CAMERA | NULL | NULL | NULL |

### 5.4 Bộ tuần tự hóa và hàm chọn trường

- **Hàm chọn trường** (`common/pickers.ts`), mỗi loại một hàm theo danh sách cho phép: user, house, zone, device, metric, threshold, latestReading, readingBucket, dailyStats, controlLog, alert (kèm history), birdFlow, birdCount, harvest.
- **Bộ tuần tự hóa** (`common/serialize.ts`): đổi kiểu **theo kiểu giá trị** (`Decimal` → number, `BigInt` → chuỗi, `Date` → `toISOString()`), đổi khóa sang camelCase. REST qua interceptor toàn cục; Socket.IO qua hàm phát chung. Cột JSON của SP được `JSON.parse` rồi đi qua cùng hai lớp.
- **`NODE_ENV=test`:** bộ tuần tự hóa **báo lỗi** nếu còn khóa PascalCase hoặc `Decimal`/`BigInt`/`Date` chưa đổi.

**Bảng đối chiếu tên trường** (cho web, mobile tra). Cột khác chỉ đổi PascalCase → camelCase (`HouseId` → `houseId`).

| Cột / khóa từ CSDL | Trường API | Ghi chú |
|---|---|---|
| `MetricCode` | `metric` | Số đo, lịch sử, sự kiện `readings.new`, thống kê ngày |
| `MetricCode` | `metricCode` | Cảnh báo, ngưỡng (hợp đồng 4.2, B10, fixture) |
| `RecordedAt` | `at` | Số đo |
| `SnapshotPath` | **`hasSnapshot`** (boolean) | Không trả đường dẫn; ảnh qua `/api/alerts/:alertId/snapshot` |
| `PasswordHash` | **(không bao giờ trả)** | |
| `Value` (DECIMAL) | `value` (number) | |
| Thời gian từ Prisma | `…T10:40:00.000Z` | `toISOString()` |
| Thời gian trong cột JSON của SP | `…T10:40:00Z` | Giữ nguyên; cả hai là UTC có `Z` |

### 5.5 Lỗi

- **Bộ lọc lỗi toàn cục** → `{"error":{"code","message","sqlNumber","details"}}` (hợp đồng 3.4); route không tồn tại → 404 `NOT_FOUND` cùng định dạng.
- `db/sql-errors.ts` đổi số lỗi SQL → HTTP theo hợp đồng 3.5, kèm `details` theo mã: 50012 → `{"fields":["in","out"]}`, 50014 → `{"fields":["windowStart"]}`. 1205 thử lại 1 lần trong `db/sp.ts`.
- **`message` lấy từ bảng câu tiếng Việt cố định** theo `code`; **không bao giờ** chứa nguyên văn lỗi SQL, đường dẫn trên máy chủ hay stack trace. Lỗi chưa biết → 500 `INTERNAL`, chi tiết chỉ ở log server.
- Multer `LIMIT_FILE_SIZE` → 413 `PAYLOAD_TOO_LARGE`.

### 5.6 Các nhóm endpoint

| Nhóm | Điểm riêng |
|---|---|
| Người dùng | `LAST_ADMIN`: `$transaction`, đếm ADMIN bằng `$queryRaw` có `UPDLOCK, HOLDLOCK` rồi cập nhật trong cùng transaction. `CANNOT_MODIFY_SELF` kiểm trước |
| Nhà, khu vực | Prisma `create`/`update` (không trigger). Tạo/ngừng nhà → socket vào/ra phòng `house:{id}` (Phần 6) |
| Thiết bị | UPDATE qua `$executeRaw` (không `OUTPUT`); INSERT theo kết luận R1 (hợp đồng 3.2), trạng thái đầu theo 5.3 |
| Ngưỡng | `PUT` bằng Prisma `upsert` (không trigger), `UpdatedBy` từ JWT; 547 → `CONSTRAINT_VIOLATION` |
| Điều khiển | `mode = 'AUTO'` thì `isOn` không bắt buộc (backend điền giá trị hiện tại); còn lại `isOn` bắt buộc. `sp_SetActuator(@Source='MANUAL', @UserId)` qua **bước thực thi chung** (Phần 4). Trả về AUTO → chạy vòng điều khiển khu vực đó |
| Số đo | `latest-readings` ← `vw_LatestReadings`; `readings` ← `sp_GetReadingHistory` (50042 → 400); `daily-stats` ← `vw_DailyEnvStats` |
| Cảnh báo | `PATCH` → `sp_UpdateAlertStatus` → phát `alert.updated` |
| Ảnh | Quyền theo cảnh báo; đọc `SnapshotPath` từ CSDL, ghép với `backend/storage/`; **đường dẫn sau ghép phải nằm trong `storage/`**; không có file → 404; `Content-Type: image/jpeg` |
| Đếm chim | `bird-flow` ← `vw_DailyBirdFlow`; `bird-counts` ← Prisma |
| Thu hoạch (mục 9) | Theo hợp đồng |

**Làm mới bộ nhớ đệm sau mọi thay đổi qua REST** ở nhóm nhà, khu vực, thiết bị, ngưỡng:

| Thay đổi | Làm mới |
|---|---|
| Đổi ngưỡng | Ngưỡng khu vực đó, rồi chạy vòng điều khiển khu vực đó |
| Tạo thiết bị | Thêm vào trạng thái thiết bị (cơ cấu chấp hành) |
| Ngừng / dùng lại thiết bị | Bỏ khỏi / nạp lại vào trạng thái thiết bị |
| Ngừng / dùng lại nhà | Bỏ khỏi / nạp lại toàn bộ khu vực và thiết bị của nhà |
| Tạo khu vực | Thêm khu vực (chưa có ngưỡng, chưa có thiết bị) |

Không làm thì ngừng một thiết bị mà bộ nhớ đệm còn giữ sẽ khiến vòng điều khiển nhận **50003** mỗi lượt. Phòng thêm: lệnh tự động nhận 50003 → bỏ thiết bị đó khỏi bộ nhớ đệm và log cảnh báo.

**Ảnh cho web và mobile** (đã tra hợp đồng 3.3, "Ảnh chụp"): hợp đồng chọn **gọi kèm token**, **không** dùng đường dẫn có chữ ký.
- **Web (TV4):** `fetch` kèm `Authorization` → `blob` → `URL.createObjectURL(blob)` gán cho `<img>`; `URL.revokeObjectURL` khi component gỡ.
- **Mobile (TV4):** `<Image source={{ uri, headers: { Authorization: 'Bearer …' } }} />`.
- Backend không cần cơ chế riêng.

### 5.7 Endpoint AI

- **`POST /api/ai/bird-counts`:** mảng rỗng → 400; **> 500 phần tử → 413**. Gọi `sp_RecordBirdCount`, trả `{windowsUpserted, windowsUnchanged}`. `windowsUpserted > 0` → phát `birdcount.updated {houseId, cameraId}` mỗi camera trong lô (tra theo mã camera bằng một truy vấn).
- **`POST /api/ai/predator-detections`** (multipart), **đúng 8 bước hợp đồng 2.4**:
  1. Kiểm `metadata` bằng DTO; thiếu `image` → 400 `fields: ["image"]`.
  2. Kiểm camera **trước khi dựng đường dẫn** (`Devices.Code` tồn tại, `IsActive`, CAMERA); sai → 404 `CAMERA_NOT_FOUND`, chưa ghi file.
  3. Chữ ký `FF D8 FF` → sai 415. Kích thước do multer chặn (`limits.fileSize = SNAPSHOT_MAX_BYTES`, 1 file).
  4. Dựng `snapshots/{yyyy}/{MM}/{dd}/{camera}_{class}_{yyyyMMddTHHmmss}Z.jpg` **chỉ từ giá trị đã kiểm**.
  5. Ghi `storage/tmp/<tên ngẫu nhiên>.jpg`.
  6. Gọi `sp_CreatePredatorAlert` với `snapshot`.
  7. `Created = 1` → tạo thư mục, đổi tên file tạm thành file chính thức.
  8. Đổi tên lỗi → log error, cảnh báo vẫn giữ.

  **File tạm xóa trong nhánh `finally`** cho **mọi đường** không đổi tên thành công: `Created = 0`, SP lỗi, mất kết nối, lỗi bất kỳ sau bước 5. Sau đó phát `alert.created` từ `AlertJson`, trả `{created, alertId, skipReason}`.
- **`POST /api/ai/heartbeat`** (mục 10): `sp_RecordHeartbeat([{device, at}])` → `{accepted, rejected}`; `ResolvedAlertIdsJson` → `alert.updated`.
- Multer `memoryStorage`: mỗi request giữ ≤ 2 MB trong bộ nhớ; lượng AI nhỏ (cooldown 5 phút mỗi loài).

### 5.8 Endpoint admin `POST /api/admin/anomalies/detect`

- **`DEMO_TOOLS=false`:** không đăng ký route (import module có điều kiện) → **404 `NOT_FOUND` giống route không tồn tại**.
- `DEMO_TOOLS=true`: JWT, **chỉ ADMIN** (OWNER → 403). Body `{"nowUtc":"…Z"}`, bắt buộc `Z`.
- Gọi `sp_DetectAnomalies(@NowUtc = nowUtc, @OfflineMinutes = 525600)`, `@DropPercent`, `@CutoffHourVn` mặc định → **chỉ phần sụt đàn** (không thiết bị nào có `LastSeenAt` cũ quá 1 năm; đã tra: SP chỉ yêu cầu `@OfflineMinutes > 0`). Không vậy thì dữ liệu mẫu kết thúc 19:55 VN, simulator tắt sẽ sinh `DEVICE_OFFLINE` lạ.
- Cảnh báo tạo ra có **`CreatedAt = nowUtc`** (giờ quá khứ; đã tra plan database-core: SP chèn `CreatedAt` bằng `@NowUtc`) → ghi vào hợp đồng.
- Phát `alert.created` cho từng cảnh báo mới; phản hồi 200 **`{"newAlerts":[…alert…]}`**.
- Dùng **chung khóa không-chạy-chồng** với nhịp mỗi phút (Phần 6): nhịp đang chạy thì chờ **tối đa 10 giây**, quá thì 503 `RETRY_LATER`.

### 5.9 Test thêm

- **Gửi cùng một sự kiện thiên địch hai lần song song** (cùng camera, lớp, `at`): đúng một cảnh báo được tạo, lần kia `COOLDOWN`; không còn file tạm; file chính thức nguyên vẹn; đổi tên không đụng nhau.
- File tạm bị xóa khi SP lỗi (SP giả ném lỗi).
- Gán trường không được phép (`ownerId` từ OWNER, `ownerId` trong PATCH, `code` sai biểu thức) → 400.
- JWT ký thuật toán khác HS256 (VD `none`) → 401.

**Chưa kiểm chứng:**
- `fs.rename` trên Windows khi file đích đã tồn tại có ghi đè không (Node trên Windows thường ghi đè, nhưng có thể lỗi `EPERM` nếu file đang mở). Test song song ở 5.9 trả lời.
- Kiểm tra trong `NODE_ENV=test` không làm chậm đáng kể; `JSON.parse` cột JSON của SP giữ đúng tên khóa.
- `forbidNonWhitelisted` có làm hỏng fixture nào gửi thêm trường không: đối chiếu khi viết plan.
- Multer `LIMIT_FILE_SIZE` có trả kịp 413 trước khi đọc hết request.
- Bảng câu thông báo tiếng Việt cho từng `code`: viết trong plan.

**Lớp phòng thủ đã chốt:** lệnh tự động nhận **50003** → bỏ thiết bị đó khỏi bộ nhớ đệm, log cảnh báo (phòng khi làm mới bộ nhớ đệm bị sót).

## Phần 6 — Socket.IO và nhịp `sp_DetectAnomalies` (đã duyệt)

### 6.1 Kết nối (hợp đồng 4.1)

- Gateway Socket.IO của Nest, cùng cổng REST, đường dẫn mặc định `/socket.io`; CORS theo `CORS_ORIGINS`.
- **Kiểm lúc bắt tay** (middleware `io.use`), theo thứ tự:
  1. Đọc `auth.token`, xác thực JWT **chỉ HS256**.
  2. CSDL chưa sẵn sàng → từ chối, lỗi `RETRY_LATER` (Phần 3).
  3. Đọc lại Users theo khóa chính; không còn hoặc `IsActive = 0` → từ chối, lỗi `UNAUTHENTICATED`. Vai trò lấy từ CSDL.

  Lỗi gửi client là `Error` có `data: {code}`; client đọc `connect_error.data.code`.
- **Phòng:** `user:{userId}`; OWNER thêm `house:{id}` cho **mỗi nhà đang hoạt động mình sở hữu**; ADMIN thêm `house:{id}` cho **mọi nhà đang hoạt động** và `role:ADMIN`.
- **Token hết hạn:** hẹn giờ ngắt đúng `exp`; hủy hẹn giờ khi socket ngắt trước.
- **Client không gửi sự kiện lên:** gateway không có handler, sự kiện gửi lên bị bỏ qua.

### 6.2 Cập nhật phòng khi đang kết nối

| Thay đổi (qua REST) | Xử lý |
|---|---|
| Tạo nhà | `in('user:{ownerId}')` và `in('role:ADMIN')` → `socketsJoin('house:{id}')` |
| Ngừng dùng nhà | `in('house:{id}')` → `socketsLeave('house:{id}')` |
| Dùng lại nhà | Như tạo nhà |
| Khóa người dùng | `in('user:{id}')` → `disconnectSockets(true)` |
| **Đổi vai trò người dùng** | `in('user:{id}')` → `disconnectSockets(true)`; client kết nối lại được xếp phòng theo vai trò mới (hợp đồng chưa ghi trường hợp này) |

Sự kiện phát trong lúc nhà bị ngừng dùng **không được phát bù** khi dùng lại; client ghép bằng REST khi kết nối lại (hợp đồng 4.1).

### 6.3 Phát sự kiện

**Một hàm phát duy nhất** `emitToHouse(houseId, event, payload)`: qua bộ tuần tự hóa rồi `to('house:{houseId}').emit(...)`. Mọi payload có `houseId` (hợp đồng 4.2).

| Sự kiện | Nguồn trong backend |
|---|---|
| `readings.new` | Thu nhận MQTT (4.2), mỗi nhà một sự kiện mỗi lô |
| `alert.created` | `NewAlertsJson` của `sp_IngestReadings`, `sp_DetectAnomalies`; `AlertJson` của `sp_CreatePredatorAlert`; endpoint admin |
| `alert.updated` | `sp_UpdateAlertStatus`; `ResolvedAlertIdsJson` của `sp_IngestReadings`, `sp_RecordHeartbeat` |
| `device.state` | `sp_SetActuator` trả `Changed = 1` (tay và tự động); `source`, `at` = lúc phát |
| `birdcount.updated` | `POST /api/ai/bird-counts` có `windowsUpserted > 0` |

- Phát lỗi → log, không làm hỏng luồng gọi (4.2).
- Không lưu sự kiện để gửi lại; client tự ghép khi kết nối lại (hợp đồng 4.1).

### 6.4 Nhịp `sp_DetectAnomalies` (mục 7 của backend, Bắt buộc)

- `@Interval` của `@nestjs/schedule`, **mỗi 60 giây**, tham số **mặc định** (`@OfflineMinutes = 5`, `@DropPercent = 20`, `@CutoffHourVn = 20`, `@NowUtc = NULL`). Giờ chốt **không** đưa vào `.env`; demo dùng endpoint admin.
- **Không chạy chồng:** một khóa trong bộ nhớ **dùng chung với endpoint admin**. Đến nhịp mà lượt trước chưa xong → **bỏ lượt**; chỉ log khi **bắt đầu** bị bỏ lượt và khi **hết** bị bỏ lượt.
  - Hệ quả: khi endpoint admin đang gọi, nhịp nền **có thể bị bỏ lượt tối đa 30 giây** (thời hạn một lần gọi). Có chủ ý: khi demo bấm nút, nhịp nền không chen vào làm số cảnh báo khác mong đợi.
- Mỗi lần gọi có **thời hạn 30 giây** (đề xuất); quá hạn thì nhả khóa, log error. **Bước 1 của plan đo thời gian chạy thật** của `sp_DetectAnomalies` trên dữ liệu mẫu và chỉnh thời hạn theo kết quả.
- CSDL chưa sẵn sàng → bỏ lượt (Phần 3). **SP lỗi → log, chạy lượt sau**, không sập backend.
- **`NewAlertsJson` của `sp_DetectAnomalies` đã gồm cả `DEVICE_OFFLINE` do `trg_Devices_Status` tạo** khi SP đánh dấu OFFLINE (database-core: SP đọc lại cảnh báo tạo trong lần gọi đó). Backend chỉ phát `alert.created` cho từng phần tử, **không làm gì thêm**.
- Cắt mục 11 của database-core: lời gọi giữ nguyên (1.2).

### 6.5 Test

- **Jest:** tính phòng cho OWNER/ADMIN, nhà ngừng dùng không vào phòng; hẹn giờ theo `exp`; khóa bỏ lượt khi đang chạy; endpoint admin chờ tối đa 10 giây rồi 503; SP lỗi thì lượt sau vẫn chạy.
- **Hộp đen** (Phần 7):
  - Fixture `contracts/fixtures/ws/` bằng `socket.io-client` 4.8.3.
  - **Cách ly giữa các chủ:** `owner2` **không nhận** sự kiện nào của H1 khi chuỗi H1 chạy.
  - Token sai bị từ chối; tài khoản bị khóa bị ngắt.
  - **`connect_error.data.code` đọc được từ phía `socket.io-client`** cho `UNAUTHENTICATED` và `RETRY_LATER` (Nest có thể bọc lỗi).
  - **ADMIN kết nối TRƯỚC khi nhà mới được tạo** vẫn nhận sự kiện của nhà đó.
  - **Sự kiện phát trong lúc nhà bị ngừng dùng không được phát bù** khi dùng lại.
  - **`DEVICE_OFFLINE` từ nhịp `sp_DetectAnomalies`:** đặt `LastSeenAt` của một cảm biến cũ hơn 5 phút, chờ một nhịp (hoặc gọi hàm nhịp trực tiếp) → nhận `alert.created` loại `DEVICE_OFFLINE` (chỉ khi mục 11 của database-core còn).

**Chưa kiểm chứng:**
- Gắn `io.use` trong gateway Nest 11 (thường trong `afterInit(server)`); cách Nest 11 trả lỗi bắt tay kèm `data`.
- Socket.IO 4.8.3 hỗ trợ `in(room).socketsJoin/socketsLeave/disconnectSockets` trong một tiến trình (có từ 4.0, chưa thử bản này).
- Thời gian chạy thật của `sp_DetectAnomalies` trên dữ liệu mẫu (bước 1 đo).

## Phần 7 — Kiểm thử, đo độ trễ, checklist demo, việc cần sửa hợp đồng (đã duyệt)

### 7.1 Hai tầng test

| Lệnh | Gồm | Cần |
|---|---|---|
| `npm test` | Jest (`*.spec.ts`): hàm thuần (`decide`, validator, bộ tuần tự hóa, `sql-errors`, `loadConfig`), service với SP giả/mock (hàng chờ thu nhận, vòng điều khiển, khóa nhịp, phòng Socket.IO, file tạm ảnh) | Không CSDL, không MQTT |
| `npm run test:contract` | `node --test test-contract/`: hộp đen, backend thật trên `SwiftletCare_Test` + Mosquitto trên máy | `.env.test`, SQL Server, Mosquitto, file backup dữ liệu mẫu |

### 7.2 Trình chạy test hợp đồng

**Kiểm trước khi chạy** (thiếu thì dừng, thông báo rõ):
1. Đọc **`.env.test`**, không bao giờ đọc `.env`; `DB_NAME` phải kết thúc `_Test`.
2. **Build backend trước khi chạy** (`npm run build`), để không test mã cũ.
3. Backend dev đã tắt: `http://localhost:3000/api/health` **không** trả lời (2.4).
4. Mosquitto đang chạy: kết nối thử bằng tài khoản `simulator`.
5. Có `SwiftletCare_Test_seed.bak`; chưa có thì hướng dẫn tạo theo **spec hợp đồng 4.3 quy tắc 12** (plan hợp đồng Task 1 ghi quy tắc này vào spec và vào `contracts/README.md`): `deploy.ps1 -Database SwiftletCare_Test -Reset` rồi `BACKUP … COPY_ONLY`.

**Mỗi chuỗi fixture** (tuần tự, không song song):
1. `RESTORE` từ file backup, câu lệnh nguyên văn theo spec hợp đồng 4.3 quy tắc 12, **chạy qua kết nối vào `master`**.
2. Khởi động backend (`node dist/main.js`) với `.env.test`.
3. **Chờ `/api/health` 200**, thời hạn 30 giây, không ngủ cố định.
4. Chạy từng fixture: REST/AI bằng `fetch` (multipart dựng bằng `FormData` + `Blob` từ file ảnh cùng thư mục fixture); MQTT bằng tài khoản `simulator`, client id `contract-test`; Socket.IO bằng `socket.io-client` 4.8.3, **nghe trước** rồi mới gửi tác nhân. So khớp **bằng `fixtures.mjs`**. `{{token:…}}` lấy bằng đăng nhập tài khoản seed với mật khẩu dev từ biến `DEV_SEED_PASSWORD` (`.env.test`, cùng tên biến plan hợp đồng dùng); `{{serviceKey}}` từ `AI_SERVICE_KEY`.
5. **Chờ gom lô** (fixture MQTT) bằng sự kiện hoặc gọi lại REST, giới hạn 5 giây, không ngủ cố định.
6. Tắt backend bằng SIGINT, đợi tối đa 10 giây rồi kill.

**Bước 1 của plan kiểm:**
- Tài khoản `swiftlet_dev` có đủ quyền chạy `ALTER DATABASE … SINGLE_USER`, `RESTORE`, `SET OFFLINE/ONLINE` từ `master` không; không đủ thì ghi quyền cần cấp (do TV1 quyết).
- **Thời gian mỗi lần `RESTORE`.** Tổng quá lâu thì gom các chuỗi **không phụ thuộc trạng thái của nhau** vào một lần phục hồi, **chỉ gom khi chắc chắn** (chuỗi chỉ đọc, hoặc sửa phần dữ liệu không chuỗi nào khác đọc), ghi danh sách gom vào plan.

**Nhịp nền trong test:** `ANOMALY_SCHEDULER=off` trong `.env.test`, để nhịp `sp_DetectAnomalies` không chen vào giữa fixture (ngày neo 12/10, `LastSeenAt` cũ → 6 `DEVICE_OFFLINE` ngẫu nhiên làm lệch danh sách cảnh báo). **Một chuỗi riêng** khởi động backend với `ANOMALY_SCHEDULER=on` để kiểm `DEVICE_OFFLINE` (6.5): nhịp đầu của `@Interval` tới sau 60 giây **cộng thời gian khởi động**, nên chờ `alert.created` **tối đa khoảng 100 giây** và **ghi thời gian thật đo được** vào báo cáo test.

**Độ phủ fixture:** trình chạy khẳng định **mọi file** trong `contracts/fixtures/{rest,ws,mqtt,ai}/` đã chạy. Ngoại lệ chỉ là fixture `.cut` nằm trong **danh sách bỏ qua tường minh**, **in ra trong báo cáo** mỗi lần chạy. Nếu mục 9/10 của backend được làm thì fixture `.cut` tương ứng **phải chạy**, không được nằm trong danh sách bỏ qua.

**Test hộp đen ngoài fixture:**

| Test | Cách làm |
|---|---|
| **An toàn dữ liệu trả ra** | Thu mọi phản hồi REST + sự kiện WS của lần chạy: không có `passwordHash`, `snapshotPath`, khóa PascalCase. Thu **stdout/stderr backend**: không chứa giá trị `AI_SERVICE_KEY`, `JWT_SECRET`, `DB_PASSWORD`, `MQTT_PASSWORD`, `DEV_SEED_PASSWORD`, chuỗi `Bearer `. Không `message` nào chứa chữ của lỗi SQL hay đường dẫn máy chủ (5.5) |
| **CSDL lỗi khi gửi số đo** (câu 6.6) | Gửi số đo liên tục qua MQTT → `ALTER DATABASE SwiftletCare_Test SET OFFLINE WITH ROLLBACK IMMEDIATE` → chờ → `SET ONLINE` → đủ số đo, không bản ghi trùng |
| **CSDL chưa sẵn sàng** (3.7) | Backend với `DB_PORT` trỏ cổng không ai nghe → health 503 đúng body 3.5; một endpoint cần CSDL trả 503 `RETRY_LATER` |
| **Cấu hình sai** | Khởi động với `ANOMALY_SCHEDULER=maybe`, `DEMO_TOOLS=yes`, `JWT_SECRET` ngắn → backend dừng mã khác 0, thông báo nêu tên biến, **không in giá trị** |
| **Endpoint admin** (5.8) | `DEMO_TOOLS=true`: `nowUtc = 2026-10-12T13:30:00Z` (20:30 VN ngày neo mặc định) → `POPULATION_DROP` H2 + `alert.created`; gọi lần hai → `newAlerts: []`. `DEMO_TOOLS=false` → 404 |
| **Gửi trùng song song** | Như 5.9 |

### 7.3 Đo độ trễ (câu 7): `backend/scripts/measure-latency.mjs`

- **Chỉ chạy trên `SwiftletCare_Dev`** (từ chối nếu `DB_NAME` khác); đọc `.env` dev.
- Simulator, backend, Mosquitto, SQL Server, script **cùng một máy**; ghi cấu hình máy (CPU, RAM, Windows, Node).
- **Số đo:** đăng nhập ADMIN, nghe `readings.new`, ghi `thời điểm nhận − at`. `at` do simulator gán nên **gồm cả 1 giây gom lô**; báo cáo nói rõ khi so với chỉ tiêu 2 giây.
- **Cảnh báo:** script **tự publish** số đo vượt ngưỡng qua MQTT (tài khoản `simulator`, client id **`latency-probe`**), nhớ `at` của mình, ghép với `alert.created` cùng khu vực + chỉ số.
  - **Giữa các lần đo:** gửi một số đo **nằm trong vùng đóng** (vượt qua vùng trễ) rồi **chờ `alert.updated`** (cảnh báo đã đóng) trước khi đo khu vực kế tiếp. Lặp trên nhiều khu vực.
  - Mẫu không có cảnh báo trong thời hạn (số đo simulator rơi cùng lô) ghi **"mất"**, báo cáo riêng.
- **Kết quả:** CSV từng mẫu + p50, p95, max, số mẫu, tỷ lệ vượt chỉ tiêu; commit vào **`backend/results/`** (nhỏ, không bí mật) để TV5 đưa vào báo cáo (NV6).
- **Hạn chế:** chưa đo mobile và thông báo đẩy (hạn chế 10).

> **Ghi chú thêm 16/10/2026 (ACL, áp cho 7.2 và 7.3):** ACL Mosquitto (plan hợp đồng Task 7, Nên có) dùng `pattern write swiftlet/devices/%c/readings`, nên client id `contract-test` (7.2) và `latency-probe` (7.3) publish vào topic của cảm biến sẽ **bị từ chối khi bật ACL**. Hai cách: không bật ACL trên máy dev/test, hoặc thêm tài khoản riêng cho hai việc này. Bước 1 của plan thử hành vi thật; cách chốt đi qua PR hợp đồng (spec simulator 3.4).

### 7.4 Checklist demo

**Trả lời câu hỏi mở 1.5:** **một máy demo** chạy SQL Server, Mosquitto, simulator, backend, AI; web chạy cùng máy; mobile qua LAN. Đo độ trễ (7.3) trên chính máy này.

| Khi nào | Việc |
|---|---|
| Ngày trước buổi demo thật | **Triển khai `SwiftletCare` MỘT lần**, ngày neo = hôm qua của buổi demo, **không `-Reset`** (spec ai-vision 4.6) |
| Cài máy demo | `.env`: `DB_NAME=SwiftletCare`, **`DEMO_TOOLS=true`**, `ANOMALY_SCHEDULER=on`, `CORS_ORIGINS` thêm IP LAN của web. Mở cổng 3000 trên Windows Firewall (mạng Private). Mobile: `EXPO_PUBLIC_API_URL=http://<IP LAN>:3000` (hợp đồng 3.6) |
| Thứ tự bật | SQL Server → Mosquitto → **simulator → backend** → AI → web, mobile. **Simulator trước backend**: dữ liệu mẫu có `LastSeenAt` 19:55 VN ngày neo; backend chạy mà simulator chưa gửi thì nhịp mỗi phút đánh dấu **6 cảm biến OFFLINE, tạo 6 `DEVICE_OFFLINE`** (nếu mục 11 của database-core còn). Bật thứ tự khác thì đây là **hành vi mong đợi**, người trình bày nói trước |
| Kiểm tra | Điện thoại mở `http://<IP LAN>:3000/api/health` thấy `{"status":"ok",…}` |
| Demo AI | **Trước 20:00 giờ VN** (spec ai-vision hạn chế 9) |
| Demo sụt đàn | ADMIN gọi `POST /api/admin/anomalies/detect`, `nowUtc` = **20:30 VN ngày neo đổi sang UTC** (`<ngày neo>T13:30:00Z`). **Mỗi CSDL chỉ một lần**; làm lại thì **triển khai CSDL mới** |
| Trong demo và tập demo | **Không chạy `npm run test:contract`** (2.4) |
| Tập 01/11, 05/11 | `SwiftletCare_Dev` (spec ai-vision 4.6) |
| Tập cuối 08/11 | **CSDL vừa triển khai mới** theo đúng các bước của ngày trước demo, để kiểm quy trình |

### 7.5 `.gitignore` gốc

Plan database-core tạo `.gitignore` gốc với `database/.env`, `database/node_modules/`, `database/generated/`, `infra/mosquitto/passwd`, `infra/mosquitto/data/`, `backend/storage/` — **thiếu file của backend**. Plan backend (task đầu tiên) **thêm vào `.gitignore` gốc**:

```gitignore
backend/.env
backend/.env.test
backend/node_modules/
backend/dist/
```

Chỉ commit `backend/.env.example`, `backend/.env.test.example`.

### 7.6 Việc cần sửa hợp đồng (một PR, TV2 và TV1 duyệt)

**Thứ tự:** PR này mở **SAU khi PR fixture của TV2 (plan hợp đồng Task 6) đã merge**, vì cả hai cùng sửa spec hợp đồng 4.3. Backend chỉ làm mục 2–5 **sau khi PR này merge** (CLAUDE.md).

1. Plan hợp đồng (Architecture): câu "simulator/AI dùng `fixtures.mjs`…" sai với AI viết bằng Python (spec ai-vision 1.5).
2. **Endpoint `POST /api/admin/anomalies/detect {"nowUtc"}`**: chỉ ADMIN; chỉ bật khi `DEMO_TOOLS=true`, không thì 404 như route không tồn tại; `nowUtc` bắt buộc `Z`; **`CreatedAt` = `nowUtc`** (giờ quá khứ); phản hồi `{"newAlerts":[…]}`; phát `alert.created`; nhịp nền đang chạy thì chờ tối đa 10 giây rồi 503. Kèm fixture.
3. **Body 503 của `/api/health`**: `"error"`, `"down"`, `"disconnected"`; fixture `rest/health.invalid-db-down.json`.
4. **`503 RETRY_LATER` khi CSDL chưa sẵn sàng/mất kết nối**; fixture cho một endpoint cần CSDL.
5. **Socket.IO:** đổi vai trò người dùng → ngắt kết nối (6.2); lỗi bắt tay có `data.code` ∈ {`UNAUTHENTICATED`, `RETRY_LATER`}.

Mục 1 chỉ sửa câu chữ; mục 2–5 kèm fixture trong cùng PR.

**Chưa kiểm chứng:**
- `ALTER DATABASE … SET OFFLINE` chạy được với tài khoản test và Prisma kết nối lại sau `SET ONLINE`; không được thì test câu 6.6 lùi về Jest với SP giả.
- `FormData`/`Blob` có sẵn trong Node 25 để gửi multipart (có từ Node 18, chưa thử với backend này).
- `node dist/main.js` nhận SIGINT trên Windows khi là tiến trình con; không được thì kill, chốt trong plan.
- "6 cảm biến OFFLINE" theo dữ liệu mẫu (6 cảm biến H1 + H2; cơ cấu chấp hành không có `LastSeenAt`, mặc định OFFLINE nên không đổi trạng thái): chưa đếm lại trên CSDL thật.
- Quyền `swiftlet_dev` cho `RESTORE` và thời gian mỗi lần `RESTORE` (bước 1).
