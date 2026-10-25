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
| S9 mqtt sai tài khoản | 25/10/2026: **không chạy lại** (máy không có dịch vụ Mosquitto, không gì nghe cổng 1883). Kết quả 18/10: Mosquitto 2.1.2, `username:'backend', password:'sai', reconnectPeriod:1000`: sự kiện `error` có `code = 5`, `Connection refused: Not authorized`, rồi `close`; trong 5 giây **không** có `reconnect` | Task 13: sai tài khoản là lỗi cấu hình, dừng, không chờ mqtt.js thử lại |
| S10 `sp_DetectAnomalies` | 25/10/2026, `SwiftletCare_Dev` (54.144 số đo), chạy trong `BEGIN TRAN … ROLLBACK` để không thêm cảnh báo: 3540 ms (lần đầu, plan nguội), 627 ms, 500 ms | Dưới 10 giây; Task 20 giữ thời hạn mặc định |
| S11 quyền `swiftlet_dev` | Làm ở Task 22 Step 1 | Task 22 |
| S12 Ctrl+C | Làm sau Task 21 | Task 21 |
| S13 `fs.rename` ghi đè | 25/10/2026 chạy lại: in `1`, ghi đè file đích đã có | Task 19 dùng `rename` |
| S14 `FormData`, `Blob` | 25/10/2026 chạy lại: `function function` | Task 22, 24 |
| S15 Logger JSON Nest 11 | 25/10/2026 chạy lại: có, `{"level":"log","pid":…,"timestamp":…,"message":"x"}` | Log dạng JSON |
| S16 ACL Mosquitto | Chưa kiểm được: Task 7 hợp đồng (ACL) chưa làm | Spec simulator 3.4 |
| S17 Multer 413 | Làm sau Task 19 | Task 19 |
| S18 `process.loadEnvFile` | 25/10/2026 chạy lại (Node v25.8.0): in `a`, **không** ghi đè biến đã có trong `process.env` | Task 22 |
| S19 cổng 3100 | 25/10/2026 chạy lại: không tiến trình nào nghe cổng 3000/3100; `contracts/README.md`, `infra/mosquitto/README.md` không nhắc `3100`/`3000` | Cổng test 3100 dùng được |
