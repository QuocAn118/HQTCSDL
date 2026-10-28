# SwiftletCare backend

NestJS 11 + Prisma 7.10.0 (SQL Server) + MQTT + Socket.IO. Spec: [backend](../docs/superpowers/specs/2026-10-15-swiftletcare-backend-design.md), hợp đồng: [integration-contract](../docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md).

## 1. Cài đặt

1. Node.js theo bảng phiên bản trong `CLAUDE.md`/`AGENTS.md` gốc.
2. `npm ci` (trong `backend/`).
3. Chép `.env.example` → `.env` và `.env.test.example` → `.env.test`, điền giá trị của máy mình. Hai file này **không commit**.
   - `DB_PASSWORD`: mật khẩu tài khoản SQL `swiftlet_dev` (xem `database/README.md`).
   - `MQTT_PASSWORD`: mật khẩu tài khoản `backend` đã tạo bằng `mosquitto_passwd` (xem `infra/mosquitto/README.md`).
   - `JWT_SECRET`, `AI_SERVICE_KEY`: mỗi khóa tự tạo một chuỗi ngẫu nhiên bằng
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
     `AI_SERVICE_KEY` phải **giống hệt** biến cùng tên trong `.env` của ai-vision: người chạy backend gửi riêng cho TV3, không gửi qua repo hay nhóm chat công khai. Đổi `JWT_SECRET` làm mọi token cũ hết hiệu lực.
4. Mật khẩu dev của tài khoản seed (`admin`, `owner1`, `owner2`) ghi trong `database/README.md`; không chép vào đây.

## 2. Chạy

```powershell
npm run build
node dist/main.js          # doc .env; cong 3000
```

- Health: `http://localhost:3000/api/health`.
- Chạy với `.env.test` (cổng 3100): `npm run start:test`, hoặc `$env:ENV_FILE='.env.test'; node dist/main.js`.
- **Tắt: nhấn Ctrl+C một lần**, đợi log `Nhan SIGINT, dang tat` rồi tiến trình tự thoát (ghi nốt lô số đo tối đa 5 giây, ngắt MQTT giữ phiên). **Ctrl+C lần hai thoát ngay** (có thể mất số đo đang gom).
- Ctrl+C nhận được cả khi chạy `node dist/main.js` lẫn `npm run start` (S12 trong `spikes/RESULTS.md`). Với `npm run start`, cmd hỏi `Terminate batch job (Y/N)?` **sau khi** backend đã tắt xong: trả lời gì cũng được. Khuyên dùng `node dist/main.js` để không có câu hỏi này.

## 3. Test

- `npm test`: Jest đơn vị, không cần CSDL/MQTT. **Phải chạy qua `npm test`** (lệnh có `node --experimental-vm-modules`): `@nestjs/jwt`/`jose` và Prisma 7 nạp module ESM động; gọi thẳng `npx jest` làm vài bộ test lỗi.
- `npm run test:e2e`: khởi tạo app Nest trong tiến trình test (không cần CSDL thật).
- `npm run test:contract` (Task 22): chạy fixture hợp đồng trên `SwiftletCare_Test`. **Tắt backend dev và simulator trước. Không chạy lúc đang demo hay tập demo** (spec backend 2.4, 7.4): test dùng chung broker MQTT.

## 4. SP giả

Không có `test-support/fake-sps.sql`: TV1 đã giao SP thật trong `database/sql/`, backend chạy trên SP thật.

## 5. Kết quả bước kiểm chứng

Xem [spikes/RESULTS.md](spikes/RESULTS.md) (S1–S19).

## 6. Thứ tự bật khi demo

SQL Server → Mosquitto → **simulator → backend** → AI → web, mobile (spec backend 7.4).

Bật backend trước simulator thì nhịp phát hiện bất thường mỗi phút đánh dấu 6 cảm biến OFFLINE và tạo 6 cảnh báo `DEVICE_OFFLINE` (dữ liệu mẫu có `LastSeenAt` cũ): đây là hành vi đúng, người trình bày nói trước. Máy demo đặt `DEMO_TOOLS=true`, `ANOMALY_SCHEDULER=on` trong `.env`.

## 7. Log

Log không chứa mật khẩu, khóa, token và không ghi body request. Khi báo lỗi cấu hình chỉ nêu tên biến, không nêu giá trị.
