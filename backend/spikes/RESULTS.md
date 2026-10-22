# Kết quả bước kiểm chứng backend (Task 1)

Ngày chạy: 18/10/2026, máy: Intel Core i7-4810MQ, RAM 32 GB, Windows 10 IoT Enterprise LTSC, Node: v25.8.0

CSDL `SwiftletCare_Dev` **chưa có** (database-core chưa giao `database/`): các mục cần CSDL ghi "chưa kiểm được", quay lại khi TV1 giao.

| Mục | Kết quả | Hệ quả cho task sau |
|---|---|---|
| S1 phiên bản, peer | `npm ls` không có `invalid`/`UNMET`/`ERR`; `@nestjs/jwt` 12.0.3, `@nestjs/schedule` 12.0.2 giữ nguyên. `nest new` sinh: jest 30.5.2, ts-jest 29.4.15, typescript 5.9.3. `@types/multer` 2.3.0 | Không đổi bảng 2.1 của spec |
| S2 Node | v25.8.0: `npm run build` đạt, `npm test` (test mẫu) 1/1 | Không cần lùi Node 24 |
| S3 import Prisma | Chưa kiểm được (chưa có `database/generated/prisma`). Chưa tạo `src/db/prisma-client.ts` và spike S3/S4/S6/S7 để build không gãy | Làm lại Step 4–7 khi có CSDL; Task 6 phụ thuộc |
| S4 bcrypt | Chưa kiểm được (cần CSDL) | Task 7 |
| S5 kết nối lại | Chưa kiểm được (cần CSDL) | Task 6 |
| S6 số lỗi SQL | Chưa kiểm được (cần CSDL) | Task 4 `sqlNumberOf`: tạm theo spec, sửa khi có S6 |
| S7 INSERT Devices | Chưa kiểm được (cần CSDL) | Task 16 |
| S8 Socket.IO | `npm ls socket.io` → `socket.io@4.8.3` (qua `@nestjs/platform-socket.io`); `socketsJoin`, `socketsLeave`, `disconnectSockets` đều `function` | Task 9 dùng được |
| S9 mqtt sai tài khoản | Mosquitto 2.1.2, `username:'backend', password:'sai', reconnectPeriod:1000`: sự kiện `error` có `code = 5`, `Connection refused: Not authorized`, rồi `close`; trong 5 giây **không** có `reconnect` | Task 13: sai tài khoản là lỗi cấu hình, dừng, không chờ mqtt.js thử lại |
| S10 `sp_DetectAnomalies` | Chưa kiểm được (cần CSDL) | Task 20 |
| S11 quyền `swiftlet_dev` | Làm ở Task 22 Step 1 | Task 22 |
| S12 Ctrl+C | Làm sau Task 21 | Task 21 |
| S13 `fs.rename` ghi đè | In `1`: ghi đè file đích đã có | Task 19 dùng `rename` |
| S14 `FormData`, `Blob` | `function function` | Task 22, 24 |
| S15 Logger JSON Nest 11 | Có: `{"level":"log","pid":…,"timestamp":…,"message":"x"}` | Log dạng JSON |
| S16 ACL Mosquitto | Chưa kiểm được: Task 7 hợp đồng (ACL) chưa làm | Spec simulator 3.4 |
| S17 Multer 413 | Làm sau Task 19 | Task 19 |
| S18 `process.loadEnvFile` | In `a`: **không** ghi đè biến đã có trong `process.env` | Task 22 |
| S19 cổng 3100 | Không tiến trình nào giữ cổng 3100; `contracts/README.md`, `infra/mosquitto/README.md` không nhắc `3100`/`3000` | Cổng test 3100 dùng được |
