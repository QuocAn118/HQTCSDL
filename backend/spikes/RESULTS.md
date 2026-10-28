# Kết quả bước kiểm chứng backend (Task 1)

Ngày chạy: 18/10/2026, máy: Intel Core i7-4810MQ, RAM 32 GB, Windows 10 IoT Enterprise LTSC, Node: v25.8.0

CSDL `SwiftletCare_Dev` **chưa có** (database-core chưa giao `database/`): các mục cần CSDL ghi "chưa kiểm được", quay lại khi TV1 giao.

| Mục | Kết quả | Hệ quả cho task sau |
|---|---|---|
| S1 phiên bản, peer | `npm ls` không có `invalid`/`UNMET`/`ERR`; `@nestjs/jwt` 12.0.3, `@nestjs/schedule` 12.0.2 giữ nguyên. `nest new` sinh: jest 30.5.2, ts-jest 29.4.15, typescript 5.9.3. `@types/multer` 2.3.0 | Không đổi bảng 2.1 của spec |
| S2 Node | v25.8.0: `npm run build` đạt, `npm test` (test mẫu) 1/1 | Không cần lùi Node 24 |
| S3 import Prisma | 25/10/2026: **cách 2**. Cách 1 build được nhưng chạy lỗi `ERR_MODULE_NOT_FOUND ... dist/database/generated/prisma/internal/class.ts` (client ESM tự import `.ts`) và đẩy `main.js` sang `dist/backend/src/`. Cách 2: `scripts/prisma-generate.mjs` sinh client CJS vào **`src/generated/prisma`** (plan ghi `backend/generated`; đặt trong `src/` để `dist/main.js` giữ nguyên), `prebuild`/`pretest` tự sinh. Jest cần `moduleNameMapper` `.js`→bỏ đuôi; test chạm CSDL cần `--experimental-vm-modules` (Prisma 7 nạp động query compiler). `node dist/spikes/s3-prisma.js` → `S3 OK 1 users = 3` | Task 6 dùng `db/prisma-client.ts` |
| S4 bcrypt | 25/10/2026, `node dist/spikes/s4-bcrypt.js`: `S4 prefix $2a$10$ compare true` (hash seed `owner1` với `DEV_SEED_PASSWORD` của `.env.test`) | Task 7 dùng `bcryptjs.compare` |
| S5 kết nối lại | Chưa kiểm (cần khởi động lại SQL Server; chồng tự làm sau) | Task 6 |
| S6 số lỗi SQL | 25/10/2026, `dist/spikes/s6-sql-errors.js` trên `SwiftletCare_Dev` (dữ liệu không đổi: mọi ca ghi đều hỏng hoặc rollback). **THROW 5xxxx**: `err.code = "P2010"`, số ở `err.meta.driverAdapterError.cause.code` (number, VD 50030, 50042, 50020). **547** (CHECK và FOREIGN KEY): không có số; `cause.kind = "ForeignKeyConstraintViolation"` (cả CHECK), Prisma model trả `P2003`, `$executeRaw` trả `P2010` + message. **2627**: không có số; `kind = "UniqueConstraintViolation"`, model trả `P2002`. **2601**: như 2627, chỉ phân biệt qua message `duplicate key row ... unique index`. **1205** (dựng bằng giao dịch Prisma + phiên sqlcmd `DEADLOCK_PRIORITY HIGH`): không có số; `kind = "TransactionWriteConflict"`, message `deadlock victim`. Hai client Prisma trong cùng tiến trình chạy giao dịch nối tiếp, không tự deadlock được. **Sai mật khẩu và CSDL không tồn tại**: đều `err.code = "ELOGIN"`, message `Login failed for user` (4060 không phân biệt được với 18456). **Không kết nối được**: `err.code = "ESOCKET"`, `Failed to connect` | Task 4: `sqlNumberOf` đúng mọi ca; thêm quy tắc 2601. Bảng đổi mã 3.5 đúng |
| S7 INSERT Devices | 25/10/2026, `node dist/spikes/s7-device-insert.js` trên `SwiftletCare_Dev`: `S7 insert tra ve [ { DeviceId: 29 } ]`, đã xóa dòng thử (Devices vẫn 28 dòng; IDENTITY tăng lên 29). `$queryRaw` trả được dòng từ batch nhiều câu lệnh có `OUTPUT … INTO @t` | Task 16: INSERT `Devices` bằng `$queryRaw` + `OUTPUT INTO` biến bảng |
| S8 Socket.IO | 25/10/2026 chạy lại: `socket.io@4.8.3` (qua `@nestjs/platform-socket.io@11.2.7`); `socketsJoin`, `socketsLeave`, `disconnectSockets` đều `function`; Task 9 Step 7 (backend thật, CSDL Dev): token sai và thiếu token → `connect_error.data.code = UNAUTHENTICATED` (Nest **không** bọc lỗi middleware `server.use`); token đúng → kết nối được. Nhánh `RETRY_LATER` chưa kiểm thật (CSDL đang sẵn sàng) | Task 9 dùng được, không cần sửa `afterInit` |
| S9 mqtt sai tài khoản | 25/10/2026 chạy lại: Mosquitto 2.1.2 (`mosquitto.exe -c infra/mosquitto/mosquitto.conf`, nghe `127.0.0.1:1883`), mqtt 5.16.1. `username:'backend', password:'sai', reconnectPeriod:1000`: `error` có `code = 5`, `Connection refused: Not authorized`, rồi `close`; trong 5 giây **không** có `reconnect`. Tài khoản `backend` đúng (MQTT_* trong `.env`): `connect OK` | Task 13: sai tài khoản là lỗi cấu hình, dừng, không chờ mqtt.js thử lại |
| S10 `sp_DetectAnomalies` | 25/10/2026, `SwiftletCare_Dev` (54.144 số đo), chạy trong `BEGIN TRAN … ROLLBACK` để không thêm cảnh báo: 3540 ms (lần đầu, plan nguội), 627 ms, 500 ms | Dưới 10 giây; Task 20 giữ thời hạn mặc định |
| S11 quyền `swiftlet_dev` | 28/10/2026, sau Task 22 Step 1 (`deploy.ps1 -Database SwiftletCare_Test -Reset` 47 s; `BACKUP … COPY_ONLY` 4,4 s, 12,3 MB, file nằm ở thư mục Backup mặc định của SQL Server `MSSQL17.SQLEXPRESS\MSSQL\Backup\SwiftletCare_Test_seed.bak`, ngoài repo). Từ `master`, tài khoản `swiftlet_dev`, chỉ trên `SwiftletCare_Test`: `SET SINGLE_USER WITH ROLLBACK IMMEDIATE` + `MULTI_USER` **được** (0,9 s); `SET OFFLINE WITH ROLLBACK IMMEDIATE` **được** (0,7 s); `SET ONLINE` **được** (2,2 s). `SINGLE_USER` + `RESTORE … WITH REPLACE` + `MULTI_USER` (đúng lệnh `restore()` của Task 22): **được**, 3 lần **3698 / 3774 / 4083 ms**; xóa thử 1 dòng `BirdCounts` trước khi phục hồi → sau phục hồi trở lại 864 (Alerts 3, SensorReadings 54.144) | Không cần thêm quyền, không cần báo TV1. ~4 s mỗi chuỗi fixture: Task 22 chưa cần gom chuỗi chỉ đọc |
| S12 Ctrl+C | 28/10/2026, `SwiftletCare_Dev` + Mosquitto thật, Ctrl+C thật (`CTRL_C_EVENT` vào console của backend, như nhấn phím). **`node dist/main.js`**: log `Nhan SIGINT, dang tat`, thoát sau 0,8 s; gửi 32 số đo qua MQTT rồi Ctrl+C ngay → 32/32 vào CSDL. **`npm run start`**: cũng nhận SIGINT; 600 số đo (3 lô) → 600/600, node thoát sau 1,6 s; sau đó cmd hỏi `Terminate batch job (Y/N)?` (backend đã tắt xong). **Web đang mở** (Socket.IO kết nối): lần đầu treo > 60 s vì `server.close(cb)` chờ WebSocket đóng → sửa `closeHttpServer` không chờ; chạy lại thoát sau 0,65 s, client bị ngắt, 32/32 số đo. **Ctrl+C lần hai** (cách 50 ms): `Nhan tin hieu lan hai: thoat ngay`, thoát sau 0,2 s, 600 số đo đang gom bị mất (đúng spec 3.6) | Cả hai cách chạy đều tắt êm; README ghi cách tắt |
| S13 `fs.rename` ghi đè | 25/10/2026 chạy lại: in `1`, ghi đè file đích đã có | Task 19 dùng `rename` |
| S14 `FormData`, `Blob` | 25/10/2026 chạy lại: `function function` | Task 22, 24 |
| S15 Logger JSON Nest 11 | 25/10/2026 chạy lại: có, `{"level":"log","pid":…,"timestamp":…,"message":"x"}` | Log dạng JSON |
| S16 ACL Mosquitto | Chưa kiểm được: Task 7 hợp đồng (ACL) chưa làm | Spec simulator 3.4 |
| S17 Multer 413 | Làm sau Task 19 | Task 19 |
| S18 `process.loadEnvFile` | 25/10/2026 chạy lại (Node v25.8.0): in `a`, **không** ghi đè biến đã có trong `process.env` | Task 22 |
| S19 cổng 3100 | 25/10/2026 chạy lại: không tiến trình nào nghe cổng 3000/3100; `contracts/README.md`, `infra/mosquitto/README.md` không nhắc `3100`/`3000` | Cổng test 3100 dùng được |

## Test hợp đồng hộp đen (Task 22, 28/10/2026)

Máy nhóm (i7-4810MQ, Windows Defender quét thời gian thực, `node_modules` 51.158 file), `SwiftletCare_Test`, Mosquitto 2.1.2 không ACL.

| Mục | Kết quả |
|---|---|
| `npm run test:contract` | **43/43 PASS**, 46/50 fixture chạy; bỏ qua 4 fixture `.cut` (`mqtt/heartbeat.cut`, `ai/heartbeat.cut`, `rest/harvests-post.cut`, `rest/report-env-vs-yield.cut`). `do phu fixture` và `an toan du lieu` PASS. Tổng **21,9 phút** |
| Thời gian `RESTORE` | 33 lần, 2380–4734 ms, tổng ~97 s (~1,6 phút) |
| Vì sao quá 15 phút | **Không phải do `RESTORE`**: mỗi lần khởi động backend ~24 s, trong đó ~23 s là nạp module trước khi Nest bắt đầu (`@nestjs/core` 7 s, `@prisma/adapter-mssql` 5,5 s, `@nestjs/jwt` 4,9 s khi nạp riêng). Lần đầu với thời hạn chờ health 30 s: 22/42 chuỗi fail vì `fetch failed` → tăng lên 90 s |
| Gom chuỗi chỉ đọc (một lần phục hồi + một backend) | `rest/health`, `rest/house.invalid-not-owner`, `rest/auth-login`, `rest/auth-login.invalid-credentials`, `rest/alerts-list.page`, `ai/ai.invalid-service-key`: cả nhóm 34,6 s (trước đây 6 × ~30 s). Tổng từ 24,5 → 21,9 phút |
| `ParseArrayPipe` (Task 19) | `ai/bird-counts.invalid-missing-z` PASS: `details.fields = ["windowStart"]` |
| L2 | `dist/main.js` chạy với client Prisma sinh trong `src/generated/prisma` ở mọi chuỗi |
| L7 / K4 (S16) | `infra/mosquitto/mosquitto.conf` không có `acl_file`: ACL tắt trên máy dev/test; `contract-test` publish được vào `swiftlet/devices/H1-F1-SENSOR/readings` (chuỗi `mqtt/*` PASS). Kiểm ACL thật khi có Task 7 hợp đồng |
| T14-3 | `sp_SetActuator` thật: điều khiển cảm biến → 409 `DEVICE_NOT_CONTROLLABLE` 50003 trong 198 / 70 / 65 ms |
| T19-2 | Hai `POST /api/ai/predator-detections` cùng sự kiện gửi song song: một `created:true` (alert 4), một `created:false` `COOLDOWN`; CSDL đúng 1 cảnh báo PREDATOR mới; `storage/tmp` rỗng |
| T18-2 | `GET /api/alerts/3/snapshot` (cảnh báo PREDATOR mẫu): 404 `NOT_FOUND` vì không có file `snapshots/seed/H1-F0-CAMERA_snake_seed.jpg` |
| K13 | `npm run test:e2e` sau `jest --clearCache`, 3 lần: 4/4 (57 s), 4/4 (40 s), 4/4 (43 s) |

## Test hộp đen ngoài fixture (Task 23, 28/10/2026)

`test-contract/extras.test.mjs` trên `SwiftletCare_Test`: **10/10 PASS** (10,1 phút). Cả bộ `npm run test:contract` (extras rồi run): 52/53 ở lần chạy đủ (fixture 43/43), ca T20-1 fail do test đo mốc sai, sửa rồi chạy lại extras 10/10.

| Mục | Kết quả |
|---|---|
| DEVICE_OFFLINE (nhịp thật) | `alert.created` DEVICE_OFFLINE của H1-F1-SENSOR sau **55–59 giây** (3 lần) |
| K12 / T15-1: CSDL OFFLINE giữa lúc gửi số đo | `ALTER DATABASE … SET OFFLINE/ONLINE` chạy được bằng `swiftlet_dev`. OFFLINE ~7 s: đủ **60/60**, không trùng. **OFFLINE 15 s: chỉ 40/60**, log `Bo lo 20 so do (loi chua biet sau 3 lan thu lai …)`. SQL Server trả **Msg 942** (`cannot be opened because it is offline`), không phải lỗi kết nối → nhánh "lỗi chưa biết" thử 1/2/5 s rồi bỏ lô, không log trong lúc thử (T23-2) |
| Cấu hình sai | `ANOMALY_SCHEDULER=maybe`, `DEMO_TOOLS=yes`, `JWT_SECRET` ngắn: dừng mã ≠ 0, nêu tên biến, không in giá trị |
| K7: `DB_NAME` không tồn tại | SQL Server trả 18456 như sai mật khẩu; 5 lần trong ~22 s rồi dừng mã 1. Trước sửa: gợi ý chỉ `DB_USER/DB_PASSWORD`; sau sửa: thêm `DB_NAME (CSDL co ton tai khong)`. Log không chứa mật khẩu |
| Endpoint admin | POPULATION_DROP H2, `createdAt` = `nowUtc`, `alert.created`, lần hai `newAlerts: []` |
| T20-1 | Phiên `sqlcmd` giữ `TABLOCKX` trên `Devices`/`Alerts`; admin gọi ở giây 62 sau "Lang nghe": **503 `RETRY_LATER` sau 10,8–10,9 s**. Nhịp bị cắt sau **15 s** bởi `requestTimeout` mặc định của `mssql` (không phải `CALL_TIMEOUT_MS` 30 s), lỗi log với message rỗng, rồi `DbService` coi là mất kết nối (`Mat ket noi CSDL, dang ket noi lai`) (T23-1). Bỏ lượt khi nhịp trước chưa xong: không xảy ra được thật vì nhịp 60 s > hạn 15/30 s |
| Gửi trùng thiên địch song song | một `created:true`, một `COOLDOWN`; `storage/tmp` rỗng |
| Socket.IO | token sai `UNAUTHENTICATED`; cách ly chủ nhà; ADMIN nhận `device.state` nhà mới tạo; không phát bù khi nhà ngừng dùng; khóa owner1 → bị ngắt |
| K16: token hết hạn | token hạn 4 s: bị ngắt sau 2,98–3,43 s kể từ lúc kết nối, đúng lúc hết hạn (±0,1 s) |
| K15 | CSDL chưa sẵn sàng (`DB_PORT=1`): `connect_error.data.code = RETRY_LATER` |
| T10-1/2/3, LAST_ADMIN | tạo ADMIN `admin2` 201; hai ADMIN hạ nhau đồng thời: **200 + 409 `LAST_ADMIN`** ngay lần đầu (3 lần chạy), không cần `WAITFOR` tạm; còn ≥ 1 ADMIN. Trùng username, trùng email → 409 `DUPLICATE` |
| Dọn ảnh | `removeNewSnapshots` xóa ảnh test sinh ra sau mỗi file test; `backend/storage` còn 0 file |
