# SwiftletCare backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Người thực thi:** TV2, theo cách Native (`superpowers:executing-plans`) trên máy mình — không dùng subagent-driven. Mỗi task: viết test trước, chạy cho fail, code cho đạt, commit. Không bỏ bước test.

## Trước khi chạy

Chạy trong PowerShell ở gốc repo; mọi lệnh phải đạt trước Task 1:

```powershell
node -v                         # ^20.19 || ^22.12 || >=24 (máy nhóm: 25)
npm view @nestjs/core@11.2.7 version     # phải in 11.2.7
npm view @nestjs/cli@11.0.24 version     # phải in 11.0.24
sqlcmd -?                       # có sẵn (bản 17 trở lên)
git status                      # sạch, đang ở nhánh backend (git switch -c backend nếu chưa có)
```

- CSDL `SwiftletCare_Dev` đã triển khai bằng `database/scripts/deploy.ps1` (plan database-core Task 1–3) trước Step 4 của Task 1. Chưa có thì làm Task 1 Step 1–3, ghi "chưa kiểm được" cho các mục cần CSDL ở `backend/spikes/RESULTS.md`, quay lại khi TV1 giao.
- Mosquitto chạy theo `infra/mosquitto/README.md` (plan hợp đồng Task 2), có tài khoản `backend` và `simulator`.
- Mật khẩu dev của tài khoản seed ghi trong README database. **Không chép mật khẩu vào file nào của `backend/`**; chỉ điền vào `backend/.env.test` (đã gitignore).

## Mốc

| Mốc | Phải xong |
|---|---|
| **18/10 (M1)** | Task 1 (bước kiểm chứng), Task 2 |
| **20/10** | Task 6 nối `sp_IngestReadings`, `sp_SetActuator` thật (SP giả nếu TV1 chưa giao); bắt đầu Task 13–15 |
| **25/10 (M2)** | Task 1–17 (khung `main.ts` chạy được từ Task 8): luồng simulator → MQTT → backend → SP → web; đăng nhập; phần đọc của mục 3 |
| **Trước 29/10** | Task 19 (endpoint AI) để TV3 kiểm tay đầu-cuối |
| **01/11 (M3)** | Task 1–23: mục 1–8 của backend đầu-cuối; test hợp đồng đạt; quyết định giữ/cắt Task 25–26 |
| Tuần 4 | Task 24 (đo độ trễ), Task 25–26 nếu còn sức, sửa lỗi |

Hết 23/10 mà Task 15 chưa xong thì TV2 báo nhóm để người hỗ trợ làm Task 17–18 song song (roadmap: người hỗ trợ chuyển sang module đang chậm).

**Goal:** Dựng `backend/` NestJS 11 nối simulator (MQTT), ai-vision (HTTP), web và mobile (REST + Socket.IO) với SQL Server qua SP của database-core, chạy vòng điều khiển theo luật, đúng spec backend và hợp đồng.

**Architecture:** Một ứng dụng NestJS, `AppModule.register(cfg)` nhận cấu hình đã kiểm. Ba "cửa" duy nhất ra ngoài: `db/sp.ts` (gọi SP), `mqtt/` (broker), `realtime/` (Socket.IO); `control-loop/rules.ts` là hàm thuần. Lỗi đi qua một bộ lọc toàn cục, dữ liệu ra đi qua một bộ tuần tự hóa. Test hai tầng: Jest cạnh mã (không CSDL, không MQTT) và `test-contract/` chạy fixture hợp đồng hộp đen trên `SwiftletCare_Test`.

**Tech Stack:** Node.js 25 (lùi LTS 24 nếu lỗi), NestJS 11.2.7, Prisma 7.10.0 + `@prisma/adapter-mssql` 7.10.0, mqtt 5.16.1, socket.io 4.8.3 (kèm `@nestjs/platform-socket.io`), `@nestjs/jwt` 12.0.3, `@nestjs/schedule` 12.0.2, bcryptjs 3.0.3, class-validator 0.15.1, class-transformer 0.5.1, Jest (theo `nest new`), `node --test`.

**Spec:** [docs/superpowers/specs/2026-10-15-swiftletcare-backend-design.md](../specs/2026-10-15-swiftletcare-backend-design.md) · hợp đồng: [integration-contract](../specs/2026-10-13-swiftletcare-integration-contract-design.md) · SP và dữ liệu mẫu: [database-core](../specs/2026-10-12-swiftletcare-database-core-design.md), [plan database-core](2026-10-14-swiftletcare-database-core.md) · fixture: [plan hợp đồng](2026-10-14-swiftletcare-integration-contract.md)

## Global Constraints

- Phiên bản **ghim chính xác** (không `^`, `~`), commit `package-lock.json`: `@nestjs/core|common|platform-express|websockets|platform-socket.io|testing` **11.2.7**, `@nestjs/cli` 11.0.24, `@nestjs/jwt` 12.0.3, `@nestjs/schedule` 12.0.2 (cảnh báo peer → lùi bản 11 mới nhất của hai gói này, ghi lại), `prisma`/`@prisma/client`/`@prisma/adapter-mssql` **7.10.0**, `mqtt` 5.16.1, `socket.io-client` 4.8.3 (không 4.8.4), `bcryptjs` 3.0.3, `class-validator` 0.15.1, `class-transformer` 0.5.1. Không cài `socket.io` riêng, không `@nestjs/config`, không `pino`, không `multer` riêng.
- Ranh giới: chỉ `src/db/sp.ts` gọi SP; chỉ `src/mqtt/` nói chuyện với broker; chỉ `src/realtime/` phát Socket.IO; `src/control-loop/rules.ts` không import gì.
- Không sửa `database/prisma/schema.prisma` hay file nào trong `database/`; không ghi bảng có trigger (`Alerts`, `Devices`) bằng `prisma.<model>.create/update`; `Devices` ghi bằng `$executeRaw`/`$queryRaw` có tham số.
- Mốc thời gian ra API: ISO 8601 UTC có `Z` (`toISOString()`); vào API phải có `Z` (`IsUtcIso`). Ngày VN `YYYY-MM-DD` giữ là chuỗi.
- Tên trường API camelCase, đổi ở `common/serialize.ts`; trường rỗng là `null`, không bỏ khóa; DECIMAL ra `number`; `BigInt` ra chuỗi.
- Cảnh báo ra API đúng 14 khóa, đúng thứ tự: `alertId, houseId, zoneId, deviceId, alertType, severity, metricCode, value, detectedClass, confidence, hasSnapshot, message, status, createdAt`.
- Định dạng lỗi: `{"error":{"code","message","sqlNumber","details"}}`; `message` lấy từ bảng câu tiếng Việt cố định; không bao giờ lộ lỗi SQL, đường dẫn máy chủ, stack.
- Cố định trong code: JWT HS256 hạn **28800** giây; client id MQTT `swiftlet-backend`, `clean: false`; thư mục `backend/storage/`; adapter `useUTC: true`; lỗi cấu hình **CSDL 5 lần liên tiếp** thì dừng, **MQTT sai tài khoản (CONNACK 4/5) dừng ngay lần đầu** (S9: mqtt.js 5.16.1 không tự kết nối lại); lịch thử lại **1, 2, 5, 10, 30 giây** rồi mỗi 30 giây.
- Log không bao giờ chứa `Authorization`, `X-Service-Key`, mật khẩu, body `login`/`reset-password`, giá trị biến `.env`.
- `.env` và `.env.test` không commit; chỉ commit `.env.example`, `.env.test.example`. **Không tạo hay ghi đè `.gitignore` gốc** (đã có, commit `1c308a5`); chỉ thêm dòng còn thiếu.
- Commit message tiếng Việt, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Phần tử số đo có `value` là chuỗi số (`"28.5"`), `null`, `NaN` hay số vô hạn** — người dùng mong phần tử đó bị bỏ và ghi vào log gộp, các phần tử khác trong tin vẫn vào hàng chờ. Test thêm ở Task 15 (`validateReadings`).
2. **Người dùng bị đổi vai trò ADMIN → OWNER khi đang giữ token cũ** — mong lần gọi kế tiếp dùng vai trò mới từ CSDL (route ADMIN trả 403), không tin `role` trong token. Test thêm ở Task 7 (`JwtAuthGuard`).
3. **`SnapshotPath` trong CSDL chứa `..` hoặc đường dẫn tuyệt đối** (dữ liệu hỏng, seed lạ) — mong `GET …/snapshot` trả 404, không đọc file ngoài `backend/storage/`. Test thêm ở Task 18 (`resolveSnapshot`).
4. **Tham số phân trang lạ: `limit=0`, `limit=1000`, `limit=abc`, `before=-5`** — mong 400 `VALIDATION_ERROR` với `fields` đúng tên, không 500. Test thêm ở Task 18 (`ListAlertsQuery`).
5. **Điều khiển tay và vòng tự động cùng đụng một thiết bị gần như cùng lúc** — mong bộ nhớ đệm luôn khớp kết quả `sp_SetActuator` trả về sau cùng, không ghi đè bằng lệnh vừa gửi. Test thêm ở Task 14 (`ControlLoopService.execute`).

## Cấu trúc file

```
backend/
  package.json  package-lock.json  tsconfig.json  tsconfig.build.json  nest-cli.json
  .env.example  .env.test.example  README.md
  src/
    main.ts                         bootstrap, đọc ENV_FILE, CORS, Socket.IO adapter, tắt êm
    app.module.ts                   AppModule.register(cfg): module, guard/pipe/filter/interceptor toàn cục
    config/config.ts                AppConfig, loadConfig(), ConfigError, APP_CONFIG
    config/storage.ts               ensureStorage()
    db/prisma-client.ts             MỘT chỗ re-export PrismaClient (đường import chốt ở Task 1)
    db/db.service.ts                DbService: PrismaClient + adapter, vòng kết nối, sẵn sàng, ping
    db/sql-errors.ts                sqlNumberOf, isConnectionError, mapSqlError
    db/sp.ts                        SpService: mỗi SP một hàm có kiểu
    db/db.module.ts
    common/errors.ts                ApiError, MESSAGES
    common/all-exceptions.filter.ts
    common/serialize.ts             serialize, assertSerialized
    common/serialize.interceptor.ts
    common/pickers.ts               hàm chọn trường từng loại
    common/validation.ts            IsUtcIso, IsVnDate, validationPipe(), leafFields()
    common/paging.ts                PageQuery, toPage()
    common/decorators.ts            Public, Roles, SkipDbCheck, CurrentUser
    common/guards/db-ready.guard.ts
    auth/                           auth.controller.ts, auth.service.ts, jwt-auth.guard.ts, roles.guard.ts,
                                    service-key.guard.ts, ownership.guard.ts, auth.module.ts
    health/health.controller.ts
    users/                          users.controller.ts, users.service.ts, dto.ts, users.module.ts
    houses/                         houses.controller.ts, zones.controller.ts, devices.controller.ts,
                                    thresholds.controller.ts, houses.service.ts, dto.ts, houses.module.ts
    readings/                       readings.controller.ts, dto.ts, readings.module.ts
    control/                        control.controller.ts, dto.ts, control.module.ts
    alerts/                         alerts.controller.ts, alerts.service.ts, dto.ts, alerts.module.ts
    birds/                          birds.controller.ts, birds.module.ts
    ai/                             ai.controller.ts, predator.service.ts, dto.ts, ai.module.ts
    admin/                          admin.controller.ts, admin.module.ts (chỉ khi DEMO_TOOLS=true)
    harvests/                       (Task 25, dưới ranh giới cắt)
    mqtt/                           mqtt.service.ts, ingest.ts (hàm thuần), ingest.service.ts, mqtt.module.ts
    control-loop/                   rules.ts, cache.service.ts, control-loop.service.ts, control-loop.module.ts
    realtime/                       rooms.ts, realtime.service.ts, realtime.gateway.ts, io.adapter.ts, realtime.module.ts
    scheduler/                      anomaly.service.ts, scheduler.module.ts
    spikes/                         script kiểm chứng của Task 1 (giữ làm bằng chứng)
    **/*.spec.ts                    Jest cạnh mã
  test-contract/                    node --test: run.test.mjs, lib/*.mjs
  test-support/fake-sps.sql         SP giả cho SwiftletCare_Dev khi TV1 chưa giao (Task 6)
  scripts/measure-latency.mjs       đo độ trễ (Task 24)
  results/                          CSV đo độ trễ (commit)
  spikes/RESULTS.md                 kết quả bước kiểm chứng (commit)
  storage/                          snapshots/, tmp/ (gitignore)
```

## Phụ thuộc vào module khác và cách làm khi chưa có

| Cần | Của | Chưa có thì |
|---|---|---|
| Bảng (migration) + `SwiftletCare_Dev` | database-core Task 1–2 | Task 1 Step 4+ ghi "chưa kiểm được", làm tiếp Task 2–5 (Jest không cần CSDL) |
| `sp_IngestReadings`, `sp_SetActuator` | database-core Task 4–5 (hạn 20/10) | `test-support/fake-sps.sql` tạo SP giả cùng tên, cùng chữ ký trong `SwiftletCare_Dev` (Task 6); Jest dùng `SpService` giả |
| SP còn lại, view, dữ liệu mẫu | database-core Task 6–12 | Jest với SP giả; endpoint tương ứng làm sau |
| `contracts/lib/fixtures.mjs`, `contracts/fixtures/` | plan hợp đồng Task 1–6 (PR của TV2) | Task 22 chờ PR fixture merge; trước đó viết khung trình chạy với một fixture viết tay trong `test-contract/` (không commit fixture giả vào `contracts/`) |
| Mosquitto, tài khoản `backend`/`simulator` | plan hợp đồng Task 2 | Jest không cần; Task 13, 15 kiểm tay sau |
| PR hợp đồng bổ sung (endpoint admin, body health 503, `RETRY_LATER`, mã lỗi Socket.IO, 26 kết nối, ACL) | Task 3 của plan này (TV2 là chủ hợp đồng) | Task 20 (admin) chỉ bật fixture sau khi PR merge; code theo spec backend đã duyệt |
| File backup `SwiftletCare_Test_seed.bak` | spec hợp đồng 4.3 quy tắc 12 | Task 22 Step 1 hướng dẫn tạo |

## Ngoài phạm vi

- Thông báo đẩy Expo, email, Zalo, loa bật theo giờ, điều khiển PID, giới hạn tần suất đăng nhập (Nên có, chỉ làm khi Bắt buộc xong và có PR riêng).
- Chạy nhiều tiến trình backend cùng lúc; phiên bản hóa API; refresh token.
- Sửa schema Prisma, SP, seed (thuộc database-core); sửa fixture ngoài Task 3.
- Màn hình quản lý người dùng (web/mobile không làm; backend vẫn có endpoint `/api/users` theo hợp đồng).

## Quy ước viết test

- Jest: file `*.spec.ts` cạnh mã, `describe` theo lớp/hàm, không CSDL, không MQTT, không mạng. Phụ thuộc thay bằng object giả viết tay (`jest.fn()`), không dùng thư viện mock thêm.
- Hẹn giờ trong test: `jest.useFakeTimers()` + `await jest.advanceTimersByTimeAsync(ms)`.
- `test-contract/`: `node --test`, chỉ đọc `backend/.env.test`, tự kiểm điều kiện trước khi chạy (Task 21).
- Chạy: `cd backend; npm test` (Jest) và `npm run test:contract` (hộp đen).

---

### Task 1: Khung NestJS ghim phiên bản và bước kiểm chứng (mọi mục "chưa kiểm chứng" của spec)

**Files:**
- Create: `backend/` (bằng `nest new`), `backend/src/db/prisma-client.ts`, `backend/src/spikes/*.ts`, `backend/spikes/RESULTS.md`, `backend/.env.example`, `backend/.env.test.example`
- Modify: `backend/package.json`, `.gitignore` (chỉ thêm dòng còn thiếu)

**Interfaces:**
- Produces: `src/db/prisma-client.ts` re-export `PrismaClient`, `Prisma` (mọi file khác import từ đây). `spikes/RESULTS.md` với các mục **S1–S18** dưới đây; task sau đọc kết quả S6 (đường lấy số lỗi SQL, Task 4), S7 (INSERT `Devices`, Task 16), S9 (mqtt sai tài khoản, Task 13), S12 (Ctrl+C, Task 21), S18 (`process.loadEnvFile`, Task 22).

- [ ] **Step 1: Tạo khung bằng Nest CLI đúng bản**

```powershell
npx @nestjs/cli@11.0.24 new backend --package-manager npm --skip-git --strict
cd backend
npm i -E @nestjs/websockets@11.2.7 @nestjs/platform-socket.io@11.2.7 @nestjs/jwt@12.0.3 @nestjs/schedule@12.0.2 @prisma/client@7.10.0 @prisma/adapter-mssql@7.10.0 mqtt@5.16.1 bcryptjs@3.0.3 class-validator@0.15.1 class-transformer@0.5.1
npm i -E -D prisma@7.10.0 socket.io-client@4.8.3
npm view @types/multer version
npm i -E -D @types/multer@<bản vừa in>
```

Ghim mọi phụ thuộc còn dạng `^`/`~` (do `nest new` sinh) về đúng bản trong `package-lock.json`:

```powershell
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));const l=JSON.parse(fs.readFileSync('package-lock.json'));for(const k of ['dependencies','devDependencies'])for(const n of Object.keys(p[k]||{}))p[k][n]=l.packages['node_modules/'+n].version;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
npm install
```

Kiểm `package.json` không còn ký tự `^` hay `~`: `Select-String -Path package.json -Pattern '[\^~]\d'` không in gì. Bản `@nestjs/core|common|platform-express|testing` phải là `11.2.7`; khác thì `npm i -E @nestjs/<gói>@11.2.7`.

- [ ] **Step 2: S1 — cảnh báo peer, S2 — Node**

```powershell
npm ls 2>&1 | Select-String -Pattern 'invalid|UNMET|ERR'
node -v
npm run build
npm test
```

Expected: lệnh đầu không in gì; `npm run build` và `npm test` (test mẫu của `nest new`) đạt.
- Có cảnh báo/lỗi với `@nestjs/jwt` hoặc `@nestjs/schedule` → `npm view @nestjs/jwt@11 version` / `npm view @nestjs/schedule@5 version` (dòng 11/5 là dòng chạy với Nest 11 — kiểm bằng `npm view <gói>@<bản> peerDependencies`), cài bản mới nhất có peer `@nestjs/common ^11`, ghi bản đã dùng vào RESULTS.md mục S1 và báo TV2 sửa bảng 2.1 của spec.
- Build lỗi trên Node 25 → cài Node LTS 24, chạy lại, ghi vào S2.

Ghi bản `jest`, `ts-jest`, `typescript` mà `nest new` sinh vào S1.

- [ ] **Step 3: Thêm dòng còn thiếu vào `.gitignore` gốc, tạo `.env.example`**

`.gitignore` gốc đã có `backend/.env`, `backend/.env.test`, `backend/node_modules/`, `backend/dist/`, `backend/storage/`. Kiểm bằng `Select-String -Path ..\.gitignore -Pattern '^backend/'`; **chỉ thêm** dòng nào thiếu (dùng Edit, không ghi đè file). Không thêm gì khác ở bước này.

`backend/.env.example` (đúng spec 2.3):

```dotenv
HOST=0.0.0.0
PORT=3000
# Web chay cong 3001 (spec web 1.3). Demo qua LAN: them http://<IP LAN may chay web>:3001, cach nhau dau phay.
CORS_ORIGINS=http://localhost:3001
# Cung ten bien voi database/.env.example
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=SwiftletCare_Dev
DB_USER=swiftlet_dev
DB_PASSWORD=
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=backend
MQTT_PASSWORD=
# Tao khoa: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=
AI_SERVICE_KEY=
SNAPSHOT_MAX_BYTES=2097152
INGEST_RETRY_MAX_ITEMS=10000
DEMO_TOOLS=false
# on: nhip sp_DetectAnomalies moi phut chay; off: tat (chi dung trong test)
ANOMALY_SCHEDULER=on
```

`backend/.env.test.example`: chép `.env.example`, đổi `PORT=3100`, `DB_NAME=SwiftletCare_Test`, `DEMO_TOOLS=true`, `ANOMALY_SCHEDULER=off`, thêm cuối file:

```dotenv
# Mat khau dev cua tai khoan seed (ghi trong README database). Dung de dang nhap trong test hop dong.
DEV_SEED_PASSWORD=
# Tai khoan MQTT gia lap thiet bi trong test hop dong.
SIM_MQTT_USERNAME=simulator
SIM_MQTT_PASSWORD=
```

Chép thành `.env` và `.env.test`, điền giá trị máy mình. Kiểm `git status --short` **không** có `.env` hay `.env.test`.

- [ ] **Step 4: S3 — import client Prisma và kết nối qua adapter**

`backend/src/db/prisma-client.ts` (cách 1, client của database-core):

```ts
// MOT cho duy nhat import client Prisma (spec backend 2.1 buoc 3). Doi duong dan o day neu S3 chon cach 2.
export { PrismaClient, Prisma } from '../../../database/generated/prisma/client';
```

`backend/src/spikes/s3-prisma.ts`:

```ts
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../db/prisma-client';

async function main(): Promise<void> {
  process.loadEnvFile('.env');
  const adapter = new PrismaMssql({
    server: process.env.DB_SERVER!,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: { encrypt: false, trustServerCertificate: true, useUTC: true },
  });
  const prisma = new PrismaClient({ adapter });
  const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
  const users = await prisma.users.count();
  console.log('S3 OK', rows[0].ok, 'users =', users);
  await prisma.$disconnect();
}
main().catch((e) => { console.error('S3 FAIL', e?.constructor?.name, e?.message); process.exit(1); });
```

Run: `npm run build; node dist/spikes/s3-prisma.js`
Expected: `S3 OK 1 users = 3`.

Nếu build lỗi định dạng module (client sinh dạng ESM, Nest build CommonJS) → **cách 2**: sinh client riêng trong `backend/`. Tạo `backend/scripts/prisma-generate.mjs`:

```js
// Sinh client Prisma rieng cho backend (CommonJS) tu schema cua database-core; khong sua file cua database-core.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const src = readFileSync('../database/prisma/schema.prisma', 'utf8');
const generator = 'generator client {\n  provider     = "prisma-client"\n  output       = "../generated/prisma"\n  moduleFormat = "cjs"\n}';
const out = src.replace(/generator client \{[\s\S]*?\n\}/, generator);
if (out === src) throw new Error('Khong tim thay khoi generator client trong schema database-core');
mkdirSync('prisma', { recursive: true });
writeFileSync('prisma/schema.prisma', '// FILE SINH TU DONG tu database/prisma/schema.prisma - khong sua tay.\n' + out);
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'generate', '--schema', 'prisma/schema.prisma'], { stdio: 'inherit', shell: process.platform === 'win32' });
```

Thêm vào `package.json` scripts: `"prisma:generate": "node scripts/prisma-generate.mjs"`, `"prebuild": "npm run prisma:generate"`. Đổi dòng export trong `prisma-client.ts` thành `export { PrismaClient, Prisma } from '../../generated/prisma/client';`. Thêm vào `.gitignore` gốc (Edit, chỉ thêm): `backend/generated/`, `backend/prisma/`. Chạy lại lệnh Run. Nếu `prisma generate` đòi `prisma.config.ts`, tạo `backend/prisma.config.ts` chỉ có `schema: 'prisma/schema.prisma'` (không có datasource) theo tài liệu Prisma 7.10 và ghi vào S3.

Ghi vào RESULTS.md S3: cách đã chọn (1 hoặc 2), thông báo lỗi nguyên văn nếu cách 1 hỏng.

- [ ] **Step 5: S4 — tiền tố hash seed và bcryptjs**

`backend/src/spikes/s4-bcrypt.ts`:

```ts
import { compareSync } from 'bcryptjs';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../db/prisma-client';

async function main(): Promise<void> {
  process.loadEnvFile('.env.test');
  const e = process.env;
  const prisma = new PrismaClient({ adapter: new PrismaMssql({ server: e.DB_SERVER!, port: Number(e.DB_PORT), database: 'SwiftletCare_Dev', user: e.DB_USER!, password: e.DB_PASSWORD!, options: { encrypt: false, trustServerCertificate: true, useUTC: true } }) });
  const u = await prisma.users.findUniqueOrThrow({ where: { Username: 'owner1' } });
  console.log('S4 prefix', u.PasswordHash.slice(0, 7), 'compare', compareSync(e.DEV_SEED_PASSWORD!, u.PasswordHash));
  await prisma.$disconnect();
}
main().catch((err) => { console.error('S4 FAIL', err?.message); process.exit(1); });
```

Run: `npm run build; node dist/spikes/s4-bcrypt.js`
Expected: `S4 prefix $2a$10$ compare true`. Không in mật khẩu.

- [ ] **Step 6: S6 — số lỗi SQL đi qua Prisma/adapter (spec 3.4)**

`backend/src/spikes/s6-sql-errors.ts` — in **cấu trúc** lỗi (không in chuỗi kết nối), để Task 4 chốt đường lấy số:

```ts
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../db/prisma-client';

const env = () => { process.loadEnvFile('.env'); return process.env; };

function client(over: Record<string, string> = {}): PrismaClient {
  const e = { ...env(), ...over };
  return new PrismaClient({ adapter: new PrismaMssql({ server: e.DB_SERVER!, port: Number(e.DB_PORT), database: e.DB_NAME!, user: e.DB_USER!, password: e.DB_PASSWORD!, options: { encrypt: false, trustServerCertificate: true, useUTC: true } }) });
}

// In moi thuoc tinh co ten number/code/kind/originalCode o moi tang (err, cause, meta, ...), bo qua chuoi dai.
function shape(err: unknown, path = 'err', seen = new Set<unknown>()): string[] {
  if (err === null || typeof err !== 'object' || seen.has(err)) return [];
  seen.add(err);
  const out: string[] = [`${path}: ${(err as object).constructor?.name}`];
  for (const [k, v] of Object.entries(err as Record<string, unknown>)) {
    if (['number', 'code', 'kind', 'originalCode', 'name', 'errorCode'].includes(k)) out.push(`${path}.${k} = ${JSON.stringify(v)}`);
    if (v && typeof v === 'object') out.push(...shape(v, `${path}.${k}`, seen));
  }
  const cause = (err as { cause?: unknown }).cause;
  if (cause) out.push(...shape(cause, `${path}.cause`, seen));
  return out;
}

async function probe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try { await fn(); console.log(`${label}: KHONG LOI`); }
  catch (e) { console.log(`--- ${label}\nmessage: ${(e as Error).message?.slice(0, 300)}\n${shape(e).join('\n')}`); }
}

async function main(): Promise<void> {
  const p = client();
  await probe('50021 qua $queryRaw', () => p.$queryRaw`EXEC dbo.sp_UpdateAlertStatus @AlertId = ${-1}, @Status = ${'ACK'}, @UserId = ${1}`);
  await probe('547 qua Prisma upsert', () => p.thresholds.upsert({ where: { ZoneId_MetricCode: { ZoneId: 1, MetricCode: 'TEMP' } }, update: { MinValue: 31, MaxValue: 25 }, create: { ZoneId: 1, MetricCode: 'TEMP', MinValue: 31, MaxValue: 25 } }));
  await probe('547 qua $executeRaw', () => p.$executeRaw`UPDATE dbo.Thresholds SET MinValue = 31, MaxValue = 25 WHERE ZoneId = 1 AND MetricCode = 'TEMP'`);
  await probe('2627 qua Prisma create', () => p.users.create({ data: { Username: 'owner1', PasswordHash: 'x', FullName: 'x', Email: 'dup@x.local', Role: 'OWNER' } }));
  await p.$disconnect();
  await probe('18456 sai mat khau', () => client({ DB_PASSWORD: 'sai-mat-khau-cho-spike' }).$queryRaw`SELECT 1`);
  await probe('4060 CSDL khong ton tai', () => client({ DB_NAME: 'KhongTonTai_Spike' }).$queryRaw`SELECT 1`);
  await probe('khong ket noi duoc (cong 1)', () => client({ DB_PORT: '1' }).$queryRaw`SELECT 1`);
}
main();
```

Run: `npm run build; node dist/spikes/s6-sql-errors.js > spikes/s6-output.txt`
Ghi vào RESULTS.md S6: với mỗi ca, **đường thuộc tính** chứa số lỗi (VD `err.cause.originalCode = 50021`) hoặc "không có, chỉ có trong message"; mã/dấu hiệu của lỗi không kết nối được. Xóa `spikes/s6-output.txt` sau khi chép (có thể chứa tên máy chủ). Lỗi 1205: dựng bằng hai phiên `sqlcmd` cập nhật chéo hai dòng `Thresholds` trong transaction; không dựng được thì ghi "1205: chưa kiểm được, dựa vào message `deadlock victim`".

- [ ] **Step 7: S5 — Prisma kết nối lại; S7 — INSERT `Devices`**

S5: chạy `node -e` vòng lặp `SELECT 1` mỗi 2 giây bằng client ở `s3-prisma.ts` (sửa tạm thành vòng lặp, không commit), rồi **khởi động lại dịch vụ SQL Server** (`Restart-Service 'MSSQL$SQLEXPRESS'` trong PowerShell quản trị). Ghi: client tự hồi phục sau bao lâu, hay phải tạo lại client. Làm lại với `RESTORE` (sau Task 22 Step 1 có file `.bak`; chưa có thì ghi "làm ở Task 22").

S7: `backend/src/spikes/s7-device-insert.ts`:

```ts
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../db/prisma-client';

async function main(): Promise<void> {
  process.loadEnvFile('.env');
  const e = process.env;
  const p = new PrismaClient({ adapter: new PrismaMssql({ server: e.DB_SERVER!, port: Number(e.DB_PORT), database: e.DB_NAME!, user: e.DB_USER!, password: e.DB_PASSWORD!, options: { encrypt: false, trustServerCertificate: true, useUTC: true } }) });
  const zone = await p.zones.findFirstOrThrow();
  const rows = await p.$queryRaw<{ DeviceId: number }[]>`
    DECLARE @t TABLE (DeviceId INT);
    INSERT INTO dbo.Devices (ZoneId, Code, Name, DeviceType, Mode, IsOn, Level)
    OUTPUT INSERTED.DeviceId INTO @t
    VALUES (${zone.ZoneId}, ${'SPIKE-S7-FAN'}, ${'Spike S7'}, ${'FAN'}, ${'AUTO'}, ${false}, ${0});
    SELECT DeviceId FROM @t;`;
  console.log('S7 insert tra ve', rows);
  await p.$executeRaw`DELETE FROM dbo.Devices WHERE Code = ${'SPIKE-S7-FAN'}`;
  await p.$disconnect();
}
main().catch((err) => { console.error('S7 FAIL', err?.message); process.exit(1); });
```

Run trên `SwiftletCare_Dev`: `npm run build; node dist/spikes/s7-device-insert.js`
Expected: `S7 insert tra ve [ { DeviceId: <số> } ]`. Ghi vào S7; nếu `$queryRaw` không trả dòng từ batch nhiều câu lệnh, ghi thông báo và kết luận R1 của database-core (đọc `database/spikes/RESULTS.md` mục R1): R1 cho phép `OUTPUT` không `INTO` → Task 16 dùng `prisma.devices.create`.

- [ ] **Step 8: S8–S18 — kiểm tay, ghi kết quả**

Mỗi mục một dòng trong RESULTS.md, ghi lệnh đã chạy và kết quả nguyên văn ngắn:

| Mục | Kiểm | Cách |
|---|---|---|
| S8 | Socket.IO 4.8.3 có `in(room).socketsJoin/socketsLeave/disconnectSockets` | `npm ls socket.io` in `4.8.3`; `node -e "const {Server}=require('socket.io');const s=new Server();console.log(typeof s.in('x').socketsJoin, typeof s.in('x').disconnectSockets)"` in `function function` |
| S9 | mqtt.js 5.16.1 báo sai tài khoản thế nào | `node -e "const m=require('mqtt');const c=m.connect('mqtt://localhost:1883',{username:'backend',password:'sai',reconnectPeriod:1000});c.on('error',e=>console.log('error',e.code,e.message));c.on('close',()=>console.log('close'));setTimeout(()=>process.exit(0),5000)"` — ghi `e.code` (mong 4 hoặc 5) và mqtt.js có tự thử lại không |
| S10 | Thời gian `sp_DetectAnomalies` trên dữ liệu mẫu | `sqlcmd … -Q "SET STATISTICS TIME ON; EXEC dbo.sp_DetectAnomalies"` trên `SwiftletCare_Dev`; ghi thời gian; > 10 giây thì báo, Task 20 chỉnh thời hạn |
| S11 | Quyền `swiftlet_dev`: `ALTER DATABASE … SINGLE_USER`, `RESTORE`, `SET OFFLINE/ONLINE` từ `master` | Chạy ba lệnh này trên `SwiftletCare_Test` (sau Task 22 Step 1); ghi thời gian mỗi lần `RESTORE`; thiếu quyền thì ghi quyền cần và báo TV1 |
| S12 | Ctrl+C trên Windows tới Node dạng SIGINT khi chạy `npm run start` | Sau Task 21; ghi có thấy log "dang tat" không |
| S13 | `fs.rename` trên Windows ghi đè file đích đã có | `node -e "const fs=require('fs');fs.writeFileSync('a.tmp','1');fs.writeFileSync('b.tmp','2');fs.renameSync('a.tmp','b.tmp');console.log(fs.readFileSync('b.tmp','utf8'));fs.unlinkSync('b.tmp')"` in `1` |
| S14 | `FormData`, `Blob` có sẵn | `node -e "console.log(typeof FormData, typeof Blob)"` in `function function` |
| S15 | Logger JSON của Nest 11 | `node -e "const {ConsoleLogger}=require('@nestjs/common');new ConsoleLogger({json:true}).log('x')"` in một dòng JSON → ghi "có"; lỗi → "không, dùng dạng văn bản" |
| S16 | ACL Mosquitto (nếu đã bật Task 7 hợp đồng) từ chối `contract-test`/`latency-probe` publish vào topic cảm biến | `mosquitto_pub -i contract-test -u simulator -P <mk> -t swiftlet/devices/H1-F1-SENSOR/readings -m "[]"` khi đang `mosquitto_sub` bằng tài khoản `backend`; ghi có nhận tin không (spec simulator 3.4) |
| S17 | Multer `LIMIT_FILE_SIZE` trả 413 trước khi đọc hết request | Sau Task 19: gửi file 3 MB bằng `curl.exe -F image=@big.jpg`; ghi thời gian và mã |
| S18 | `process.loadEnvFile` có ghi đè biến đã có trong `process.env` không | `$env:X='a'; node -e "require('fs').writeFileSync('t.env','X=b');process.loadEnvFile('t.env');console.log(process.env.X)"; Remove-Item t.env` — ghi `a` (không ghi đè) hay `b` |
| S19 | Cổng 3100 không bị chiếm, không file nào giả định cổng test khác | `Get-NetTCPConnection -LocalPort 3100 -ErrorAction SilentlyContinue` không in gì; `Select-String -Path ..\contracts\README.md,..\infra\mosquitto\README.md -Pattern '3100|3000'` (khi đã có) |

- [ ] **Step 9: Viết `backend/spikes/RESULTS.md`**

Khung (điền kết quả thật từ Step 2–8):

```markdown
# Kết quả bước kiểm chứng backend (Task 1)

Ngày chạy: <dd/MM/yyyy>, máy: <CPU, RAM, Windows>, Node: <node -v>

| Mục | Kết quả | Hệ quả cho task sau |
|---|---|---|
| S1 phiên bản, peer | ... | |
| S2 Node | ... | |
| S3 import Prisma | cách 1 / cách 2 | |
| S4 bcrypt | $2a$10$, compare true | |
| S5 kết nối lại | ... | Task 6 |
| S6 số lỗi SQL | đường thuộc tính: ... | Task 4 `sqlNumberOf` |
| S7 INSERT Devices | ... | Task 10 |
| S8 … S19 | ... | |
```

- [ ] **Step 10: Commit**

```powershell
cd ..
git add backend .gitignore
git status --short   # khong co backend/.env, backend/.env.test, backend/spikes/s6-output.txt
git commit -m "feat(backend): khung NestJS ghim phiên bản và kết quả bước kiểm chứng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: `loadConfig()` và thư mục `storage/`

**Files:**
- Create: `backend/src/config/config.ts`, `backend/src/config/config.spec.ts`, `backend/src/config/storage.ts`, `backend/src/config/storage.spec.ts`

**Interfaces:**
- Produces:
  - `interface AppConfig { host: string; port: number; corsOrigins: string[]; db: { server: string; port: number; database: string; user: string; password: string }; mqtt: { url: string; username: string; password: string }; jwtSecret: string; aiServiceKey: string; snapshotMaxBytes: number; ingestRetryMaxItems: number; demoTools: boolean; anomalyScheduler: boolean; storageRoot: string }`
  - `class ConfigError extends Error` — `message` chỉ gồm `TEN_BIEN: lý do`, nối bằng `; `.
  - `loadConfig(env?: NodeJS.ProcessEnv, storageRoot?: string): AppConfig`
  - `const APP_CONFIG = 'APP_CONFIG'` (token DI).
  - `interface StoragePaths { root: string; snapshots: string; tmp: string }`, `ensureStorage(root: string): StoragePaths` — ném `Error` nêu thư mục và lý do.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/config/config.spec.ts`:

```ts
import { ConfigError, loadConfig } from './config';

const KEY = 'k'.repeat(32);
const base: NodeJS.ProcessEnv = {
  HOST: '0.0.0.0', PORT: '3000', CORS_ORIGINS: 'http://localhost:3001, http://192.168.1.5:3001',
  DB_SERVER: 'localhost', DB_PORT: '1433', DB_NAME: 'SwiftletCare_Dev', DB_USER: 'swiftlet_dev', DB_PASSWORD: 'p@ss;word{}',
  MQTT_URL: 'mqtt://localhost:1883', MQTT_USERNAME: 'backend', MQTT_PASSWORD: 'mq',
  JWT_SECRET: KEY, AI_SERVICE_KEY: KEY, SNAPSHOT_MAX_BYTES: '2097152', INGEST_RETRY_MAX_ITEMS: '10000',
  DEMO_TOOLS: 'false', ANOMALY_SCHEDULER: 'on',
};

function errorOf(env: NodeJS.ProcessEnv): string {
  try { loadConfig(env, 'C:/x/storage'); } catch (e) { expect(e).toBeInstanceOf(ConfigError); return (e as Error).message; }
  throw new Error('mong ConfigError');
}

describe('loadConfig', () => {
  it('doc dung moi bien, tach CORS_ORIGINS, giu nguyen mat khau co ky tu dac biet', () => {
    const c = loadConfig(base, 'C:/x/storage');
    expect(c.port).toBe(3000);
    expect(c.corsOrigins).toEqual(['http://localhost:3001', 'http://192.168.1.5:3001']);
    expect(c.db).toEqual({ server: 'localhost', port: 1433, database: 'SwiftletCare_Dev', user: 'swiftlet_dev', password: 'p@ss;word{}' });
    expect(c.demoTools).toBe(false);
    expect(c.anomalyScheduler).toBe(true);
    expect(c.snapshotMaxBytes).toBe(2097152);
    expect(c.storageRoot).toBe('C:/x/storage');
  });

  it('bao moi bien sai cung luc, chi neu TEN bien, khong in gia tri', () => {
    const msg = errorOf({ ...base, JWT_SECRET: 'ngan-qua', ANOMALY_SCHEDULER: 'maybe', DEMO_TOOLS: 'yes', PORT: '-1', DB_PASSWORD: '' });
    expect(msg).toContain('JWT_SECRET');
    expect(msg).toContain('ANOMALY_SCHEDULER');
    expect(msg).toContain('DEMO_TOOLS');
    expect(msg).toContain('PORT');
    expect(msg).toContain('DB_PASSWORD');
    expect(msg).not.toContain('ngan-qua');
    expect(msg).not.toContain('maybe');
  });

  it('AI_SERVICE_KEY < 32 ky tu -> loi; so khong phai so nguyen duong -> loi', () => {
    expect(errorOf({ ...base, AI_SERVICE_KEY: 'x' })).toContain('AI_SERVICE_KEY');
    expect(errorOf({ ...base, SNAPSHOT_MAX_BYTES: '2MB' })).toContain('SNAPSHOT_MAX_BYTES');
    expect(errorOf({ ...base, INGEST_RETRY_MAX_ITEMS: '0' })).toContain('INGEST_RETRY_MAX_ITEMS');
  });

  it('thieu bien bat buoc -> loi neu ten', () => {
    const { MQTT_URL, ...rest } = base;
    expect(errorOf(rest)).toContain('MQTT_URL');
  });
});
```

`backend/src/config/storage.spec.ts`:

```ts
import { existsSync, mkdtempSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureStorage } from './storage';

describe('ensureStorage', () => {
  it('tao snapshots/ va tmp/, xoa file con sot trong tmp/, giu snapshots/', () => {
    const root = mkdtempSync(join(tmpdir(), 'sc-storage-'));
    mkdirSync(join(root, 'tmp'), { recursive: true });
    mkdirSync(join(root, 'snapshots'), { recursive: true });
    writeFileSync(join(root, 'tmp', 'old.jpg'), 'x');
    writeFileSync(join(root, 'snapshots', 'keep.jpg'), 'y');
    const p = ensureStorage(root);
    expect(existsSync(p.snapshots)).toBe(true);
    expect(readdirSync(p.tmp)).toEqual([]);
    expect(readdirSync(p.snapshots)).toEqual(['keep.jpg']);
  });

  it('khong tao duoc -> Error neu thu muc', () => {
    const root = mkdtempSync(join(tmpdir(), 'sc-storage-'));
    writeFileSync(join(root, 'snapshots'), 'la file, khong phai thu muc');
    expect(() => ensureStorage(root)).toThrow(/snapshots/);
  });
});
```

Run: `cd backend; npx jest src/config`
Expected: FAIL `Cannot find module './config'`.

- [ ] **Step 2: Viết `backend/src/config/config.ts`**

```ts
import { join } from 'node:path';

export const APP_CONFIG = 'APP_CONFIG';

export interface AppConfig {
  host: string;
  port: number;
  corsOrigins: string[];
  db: { server: string; port: number; database: string; user: string; password: string };
  mqtt: { url: string; username: string; password: string };
  jwtSecret: string;
  aiServiceKey: string;
  snapshotMaxBytes: number;
  ingestRetryMaxItems: number;
  demoTools: boolean;
  anomalyScheduler: boolean;
  storageRoot: string;
}

export class ConfigError extends Error {}

// Spec backend 2.3: loi chi neu TEN bien va ly do, khong bao gio in gia tri.
export function loadConfig(env: NodeJS.ProcessEnv = process.env, storageRoot = join(__dirname, '..', '..', 'storage')): AppConfig {
  const problems: string[] = [];
  const str = (name: string): string => {
    const v = env[name]?.trim();
    if (!v) problems.push(`${name}: thieu hoac rong`);
    return v ?? '';
  };
  const int = (name: string): number => {
    const raw = str(name);
    const n = Number(raw);
    if (raw && !(Number.isInteger(n) && n > 0)) problems.push(`${name}: phai la so nguyen duong`);
    return n;
  };
  const oneOf = <T>(name: string, map: Record<string, T>): T => {
    const raw = str(name);
    if (raw && !(raw in map)) problems.push(`${name}: chi nhan ${Object.keys(map).join(' | ')}`);
    return map[raw];
  };
  const secret = (name: string): string => {
    const v = str(name);
    if (v && v.length < 32) problems.push(`${name}: can it nhat 32 ky tu`);
    return v;
  };

  const cfg: AppConfig = {
    host: str('HOST'),
    port: int('PORT'),
    corsOrigins: str('CORS_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean),
    db: { server: str('DB_SERVER'), port: int('DB_PORT'), database: str('DB_NAME'), user: str('DB_USER'), password: env.DB_PASSWORD ?? '' },
    mqtt: { url: str('MQTT_URL'), username: str('MQTT_USERNAME'), password: str('MQTT_PASSWORD') },
    jwtSecret: secret('JWT_SECRET'),
    aiServiceKey: secret('AI_SERVICE_KEY'),
    snapshotMaxBytes: int('SNAPSHOT_MAX_BYTES'),
    ingestRetryMaxItems: int('INGEST_RETRY_MAX_ITEMS'),
    demoTools: oneOf('DEMO_TOOLS', { true: true, false: false }),
    anomalyScheduler: oneOf('ANOMALY_SCHEDULER', { on: true, off: false }),
    storageRoot,
  };
  // Mat khau giu nguyen (khong trim): co the co khoang trang/ky tu dac biet; chi kiem khong rong.
  if (!cfg.db.password) problems.push('DB_PASSWORD: thieu hoac rong');
  if (problems.length) throw new ConfigError(problems.join('; '));
  return cfg;
}
```

- [ ] **Step 3: Viết `backend/src/config/storage.ts`**

```ts
import { mkdirSync, readdirSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export interface StoragePaths { root: string; snapshots: string; tmp: string }

// Spec backend 2.2 / hop dong 2.4: kiem tao/ghi duoc, xoa file tam cua lan chay truoc.
export function ensureStorage(root: string): StoragePaths {
  const paths = { root, snapshots: join(root, 'snapshots'), tmp: join(root, 'tmp') };
  for (const dir of [paths.snapshots, paths.tmp]) {
    try {
      mkdirSync(dir, { recursive: true });
      const probe = join(dir, `.probe-${process.pid}`);
      writeFileSync(probe, '');
      unlinkSync(probe);
    } catch (e) {
      throw new Error(`Khong tao/ghi duoc thu muc ${dir}: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`);
    }
  }
  for (const f of readdirSync(paths.tmp)) rmSync(join(paths.tmp, f), { recursive: true, force: true });
  return paths;
}
```

- [ ] **Step 4: Chạy test**

Run: `npx jest src/config`
Expected: PASS 6 test.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/config
git commit -m "feat(backend): đọc và kiểm cấu hình .env, chuẩn bị thư mục storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Mở PR hợp đồng bổ sung (TV2 là chủ hợp đồng, TV1 cùng duyệt)

**Điều kiện:** PR fixture của plan hợp đồng (Task 6, nhánh `contract/fixtures`) **đã merge** vào `main` (cả hai cùng sửa spec hợp đồng 4.3). Chưa merge thì làm Task 4 trở đi, quay lại task này sau; Task 20 (fixture admin) và Task 22 chờ PR này.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md` (2.1, 3.3, 3.4, 3.5, 4.1), `docs/superpowers/plans/2026-10-14-swiftletcare-integration-contract.md` (câu Architecture), `contracts/test/fixtures.test.mjs`
- Create: `contracts/fixtures/rest/health.invalid-db-down.json`, `contracts/fixtures/rest/houses-list.invalid-db-not-ready.json`, `contracts/fixtures/rest/admin-anomalies-detect.invalid-missing-z.json`, `contracts/fixtures/rest/admin-anomalies-detect.invalid-forbidden.json`

**Interfaces:**
- Produces: hợp đồng có endpoint `POST /api/admin/anomalies/detect`, body 503 của health, `RETRY_LATER` khi CSDL chưa sẵn sàng, mã lỗi bắt tay Socket.IO; bốn fixture mới mà Task 22 chạy.

- [ ] **Step 1: Tạo nhánh**

```powershell
git switch main; git pull
git switch -c contract/backend-additions
```

- [ ] **Step 2: Thêm test fixture mới (phải fail)**

Trong `contracts/test/fixtures.test.mjs`:
- `EXPECTED.rest` thêm: `'health.invalid-db-down.json', 'houses-list.invalid-db-not-ready.json', 'admin-anomalies-detect.invalid-missing-z.json', 'admin-anomalies-detect.invalid-forbidden.json',`
- `APP_ERRORS` thêm `RETRY_LATER: 503,`.
- Hàm `httpProblems`: body 503 của health không có dạng `{error}` (spec backend 3.5), nên thêm nhánh đầu hàm:

```js
  if (file === 'health.invalid-db-down.json') {
    return f.status === 503 && sameKeys(f.response, ['status', 'db', 'mqtt']) && f.response.status === 'error'
      ? [] : ['health 503 phai la {status:"error", db, mqtt}'];
  }
```

- `REST_PUBLIC` thêm `'health.invalid-db-down.json'`.

Run: `cd contracts; npm test`
Expected: FAIL `thu muc fixture: dung va du danh sach spec 4.3` (thiếu 4 file).

- [ ] **Step 3: Viết bốn fixture (UTF-8 không BOM)**

`contracts/fixtures/rest/health.invalid-db-down.json` — bộ chạy khởi động backend với `DB_PORT` trỏ cổng không ai nghe:

```json
{
  "method": "GET",
  "path": "/api/health",
  "status": 503,
  "response": {"status": "error", "db": "down", "mqtt": "connected"}
}
```

`contracts/fixtures/rest/houses-list.invalid-db-not-ready.json` — cùng điều kiện; guard sẵn sàng CSDL chạy trước guard JWT:

```json
{
  "method": "GET",
  "path": "/api/houses",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "status": 503,
  "response": {"error": {"code": "RETRY_LATER", "message": "{{any:string}}", "sqlNumber": null, "details": null}}
}
```

`contracts/fixtures/rest/admin-anomalies-detect.invalid-missing-z.json`:

```json
{
  "method": "POST",
  "path": "/api/admin/anomalies/detect",
  "headers": {"Authorization": "Bearer {{token:admin}}"},
  "body": {"nowUtc": "{{now:noZ}}"},
  "status": 400,
  "response": {"error": {"code": "VALIDATION_ERROR", "message": "{{any:string}}", "sqlNumber": null, "details": {"fields": ["nowUtc"]}}}
}
```

`contracts/fixtures/rest/admin-anomalies-detect.invalid-forbidden.json`:

```json
{
  "method": "POST",
  "path": "/api/admin/anomalies/detect",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "body": {"nowUtc": "{{now}}"},
  "status": 403,
  "response": {"error": {"code": "FORBIDDEN", "message": "{{any:string}}", "sqlNumber": null, "details": null}}
}
```

Ca thành công của endpoint admin **không** có fixture: kết quả phụ thuộc giờ thật (sụt đàn chỉ xét sau 20:00 VN) và `nowUtc` phải là mốc cố định của ngày neo, trái quy tắc 4.3 "không mốc cố định". Ca này nằm trong test hộp đen của backend (Task 23).

Run: `cd contracts; npm test`
Expected: PASS.

- [ ] **Step 4: Sửa spec hợp đồng**

Dùng Edit, chỉ thêm/sửa đúng các chỗ sau:
1. **2.1**: "(28 kết nối với dữ liệu mẫu)" → "(26 kết nối với dữ liệu mẫu: 6 SENSOR + 20 cơ cấu chấp hành; CAMERA gửi qua HTTP). Tài khoản `simulator` và ACL không giới hạn số kết nối."
2. **2.x (ACL, Nên có)** thêm một dòng: "ACL `pattern write swiftlet/devices/%c/readings` từ chối client `contract-test` (test hợp đồng backend) và `latency-probe` (đo độ trễ) khi publish vào topic cảm biến bằng tài khoản `simulator`. Máy dev/test **không bật ACL**; bật ACL trên máy demo thì hai việc đó không chạy trên máy demo." (Cách chốt: theo kết quả S16 của Task 1; nếu chọn tài khoản riêng thì ghi tên tài khoản và dòng `user` thay câu trên.)
3. **3.3** thêm dòng bảng: `| Demo | POST /api/admin/anomalies/detect {"nowUtc"} → {"newAlerts":[…cảnh báo 14 khóa…]} | ADMIN; chỉ khi backend đặt DEMO_TOOLS=true, không thì 404 như route không tồn tại | sp_DetectAnomalies(@NowUtc, @OfflineMinutes = 525600) |` và đoạn: "`nowUtc` bắt buộc `Z`. Cảnh báo tạo ra có `createdAt = nowUtc`. Phát `alert.created` cho từng cảnh báo. Nhịp nền đang chạy thì chờ tối đa 10 giây, quá thì 503 `RETRY_LATER`. Mỗi nhà tối đa một cảnh báo sụt đàn mỗi ngày → mỗi CSDL demo được một lần."
4. **3.3 Sức khỏe**: thêm "503: `{"status":"error","db":"ok"|"down","mqtt":"connected"|"disconnected"}`."
5. **3.5** bảng HTTP thêm: `| 503 | RETRY_LATER | CSDL chưa sẵn sàng hoặc mất kết nối (kể cả lúc khởi động); 1205 sau một lần thử lại |`.
6. **4.1** thêm: "Đổi vai trò người dùng → server ngắt mọi kết nối của người đó (`disconnectSockets`), client kết nối lại được xếp phòng theo vai trò mới. Lỗi bắt tay gửi `Error` có `data: {code}`, `code` ∈ {`UNAUTHENTICATED`, `RETRY_LATER`}; client đọc `connect_error.data.code`: `UNAUTHENTICATED` → về đăng nhập, `RETRY_LATER` → tự kết nối lại (giãn dần)."
7. **4.3** bảng fixture thêm bốn file mới; ghi: "Hai fixture `*.invalid-db-*` chạy với backend trỏ CSDL tới cổng không ai nghe (bộ chạy tự đặt); `{{token:…}}` khi đó do bộ chạy tự ký bằng `JWT_SECRET` của `.env.test`."
8. **4.1** dòng "**Trạng thái cơ cấu chấp hành** (`device.state`) ghép theo `at` tương tự." → "**Trạng thái cơ cấu chấp hành** (`device.state`): REST `devices` không có mốc thời gian trạng thái nên không ghép theo `at`. Giữ các `device.state` đến trong lúc REST đang tải; REST xong thì áp kết quả REST, rồi áp lại các sự kiện đã giữ theo thứ tự đến; sau đó áp sự kiện trực tiếp. Mỗi sự kiện ghi đè toàn bộ trạng thái (`mode`, `isOn`, `level`), nên áp lại là idempotent." (theo spec web 2.4; rà chéo 17/10)

Plan hợp đồng, câu Architecture: "backend import thư viện này cho test tích hợp, simulator/AI dùng để kiểm payload tự tạo" → "backend import thư viện này cho test tích hợp; simulator kiểm **hình dạng** payload tự tạo (spec simulator 3.1); AI viết bằng Python nên chỉ đối chiếu kiểu dữ liệu với fixture (spec ai-vision 1.5)".

- [ ] **Step 5: Commit và mở PR**

```powershell
git add contracts docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md docs/superpowers/plans/2026-10-14-swiftletcare-integration-contract.md
git commit -m "docs(contract): endpoint admin demo, body health 503, RETRY_LATER khi CSDL chưa sẵn sàng, mã lỗi Socket.IO, 26 kết nối, ACL, ghép device.state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin contract/backend-additions
gh pr create --base main --reviewer <tài-khoản-GitHub-của-TV1> --title "Hợp đồng: bổ sung từ spec backend" --body-file -
```

Nội dung PR (stdin):

```markdown
## Thay đổi hợp đồng
1. Plan hợp đồng (Architecture): sửa câu "simulator/AI dùng fixtures.mjs" (AI viết Python; simulator chỉ so hình dạng).
2. Endpoint `POST /api/admin/anomalies/detect` (ADMIN, chỉ khi `DEMO_TOOLS=true`), `createdAt = nowUtc`, `{"newAlerts":[…]}`; fixture lỗi thiếu `Z`, OWNER → 403.
3. Body 503 của `/api/health`; fixture `rest/health.invalid-db-down.json`.
4. `503 RETRY_LATER` khi CSDL chưa sẵn sàng/mất kết nối; fixture `rest/houses-list.invalid-db-not-ready.json`.
5. Socket.IO: đổi vai trò → ngắt kết nối; lỗi bắt tay `data.code` ∈ {UNAUTHENTICATED, RETRY_LATER}.
6. "28 kết nối" → 26; tài khoản/ACL không giới hạn số kết nối.
7. ACL xung đột với `contract-test`/`latency-probe` → không bật ACL trên máy dev/test.
8. 4.1: `device.state` không ghép theo `at` (REST `devices` không có mốc trạng thái); giữ sự kiện trong lúc REST tải, áp REST rồi áp lại theo thứ tự đến (spec web 2.4).

## Module bị ảnh hưởng
backend (TV2), web và mobile (TV4: xử lý `connect_error.data.code`, trang `/admin/tools`), simulator (TV5: 26 kết nối).

## Kiểm tra
- [ ] `cd contracts; npm test` đạt
- [ ] TV1 duyệt (`sp_DetectAnomalies` với `@OfflineMinutes = 525600`, `createdAt = nowUtc`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Merge xong báo cả nhóm:

```text
[Hợp đồng] Đã merge PR bổ sung từ backend: endpoint admin demo, body health 503, RETRY_LATER khi CSDL chưa sẵn sàng,
data.code khi bắt tay Socket.IO, 26 kết nối, không bật ACL trên máy dev/test, ghép device.state theo thứ tự đến. Ảnh hưởng: backend, web, mobile, simulator.
```

### Task 4: Lỗi — `ApiError`, đổi số lỗi SQL, kiểm đầu vào, bộ lọc toàn cục

**Files:**
- Create: `backend/src/common/errors.ts`, `backend/src/db/sql-errors.ts`, `backend/src/db/sql-errors.spec.ts`, `backend/src/common/validation.ts`, `backend/src/common/validation.spec.ts`, `backend/src/common/all-exceptions.filter.ts`, `backend/src/common/all-exceptions.filter.spec.ts`

**Interfaces:**
- Consumes: kết quả S6 (Task 1) — đường thuộc tính chứa số lỗi.
- Produces:
  - `errors.ts`: `class ApiError extends Error { status: number; code: string; sqlNumber: number | null; details: unknown }` (constructor `(status, code, sqlNumber = null, details = null)`), `MESSAGES: Record<string, string>`, `DB_HEALTH = 'DB_HEALTH'`, `interface DbHealth { reportFailure(err: unknown): void }`.
  - `sql-errors.ts`: `sqlNumberOf(err: unknown): number | null`, `isConnectionError(err: unknown): boolean`, `isDbConfigError(n: number | null): boolean` (18456, 4060), `mapSqlError(n: number): ApiError`.
  - `validation.ts`: `ISO_Z_RE`, `isUtcIso(v: unknown): boolean`, `IsUtcIso()`, `IsVnDate()` (decorator), `leafFields(errors: ValidationError[]): string[]`, `validationError(errors): ApiError`, `validationPipe(): ValidationPipe`, `validateDto<T extends object>(cls: new () => T, plain: unknown): Promise<T>`.
  - `all-exceptions.filter.ts`: `toApiError(e: unknown): ApiError`, `class AllExceptionsFilter` (đăng ký `APP_FILTER` ở Task 8).

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/db/sql-errors.spec.ts`:

```ts
import { isConnectionError, isDbConfigError, mapSqlError, sqlNumberOf } from './sql-errors';

describe('sqlNumberOf', () => {
  it.each([
    ['so o tang ngoai', { number: 1205 }, 1205],
    ['so trong cause (driver)', { message: 'x', cause: { originalCode: 50021 } }, 50021],
    ['so trong meta.driverAdapterError.cause', { meta: { driverAdapterError: { cause: { kind: 'mssql', code: 547 } } } }, 547],
    ['so dang chuoi', { cause: { code: '2627' } }, 2627],
    ['Prisma P2002 -> trung khoa', { code: 'P2002' }, 2627],
    ['Prisma P2003 -> khoa ngoai', { code: 'P2003' }, 547],
    ['message deadlock', new Error('Transaction (Process ID 55) was deadlocked ... chosen as the deadlock victim'), 1205],
    ['message CHECK', new Error('The UPDATE statement conflicted with the CHECK constraint "CK_Thresholds_MinMax"'), 547],
    ['message duplicate', new Error('Violation of UNIQUE KEY constraint. Cannot insert duplicate key'), 2627],
    ['message login', new Error("Login failed for user 'swiftlet_dev'."), 18456],
    ['message db', new Error('Cannot open database "X" requested by the login.'), 4060],
    ['khong co so', new Error('loi la'), null],
  ])('%s', (_label, err, expected) => {
    expect(sqlNumberOf(err)).toBe(expected);
  });

  it('khong lap vo han voi vong tham chieu', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(sqlNumberOf(a)).toBeNull();
  });
});

describe('isConnectionError', () => {
  it.each([
    [{ code: 'P1001' }, true],
    [{ cause: { code: 'ESOCKET' } }, true],
    [{ cause: { code: 'ETIMEOUT' } }, true],
    [new Error('Failed to connect to localhost:1'), true],
    [{ number: 547 }, false],
    [new Error('loi khac'), false],
  ])('%j -> %s', (err, expected) => {
    expect(isConnectionError(err)).toBe(expected);
  });
});

describe('mapSqlError (hop dong 3.5)', () => {
  it.each([
    [50001, 500, 'INTERNAL', null], [50002, 500, 'INTERNAL', null],
    [50003, 409, 'DEVICE_NOT_CONTROLLABLE', null], [50010, 404, 'CAMERA_NOT_FOUND', null],
    [50012, 400, 'VALIDATION_ERROR', { fields: ['in', 'out'] }],
    [50013, 400, 'VALIDATION_ERROR', { fields: ['class'] }],
    [50014, 400, 'VALIDATION_ERROR', { fields: ['windowStart'] }],
    [50020, 404, 'ALERT_NOT_FOUND', null], [50021, 409, 'ALERT_INVALID_TRANSITION', null],
    [50030, 400, 'INVALID_JSON', null], [50040, 400, 'INVALID_PARAMETER', null],
    [50041, 400, 'INVALID_PARAMETER', null], [50042, 400, 'INVALID_PARAMETER', null],
    [547, 400, 'CONSTRAINT_VIOLATION', null], [2627, 409, 'DUPLICATE', null], [2601, 409, 'DUPLICATE', null],
    [1205, 503, 'RETRY_LATER', null], [8152, 500, 'INTERNAL', null],
  ])('%i -> %i %s', (n, status, code, details) => {
    const e = mapSqlError(n);
    expect([e.status, e.code, e.details]).toEqual([status, code, details]);
    expect(e.sqlNumber).toBe(n);
  });

  it('isDbConfigError chi 18456 va 4060', () => {
    expect([18456, 4060, 547, null].map(isDbConfigError)).toEqual([true, true, false, false]);
  });
});
```

`backend/src/common/validation.spec.ts`:

```ts
import { IsInt, IsOptional, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiError } from './errors';
import { IsUtcIso, IsVnDate, isUtcIso, validateDto } from './validation';

class Inner { @IsUtcIso() at!: string }
class Outer {
  @IsString() camera!: string;
  @IsInt() count!: number;
  @IsOptional() @IsVnDate() day?: string;
  @ValidateNested() @Type(() => Inner) inner!: Inner;
}

describe('isUtcIso', () => {
  it.each([
    ['2026-10-12T10:40:00Z', true], ['2026-10-12T10:40:00.000Z', true], ['2026-10-12T10:40:00.5Z', true],
    ['2026-10-12T10:40:00', false], ['2026-10-12T17:40:00+07:00', false], ['2026-02-30T00:00:00Z', false],
    ['2026-10-12', false], [1760265600000, false], [null, false],
  ])('%p -> %p', (v, ok) => expect(isUtcIso(v)).toBe(ok));
});

describe('validateDto', () => {
  it('hop le -> tra instance', async () => {
    const o = await validateDto(Outer, { camera: 'H1-F0-CAMERA', count: 1, day: '2026-10-12', inner: { at: '2026-10-12T10:40:00Z' } });
    expect(o).toBeInstanceOf(Outer);
  });

  it('loi long nhau -> fields la ten truong la; truong la -> VALIDATION_ERROR', async () => {
    await expect(validateDto(Outer, { camera: 'x', count: 1, inner: { at: '2026-10-12T17:40:00+07:00' } }))
      .rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR', details: { fields: ['at'] } });
    await expect(validateDto(Outer, { camera: 'x', count: 1, inner: { at: '2026-10-12T10:40:00Z' }, extra: 1 }))
      .rejects.toMatchObject({ details: { fields: ['extra'] } });
    await expect(validateDto(Outer, { camera: 'x', count: 1.5, day: '12/10/2026', inner: { at: '2026-10-12T10:40:00Z' } }))
      .rejects.toBeInstanceOf(ApiError);
  });
});
```

`backend/src/common/all-exceptions.filter.spec.ts`:

```ts
import { BadRequestException, ForbiddenException, NotFoundException, PayloadTooLargeException, UnauthorizedException } from '@nestjs/common';
import { ApiError, MESSAGES } from './errors';
import { AllExceptionsFilter, toApiError } from './all-exceptions.filter';

function hostFor(res: { status: jest.Mock; json: jest.Mock }) {
  return { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'GET', route: { path: '/api/x' }, url: '/api/x?secret=1' }) }) } as never;
}

describe('toApiError', () => {
  it.each([
    [new NotFoundException(), 404, 'NOT_FOUND'],
    [new PayloadTooLargeException(), 413, 'PAYLOAD_TOO_LARGE'],
    [new UnauthorizedException(), 401, 'UNAUTHENTICATED'],
    [new ForbiddenException(), 403, 'FORBIDDEN'],
    [new BadRequestException('Unexpected token } in JSON'), 400, 'VALIDATION_ERROR'],
    [{ number: 50021 }, 409, 'ALERT_INVALID_TRANSITION'],
    [{ code: 'P1001' }, 503, 'RETRY_LATER'],
    [new Error('bat ngo'), 500, 'INTERNAL'],
  ])('%p -> %i %s', (e, status, code) => {
    const a = toApiError(e);
    expect([a.status, a.code]).toEqual([status, code]);
  });

  it('ApiError giu nguyen', () => {
    const e = new ApiError(409, 'LAST_ADMIN');
    expect(toApiError(e)).toBe(e);
  });
});

describe('AllExceptionsFilter', () => {
  it('tra dung dinh dang hop dong 3.4, message tu bang co dinh, khong lo loi SQL', () => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const failures: unknown[] = [];
    new AllExceptionsFilter({ reportFailure: (e) => failures.push(e) }).catch(Object.assign(new Error('The UPDATE statement conflicted with the CHECK constraint "CK_X" in C:\\db'), { number: 547 }), hostFor(res));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'CONSTRAINT_VIOLATION', message: MESSAGES.CONSTRAINT_VIOLATION, sqlNumber: 547, details: null } });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/CHECK|C:\\/);
    expect(failures).toEqual([]);
  });

  it('loi ket noi -> 503 RETRY_LATER va bao DbHealth', () => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const failures: unknown[] = [];
    new AllExceptionsFilter({ reportFailure: (e) => failures.push(e) }).catch({ code: 'P1001' }, hostFor(res));
    expect(res.status).toHaveBeenCalledWith(503);
    expect(failures).toHaveLength(1);
  });

  it('moi code trong MESSAGES la cau tieng Viet khong rong', () => {
    for (const code of ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CANNOT_MODIFY_SELF', 'LAST_ADMIN',
      'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'INTERNAL', 'RETRY_LATER', 'DEVICE_NOT_CONTROLLABLE', 'CAMERA_NOT_FOUND',
      'ALERT_NOT_FOUND', 'ALERT_INVALID_TRANSITION', 'INVALID_JSON', 'INVALID_PARAMETER', 'CONSTRAINT_VIOLATION', 'DUPLICATE']) {
      expect(MESSAGES[code]?.length).toBeGreaterThan(5);
    }
  });
});
```

Run: `npx jest src/db/sql-errors src/common`
Expected: FAIL (module chưa có).

- [ ] **Step 2: Viết `backend/src/common/errors.ts`**

```ts
export const DB_HEALTH = 'DB_HEALTH';
export interface DbHealth { reportFailure(err: unknown): void }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly sqlNumber: number | null = null,
    readonly details: unknown = null,
  ) {
    super(code);
  }
}

// Cau thong bao co dinh theo code (spec backend 5.5): khong bao gio chua loi SQL, duong dan, stack.
export const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Dữ liệu gửi lên không hợp lệ.',
  UNAUTHENTICATED: 'Chưa đăng nhập, phiên đã hết hạn hoặc thông tin đăng nhập không đúng.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
  CANNOT_MODIFY_SELF: 'Không thể tự khóa hoặc tự hạ vai trò của chính mình.',
  LAST_ADMIN: 'Phải còn ít nhất một quản trị viên đang hoạt động.',
  PAYLOAD_TOO_LARGE: 'Dữ liệu gửi lên vượt kích thước cho phép.',
  UNSUPPORTED_MEDIA_TYPE: 'Định dạng tệp không được hỗ trợ (chỉ nhận ảnh JPEG).',
  INTERNAL: 'Lỗi hệ thống. Vui lòng thử lại hoặc báo quản trị viên.',
  RETRY_LATER: 'Hệ thống đang bận hoặc chưa sẵn sàng, vui lòng thử lại sau.',
  DEVICE_NOT_CONTROLLABLE: 'Thiết bị không điều khiển được (đã ngừng dùng hoặc không phải cơ cấu chấp hành).',
  CAMERA_NOT_FOUND: 'Không tìm thấy camera đang hoạt động với mã này.',
  ALERT_NOT_FOUND: 'Không tìm thấy cảnh báo.',
  ALERT_INVALID_TRANSITION: 'Không thể chuyển cảnh báo sang trạng thái này.',
  INVALID_JSON: 'Dữ liệu JSON không hợp lệ.',
  INVALID_PARAMETER: 'Tham số không hợp lệ.',
  CONSTRAINT_VIOLATION: 'Dữ liệu vi phạm ràng buộc (ví dụ ngưỡng dưới phải nhỏ hơn ngưỡng trên).',
  DUPLICATE: 'Dữ liệu bị trùng với bản ghi đã có.',
};
```

- [ ] **Step 3: Viết `backend/src/db/sql-errors.ts`**

Đường lấy số theo S6: thứ tự dò dưới đây phủ các dạng đã gặp; nếu S6 cho thấy số nằm ở thuộc tính khác thì **thêm tên thuộc tính đó vào `NUMBER_KEYS`** và thêm một ca vào test.

```ts
import { ApiError } from '../common/errors';

const NUMBER_KEYS = ['number', 'originalCode', 'code', 'errorCode'];
const PRISMA_CODES: Record<string, number> = { P2002: 2627, P2003: 547, P2004: 547 };
const MESSAGE_RULES: Array<[RegExp, number]> = [
  [/deadlock victim/i, 1205],
  [/conflicted with the (CHECK|FOREIGN KEY|REFERENCE) constraint/i, 547],
  [/duplicate key|UNIQUE KEY constraint|unique index/i, 2627],
  [/Login failed for user/i, 18456],
  [/Cannot open database/i, 4060],
];
const CONNECTION_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'ESOCKET', 'ETIMEOUT', 'ECONNCLOSED', 'ECONNREFUSED', 'ECONNRESET', 'ENOTOPEN', 'EINSTLOOKUP']);
const CONNECTION_MESSAGE = /Failed to connect|Connection lost|ConnectionError|socket hang up|Connection is closed|Timeout: Request failed|server closed the connection/i;

function* walk(err: unknown, seen = new Set<unknown>()): Generator<Record<string, unknown>> {
  if (err === null || typeof err !== 'object' || seen.has(err)) return;
  seen.add(err);
  const o = err as Record<string, unknown>;
  yield o;
  for (const k of ['cause', 'meta', 'driverAdapterError', 'originalError', 'error']) yield* walk(o[k], seen);
}

export function sqlNumberOf(err: unknown): number | null {
  const messages: string[] = [];
  for (const o of walk(err)) {
    for (const k of NUMBER_KEYS) {
      const v = o[k];
      if (typeof v === 'string' && PRISMA_CODES[v]) return PRISMA_CODES[v];
      const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{3,5}$/.test(v) ? Number(v) : NaN;
      if (Number.isInteger(n) && n >= 100) return n;
    }
    if (typeof o.message === 'string') messages.push(o.message);
  }
  for (const m of messages) for (const [re, n] of MESSAGE_RULES) if (re.test(m)) return n;
  return null;
}

export function isConnectionError(err: unknown): boolean {
  for (const o of walk(err)) {
    if (typeof o.code === 'string' && CONNECTION_CODES.has(o.code)) return true;
    if (typeof o.message === 'string' && CONNECTION_MESSAGE.test(o.message)) return true;
  }
  return false;
}

export const isDbConfigError = (n: number | null): boolean => n === 18456 || n === 4060;

// Bang doi ma hop dong 3.5.
export function mapSqlError(n: number): ApiError {
  const fields: Record<number, string[]> = { 50012: ['in', 'out'], 50013: ['class'], 50014: ['windowStart'] };
  if (fields[n]) return new ApiError(400, 'VALIDATION_ERROR', n, { fields: fields[n] });
  const table: Record<number, [number, string]> = {
    50003: [409, 'DEVICE_NOT_CONTROLLABLE'], 50010: [404, 'CAMERA_NOT_FOUND'], 50020: [404, 'ALERT_NOT_FOUND'],
    50021: [409, 'ALERT_INVALID_TRANSITION'], 50030: [400, 'INVALID_JSON'],
    50040: [400, 'INVALID_PARAMETER'], 50041: [400, 'INVALID_PARAMETER'], 50042: [400, 'INVALID_PARAMETER'],
    547: [400, 'CONSTRAINT_VIOLATION'], 2627: [409, 'DUPLICATE'], 2601: [409, 'DUPLICATE'], 1205: [503, 'RETRY_LATER'],
  };
  const [status, code] = table[n] ?? [500, 'INTERNAL'];
  return new ApiError(status, code, n);
}
```

- [ ] **Step 4: Viết `backend/src/common/validation.ts`**

```ts
import { ValidationError, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ValidateBy, validate } from 'class-validator';
import { ApiError } from './errors';

export const ISO_Z_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const VN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isUtcIso(v: unknown): boolean {
  if (typeof v !== 'string' || !ISO_Z_RE.test(v)) return false;
  const t = Date.parse(v);
  // Date tu tran ngay (30/02 -> 02/03): so lai phan ngay gio de bat ngay khong co that.
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 19) === v.slice(0, 19);
}

export function isVnDate(v: unknown): boolean {
  return typeof v === 'string' && VN_DATE_RE.test(v) && isUtcIso(`${v}T00:00:00Z`);
}

export const IsUtcIso = () => ValidateBy({ name: 'isUtcIso', validator: { validate: isUtcIso, defaultMessage: () => 'phai la ISO 8601 UTC co Z' } });
export const IsVnDate = () => ValidateBy({ name: 'isVnDate', validator: { validate: isVnDate, defaultMessage: () => 'phai la YYYY-MM-DD' } });

// Ten truong la (bo khung long nhau va chi so mang), giu thu tu, khong trung (bo sung hop dong B7).
export function leafFields(errors: ValidationError[]): string[] {
  const out: string[] = [];
  const visit = (e: ValidationError) => {
    if (e.children?.length) e.children.forEach(visit);
    else if (!out.includes(e.property)) out.push(e.property);
  };
  errors.forEach(visit);
  return out;
}

export const validationError = (errors: ValidationError[]) => new ApiError(400, 'VALIDATION_ERROR', null, { fields: leafFields(errors) });

export function validationPipe(): ValidationPipe {
  return new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: validationError });
}

export async function validateDto<T extends object>(cls: new () => T, plain: unknown): Promise<T> {
  const obj = plainToInstance(cls, plain);
  if (obj === null || typeof obj !== 'object') throw new ApiError(400, 'VALIDATION_ERROR', null, { fields: [cls.name] });
  const errors = await validate(obj, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) throw validationError(errors);
  return obj;
}
```

- [ ] **Step 5: Viết `backend/src/common/all-exceptions.filter.ts`**

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Inject, Logger, Optional } from '@nestjs/common';
import { ApiError, DB_HEALTH, DbHealth, MESSAGES } from './errors';
import { isConnectionError, mapSqlError, sqlNumberOf } from '../db/sql-errors';

const HTTP_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE', 415: 'UNSUPPORTED_MEDIA_TYPE', 503: 'RETRY_LATER',
};

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof HttpException) {
    const status = e.getStatus();
    const code = HTTP_CODES[status] ?? 'INTERNAL';
    // 400 cua Nest (JSON hong, ParseIntPipe...) khong co ten truong cu the.
    return new ApiError(code === 'INTERNAL' ? 500 : status, code, null, code === 'VALIDATION_ERROR' ? { fields: ['body'] } : null);
  }
  if (isConnectionError(e)) return new ApiError(503, 'RETRY_LATER');
  const n = sqlNumberOf(e);
  return n !== null ? mapSqlError(n) : new ApiError(500, 'INTERNAL');
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Loi');

  constructor(@Optional() @Inject(DB_HEALTH) private readonly dbHealth?: DbHealth) {}

  catch(e: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    const api = toApiError(e);
    if (api.code === 'RETRY_LATER' && api.sqlNumber === null && isConnectionError(e)) this.dbHealth?.reportFailure(e);
    // Chi log ma, route, code - khong log header, body, query (spec backend 2.3).
    if (api.status >= 500) {
      this.log.error(`${req?.method} ${req?.route?.path ?? '(khong co route)'} -> ${api.status} ${api.code}${api.sqlNumber ? ` sql ${api.sqlNumber}` : ''}: ${(e as Error)?.constructor?.name ?? typeof e}`);
    }
    res.status(api.status).json({ error: { code: api.code, message: MESSAGES[api.code] ?? MESSAGES.INTERNAL, sqlNumber: api.sqlNumber, details: api.details } });
  }
}
```

- [ ] **Step 6: Chạy test**

Run: `npx jest src/db/sql-errors src/common`
Expected: PASS mọi test.

- [ ] **Step 7: Commit**

```powershell
git add backend/src/common backend/src/db/sql-errors.ts backend/src/db/sql-errors.spec.ts
git commit -m "feat(backend): định dạng lỗi hợp đồng, đổi số lỗi SQL, kiểm đầu vào có Z

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Bộ tuần tự hóa và hàm chọn trường

**Files:**
- Create: `backend/src/common/serialize.ts`, `backend/src/common/serialize.spec.ts`, `backend/src/common/serialize.interceptor.ts`, `backend/src/common/pickers.ts`, `backend/src/common/pickers.spec.ts`

**Interfaces:**
- Produces:
  - `serialize(v: unknown): unknown` — `Date` → `toISOString()`, Decimal (có `toFixed` và `d`/`constructor.name === 'Decimal'`) → `number`, `bigint` → chuỗi, khóa object → camelCase (ký tự đầu viết thường), giữ thứ tự khóa, `undefined` → `null`.
  - `assertSerialized(v: unknown, path?: string): void` — ném `Error` nếu còn khóa bắt đầu chữ hoa, `Date`, Decimal, `bigint` (chỉ gọi khi `NODE_ENV=test`).
  - `parseJsonColumn<T = unknown>(s: string | null | undefined, fallback: T): T`.
  - `SerializeInterceptor` (đăng ký `APP_INTERCEPTOR` ở Task 8): áp `serialize` cho mọi phản hồi trừ `StreamableFile`/`Buffer`.
  - `pickers.ts`: hàm nhận dòng PascalCase (Prisma hoặc SP), trả object camelCase **đã serialize**: `user`, `house`, `zone`, `device`, `metric`, `threshold`, `latestReading`, `readingBucket`, `dailyStats`, `controlLog`, `alert`, `alertWithHistory`, `alertStatus`, `alertFromSp`, `readingEvent`, `birdFlow`, `birdCount`, `harvest`, `vnDate(d: Date | string): string`.
- Tên trường: theo bảng spec backend 5.4 **và** fixture hợp đồng. Chỉ số đo đổi `MetricCode → metric`, `RecordedAt → at` (`latestReading`, `readingEvent`); cảnh báo và ngưỡng **giữ `metricCode`** (fixture `alerts-list.page`, `thresholds-put`, `ws/alert.created.*`).

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/common/serialize.spec.ts`:

```ts
import { assertSerialized, parseJsonColumn, serialize } from './serialize';

class Decimal { constructor(private readonly s: string) {} toFixed() { return this.s; } toString() { return this.s; } }

describe('serialize', () => {
  it('doi kieu theo gia tri va khoa camelCase, giu thu tu khoa', () => {
    const out = serialize({ HouseId: 1, Value: new Decimal('31.20'), ReadingId: 9007199254740993n, CreatedAt: new Date(Date.UTC(2026, 9, 12, 10, 40)), Nested: [{ MetricCode: 'TEMP', X: undefined }] });
    expect(out).toEqual({ houseId: 1, value: 31.2, readingId: '9007199254740993', createdAt: '2026-10-12T10:40:00.000Z', nested: [{ metricCode: 'TEMP', x: null }] });
    expect(Object.keys(out as object)).toEqual(['houseId', 'value', 'readingId', 'createdAt', 'nested']);
  });

  it('chuoi thoi gian tu cot JSON cua SP giu nguyen (...Z)', () => {
    expect(serialize({ CreatedAt: '2026-10-12T10:40:00Z' })).toEqual({ createdAt: '2026-10-12T10:40:00Z' });
  });

  it('assertSerialized bat khoa PascalCase, Date, Decimal, bigint', () => {
    expect(() => assertSerialized({ HouseId: 1 })).toThrow(/HouseId/);
    expect(() => assertSerialized({ a: new Date() })).toThrow(/Date/);
    expect(() => assertSerialized({ a: [{ b: new Decimal('1') }] })).toThrow(/Decimal/);
    expect(() => assertSerialized({ a: 1n })).toThrow(/bigint/);
    expect(() => assertSerialized(serialize({ HouseId: 1, V: new Decimal('2') }))).not.toThrow();
  });

  it('parseJsonColumn', () => {
    expect(parseJsonColumn('[{"AlertId":1}]', [])).toEqual([{ AlertId: 1 }]);
    expect(parseJsonColumn(null, [])).toEqual([]);
  });
});
```

`backend/src/common/pickers.spec.ts`:

```ts
import * as pick from './pickers';

class Decimal { constructor(private readonly s: string) {} toFixed() { return this.s; } toString() { return this.s; } }
const ALERT_KEYS = ['alertId', 'houseId', 'zoneId', 'deviceId', 'alertType', 'severity', 'metricCode', 'value',
  'detectedClass', 'confidence', 'hasSnapshot', 'message', 'status', 'createdAt'];

const alertRow = {
  AlertId: 7, HouseId: 1, ZoneId: 2, DeviceId: null, AlertType: 'THRESHOLD', Severity: 'WARNING', MetricCode: 'TEMP',
  Value: new Decimal('31.20'), DetectedClass: null, Confidence: null, SnapshotPath: 'snapshots/x.jpg', Message: 'm',
  Status: 'NEW', CreatedAt: new Date(Date.UTC(2026, 9, 12)), ResolvedAt: null, ResolvedBy: null,
};

describe('pickers', () => {
  it('alert: dung 14 khoa dung thu tu, hasSnapshot thay SnapshotPath', () => {
    const a = pick.alert(alertRow) as Record<string, unknown>;
    expect(Object.keys(a)).toEqual(ALERT_KEYS);
    expect(a.hasSnapshot).toBe(true);
    expect(a.value).toBe(31.2);
    expect(JSON.stringify(a)).not.toContain('snapshots/');
  });

  it('alertFromSp: cot JSON PascalCase cua SP -> 14 khoa', () => {
    const sp = { AlertId: 1, HouseId: 1, ZoneId: null, DeviceId: 3, AlertType: 'PREDATOR', Severity: 'CRITICAL', MetricCode: null, Value: null, DetectedClass: 'snake', Confidence: 0.87, HasSnapshot: true, Message: 'x', Status: 'NEW', CreatedAt: '2026-10-12T10:40:00Z' };
    expect(Object.keys(pick.alertFromSp(sp) as object)).toEqual(ALERT_KEYS);
  });

  it('user: khong bao gio co passwordHash', () => {
    const u = pick.user({ UserId: 2, Username: 'owner1', PasswordHash: '$2a$10$x', FullName: 'A', Email: 'e', Phone: null, Role: 'OWNER', IsActive: true, CreatedAt: new Date() });
    expect(u).toEqual({ userId: 2, username: 'owner1', fullName: 'A', email: 'e', phone: null, role: 'OWNER', isActive: true });
  });

  it('latestReading va readingEvent: MetricCode -> metric, RecordedAt -> at', () => {
    const at = new Date(Date.UTC(2026, 9, 12, 10, 40));
    expect(pick.latestReading({ HouseId: 1, ZoneId: 2, ZoneName: 'F1', DeviceId: 5, DeviceCode: 'H1-F1-SENSOR', DeviceStatus: 'ONLINE', MetricCode: 'TEMP', Unit: '°C', Value: new Decimal('28.5'), RecordedAt: at }))
      .toEqual({ houseId: 1, zoneId: 2, zoneName: 'F1', deviceId: 5, deviceCode: 'H1-F1-SENSOR', deviceStatus: 'ONLINE', metric: 'TEMP', unit: '°C', value: 28.5, at: '2026-10-12T10:40:00.000Z' });
    expect(pick.readingEvent({ DeviceId: 5, DeviceCode: 'H1-F1-SENSOR', HouseId: 1, ZoneId: 2, MetricCode: 'TEMP', Value: 31.2, RecordedAt: '2026-10-12T10:40:07Z' }))
      .toEqual({ deviceId: 5, deviceCode: 'H1-F1-SENSOR', zoneId: 2, metric: 'TEMP', value: 31.2, at: '2026-10-12T10:40:07Z' });
  });

  it('threshold giu metricCode; dailyStats/birdFlow doi ngay VN thanh YYYY-MM-DD', () => {
    expect(pick.threshold({ ZoneId: 2, MetricCode: 'TEMP', MinValue: new Decimal('25'), MaxValue: new Decimal('31'), TargetValue: null, UpdatedBy: 2, UpdatedAt: new Date(0) }))
      .toEqual({ zoneId: 2, metricCode: 'TEMP', minValue: 25, maxValue: 31, targetValue: null, updatedBy: 2, updatedAt: '1970-01-01T00:00:00.000Z' });
    expect(pick.birdFlow({ HouseId: 1, DayVn: new Date(Date.UTC(2026, 9, 12)), InTotal: 10, OutTotal: 3, Net: 7 }))
      .toEqual({ houseId: 1, dayVn: '2026-10-12', inTotal: 10, outTotal: 3, net: 7 });
    expect(pick.vnDate('2026-10-12')).toBe('2026-10-12');
  });

  it('alertStatus: cot cua sp_UpdateAlertStatus', () => {
    expect(pick.alertStatus({ AlertId: 7, HouseId: 1, ZoneId: 4, AlertType: 'THRESHOLD', Status: 'ACK', ResolvedAt: null, ResolvedBy: null }))
      .toEqual({ alertId: 7, houseId: 1, zoneId: 4, alertType: 'THRESHOLD', status: 'ACK', resolvedAt: null, resolvedBy: null });
  });
});
```

Run: `npx jest src/common/serialize src/common/pickers`
Expected: FAIL (module chưa có).

- [ ] **Step 2: Viết `backend/src/common/serialize.ts`**

```ts
type Obj = Record<string, unknown>;

// Decimal cua Prisma (decimal.js): ten lop co the bi rut gon khi dong goi, nen nhan ca theo cau truc d/e/s.
const isDecimal = (v: unknown): v is { toString(): string } => {
  if (typeof v !== 'object' || v === null || typeof (v as { toFixed?: unknown }).toFixed !== 'function') return false;
  const o = v as { d?: unknown; e?: unknown; s?: unknown };
  return (v as object).constructor?.name === 'Decimal' || (Array.isArray(o.d) && typeof o.e === 'number' && typeof o.s === 'number');
};

const camel = (k: string): string => (k ? k[0].toLowerCase() + k.slice(1) : k);

export function serialize(v: unknown): unknown {
  if (v === undefined) return null;
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (isDecimal(v)) return Number(v.toString());
  if (Array.isArray(v)) return v.map(serialize);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v as Obj).map(([k, x]) => [camel(k), serialize(x)]));
  return v;
}

export function assertSerialized(v: unknown, path = '$'): void {
  if (typeof v === 'bigint') throw new Error(`${path}: bigint chua doi`);
  if (v instanceof Date) throw new Error(`${path}: Date chua doi`);
  if (isDecimal(v)) throw new Error(`${path}: Decimal chua doi`);
  if (Array.isArray(v)) return v.forEach((x, i) => assertSerialized(x, `${path}[${i}]`));
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Obj)) {
      if (/^[A-Z]/.test(k)) throw new Error(`${path}.${k}: khoa PascalCase`);
      assertSerialized(x, `${path}.${k}`);
    }
  }
}

export function parseJsonColumn<T = unknown>(s: string | null | undefined, fallback: T): T {
  return s ? (JSON.parse(s) as T) : fallback;
}
```

- [ ] **Step 3: Viết `backend/src/common/serialize.interceptor.ts`**

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { assertSerialized, serialize } from './serialize';

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((body) => {
      if (body instanceof StreamableFile || Buffer.isBuffer(body)) return body;
      const out = serialize(body);
      if (process.env.NODE_ENV === 'test') assertSerialized(out);
      return out;
    }));
  }
}
```

- [ ] **Step 4: Viết `backend/src/common/pickers.ts`**

```ts
import { serialize } from './serialize';

type Row = Record<string, unknown>;
const out = (o: Row) => serialize(o) as Record<string, unknown>;

// Ngay VN (cot DATE): mssql tra Date luc 00:00 UTC khi useUTC = true; chuoi giu nguyen.
export function vnDate(d: unknown): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

export const user = (u: Row) => out({ userId: u.UserId, username: u.Username, fullName: u.FullName, email: u.Email, phone: u.Phone, role: u.Role, isActive: u.IsActive });
export const house = (h: Row) => out({ houseId: h.HouseId, ownerId: h.OwnerId, name: h.Name, address: h.Address, isActive: h.IsActive, createdAt: h.CreatedAt });
export const zone = (z: Row) => out({ zoneId: z.ZoneId, houseId: z.HouseId, name: z.Name, floorNo: z.FloorNo });
export const device = (d: Row) => out({
  deviceId: d.DeviceId, zoneId: d.ZoneId, code: d.Code, name: d.Name, deviceType: d.DeviceType, status: d.Status,
  lastSeenAt: d.LastSeenAt, mode: d.Mode, isOn: d.IsOn, level: d.Level, isActive: d.IsActive,
});
export const metric = (m: Row) => out({ metricCode: m.MetricCode, name: m.Name, unit: m.Unit, validMin: m.ValidMin, validMax: m.ValidMax, hysteresis: m.Hysteresis });
export const threshold = (t: Row) => out({ zoneId: t.ZoneId, metricCode: t.MetricCode, minValue: t.MinValue, maxValue: t.MaxValue, targetValue: t.TargetValue, updatedBy: t.UpdatedBy, updatedAt: t.UpdatedAt });
export const latestReading = (r: Row) => out({
  houseId: r.HouseId, zoneId: r.ZoneId, zoneName: r.ZoneName, deviceId: r.DeviceId, deviceCode: r.DeviceCode,
  deviceStatus: r.DeviceStatus, metric: r.MetricCode, unit: r.Unit, value: r.Value, at: r.RecordedAt,
});
export const readingBucket = (r: Row) => out({ bucketUtc: r.BucketUtc, avgValue: r.AvgValue, minValue: r.MinValue, maxValue: r.MaxValue });
export const dailyStats = (r: Row) => out({ zoneId: r.ZoneId, metric: r.MetricCode, dayVn: vnDate(r.DayVn), avgValue: r.AvgValue, minValue: r.MinValue, maxValue: r.MaxValue, samples: r.Samples });
export const controlLog = (l: Row) => out({ logId: l.LogId, deviceId: l.DeviceId, isOn: l.IsOn, level: l.Level, mode: l.Mode, source: l.Source, userId: l.UserId, reason: l.Reason, createdAt: l.CreatedAt });

// Cảnh báo: 14 khoa dung thu tu (hop dong 4.2); khong bao gio tra SnapshotPath.
export const alert = (a: Row) => out({
  alertId: a.AlertId, houseId: a.HouseId, zoneId: a.ZoneId, deviceId: a.DeviceId, alertType: a.AlertType, severity: a.Severity,
  metricCode: a.MetricCode, value: a.Value, detectedClass: a.DetectedClass, confidence: a.Confidence,
  hasSnapshot: a.SnapshotPath !== null && a.SnapshotPath !== undefined, message: a.Message, status: a.Status, createdAt: a.CreatedAt,
});
export const alertWithHistory = (a: Row & { History?: Row[] }) => ({
  ...alert(a),
  history: (a.History ?? []).map((h) => out({ historyId: h.HistoryId, oldStatus: h.OldStatus, newStatus: h.NewStatus, userId: h.UserId, note: h.Note, changedAt: h.ChangedAt })),
});
export const alertFromSp = (a: Row) => out({
  alertId: a.AlertId, houseId: a.HouseId, zoneId: a.ZoneId, deviceId: a.DeviceId, alertType: a.AlertType, severity: a.Severity,
  metricCode: a.MetricCode, value: a.Value, detectedClass: a.DetectedClass, confidence: a.Confidence,
  hasSnapshot: a.HasSnapshot, message: a.Message, status: a.Status, createdAt: a.CreatedAt,
});
export const alertStatus = (a: Row) => out({ alertId: a.AlertId, houseId: a.HouseId, zoneId: a.ZoneId, alertType: a.AlertType, status: a.Status, resolvedAt: a.ResolvedAt, resolvedBy: a.ResolvedBy });
export const readingEvent = (r: Row) => out({ deviceId: r.DeviceId, deviceCode: r.DeviceCode, zoneId: r.ZoneId, metric: r.MetricCode, value: r.Value, at: r.RecordedAt });
export const birdFlow = (b: Row) => out({ houseId: b.HouseId, dayVn: vnDate(b.DayVn), inTotal: b.InTotal, outTotal: b.OutTotal, net: b.Net });
export const birdCount = (b: Row) => out({ countId: b.CountId, cameraId: b.CameraId, windowStart: b.WindowStart, inCount: b.InCount, outCount: b.OutCount });
export const harvest = (h: Row) => out({ harvestId: h.HarvestId, zoneId: h.ZoneId, harvestDate: vnDate(h.HarvestDate), nestCount: h.NestCount, weightGram: h.WeightGram, grade: h.Grade, recordedBy: h.RecordedBy, createdAt: h.CreatedAt });
```

- [ ] **Step 5: Chạy test**

Run: `npx jest src/common`
Expected: PASS mọi test (cả Task 4).

- [ ] **Step 6: Commit**

```powershell
git add backend/src/common
git commit -m "feat(backend): bộ tuần tự hóa chung và hàm chọn trường theo hợp đồng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: `DbService` (kết nối, sẵn sàng, thử lại) và `SpService` (mỗi SP một hàm), SP giả

**Files:**
- Create: `backend/src/db/db.service.ts`, `backend/src/db/db.service.spec.ts`, `backend/src/db/sp.ts`, `backend/src/db/sp.spec.ts`, `backend/src/db/db.module.ts`, `backend/test-support/fake-sps.sql`, `backend/src/common/async.ts`

**Interfaces:**
- Consumes: `APP_CONFIG`, `AppConfig` (Task 2); `DB_HEALTH`, `DbHealth` (Task 4); `sqlNumberOf`, `isConnectionError`, `isDbConfigError` (Task 4); `PrismaClient` từ `db/prisma-client.ts` (Task 1).
- Produces:
  - `common/async.ts`: `sleep(ms): Promise<void>`, `withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T>` (quá hạn → `Error('timeout: <label>')`), `RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000]`, `retryDelay(attempt: number): number`.
  - `DbService implements DbHealth`: `get prisma(): PrismaClient`, `isReady(): boolean`, `addLoader(name: string, fn: () => Promise<void>): void`, `start(): void`, `reportFailure(err: unknown): void`, `ping(): Promise<boolean>`, `onModuleDestroy()`. Token phụ: `PRISMA_FACTORY` (`(cfg: AppConfig) => PrismaClient`), `EXIT` (`(code: number) => void`).
  - `SpService` với các kiểu `ReadingItem { device: string; metric: string; value: number; at: string }`, `AcceptedRow`, `SpAlert` (`Record<string, unknown>`, khóa PascalCase của SP), `IngestResult { received: number; accepted: number; duplicates: number; rejected: number; acceptedRows: AcceptedRow[]; newAlerts: SpAlert[]; resolvedAlertIds: number[] }`, `SetActuatorArgs`, `ActuatorResult { changed: boolean; deviceCode: string; mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null }`; hàm `ingestReadings`, `setActuator`, `updateAlertStatus`, `readingHistory`, `recordBirdCount`, `createPredatorAlert`, `detectAnomalies`, `recordHeartbeat`, `reportEnvVsYield`.
  - `DbModule` (global): cung cấp `DbService`, `SpService`, `DB_HEALTH` (useExisting `DbService`).

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/db/db.service.spec.ts`:

```ts
import { AppConfig } from '../config/config';
import { DbService } from './db.service';

const cfg = { db: { server: 's', port: 1433, database: 'd', user: 'u', password: 'p' } } as AppConfig;

function fakePrisma(results: Array<'ok' | Error>) {
  const p = {
    $queryRawUnsafe: jest.fn(async () => {
      const r = results.length > 1 ? results.shift()! : results[0];
      if (r instanceof Error) throw r;
      return [{ ok: 1 }];
    }),
    $disconnect: jest.fn(async () => undefined),
  };
  return p;
}

describe('DbService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('thu lai 1, 2 giay roi san sang; chay loader truoc khi bao san sang', async () => {
    const prisma = fakePrisma([Object.assign(new Error('Failed to connect'), {}), new Error('Failed to connect'), 'ok']);
    const db = new DbService(cfg, () => prisma as never, jest.fn());
    const loaded: string[] = [];
    db.addLoader('cache', async () => { loaded.push('cache'); });
    db.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(db.isReady()).toBe(false);
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.isReady()).toBe(false);
    await jest.advanceTimersByTimeAsync(2000);
    expect(db.isReady()).toBe(true);
    expect(loaded).toEqual(['cache']);
  });

  it('loi cau hinh 18456 lien tiep 5 lan -> goi exit(1), khong in mat khau', async () => {
    const exit = jest.fn();
    const logged: string[] = [];
    const prisma = fakePrisma([Object.assign(new Error("Login failed for user 'u'."), { number: 18456 })]);
    const db = new DbService(cfg, () => prisma as never, exit);
    (db as unknown as { log: { error: (m: string) => void; warn: (m: string) => void; log: (m: string) => void } }).log =
      { error: (m) => logged.push(m), warn: (m) => logged.push(m), log: (m) => logged.push(m) };
    db.start();
    await jest.advanceTimersByTimeAsync(1000 + 2000 + 5000 + 10000 + 1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(logged.join('\n')).toContain('DB_USER');
    expect(logged.join('\n')).not.toMatch(/password=|PWD=/i);
  });

  it('reportFailure -> het san sang, tao lai client, ket noi lai', async () => {
    const created: unknown[] = [];
    const factory = () => { const p = fakePrisma(['ok']); created.push(p); return p as never; };
    const db = new DbService(cfg, factory, jest.fn());
    db.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(db.isReady()).toBe(true);
    db.reportFailure(new Error('Connection lost'));
    expect(db.isReady()).toBe(false);
    await jest.advanceTimersByTimeAsync(0);
    expect(db.isReady()).toBe(true);
    expect(created).toHaveLength(2);
  });

  it('ping luu tam 5 giay', async () => {
    const prisma = fakePrisma(['ok']);
    const db = new DbService(cfg, () => prisma as never, jest.fn());
    db.start();
    await jest.advanceTimersByTimeAsync(0);
    const before = prisma.$queryRawUnsafe.mock.calls.length;
    await db.ping(); await db.ping();
    expect(prisma.$queryRawUnsafe.mock.calls.length).toBe(before + 1);
    await jest.advanceTimersByTimeAsync(5001);
    await db.ping();
    expect(prisma.$queryRawUnsafe.mock.calls.length).toBe(before + 2);
  });
});
```

`backend/src/db/sp.spec.ts`:

```ts
import { SpService } from './sp';

function spWith(rows: unknown[] | Error | Array<unknown[] | Error>) {
  const queue = Array.isArray(rows) && rows.length && (Array.isArray(rows[0]) || rows[0] instanceof Error) ? [...(rows as Array<unknown[] | Error>)] : [rows as unknown[]];
  const prisma = { $queryRawUnsafe: jest.fn(async () => { const r = queue.length > 1 ? queue.shift()! : queue[0]; if (r instanceof Error) throw r; return r; }) };
  return { sp: new SpService({ prisma } as never), prisma };
}

describe('SpService', () => {
  it('ingestReadings: gui JSON qua @P1, doc 1 dong, parse 3 cot JSON', async () => {
    const { sp, prisma } = spWith([{ Received: 2, Accepted: 1, Duplicates: 1, Rejected: 0,
      AcceptedJson: '[{"DeviceId":5,"DeviceCode":"H1-F1-SENSOR","HouseId":1,"ZoneId":2,"MetricCode":"TEMP","Value":31.2,"RecordedAt":"2026-10-12T10:40:07Z"}]',
      NewAlertsJson: '[]', ResolvedAlertIdsJson: '[{"AlertId":9}]' }]);
    const items = [{ device: 'H1-F1-SENSOR', metric: 'TEMP', value: 31.2, at: '2026-10-12T10:40:07Z' }];
    const r = await sp.ingestReadings(items);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith('EXEC dbo.sp_IngestReadings @Json = @P1', JSON.stringify(items));
    expect(r).toMatchObject({ received: 2, accepted: 1, duplicates: 1, rejected: 0, newAlerts: [], resolvedAlertIds: [9] });
    expect(r.acceptedRows[0].ZoneId).toBe(2);
  });

  it('setActuator: dung thu tu tham so, doc Changed/Mode/IsOn/Level', async () => {
    const { sp, prisma } = spWith([{ Changed: true, DeviceCode: 'H1-F1-FAN', Mode: 'MANUAL', IsOn: true, Level: 80 }]);
    const r = await sp.setActuator({ deviceId: 3, isOn: true, level: 80, source: 'MANUAL', mode: 'MANUAL', userId: 2, reason: 'x' });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      'EXEC dbo.sp_SetActuator @DeviceId = @P1, @IsOn = @P2, @Level = @P3, @Source = @P4, @Mode = @P5, @UserId = @P6, @Reason = @P7',
      3, true, 80, 'MANUAL', 'MANUAL', 2, 'x');
    expect(r).toEqual({ changed: true, deviceCode: 'H1-F1-FAN', mode: 'MANUAL', isOn: true, level: 80 });
  });

  it('1205 -> tu thu lai dung 1 lan', async () => {
    const deadlock = Object.assign(new Error('deadlock victim'), { number: 1205 });
    const { sp, prisma } = spWith([deadlock, [{ WindowsUpserted: 1, WindowsUnchanged: 0 }]]);
    await expect(sp.recordBirdCount([{ camera: 'H1-F0-CAMERA', windowStart: '2026-10-12T10:00:00Z', in: 1, out: 0 }])).resolves.toEqual({ windowsUpserted: 1, windowsUnchanged: 0 });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('1205 hai lan -> nem loi (filter doi thanh 503)', async () => {
    const deadlock = Object.assign(new Error('deadlock victim'), { number: 1205 });
    const { sp } = spWith([deadlock, deadlock]);
    await expect(sp.recordBirdCount([])).rejects.toMatchObject({ number: 1205 });
  });

  it('SP tra 0 dong -> Error (vi pham quy uoc 1 tap ket qua 1 dong)', async () => {
    const { sp } = spWith([[]]);
    await expect(sp.updateAlertStatus(1, 'ACK', 2, null)).rejects.toThrow(/0 dong/);
  });

  it('createPredatorAlert: AlertJson -> object; detectAnomalies mac dinh 5 phut', async () => {
    const { sp } = spWith([{ Created: true, AlertId: 11, SkipReason: null, AlertJson: '{"AlertId":11}' }]);
    expect(await sp.createPredatorAlert({ camera: 'H1-F0-CAMERA', class: 'snake', confidence: 0.87, snapshot: 'snapshots/a.jpg', at: '2026-10-12T10:40:07Z' }))
      .toEqual({ created: true, alertId: 11, skipReason: null, alert: { AlertId: 11 } });
    const d = spWith([{ NewAlertsJson: '[]' }]);
    await d.sp.detectAnomalies();
    expect(d.prisma.$queryRawUnsafe).toHaveBeenCalledWith('EXEC dbo.sp_DetectAnomalies @OfflineMinutes = @P1, @NowUtc = @P2', 5, null);
  });
});
```

Run: `npx jest src/db`
Expected: FAIL (module chưa có).

- [ ] **Step 2: Viết `backend/src/common/async.ts`**

```ts
export const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];
export const retryDelay = (attempt: number): number => RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, reject) => { t = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms); }),
  ]);
}
```

- [ ] **Step 3: Viết `backend/src/db/db.service.ts`**

```ts
import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { APP_CONFIG, AppConfig } from '../config/config';
import { DbHealth } from '../common/errors';
import { retryDelay, sleep, withTimeout } from '../common/async';
import { PrismaClient } from './prisma-client';
import { isConnectionError, isDbConfigError, sqlNumberOf } from './sql-errors';

export const PRISMA_FACTORY = 'PRISMA_FACTORY';
export const EXIT = 'EXIT';

export function createPrisma(cfg: AppConfig): PrismaClient {
  // Truyen tung thanh phan, khong tu ghep chuoi ket noi (mat khau co the co ky tu dac biet); useUTC co dinh (R6).
  const adapter = new PrismaMssql({
    server: cfg.db.server, port: cfg.db.port, database: cfg.db.database, user: cfg.db.user, password: cfg.db.password,
    options: { encrypt: false, trustServerCertificate: true, useUTC: true },
  });
  return new PrismaClient({ adapter });
}

const CONFIG_HINT: Record<number, string> = {
  18456: 'dang nhap SQL Server bi tu choi, kiem tra DB_USER/DB_PASSWORD',
  4060: 'CSDL khong ton tai hoac khong co quyen, kiem tra DB_NAME',
};

@Injectable()
export class DbService implements DbHealth, OnModuleDestroy {
  private log: Pick<Logger, 'log' | 'warn' | 'error'> = new Logger('CSDL');
  private client: PrismaClient;
  private ready = false;
  private connecting = false;
  private stopped = false;
  private configFailures = 0;
  private lastPing: { at: number; ok: boolean } | null = null;
  private readonly loaders: Array<{ name: string; fn: () => Promise<void> }> = [];

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Optional() @Inject(PRISMA_FACTORY) private readonly factory: (cfg: AppConfig) => PrismaClient = createPrisma,
    @Optional() @Inject(EXIT) private readonly exit: (code: number) => void = (code) => process.exit(code),
  ) {
    this.client = this.factory(cfg);
  }

  get prisma(): PrismaClient { return this.client; }
  isReady(): boolean { return this.ready; }
  addLoader(name: string, fn: () => Promise<void>): void { this.loaders.push({ name, fn }); }

  start(): void {
    if (this.connecting || this.stopped) return;
    this.connecting = true;
    void this.connectLoop().finally(() => { this.connecting = false; });
  }

  reportFailure(err: unknown): void {
    if (!this.ready || !isConnectionError(err)) return;
    this.ready = false;
    this.lastPing = null;
    this.log.warn('Mat ket noi CSDL, dang ket noi lai');
    const old = this.client;
    void old.$disconnect().catch(() => undefined);
    this.client = this.factory(this.cfg); // S5: tao lai client cho chac chan sau RESTORE / khoi dong lai SQL Server
    this.start();
  }

  async ping(): Promise<boolean> {
    if (!this.ready) return false;
    if (this.lastPing && Date.now() - this.lastPing.at < 5000) return this.lastPing.ok;
    try {
      await this.client.$queryRawUnsafe('SELECT 1 AS ok');
      this.lastPing = { at: Date.now(), ok: true };
    } catch (e) {
      this.lastPing = { at: Date.now(), ok: false };
      this.reportFailure(e);
    }
    return this.lastPing?.ok ?? false;
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.client.$disconnect().catch(() => undefined);
  }

  private async connectLoop(): Promise<void> {
    let attempt = 0;
    let lastState = '';
    while (!this.stopped) {
      try {
        await withTimeout(this.client.$queryRawUnsafe('SELECT 1 AS ok'), 10000, 'SELECT 1');
        for (const l of this.loaders) await withTimeout(l.fn(), 10000, `nap ${l.name}`);
        this.ready = true;
        this.configFailures = 0;
        this.log.log('CSDL san sang (da nap bo nho dem)');
        return;
      } catch (e) {
        const n = sqlNumberOf(e);
        if (isDbConfigError(n)) {
          this.configFailures += 1;
          this.log.error(`Cau hinh CSDL sai (lan ${this.configFailures}/5): ${CONFIG_HINT[n as number]}`);
          if (this.configFailures >= 5) { this.exit(1); return; }
        } else {
          this.configFailures = 0;
          const state = (e as Error)?.message?.startsWith('timeout') ? 'qua han' : 'chua san sang';
          if (state !== lastState) this.log.warn(`CSDL ${state}, thu lai theo lich 1, 2, 5, 10, 30 giay`);
          lastState = state;
        }
      }
      await sleep(retryDelay(attempt++));
    }
  }
}
```

- [ ] **Step 4: Viết `backend/src/db/sp.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { parseJsonColumn } from '../common/serialize';
import { DbService } from './db.service';
import { sqlNumberOf } from './sql-errors';

export interface ReadingItem { device: string; metric: string; value: number; at: string }
export interface AcceptedRow { DeviceId: number; DeviceCode: string; HouseId: number; ZoneId: number; MetricCode: string; Value: number; RecordedAt: string }
export type SpAlert = Record<string, unknown>;
export interface IngestResult { received: number; accepted: number; duplicates: number; rejected: number; acceptedRows: AcceptedRow[]; newAlerts: SpAlert[]; resolvedAlertIds: number[] }
export interface SetActuatorArgs { deviceId: number; isOn: boolean; level: number | null; source: 'AUTO' | 'MANUAL'; mode: 'AUTO' | 'MANUAL' | null; userId: number | null; reason: string | null }
export interface ActuatorResult { changed: boolean; deviceCode: string; mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null }
export interface BirdCountItem { camera: string; windowStart: string; in: number; out: number }
export interface PredatorInput { camera: string; class: string; confidence: number; snapshot: string; at: string }
export interface HeartbeatItem { device: string; at: string }

type Row = Record<string, unknown>;
const ids = (json: unknown) => parseJsonColumn<Array<{ AlertId: number }>>(json as string, []).map((x) => x.AlertId);

// Cua duy nhat goi SP (spec backend 2.2). Moi SP tra dung 1 tap ket qua (database-core Phan 3).
@Injectable()
export class SpService {
  constructor(private readonly db: DbService) {}

  async ingestReadings(items: ReadingItem[]): Promise<IngestResult> {
    const r = await this.one('EXEC dbo.sp_IngestReadings @Json = @P1', JSON.stringify(items));
    return {
      received: Number(r.Received), accepted: Number(r.Accepted), duplicates: Number(r.Duplicates), rejected: Number(r.Rejected),
      acceptedRows: parseJsonColumn<AcceptedRow[]>(r.AcceptedJson as string, []),
      newAlerts: parseJsonColumn<SpAlert[]>(r.NewAlertsJson as string, []),
      resolvedAlertIds: ids(r.ResolvedAlertIdsJson),
    };
  }

  async setActuator(a: SetActuatorArgs): Promise<ActuatorResult> {
    const r = await this.one(
      'EXEC dbo.sp_SetActuator @DeviceId = @P1, @IsOn = @P2, @Level = @P3, @Source = @P4, @Mode = @P5, @UserId = @P6, @Reason = @P7',
      a.deviceId, a.isOn, a.level, a.source, a.mode, a.userId, a.reason);
    return { changed: Boolean(r.Changed), deviceCode: String(r.DeviceCode), mode: r.Mode as 'AUTO' | 'MANUAL', isOn: Boolean(r.IsOn), level: r.Level === null ? null : Number(r.Level) };
  }

  updateAlertStatus(alertId: number, status: string, userId: number, note: string | null): Promise<Row> {
    return this.one('EXEC dbo.sp_UpdateAlertStatus @AlertId = @P1, @Status = @P2, @UserId = @P3, @Note = @P4', alertId, status, userId, note);
  }

  readingHistory(zoneId: number, metric: string, from: Date, to: Date, bucketMinutes: number): Promise<Row[]> {
    return this.rows('EXEC dbo.sp_GetReadingHistory @ZoneId = @P1, @MetricCode = @P2, @FromUtc = @P3, @ToUtc = @P4, @BucketMinutes = @P5', zoneId, metric, from, to, bucketMinutes);
  }

  async recordBirdCount(items: BirdCountItem[]): Promise<{ windowsUpserted: number; windowsUnchanged: number }> {
    const r = await this.one('EXEC dbo.sp_RecordBirdCount @Json = @P1', JSON.stringify(items));
    return { windowsUpserted: Number(r.WindowsUpserted), windowsUnchanged: Number(r.WindowsUnchanged) };
  }

  async createPredatorAlert(p: PredatorInput): Promise<{ created: boolean; alertId: number | null; skipReason: string | null; alert: SpAlert | null }> {
    const r = await this.one('EXEC dbo.sp_CreatePredatorAlert @Json = @P1', JSON.stringify(p));
    return { created: Boolean(r.Created), alertId: r.AlertId === null ? null : Number(r.AlertId), skipReason: (r.SkipReason as string) ?? null, alert: parseJsonColumn<SpAlert | null>(r.AlertJson as string, null) };
  }

  async detectAnomalies(opts: { nowUtc?: Date; offlineMinutes?: number } = {}): Promise<SpAlert[]> {
    const r = await this.one('EXEC dbo.sp_DetectAnomalies @OfflineMinutes = @P1, @NowUtc = @P2', opts.offlineMinutes ?? 5, opts.nowUtc ?? null);
    return parseJsonColumn<SpAlert[]>(r.NewAlertsJson as string, []);
  }

  async recordHeartbeat(items: HeartbeatItem[]): Promise<{ accepted: number; rejected: number; resolvedAlertIds: number[] }> {
    const r = await this.one('EXEC dbo.sp_RecordHeartbeat @Json = @P1', JSON.stringify(items));
    return { accepted: Number(r.Accepted), rejected: Number(r.Rejected), resolvedAlertIds: ids(r.ResolvedAlertIdsJson) };
  }

  reportEnvVsYield(houseId: number, fromVnDate: string, toVnDate: string): Promise<Row[]> {
    return this.rows('EXEC dbo.sp_Report_EnvStabilityVsYield @HouseId = @P1, @FromVnDate = @P2, @ToVnDate = @P3', houseId, fromVnDate, toVnDate);
  }

  private async rows(sql: string, ...params: unknown[]): Promise<Row[]> {
    try {
      return await this.db.prisma.$queryRawUnsafe<Row[]>(sql, ...params);
    } catch (e) {
      if (sqlNumberOf(e) !== 1205) throw e;
      return this.db.prisma.$queryRawUnsafe<Row[]>(sql, ...params); // hop dong 3.5: thu lai 1 lan
    }
  }

  private async one(sql: string, ...params: unknown[]): Promise<Row> {
    const rows = await this.rows(sql, ...params);
    if (rows.length !== 1) throw new Error(`SP tra ${rows.length} dong, mong 1: ${sql.split(' ')[1]}`);
    return rows[0];
  }
}
```

- [ ] **Step 5: Viết `backend/src/db/db.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { DB_HEALTH } from '../common/errors';
import { DbService } from './db.service';
import { SpService } from './sp';

@Global()
@Module({
  providers: [DbService, SpService, { provide: DB_HEALTH, useExisting: DbService }],
  exports: [DbService, SpService, DB_HEALTH],
})
export class DbModule {}
```

- [ ] **Step 6: Chạy test**

Run: `npx jest src/db`
Expected: PASS mọi test.

- [ ] **Step 7: SP giả khi TV1 chưa giao (chỉ `SwiftletCare_Dev`)**

`backend/test-support/fake-sps.sql` — chỉ tạo khi SP thật **chưa có** (không ghi đè SP thật), cùng chữ ký, trả dòng cố định; **không** đặt vào `database/sql/`:

```sql
-- SP GIA cho backend khi database-core chua giao (spec backend 1.3). CHI chay tren SwiftletCare_Dev.
-- Xoa khi co SP that: deploy.ps1 cua database-core dung CREATE OR ALTER nen tu ghi de.
SET NOCOUNT ON;
IF DB_NAME() <> N'SwiftletCare_Dev' THROW 59999, N'fake-sps.sql chi chay tren SwiftletCare_Dev', 1;
GO
IF OBJECT_ID(N'dbo.sp_IngestReadings', N'P') IS NULL
EXEC (N'CREATE PROCEDURE dbo.sp_IngestReadings @Json NVARCHAR(MAX), @StaleMinutes INT = 2
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Received = (SELECT COUNT(*) FROM OPENJSON(@Json)), Accepted = 0, Duplicates = 0,
           Rejected = (SELECT COUNT(*) FROM OPENJSON(@Json)),
           AcceptedJson = N''[]'', NewAlertsJson = N''[]'', ResolvedAlertIdsJson = N''[]'';
END');
GO
IF OBJECT_ID(N'dbo.sp_SetActuator', N'P') IS NULL
EXEC (N'CREATE PROCEDURE dbo.sp_SetActuator @DeviceId INT, @IsOn BIT, @Level TINYINT = NULL, @Source VARCHAR(6),
    @Mode VARCHAR(6) = NULL, @UserId INT = NULL, @Reason NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Changed = CAST(1 AS BIT), DeviceCode = (SELECT Code FROM dbo.Devices WHERE DeviceId = @DeviceId),
           Mode = ISNULL(@Mode, CASE WHEN @Source = ''MANUAL'' THEN ''MANUAL'' ELSE ''AUTO'' END), IsOn = @IsOn, Level = @Level;
END');
GO
```

Run (chỉ khi `SELECT OBJECT_ID('dbo.sp_IngestReadings')` trả NULL): `sqlcmd -S localhost,1433 -U swiftlet_dev -d SwiftletCare_Dev -b -I -f 65001 -i test-support/fake-sps.sql`
Expected: không lỗi. Khi TV1 giao SP thật (20/10): chạy lại `database/scripts/deploy.ps1 -Database SwiftletCare_Dev` rồi chạy lại các bước kiểm tay của Task 14, 15.

- [ ] **Step 8: Commit**

```powershell
git add backend/src/db backend/src/common/async.ts backend/test-support
git commit -m "feat(backend): kết nối CSDL có thử lại, lớp gọi SP có kiểu, SP giả cho Dev

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Xác thực — đăng nhập, guard JWT (chỉ HS256, đọc lại Users), guard vai trò, guard `X-Service-Key`

**Files:**
- Create: `backend/src/common/decorators.ts`, `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.service.spec.ts`, `backend/src/auth/auth.controller.ts`, `backend/src/auth/jwt-auth.guard.ts`, `backend/src/auth/roles.guard.ts`, `backend/src/auth/service-key.guard.ts`, `backend/src/auth/guards.spec.ts`, `backend/src/auth/auth.module.ts`

**Interfaces:**
- Consumes: `DbService` (Task 6), `ApiError` (Task 4), `pickers.user` (Task 5), `APP_CONFIG` (Task 2).
- Produces:
  - `decorators.ts`: `Public()`, `Roles(...roles: Role[])`, `SkipDbCheck()`, `CurrentUser()`, `type Role = 'ADMIN' | 'OWNER'`, `interface AuthUser { userId: number; role: Role; username: string; exp: number }`, hằng `IS_PUBLIC`, `ROLES`, `SKIP_DB`.
  - `AuthService`: `login(username: string, password: string): Promise<{ accessToken: string; expiresIn: 28800; user: object }>`, `verifySignature(token: string): Promise<{ sub: number; exp: number }>`, `loadActiveUser(sub: number, exp: number): Promise<AuthUser>`, `verifyToken(token: string): Promise<AuthUser>` (= hai hàm trên nối nhau; Task 9 dùng riêng từng hàm cho Socket.IO), `JWT_TTL_SECONDS = 28800`.
  - `JwtAuthGuard`, `RolesGuard`, `ServiceKeyGuard` (đăng ký `APP_GUARD` theo thứ tự ở Task 8: DbReady → Jwt → Roles → Ownership).
  - `AuthModule` export `AuthService`.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/auth/auth.service.spec.ts`:

```ts
import { JwtService } from '@nestjs/jwt';
import { hashSync } from 'bcryptjs';
import { AuthService, JWT_TTL_SECONDS } from './auth.service';

const SECRET = 's'.repeat(32);
const HASH = hashSync('dung-mat-khau', 4);

function setup(users: Record<string, unknown>[]) {
  const findUnique = jest.fn(async ({ where }: { where: { Username?: string; UserId?: number } }) =>
    users.find((u) => (where.Username !== undefined ? u.Username === where.Username : u.UserId === where.UserId)) ?? null);
  const db = { prisma: { users: { findUnique } } };
  const jwt = new JwtService({ secret: SECRET, signOptions: { algorithm: 'HS256', expiresIn: JWT_TTL_SECONDS } });
  return { auth: new AuthService(db as never, jwt), jwt, findUnique };
}

const owner = { UserId: 2, Username: 'owner1', PasswordHash: HASH, FullName: 'Chủ nhà yến H1', Email: 'owner1@swiftletcare.local', Phone: null, Role: 'OWNER', IsActive: true };

describe('AuthService.login', () => {
  it('dung mat khau -> token HS256 {sub, role}, expiresIn 28800, user khong co passwordHash', async () => {
    const { auth, jwt } = setup([owner]);
    await auth.onModuleInit();
    const r = await auth.login('owner1', 'dung-mat-khau');
    expect(r.expiresIn).toBe(28800);
    expect(r.user).toEqual({ userId: 2, username: 'owner1', fullName: 'Chủ nhà yến H1', email: 'owner1@swiftletcare.local', phone: null, role: 'OWNER', isActive: true });
    const header = JSON.parse(Buffer.from(r.accessToken.split('.')[0], 'base64url').toString());
    expect(header.alg).toBe('HS256');
    const p = jwt.decode(r.accessToken) as { sub: number; role: string; exp: number; iat: number };
    expect([p.sub, p.role, p.exp - p.iat]).toEqual([2, 'OWNER', 28800]);
  });

  it.each([
    ['sai mat khau', 'owner1', 'sai'],
    ['khong co tai khoan', 'khongco', 'dung-mat-khau'],
  ])('%s -> 401 UNAUTHENTICATED', async (_l, u, p) => {
    const { auth } = setup([owner]);
    await auth.onModuleInit();
    await expect(auth.login(u, p)).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('tai khoan bi khoa -> cung loi 401', async () => {
    const { auth } = setup([{ ...owner, IsActive: false }]);
    await auth.onModuleInit();
    await expect(auth.login('owner1', 'dung-mat-khau')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });
});

describe('AuthService.verifyToken', () => {
  it('vai tro lay tu CSDL, khong tin token (Review Focus 2)', async () => {
    const { auth, jwt } = setup([{ ...owner, UserId: 1, Username: 'admin', Role: 'OWNER' }]);
    const token = jwt.sign({ sub: 1, role: 'ADMIN' });
    await expect(auth.verifyToken(token)).resolves.toMatchObject({ userId: 1, role: 'OWNER', username: 'admin' });
  });

  it('alg none -> 401', async () => {
    const { auth } = setup([owner]);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    await expect(auth.verifyToken(`${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 2, role: 'ADMIN' })}.`)).rejects.toMatchObject({ status: 401 });
  });

  it('ky bang khoa khac, het han, sub khong phai so, nguoi dung bi khoa -> 401', async () => {
    const { auth, jwt } = setup([{ ...owner, IsActive: false }]);
    const other = new JwtService({ secret: 'x'.repeat(32) });
    for (const t of [other.sign({ sub: 2 }), jwt.sign({ sub: 2 }, { expiresIn: -10 }), jwt.sign({ sub: 'abc' }), jwt.sign({ sub: 2 })]) {
      await expect(auth.verifyToken(t)).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    }
  });
});
```

`backend/src/auth/guards.spec.ts`:

```ts
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ServiceKeyGuard } from './service-key.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

const ctx = (req: object, meta: Record<string, unknown> = {}) => {
  const handler = () => undefined;
  Object.entries(meta).forEach(([k, v]) => Reflect.defineMetadata(k, v, handler));
  return { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler, getClass: () => class {} } as never;
};

const thrown = (fn: () => unknown): unknown => {
  try { fn(); } catch (e) { return e; }
  throw new Error('mong nem loi');
};

describe('RolesGuard', () => {
  const g = new RolesGuard(new Reflector());
  it('OWNER goi route ADMIN -> 403 FORBIDDEN', () => {
    expect(thrown(() => g.canActivate(ctx({ user: { role: 'OWNER' } }, { roles: ['ADMIN'] })))).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
  it('khong khai bao vai tro -> qua', () => expect(g.canActivate(ctx({ user: { role: 'OWNER' } }))).toBe(true));
});

describe('ServiceKeyGuard', () => {
  const g = new ServiceKeyGuard({ aiServiceKey: 'k'.repeat(32) } as never);
  it('dung khoa -> qua; sai/thieu -> 401', () => {
    expect(g.canActivate(ctx({ headers: { 'x-service-key': 'k'.repeat(32) } }))).toBe(true);
    for (const h of [{ 'x-service-key': 'khoa-sai' }, {}]) {
      expect(thrown(() => g.canActivate(ctx({ headers: h })))).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    }
  });
});

describe('JwtAuthGuard', () => {
  it('route Public -> qua khong doc header; thieu Bearer -> 401; hop le -> gan req.user', async () => {
    const auth = { verifyToken: jest.fn(async () => ({ userId: 2, role: 'OWNER', username: 'owner1', exp: 0 })) };
    const g = new JwtAuthGuard(new Reflector(), auth as never);
    await expect(g.canActivate(ctx({ headers: {} }, { isPublic: true }))).resolves.toBe(true);
    await expect(g.canActivate(ctx({ headers: {} }))).rejects.toMatchObject({ status: 401 });
    const req: { headers: object; user?: unknown } = { headers: { authorization: 'Bearer abc' } };
    await expect(g.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toMatchObject({ userId: 2 });
    expect(auth.verifyToken).toHaveBeenCalledWith('abc');
  });
});
```

Run: `npx jest src/auth`
Expected: FAIL (module chưa có).

- [ ] **Step 2: Viết `backend/src/common/decorators.ts`**

```ts
import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';

export type Role = 'ADMIN' | 'OWNER';
export interface AuthUser { userId: number; role: Role; username: string; exp: number }

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const SKIP_DB = 'skipDb';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
export const SkipDbCheck = () => SetMetadata(SKIP_DB, true);
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
```

- [ ] **Step 3: Viết `backend/src/auth/auth.service.ts`**

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { ApiError } from '../common/errors';
import { AuthUser, Role } from '../common/decorators';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';

export const JWT_TTL_SECONDS = 28800;
const unauthenticated = () => new ApiError(401, 'UNAUTHENTICATED');

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(private readonly db: DbService, private readonly jwt: JwtService) {}

  // Hash gia hop le cost 10, tao mot lan: tai khoan khong ton tai van ton thoi gian bcrypt nhu that (spec backend 5.1).
  async onModuleInit(): Promise<void> {
    this.dummyHash = await hash(randomBytes(16).toString('hex'), 10);
  }

  async login(username: string, password: string) {
    const u = await this.db.prisma.users.findUnique({ where: { Username: username } });
    const ok = await compare(password, u?.PasswordHash ?? this.dummyHash);
    if (!u || !ok || !u.IsActive) throw unauthenticated();
    const accessToken = await this.jwt.signAsync({ sub: u.UserId, role: u.Role });
    return { accessToken, expiresIn: JWT_TTL_SECONDS as 28800, user: pick.user(u) };
  }

  // Chi kiem chu ky + han, chi nhan HS256 (spec backend 5.1); Socket.IO goi rieng truoc khi kiem CSDL san sang (6.1).
  async verifySignature(token: string): Promise<{ sub: number; exp: number }> {
    let payload: { sub?: unknown; exp?: number };
    try {
      payload = await this.jwt.verifyAsync(token, { algorithms: ['HS256'] });
    } catch {
      throw unauthenticated();
    }
    if (!Number.isInteger(payload.sub)) throw unauthenticated();
    return { sub: payload.sub as number, exp: payload.exp ?? 0 };
  }

  // Doc lai Users theo khoa chinh; vai tro lay tu CSDL, khong tin token (hop dong 3.1).
  async loadActiveUser(sub: number, exp: number): Promise<AuthUser> {
    const u = await this.db.prisma.users.findUnique({ where: { UserId: sub } });
    if (!u || !u.IsActive) throw unauthenticated();
    return { userId: u.UserId, role: u.Role as Role, username: u.Username, exp };
  }

  async verifyToken(token: string): Promise<AuthUser> {
    const p = await this.verifySignature(token);
    return this.loadActiveUser(p.sub, p.exp);
  }
}
```

- [ ] **Step 4: Viết ba guard**

`backend/src/auth/jwt-auth.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../common/errors';
import { IS_PUBLIC } from '../common/decorators';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const m = /^Bearer (\S+)$/.exec(req.headers?.authorization ?? '');
    if (!m) throw new ApiError(401, 'UNAUTHENTICATED');
    req.user = await this.auth.verifyToken(m[1]);
    return true;
  }
}
```

`backend/src/auth/roles.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../common/errors';
import { ROLES, Role } from '../common/decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const role = ctx.switchToHttp().getRequest().user?.role;
    if (!roles.includes(role)) throw new ApiError(403, 'FORBIDDEN');
    return true;
  }
}
```

`backend/src/auth/service-key.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, AppConfig } from '../config/config';
import { ApiError } from '../common/errors';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest();

// Bam ca hai roi so timingSafeEqual (hai gia tri bam cung do dai); khong bao gio log khoa (spec backend 5.1).
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  private readonly expected: Buffer;
  constructor(@Inject(APP_CONFIG) cfg: AppConfig) { this.expected = sha(cfg.aiServiceKey); }

  canActivate(ctx: ExecutionContext): boolean {
    const got = ctx.switchToHttp().getRequest().headers?.['x-service-key'];
    if (typeof got !== 'string' || !timingSafeEqual(sha(got), this.expected)) throw new ApiError(401, 'UNAUTHENTICATED');
    return true;
  }
}
```

- [ ] **Step 5: Viết controller và module**

`backend/src/auth/auth.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString() @MaxLength(50) username!: string;
  @IsString() @MaxLength(200) password!: string;
}

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly db: DbService) {}

  @Public() @Post('auth/login') @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Get('auth/me')
  async me(@CurrentUser() u: AuthUser) {
    return pick.user(await this.db.prisma.users.findUniqueOrThrow({ where: { UserId: u.userId } }));
  }
}
```

`backend/src/auth/auth.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, AppConfig } from '../config/config';
import { AuthController } from './auth.controller';
import { AuthService, JWT_TTL_SECONDS } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { ServiceKeyGuard } from './service-key.guard';

@Global()
@Module({
  imports: [JwtModule.registerAsync({
    inject: [APP_CONFIG],
    useFactory: (cfg: AppConfig) => ({ secret: cfg.jwtSecret, signOptions: { algorithm: 'HS256', expiresIn: JWT_TTL_SECONDS } }),
  })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, ServiceKeyGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, ServiceKeyGuard],
})
export class AuthModule {}
```

- [ ] **Step 6: Chạy test**

Run: `npx jest src/auth`
Expected: PASS mọi test.

- [ ] **Step 7: Commit**

```powershell
git add backend/src/auth backend/src/common/decorators.ts
git commit -m "feat(backend): đăng nhập bcrypt, JWT HS256 đọc lại Users mỗi request, guard vai trò và khóa dịch vụ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Guard sẵn sàng CSDL, guard quyền sở hữu, `/api/health`, khung `AppModule` + `main.ts` chạy được

**Files:**
- Create: `backend/src/common/guards/db-ready.guard.ts`, `backend/src/auth/ownership.guard.ts`, `backend/src/auth/ownership.guard.spec.ts`, `backend/src/common/status.ts`, `backend/src/health/health.controller.ts`, `backend/src/health/health.controller.spec.ts`, `backend/src/health/health.module.ts`, `backend/src/config/config.module.ts`, `backend/test/app.e2e-spec.ts` (thay file mẫu của `nest new`)
- Modify: `backend/src/app.module.ts`, `backend/src/main.ts` (thay nội dung mẫu), `backend/src/auth/auth.module.ts` (thêm `OwnershipGuard`); xóa `backend/src/app.controller.ts`, `app.service.ts`, `app.controller.spec.ts` của mẫu

**Interfaces:**
- Consumes: `DbService` (Task 6), guard của Task 7, `AllExceptionsFilter` (Task 4), `SerializeInterceptor` (Task 5), `validationPipe()` (Task 4).
- Produces:
  - `DbReadyGuard`: CSDL chưa sẵn sàng → 503 `RETRY_LATER` (trừ route `@SkipDbCheck()`).
  - `OwnershipGuard`: đọc **một** tham số route theo thứ tự `alertId`, `deviceId`, `zoneId`, `houseId`; một truy vấn lần ra `{houseId, ownerId}`; OWNER không sở hữu hoặc không tồn tại → 404 `NOT_FOUND`; gán `req.houseId`. Hàm phụ `ownerOf(db, kind, id): Promise<{ houseId: number; ownerId: number } | null>` (export, Task 18 dùng cho query `houseId`).
  - `common/status.ts`: `abstract class MqttStatus { abstract isConnected(): boolean }` — Task 13 cung cấp.
  - `ConfigModule.forRoot(cfg)` (global, cung cấp `APP_CONFIG`).
  - `AppModule.register(cfg: AppConfig): DynamicModule` với mảng `FEATURE_MODULES` — **task sau thêm module của mình vào mảng này**.
  - `main.ts`: `bootstrap()` đọc `ENV_FILE` (mặc định `.env`), tiền tố `/api`, CORS, mở cổng, `DbService.start()`.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/auth/ownership.guard.spec.ts`:

```ts
import { Reflector } from '@nestjs/core';
import { OwnershipGuard } from './ownership.guard';

const owner = (HouseId: number, OwnerId: number) => ({ HouseId, House: { OwnerId }, OwnerId, Zone: { HouseId, House: { OwnerId } } });
const db = {
  prisma: {
    houses: { findUnique: jest.fn(async ({ where }) => (where.HouseId === 1 ? { HouseId: 1, OwnerId: 2 } : null)) },
    zones: { findUnique: jest.fn(async ({ where }) => (where.ZoneId === 10 ? owner(1, 2) : null)) },
    devices: { findUnique: jest.fn(async ({ where }) => (where.DeviceId === 20 ? owner(1, 2) : null)) },
    alerts: { findUnique: jest.fn(async ({ where }) => (where.AlertId === 30 ? owner(1, 2) : null)) },
  },
};
const ctx = (req: object) => ({ switchToHttp: () => ({ getRequest: () => req }), getHandler: () => () => 0, getClass: () => class {} }) as never;
const g = new OwnershipGuard(new Reflector(), db as never);
const OWNER1 = { userId: 2, role: 'OWNER' };
const OWNER2 = { userId: 3, role: 'OWNER' };
const ADMIN = { userId: 1, role: 'ADMIN' };

describe('OwnershipGuard', () => {
  it.each([['houseId', '1'], ['zoneId', '10'], ['deviceId', '20'], ['alertId', '30']])('chu so huu qua %s, gan req.houseId', async (k, v) => {
    const req: Record<string, unknown> = { user: OWNER1, params: { [k]: v } };
    await expect(g.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.houseId).toBe(1);
  });

  it('OWNER khac -> 404 NOT_FOUND (khong 403)', async () => {
    await expect(g.canActivate(ctx({ user: OWNER2, params: { houseId: '1' } }))).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('khong ton tai -> 404; ADMIN qua moi nha', async () => {
    await expect(g.canActivate(ctx({ user: ADMIN, params: { zoneId: '99' } }))).rejects.toMatchObject({ status: 404 });
    await expect(g.canActivate(ctx({ user: ADMIN, params: { deviceId: '20' } }))).resolves.toBe(true);
  });

  it('id khong phai so nguyen duong -> 404 khong truy van', async () => {
    db.prisma.houses.findUnique.mockClear();
    for (const v of ['abc', '-1', '1.5', '99999999999']) {
      await expect(g.canActivate(ctx({ user: OWNER1, params: { houseId: v } }))).rejects.toMatchObject({ status: 404 });
    }
    expect(db.prisma.houses.findUnique).not.toHaveBeenCalled();
  });

  it('route khong co tham so so huu -> qua', async () => {
    await expect(g.canActivate(ctx({ user: OWNER1, params: { userId: '5' } }))).resolves.toBe(true);
  });
});
```

`backend/src/health/health.controller.spec.ts`:

```ts
import { HealthController } from './health.controller';

const res = () => { const r = { code: 0, status(c: number) { r.code = c; return r; } }; return r; };

describe('HealthController', () => {
  it.each([
    [true, true, true, 200, { status: 'ok', db: 'ok', mqtt: 'connected' }],
    [true, false, true, 503, { status: 'error', db: 'down', mqtt: 'connected' }],
    [false, true, true, 503, { status: 'error', db: 'down', mqtt: 'connected' }],
    [true, true, false, 503, { status: 'error', db: 'ok', mqtt: 'disconnected' }],
  ])('ready=%s ping=%s mqtt=%s -> %i', async (ready, ping, mqtt, code, body) => {
    const db = { isReady: () => ready, ping: async () => ping };
    const r = res();
    expect(await new HealthController(db as never, { isConnected: () => mqtt }).health(r as never)).toEqual(body);
    expect(r.code).toBe(code);
  });

  it('chua co MqttStatus -> disconnected', async () => {
    const r = res();
    expect(await new HealthController({ isReady: () => true, ping: async () => true } as never, undefined).health(r as never)).toMatchObject({ mqtt: 'disconnected' });
  });
});
```

`backend/test/app.e2e-spec.ts` (thay file mẫu):

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config/config';

const KEY = 'k'.repeat(32);
const env = { HOST: '127.0.0.1', PORT: '3999', CORS_ORIGINS: 'http://localhost:3001', DB_SERVER: '127.0.0.1', DB_PORT: '1', DB_NAME: 'X_Test', DB_USER: 'u', DB_PASSWORD: 'p',
  MQTT_URL: 'mqtt://127.0.0.1:1', MQTT_USERNAME: 'b', MQTT_PASSWORD: 'p', JWT_SECRET: KEY, AI_SERVICE_KEY: KEY, SNAPSHOT_MAX_BYTES: '2097152',
  INGEST_RETRY_MAX_ITEMS: '100', DEMO_TOOLS: 'false', ANOMALY_SCHEDULER: 'off' };

describe('Khung ung dung (khong CSDL, khong MQTT)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule.register(loadConfig(env, require('node:os').tmpdir()))] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(() => app.close());

  it('route khong ton tai -> 404 dung dinh dang loi', async () => {
    const r = await request(app.getHttpServer()).get('/api/khong-co');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String), sqlNumber: null, details: null } });
  });

  it('health khi CSDL chua san sang -> 503 body spec 3.5', async () => {
    const r = await request(app.getHttpServer()).get('/api/health');
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ status: 'error', db: 'down', mqtt: 'disconnected' });
  });

  it('route can CSDL khi chua san sang -> 503 RETRY_LATER truoc ca kiem token', async () => {
    const r = await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'owner1', password: 'x' });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('RETRY_LATER');
  });
});
```

Run: `npx jest src/auth/ownership src/health; npm run test:e2e`
Expected: FAIL (module chưa có).

- [ ] **Step 2: Viết guard sẵn sàng CSDL và `status.ts`**

`backend/src/common/guards/db-ready.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../errors';
import { SKIP_DB } from '../decorators';
import { DbService } from '../../db/db.service';

// Spec backend 3.1: cong HTTP mo ngay; route can CSDL tra 503 toi khi CSDL san sang (ke ca login).
@Injectable()
export class DbReadyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly db: DbService) {}
  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(SKIP_DB, [ctx.getHandler(), ctx.getClass()])) return true;
    if (!this.db.isReady()) throw new ApiError(503, 'RETRY_LATER');
    return true;
  }
}
```

`backend/src/common/status.ts`:

```ts
// MqttService (Task 13) cung cap; health doc qua lop truu tuong nay de khong phu thuoc module MQTT.
export abstract class MqttStatus { abstract isConnected(): boolean }
```

- [ ] **Step 3: Viết `backend/src/auth/ownership.guard.ts`**

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../common/errors';
import { AuthUser, IS_PUBLIC } from '../common/decorators';
import { DbService } from '../db/db.service';

export type OwnedKind = 'alertId' | 'deviceId' | 'zoneId' | 'houseId';
const KINDS: OwnedKind[] = ['alertId', 'deviceId', 'zoneId', 'houseId'];
const notFound = () => new ApiError(404, 'NOT_FOUND');

// Mot truy van lan ra nha (spec backend 5.2).
export async function ownerOf(db: DbService, kind: OwnedKind, id: number): Promise<{ houseId: number; ownerId: number } | null> {
  const p = db.prisma;
  const viaHouse = { select: { OwnerId: true } } as const;
  switch (kind) {
    case 'houseId': {
      const h = await p.houses.findUnique({ where: { HouseId: id }, select: { HouseId: true, OwnerId: true } });
      return h && { houseId: h.HouseId, ownerId: h.OwnerId };
    }
    case 'zoneId': {
      const z = await p.zones.findUnique({ where: { ZoneId: id }, select: { HouseId: true, House: viaHouse } });
      return z && { houseId: z.HouseId, ownerId: z.House.OwnerId };
    }
    case 'deviceId': {
      const d = await p.devices.findUnique({ where: { DeviceId: id }, select: { Zone: { select: { HouseId: true, House: viaHouse } } } });
      return d && { houseId: d.Zone.HouseId, ownerId: d.Zone.House.OwnerId };
    }
    case 'alertId': {
      const a = await p.alerts.findUnique({ where: { AlertId: id }, select: { HouseId: true, House: viaHouse } });
      return a && { houseId: a.HouseId, ownerId: a.House.OwnerId };
    }
  }
}

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly db: DbService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const kind = KINDS.find((k) => req.params?.[k] !== undefined);
    if (!kind) return true;
    const raw = String(req.params[kind]);
    if (!/^[1-9]\d{0,8}$/.test(raw)) throw notFound();
    const found = await ownerOf(this.db, kind, Number(raw));
    const user = req.user as AuthUser;
    if (!found || (user.role !== 'ADMIN' && found.ownerId !== user.userId)) throw notFound();
    req.houseId = found.houseId;
    return true;
  }
}
```

Trong `auth.module.ts` thêm `OwnershipGuard` vào `providers` và `exports`.

- [ ] **Step 4: Viết health**

`backend/src/health/health.controller.ts`:

```ts
import { Controller, Get, Optional, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public, SkipDbCheck } from '../common/decorators';
import { MqttStatus } from '../common/status';
import { DbService } from '../db/db.service';

@Controller()
export class HealthController {
  constructor(private readonly db: DbService, @Optional() private readonly mqtt?: MqttStatus) {}

  // Cong khai, khong tra chi tiet nao khac (hop dong 3.3, spec backend 3.5).
  @Public() @SkipDbCheck() @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const dbOk = this.db.isReady() && (await this.db.ping());
    const mqttOk = this.mqtt?.isConnected() ?? false;
    res.status(dbOk && mqttOk ? 200 : 503);
    return dbOk && mqttOk
      ? { status: 'ok', db: 'ok', mqtt: 'connected' }
      : { status: 'error', db: dbOk ? 'ok' : 'down', mqtt: mqttOk ? 'connected' : 'disconnected' };
  }
}
```

`backend/src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

- [ ] **Step 5: Viết `ConfigModule`, `AppModule`, `main.ts`**

`backend/src/config/config.module.ts`:

```ts
import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from './config';

@Global()
@Module({})
export class ConfigModule {
  static forRoot(cfg: AppConfig): DynamicModule {
    return { module: ConfigModule, providers: [{ provide: APP_CONFIG, useValue: cfg }], exports: [APP_CONFIG] };
  }
}
```

`backend/src/app.module.ts`:

```ts
import { DynamicModule, Module, Type } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppConfig } from './config/config';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { DbReadyGuard } from './common/guards/db-ready.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { OwnershipGuard } from './auth/ownership.guard';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { SerializeInterceptor } from './common/serialize.interceptor';
import { validationPipe } from './common/validation';

// Moi task sau them module cua minh vao day.
const FEATURE_MODULES: Type[] = [HealthModule];

@Module({})
export class AppModule {
  static register(cfg: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(cfg), DbModule, AuthModule, ...FEATURE_MODULES],
      providers: [
        // Thu tu guard toan cuc = thu tu chay: san sang CSDL -> JWT -> vai tro -> so huu.
        { provide: APP_GUARD, useExisting: DbReadyGuard }, DbReadyGuard,
        { provide: APP_GUARD, useExisting: JwtAuthGuard },
        { provide: APP_GUARD, useExisting: RolesGuard },
        { provide: APP_GUARD, useExisting: OwnershipGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: SerializeInterceptor },
        { provide: APP_PIPE, useFactory: validationPipe },
      ],
    };
  }
}
```

`backend/src/main.ts`:

```ts
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module';
import { AppConfig, ConfigError, loadConfig } from './config/config';
import { ensureStorage } from './config/storage';
import { DbService } from './db/db.service';

async function bootstrap(): Promise<void> {
  const log = new Logger('Khoi dong');
  // Test hop dong chay voi ENV_FILE=.env.test (spec backend 7.2); khong bao gio in gia tri.
  const envFile = process.env.ENV_FILE ?? '.env';
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  let cfg: AppConfig;
  try {
    cfg = loadConfig();
    ensureStorage(cfg.storageRoot);
  } catch (e) {
    log.error(e instanceof ConfigError ? `Cau hinh sai: ${e.message}` : (e as Error).message);
    process.exit(1);
  }
  const app = await NestFactory.create(AppModule.register(cfg));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: cfg.corsOrigins });
  await app.listen(cfg.port, cfg.host);
  log.log(`Lang nghe ${cfg.host}:${cfg.port}, CSDL ${cfg.db.database}`);
  app.get(DbService).start();
}
void bootstrap();
```

Trong `package.json` đặt script: `"start": "node dist/main.js"`, `"start:test": "set ENV_FILE=.env.test&& node dist/main.js"` (PowerShell: `$env:ENV_FILE='.env.test'; node dist/main.js`).

- [ ] **Step 6: Chạy test**

Run: `npx jest src; npm run test:e2e`
Expected: PASS mọi test (gồm 3 test e2e). E2E có thể log cảnh báo kết nối CSDL — không sao (không gọi `start()` nên không kết nối).

- [ ] **Step 7: Chạy thử thật (cần CSDL Dev)**

```powershell
npm run build; npm run start
```

Cửa sổ khác: `curl.exe -s -i http://localhost:3000/api/health` → `HTTP/1.1 503` và `{"status":"error","db":"ok","mqtt":"disconnected"}` (chưa có MQTT). Ctrl+C để dừng.

- [ ] **Step 8: Commit**

```powershell
git add backend/src backend/test backend/package.json
git commit -m "feat(backend): guard sẵn sàng CSDL và quyền sở hữu, /api/health, khung AppModule chạy được

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Socket.IO — bắt tay, phòng, hàm phát chung, ngắt theo hạn token

**Files:**
- Create: `backend/src/realtime/rooms.ts`, `backend/src/realtime/rooms.spec.ts`, `backend/src/realtime/realtime.service.ts`, `backend/src/realtime/realtime.service.spec.ts`, `backend/src/realtime/realtime.gateway.ts`, `backend/src/realtime/realtime.gateway.spec.ts`, `backend/src/realtime/io.adapter.ts`, `backend/src/realtime/realtime.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `RealtimeModule` vào `FEATURE_MODULES`), `backend/src/main.ts` (dùng `CorsIoAdapter`)

**Interfaces:**
- Consumes: `AuthService.verifySignature`, `loadActiveUser` (Task 7), `DbService` (Task 6), `serialize` (Task 5), `AuthUser` (Task 7).
- Produces:
  - `rooms.ts`: `roomsFor(user: { userId: number; role: Role }, houses: Array<{ HouseId: number; OwnerId: number; IsActive: boolean }>): string[]`, `handshakeError(code: 'UNAUTHENTICATED' | 'RETRY_LATER'): Error & { data: { code: string } }`.
  - `RealtimeService`: `attach(server: Server): void`, `emitToHouse(houseId: number, event: string, payload: object): void` (không bao giờ ném lỗi), `houseActivated(houseId: number, ownerId: number): void`, `houseDeactivated(houseId: number): void`, `disconnectUser(userId: number): void`.
  - `CorsIoAdapter(app, origins: string[])`.
  - `RealtimeModule` (global) export `RealtimeService`.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/realtime/rooms.spec.ts`:

```ts
import { handshakeError, roomsFor } from './rooms';

const houses = [
  { HouseId: 1, OwnerId: 2, IsActive: true },
  { HouseId: 2, OwnerId: 3, IsActive: true },
  { HouseId: 3, OwnerId: 2, IsActive: false },
];

describe('roomsFor (hop dong 4.1)', () => {
  it('OWNER: user + nha dang hoat dong cua minh', () => {
    expect(roomsFor({ userId: 2, role: 'OWNER' }, houses)).toEqual(['user:2', 'house:1']);
  });
  it('ADMIN: user + moi nha dang hoat dong + role:ADMIN', () => {
    expect(roomsFor({ userId: 1, role: 'ADMIN' }, houses)).toEqual(['user:1', 'house:1', 'house:2', 'role:ADMIN']);
  });
  it('handshakeError mang data.code', () => {
    expect(handshakeError('RETRY_LATER')).toMatchObject({ message: 'RETRY_LATER', data: { code: 'RETRY_LATER' } });
  });
});
```

`backend/src/realtime/realtime.service.spec.ts`:

```ts
import { RealtimeService } from './realtime.service';

function fakeServer() {
  const calls: Array<[string, ...unknown[]]> = [];
  const room = (name: string) => ({
    emit: (e: string, p: unknown) => calls.push(['emit', name, e, p]),
    socketsJoin: (r: string) => calls.push(['join', name, r]),
    socketsLeave: (r: string) => calls.push(['leave', name, r]),
    disconnectSockets: (close: boolean) => calls.push(['disconnect', name, close]),
  });
  return { server: { to: room, in: room }, calls };
}

describe('RealtimeService', () => {
  it('emitToHouse: qua serialize, phat vao house:{id}', () => {
    const { server, calls } = fakeServer();
    const rt = new RealtimeService();
    rt.attach(server as never);
    rt.emitToHouse(1, 'device.state', { DeviceId: 3, at: new Date(0) });
    expect(calls).toEqual([['emit', 'house:1', 'device.state', { deviceId: 3, at: '1970-01-01T00:00:00.000Z' }]]);
  });

  it('chua attach hoac phat loi -> khong nem', () => {
    const rt = new RealtimeService();
    expect(() => rt.emitToHouse(1, 'x', {})).not.toThrow();
    rt.attach({ to: () => { throw new Error('hong'); } } as never);
    expect(() => rt.emitToHouse(1, 'x', {})).not.toThrow();
  });

  it('cap nhat phong khi dang ket noi (spec backend 6.2)', () => {
    const { server, calls } = fakeServer();
    const rt = new RealtimeService();
    rt.attach(server as never);
    rt.houseActivated(5, 2);
    rt.houseDeactivated(5);
    rt.disconnectUser(2);
    expect(calls).toEqual([
      ['join', 'user:2', 'house:5'], ['join', 'role:ADMIN', 'house:5'],
      ['leave', 'house:5', 'house:5'],
      ['disconnect', 'user:2', true],
    ]);
  });
});
```

`backend/src/realtime/realtime.gateway.spec.ts`:

```ts
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { ApiError } from '../common/errors';

function setup(opts: { ready?: boolean; active?: boolean } = {}) {
  const auth = {
    verifySignature: jest.fn(async (t: string) => { if (t !== 'good') throw new ApiError(401, 'UNAUTHENTICATED'); return { sub: 2, exp: Math.floor(Date.now() / 1000) + 60 }; }),
    loadActiveUser: jest.fn(async (sub: number, exp: number) => { if (opts.active === false) throw new ApiError(401, 'UNAUTHENTICATED'); return { userId: sub, role: 'OWNER', username: 'owner1', exp }; }),
  };
  const db = { isReady: () => opts.ready ?? true, prisma: { houses: { findMany: jest.fn(async () => [{ HouseId: 1, OwnerId: 2, IsActive: true }]) } } };
  return { gw: new RealtimeGateway(auth as never, db as never, new RealtimeService()), auth, db };
}
const socket = (token?: unknown) => ({ handshake: { auth: { token } }, data: {} as Record<string, unknown>, join: jest.fn(), disconnect: jest.fn() });

describe('RealtimeGateway.handshake (thu tu spec backend 6.1)', () => {
  it.each([
    ['khong co token', undefined, {}, 'UNAUTHENTICATED'],
    ['token sai', 'bad', {}, 'UNAUTHENTICATED'],
    ['CSDL chua san sang', 'good', { ready: false }, 'RETRY_LATER'],
    ['nguoi dung bi khoa', 'good', { active: false }, 'UNAUTHENTICATED'],
  ])('%s -> %s', async (_l, token, opts, code) => {
    const { gw } = setup(opts);
    await expect(gw.handshake(socket(token) as never)).rejects.toBe(code);
  });

  it('token sai thi khong kiem CSDL; hop le thi gan socket.data.user', async () => {
    const { gw, auth } = setup({ ready: false });
    await expect(gw.handshake(socket('bad') as never)).rejects.toBe('UNAUTHENTICATED');
    expect(auth.loadActiveUser).not.toHaveBeenCalled();
    const ok = setup();
    const s = socket('good');
    await ok.gw.handshake(s as never);
    expect(s.data.user).toMatchObject({ userId: 2, role: 'OWNER' });
  });
});

describe('RealtimeGateway.handleConnection', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('vao phong, hen gio ngat dung exp, huy hen gio khi ngat truoc', async () => {
    const { gw } = setup();
    const s = socket('good');
    s.data.user = { userId: 2, role: 'OWNER', username: 'owner1', exp: Math.floor(Date.now() / 1000) + 60 };
    await gw.handleConnection(s as never);
    expect(s.join).toHaveBeenCalledWith(['user:2', 'house:1']);
    await jest.advanceTimersByTimeAsync(59_000);
    expect(s.disconnect).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1_500);
    expect(s.disconnect).toHaveBeenCalledWith(true);

    const s2 = socket('good');
    s2.data.user = { userId: 2, role: 'OWNER', username: 'owner1', exp: Math.floor(Date.now() / 1000) + 60 };
    await gw.handleConnection(s2 as never);
    gw.handleDisconnect(s2 as never);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(s2.disconnect).not.toHaveBeenCalled();
  });
});
```

Run: `npx jest src/realtime`
Expected: FAIL (module chưa có).

- [ ] **Step 2: Viết `backend/src/realtime/rooms.ts`**

```ts
import { Role } from '../common/decorators';

export function roomsFor(user: { userId: number; role: Role }, houses: Array<{ HouseId: number; OwnerId: number; IsActive: boolean }>): string[] {
  const own = houses.filter((h) => h.IsActive && (user.role === 'ADMIN' || h.OwnerId === user.userId)).map((h) => `house:${h.HouseId}`);
  return [`user:${user.userId}`, ...own, ...(user.role === 'ADMIN' ? ['role:ADMIN'] : [])];
}

// Client doc connect_error.data.code (spec backend 6.1).
export function handshakeError(code: 'UNAUTHENTICATED' | 'RETRY_LATER'): Error & { data: { code: string } } {
  return Object.assign(new Error(code), { data: { code } });
}
```

- [ ] **Step 3: Viết `backend/src/realtime/realtime.service.ts`**

```ts
import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { serialize } from '../common/serialize';

// Cua duy nhat phat Socket.IO (spec backend 2.2, 6.3).
@Injectable()
export class RealtimeService {
  private server: Server | null = null;
  private readonly log = new Logger('Realtime');

  attach(server: Server): void { this.server = server; }

  emitToHouse(houseId: number, event: string, payload: object): void {
    try {
      this.server?.to(`house:${houseId}`).emit(event, serialize(payload));
    } catch (e) {
      this.log.error(`Phat ${event} cho nha ${houseId} loi: ${(e as Error).message}`);
    }
  }

  houseActivated(houseId: number, ownerId: number): void {
    this.safe(() => {
      this.server?.in(`user:${ownerId}`).socketsJoin(`house:${houseId}`);
      this.server?.in('role:ADMIN').socketsJoin(`house:${houseId}`);
    });
  }

  houseDeactivated(houseId: number): void {
    this.safe(() => this.server?.in(`house:${houseId}`).socketsLeave(`house:${houseId}`));
  }

  disconnectUser(userId: number): void {
    this.safe(() => this.server?.in(`user:${userId}`).disconnectSockets(true));
  }

  private safe(fn: () => void): void {
    try { fn(); } catch (e) { this.log.error(`Cap nhat phong loi: ${(e as Error).message}`); }
  }
}
```

- [ ] **Step 4: Viết `backend/src/realtime/realtime.gateway.ts`**

```ts
import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../common/decorators';
import { DbService } from '../db/db.service';
import { RealtimeService } from './realtime.service';
import { handshakeError, roomsFor } from './rooms';

type Code = 'UNAUTHENTICATED' | 'RETRY_LATER';

// Khong co @SubscribeMessage: client khong gui su kien len (hop dong 4.1).
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger('Realtime');

  constructor(private readonly auth: AuthService, private readonly db: DbService, private readonly rt: RealtimeService) {}

  afterInit(server: Server): void {
    this.rt.attach(server);
    server.use((socket, next) => {
      this.handshake(socket).then(() => next(), (code: Code) => next(handshakeError(code)));
    });
  }

  // Thu tu: chu ky JWT -> CSDL san sang -> doc lai Users (spec backend 6.1). Nem ra ma loi dang chuoi.
  async handshake(socket: Socket): Promise<void> {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) throw 'UNAUTHENTICATED';
    let sig: { sub: number; exp: number };
    try { sig = await this.auth.verifySignature(token); } catch { throw 'UNAUTHENTICATED'; }
    if (!this.db.isReady()) throw 'RETRY_LATER';
    try {
      socket.data.user = await this.auth.loadActiveUser(sig.sub, sig.exp);
    } catch (e) {
      throw (e as { code?: string })?.code === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'RETRY_LATER';
    }
  }

  async handleConnection(socket: Socket): Promise<void> {
    const user = socket.data.user as AuthUser | undefined;
    if (!user) { socket.disconnect(true); return; }
    try {
      const houses = await this.db.prisma.houses.findMany({
        where: { IsActive: true, ...(user.role === 'ADMIN' ? {} : { OwnerId: user.userId }) },
        select: { HouseId: true, OwnerId: true, IsActive: true },
      });
      await socket.join(roomsFor(user, houses));
    } catch (e) {
      this.log.warn(`Khong xep phong duoc cho nguoi dung ${user.userId}: ${(e as Error).message}`);
      socket.disconnect(true);
      return;
    }
    socket.data.expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(0, user.exp * 1000 - Date.now()));
  }

  handleDisconnect(socket: Socket): void {
    clearTimeout(socket.data.expiryTimer as NodeJS.Timeout | undefined);
  }
}
```

- [ ] **Step 5: Viết adapter, module; nối vào app**

`backend/src/realtime/io.adapter.ts`:

```ts
import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

// CORS cua Socket.IO dung cung CORS_ORIGINS voi REST (hop dong 3.6).
export class CorsIoAdapter extends IoAdapter {
  constructor(app: INestApplicationContext, private readonly origins: string[]) { super(app); }
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, cors: { origin: this.origins } });
  }
}
```

`backend/src/realtime/realtime.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Global()
@Module({ providers: [RealtimeService, RealtimeGateway], exports: [RealtimeService] })
export class RealtimeModule {}
```

`app.module.ts`: `const FEATURE_MODULES: Type[] = [HealthModule, RealtimeModule];`
`main.ts`: sau `app.enableCors(...)` thêm `app.useWebSocketAdapter(new CorsIoAdapter(app, cfg.corsOrigins));`

- [ ] **Step 6: Chạy test**

Run: `npx jest src/realtime; npm run test:e2e`
Expected: PASS.

- [ ] **Step 7: Kiểm tay `connect_error.data.code` (S8, spec 6.5 "Nest có thể bọc lỗi")**

Với backend đang chạy (CSDL Dev): 

```powershell
node -e "const {io}=require('socket.io-client');const s=io('http://localhost:3000',{auth:{token:'sai'},reconnection:false});s.on('connect_error',e=>{console.log('code',e.data&&e.data.code);process.exit(0)})"
```

Expected: `code UNAUTHENTICATED`. In `undefined` → Nest bọc lỗi; ghi vào RESULTS.md mục S8 và sửa `afterInit` theo cách trả lỗi Nest 11 hỗ trợ cho tới khi in đúng.

- [ ] **Step 8: Commit**

```powershell
git add backend/src/realtime backend/src/app.module.ts backend/src/main.ts backend/spikes/RESULTS.md
git commit -m "feat(backend): Socket.IO kiểm bắt tay, xếp phòng theo nhà, phát sự kiện qua bộ tuần tự hóa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Quản lý người dùng (ADMIN) — `CANNOT_MODIFY_SELF`, `LAST_ADMIN`, ngắt socket

**Files:**
- Create: `backend/src/users/dto.ts`, `backend/src/users/users.service.ts`, `backend/src/users/users.service.spec.ts`, `backend/src/users/users.controller.ts`, `backend/src/users/users.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `UsersModule`)

**Interfaces:**
- Consumes: `DbService` (Task 6), `RealtimeService.disconnectUser` (Task 9), `pickers.user` (Task 5), `ApiError` (Task 4), `AuthUser`, `Roles` (Task 7).
- Produces: `UsersService` với `list()`, `get(id)`, `create(dto: CreateUserDto)`, `update(actor: AuthUser, id: number, dto: UpdateUserDto)`, `resetPassword(id: number, newPassword: string)`; route `GET/POST /api/users`, `GET/PATCH /api/users/:userId`, `POST /api/users/:userId/reset-password` (200).

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/users/users.service.spec.ts`:

```ts
import { compareSync } from 'bcryptjs';
import { UsersService } from './users.service';

const ADMIN = { userId: 1, role: 'ADMIN' as const, username: 'admin', exp: 0 };
const row = (o: Record<string, unknown>) => ({ UserId: 5, Username: 'u5', PasswordHash: 'h', FullName: 'U', Email: 'u5@x', Phone: null, Role: 'OWNER', IsActive: true, CreatedAt: new Date(0), ...o });

function setup(target: Record<string, unknown> | null, activeAdmins = 2) {
  const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => row({ ...target, ...data }));
  const tx = { $queryRawUnsafe: jest.fn(async () => [{ n: activeAdmins }]), users: { update } };
  const prisma = {
    users: { findUnique: jest.fn(async () => target && row(target)), update, create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => row(data)) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const rt = { disconnectUser: jest.fn() };
  return { svc: new UsersService({ prisma } as never, rt as never), prisma, tx, rt, update };
}

describe('UsersService.update', () => {
  it('ADMIN tu khoa minh hoac tu ha vai tro -> 409 CANNOT_MODIFY_SELF', async () => {
    for (const dto of [{ isActive: false }, { role: 'OWNER' as const }]) {
      const { svc, update } = setup({ UserId: 1, Role: 'ADMIN' });
      await expect(svc.update(ADMIN, 1, dto)).rejects.toMatchObject({ status: 409, code: 'CANNOT_MODIFY_SELF' });
      expect(update).not.toHaveBeenCalled();
    }
  });

  it('ha ADMIN dang hoat dong cuoi cung -> 409 LAST_ADMIN, dem bang UPDLOCK, HOLDLOCK trong transaction', async () => {
    const { svc, tx, update } = setup({ UserId: 7, Role: 'ADMIN' }, 1);
    await expect(svc.update(ADMIN, 7, { role: 'OWNER' })).rejects.toMatchObject({ status: 409, code: 'LAST_ADMIN' });
    expect(tx.$queryRawUnsafe.mock.calls[0][0]).toMatch(/WITH \(UPDLOCK, HOLDLOCK\)/);
    expect(update).not.toHaveBeenCalled();
  });

  it('con ADMIN khac -> cap nhat trong transaction, ngat socket (doi vai tro)', async () => {
    const { svc, prisma, rt } = setup({ UserId: 7, Role: 'ADMIN' }, 2);
    await expect(svc.update(ADMIN, 7, { role: 'OWNER' })).resolves.toMatchObject({ userId: 7, role: 'OWNER' });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(rt.disconnectUser).toHaveBeenCalledWith(7);
  });

  it('khoa OWNER -> ngat socket; doi ten -> khong ngat', async () => {
    const a = setup({ UserId: 5 });
    await a.svc.update(ADMIN, 5, { isActive: false });
    expect(a.rt.disconnectUser).toHaveBeenCalledWith(5);
    const b = setup({ UserId: 5 });
    await b.svc.update(ADMIN, 5, { fullName: 'Ten moi' });
    expect(b.rt.disconnectUser).not.toHaveBeenCalled();
  });

  it('khong ton tai -> 404', async () => {
    const { svc } = setup(null);
    await expect(svc.update(ADMIN, 99, { fullName: 'x' })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe('UsersService.create / resetPassword', () => {
  it('bam bcrypt cost 10, khong tra passwordHash', async () => {
    const { svc, prisma } = setup({ UserId: 5 });
    const u = await svc.create({ username: 'moi', password: 'mat-khau-dai', fullName: 'Moi', email: 'moi@x.local', role: 'OWNER' });
    const hash = prisma.users.create.mock.calls[0][0].data.PasswordHash as string;
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
    expect(compareSync('mat-khau-dai', hash)).toBe(true);
    expect(JSON.stringify(u)).not.toContain('$2');
  });

  it('resetPassword: bam mat khau moi', async () => {
    const { svc, update } = setup({ UserId: 5 });
    await svc.resetPassword(5, 'mat-khau-moi-1');
    expect(compareSync('mat-khau-moi-1', update.mock.calls[0][0].data.PasswordHash as string)).toBe(true);
  });
});
```

Run: `npx jest src/users`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/users/dto.ts`**

```ts
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

const ROLES = ['ADMIN', 'OWNER'] as const;
type RoleDto = (typeof ROLES)[number];

export class CreateUserDto {
  @IsString() @Length(3, 50) username!: string;
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
  @IsString() @Length(1, 100) fullName!: string;
  @IsEmail() @MaxLength(255) email!: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @IsIn(ROLES) role!: RoleDto;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @Length(1, 100) fullName?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @IsOptional() @IsIn(ROLES) role?: RoleDto;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(200) newPassword!: string;
}
```

- [ ] **Step 3: Viết `backend/src/users/users.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { ApiError } from '../common/errors';
import { AuthUser } from '../common/decorators';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateUserDto, UpdateUserDto } from './dto';

const notFound = () => new ApiError(404, 'NOT_FOUND');

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService, private readonly rt: RealtimeService) {}

  async list() {
    return (await this.db.prisma.users.findMany({ orderBy: { UserId: 'asc' } })).map(pick.user);
  }

  async get(id: number) {
    const u = await this.db.prisma.users.findUnique({ where: { UserId: id } });
    if (!u) throw notFound();
    return pick.user(u);
  }

  async create(dto: CreateUserDto) {
    const u = await this.db.prisma.users.create({
      data: { Username: dto.username, PasswordHash: await hash(dto.password, 10), FullName: dto.fullName, Email: dto.email, Phone: dto.phone ?? null, Role: dto.role },
    });
    return pick.user(u);
  }

  async update(actor: AuthUser, id: number, dto: UpdateUserDto) {
    const target = await this.db.prisma.users.findUnique({ where: { UserId: id } });
    if (!target) throw notFound();
    const deactivate = dto.isActive === false && target.IsActive;
    const roleChanged = dto.role !== undefined && dto.role !== target.Role;
    if (id === actor.userId && (deactivate || (roleChanged && dto.role !== 'ADMIN'))) throw new ApiError(409, 'CANNOT_MODIFY_SELF');
    const data = { FullName: dto.fullName, Email: dto.email, Phone: dto.phone, Role: dto.role, IsActive: dto.isActive };

    let updated;
    if (target.Role === 'ADMIN' && target.IsActive && (deactivate || roleChanged)) {
      // Hai ADMIN ha nhau dong thoi: dem va cap nhat trong cung transaction, khoa UPDLOCK, HOLDLOCK (hop dong 3.3).
      updated = await this.db.prisma.$transaction(async (tx) => {
        const [{ n }] = await tx.$queryRawUnsafe<Array<{ n: number }>>(
          'SELECT COUNT(*) AS n FROM dbo.Users WITH (UPDLOCK, HOLDLOCK) WHERE Role = @P1 AND IsActive = 1', 'ADMIN');
        if (Number(n) <= 1) throw new ApiError(409, 'LAST_ADMIN');
        return tx.users.update({ where: { UserId: id }, data });
      });
    } else {
      updated = await this.db.prisma.users.update({ where: { UserId: id }, data });
    }
    if (deactivate || roleChanged) this.rt.disconnectUser(id); // spec backend 6.2
    return pick.user(updated);
  }

  async resetPassword(id: number, newPassword: string) {
    if (!(await this.db.prisma.users.findUnique({ where: { UserId: id } }))) throw notFound();
    return pick.user(await this.db.prisma.users.update({ where: { UserId: id }, data: { PasswordHash: await hash(newPassword, 10) } }));
  }
}
```

- [ ] **Step 4: Viết controller, module; nối vào app**

`backend/src/users/users.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiError } from '../common/errors';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto';
import { UsersService } from './users.service';

const id = () => new ParseIntPipe({ exceptionFactory: () => new ApiError(404, 'NOT_FOUND') });

@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() list() { return this.users.list(); }
  @Post() create(@Body() dto: CreateUserDto) { return this.users.create(dto); }
  @Get(':userId') get(@Param('userId', id()) userId: number) { return this.users.get(userId); }
  @Patch(':userId') update(@CurrentUser() u: AuthUser, @Param('userId', id()) userId: number, @Body() dto: UpdateUserDto) { return this.users.update(u, userId, dto); }
  @Post(':userId/reset-password') @HttpCode(200)
  reset(@Param('userId', id()) userId: number, @Body() dto: ResetPasswordDto) { return this.users.resetPassword(userId, dto.newPassword); }
}
```

`backend/src/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
```

`app.module.ts`: thêm `UsersModule` vào `FEATURE_MODULES`.

- [ ] **Step 5: Chạy test**

Run: `npx jest src/users; npm run build`
Expected: PASS; build không lỗi kiểu (`tx.users.update` có trong client Prisma).

- [ ] **Step 6: Commit**

```powershell
git add backend/src/users backend/src/app.module.ts
git commit -m "feat(backend): quản lý người dùng cho ADMIN, chặn tự khóa và mất ADMIN cuối cùng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Luật điều khiển — hàm thuần `decide()` và bảng ca

**Files:**
- Create: `backend/src/control-loop/rules.ts`, `backend/src/control-loop/rules.spec.ts`

**Interfaces:**
- Produces (không import gì, spec backend 2.2):
  - `type Metric = 'TEMP' | 'HUMID' | 'CO2' | 'LIGHT'`, `type ActuatorType = 'FAN' | 'MIST' | 'HEATER'`, `type RuleKey = 'TEMP_HIGH' | 'TEMP_LOW' | 'HUMID_LOW' | 'HUMID_HIGH' | 'CO2_HIGH'`
  - `interface Reading { value: number; at: Date }`, `interface Bounds { min: number | null; max: number | null; target: number | null; hysteresis: number }`
  - `interface ActuatorState { deviceId: number; type: ActuatorType; mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null }`
  - `type Latches = Partial<Record<RuleKey, boolean>>`
  - `interface ZoneInput { readings: Partial<Record<Metric, Reading>>; bounds: Partial<Record<Metric, Bounds>>; actuators: ActuatorState[]; latches: Latches; nowUtc: Date; staleMinutes: number }`
  - `interface Command { deviceId: number; isOn: boolean; level: number | null; reason: string }`
  - `offThresholds(b: Bounds): { h: number; offHi: number | null; offLo: number | null }`
  - `decide(input: ZoneInput): { commands: Command[]; latches: Latches }`
  - `initLatches(input: Omit<ZoneInput, 'latches'>): Latches`
  - `RULES: ReadonlyArray<{ key: RuleKey; metric: Metric; dir: 'HIGH' | 'LOW'; device: ActuatorType }>`

- [ ] **Step 1: Viết bảng ca (phải fail)**

`backend/src/control-loop/rules.spec.ts` — ngưỡng seed: TEMP 26–30 Target 28 Hysteresis 0,5; HUMID 75–90 Target 82 Hysteresis 2; CO2 chỉ Max 1000 Hysteresis 50:

```ts
import { ActuatorState, Bounds, Latches, ZoneInput, decide, initLatches, offThresholds } from './rules';

const NOW = new Date(Date.UTC(2026, 9, 12, 10, 40, 7));
const fresh = (value: number) => ({ value, at: NOW });
const stale = (value: number) => ({ value, at: new Date(NOW.getTime() - 3 * 60_000) });
const TEMP: Bounds = { min: 26, max: 30, target: 28, hysteresis: 0.5 };
const HUMID: Bounds = { min: 75, max: 90, target: 82, hysteresis: 2 };
const CO2: Bounds = { min: null, max: 1000, target: null, hysteresis: 50 };
const fan = (o: Partial<ActuatorState> = {}): ActuatorState => ({ deviceId: 1, type: 'FAN', mode: 'AUTO', isOn: false, level: 0, ...o });
const mist = (o: Partial<ActuatorState> = {}): ActuatorState => ({ deviceId: 2, type: 'MIST', mode: 'AUTO', isOn: false, level: null, ...o });
const heater = (o: Partial<ActuatorState> = {}): ActuatorState => ({ deviceId: 3, type: 'HEATER', mode: 'AUTO', isOn: false, level: null, ...o });

function zone(o: Partial<ZoneInput>): ZoneInput {
  return { readings: {}, bounds: { TEMP, HUMID, CO2 }, actuators: [fan(), mist(), heater()], latches: {}, nowUtc: NOW, staleMinutes: 2, ...o };
}
const cmds = (o: Partial<ZoneInput>) => decide(zone(o)).commands.map((c) => [c.deviceId, c.isOn, c.level]);

describe('offThresholds', () => {
  it('co Min va Max: h = MIN(Hysteresis, (Max-Min)/4); lay muc chat hon voi Target', () => {
    expect(offThresholds(TEMP)).toEqual({ h: 0.5, offHi: 28, offLo: 28 });
    expect(offThresholds(HUMID)).toEqual({ h: 2, offHi: 82, offLo: 82 });
  });
  it('h bi chan boi (Max-Min)/4', () => {
    expect(offThresholds({ min: 28, max: 30, target: null, hysteresis: 2 })).toEqual({ h: 0.5, offHi: 29.5, offLo: 28.5 });
  });
  it('chi Max (CO2): offHi = Max - Hysteresis', () => {
    expect(offThresholds(CO2)).toEqual({ h: 50, offHi: 950, offLo: null });
  });
  it('Target = Max: offHi = Max - h (khong bat tat lien tuc quanh Max)', () => {
    expect(offThresholds({ min: 26, max: 30, target: 30, hysteresis: 0.5 }).offHi).toBe(29.5);
  });
});

describe('decide - bat/nha tung luat', () => {
  it.each([
    ['TEMP > Max -> FAN bat 100', { TEMP: fresh(30.6) }, {}, [[1, true, 100]]],
    ['TEMP < Min -> HEATER bat, Level NULL', { TEMP: fresh(25.4) }, {}, [[3, true, null]]],
    ['HUMID < Min -> MIST bat', { HUMID: fresh(74.9) }, {}, [[2, true, null]]],
    ['HUMID > Max -> FAN bat', { HUMID: fresh(91) }, {}, [[1, true, 100]]],
    ['CO2 > Max -> FAN bat', { CO2: fresh(1050) }, {}, [[1, true, 100]]],
    ['trong vung tre, chot dang bat -> giu bat (khong lenh)', { TEMP: fresh(29) }, { TEMP_HIGH: true }, []],
  ])('%s', (_l, readings, latches, expected) => {
    const act = 'TEMP_HIGH' in latches ? [fan({ isOn: true, level: 100 }), mist(), heater()] : undefined;
    expect(cmds({ readings, latches: latches as Latches, ...(act ? { actuators: act } : {}) })).toEqual(expected);
  });

  it('nha: TEMP <= offHi (28) -> FAN tat Level 0', () => {
    const r = decide(zone({ readings: { TEMP: fresh(28) }, latches: { TEMP_HIGH: true }, actuators: [fan({ isOn: true, level: 100 }), mist(), heater()] }));
    expect(r.commands.map((c) => [c.deviceId, c.isOn, c.level])).toEqual([[1, false, 0]]);
    expect(r.latches.TEMP_HIGH).toBe(false);
  });

  it('nha CO2 o 950 (Max - h), giu o 951', () => {
    const on = [fan({ isOn: true, level: 100 }), mist(), heater()];
    expect(cmds({ readings: { CO2: fresh(951) }, latches: { CO2_HIGH: true }, actuators: on })).toEqual([]);
    expect(cmds({ readings: { CO2: fresh(950) }, latches: { CO2_HIGH: true }, actuators: on })).toEqual([[1, false, 0]]);
  });
});

describe('decide - quy tac', () => {
  const fanOn = [fan({ isOn: true, level: 100 }), mist(), heater()];

  it('FAN do hai luat cung can: nha mot luat FAN van bat; nha ca hai moi tat', () => {
    expect(cmds({ readings: { TEMP: fresh(27), CO2: fresh(1100) }, latches: { TEMP_HIGH: true, CO2_HIGH: true }, actuators: fanOn })).toEqual([]);
    expect(cmds({ readings: { TEMP: fresh(27), CO2: fresh(900) }, latches: { TEMP_HIGH: true, CO2_HIGH: true }, actuators: fanOn })).toEqual([[1, false, 0]]);
  });

  it('moi luat mot chot: FAN bat vi CO2 khong lam luat TEMP tu giu', () => {
    const r = decide(zone({ readings: { TEMP: fresh(29), CO2: fresh(1100) }, latches: { CO2_HIGH: true }, actuators: fanOn }));
    expect(r.latches.TEMP_HIGH).toBe(false);
  });

  it('gia tri cu hon staleMinutes -> bo qua, giu nguyen chot, khong lenh', () => {
    const r = decide(zone({ readings: { TEMP: stale(25) }, latches: { TEMP_HIGH: true }, actuators: fanOn }));
    expect(r.commands).toEqual([]);
    expect(r.latches.TEMP_HIGH).toBe(true);
  });

  it('thiet bi MANUAL -> khong sinh lenh du chot doi', () => {
    expect(cmds({ readings: { TEMP: fresh(31) }, actuators: [fan({ mode: 'MANUAL' }), mist(), heater()] })).toEqual([]);
  });

  it('thieu nguong luat can (khong co Min HUMID) -> luat do tat han', () => {
    const r = decide(zone({ readings: { HUMID: fresh(10) }, bounds: { HUMID: { min: null, max: 90, target: null, hysteresis: 2 } } }));
    expect(r.latches.HUMID_LOW).toBe(false);
    expect(r.commands).toEqual([]);
  });

  it('FAN tra ve AUTO voi Level 80 -> lenh Level 100 (can bat) hoac 0 (can tat)', () => {
    expect(cmds({ readings: { TEMP: fresh(31) }, actuators: [fan({ isOn: true, level: 80 }), mist(), heater()] })).toEqual([[1, true, 100]]);
    expect(cmds({ readings: { TEMP: fresh(27) }, actuators: [fan({ isOn: true, level: 80 }), mist(), heater()] })).toEqual([[1, false, 0]]);
  });

  it('khong co doi -> khong lenh; reason ghi luat va gia tri', () => {
    expect(cmds({ readings: { TEMP: fresh(28) } })).toEqual([]);
    expect(decide(zone({ readings: { TEMP: fresh(30.6) } })).commands[0].reason).toBe('TEMP 30.6 > Max 30');
  });
});

describe('initLatches', () => {
  const base = { bounds: { TEMP, HUMID, CO2 }, nowUtc: NOW, staleMinutes: 2 };
  it('khong cu, da vuot nguong bat -> chot bat', () => {
    expect(initLatches({ ...base, readings: { TEMP: fresh(31) }, actuators: [fan(), mist(), heater()] }).TEMP_HIGH).toBe(true);
  });
  it('khong cu, giua nguong bat va nha, thiet bi dang bat -> chot bat; thiet bi tat -> chot tat', () => {
    expect(initLatches({ ...base, readings: { TEMP: fresh(29) }, actuators: [fan({ isOn: true, level: 100 }), mist(), heater()] }).TEMP_HIGH).toBe(true);
    expect(initLatches({ ...base, readings: { TEMP: fresh(29) }, actuators: [fan(), mist(), heater()] }).TEMP_HIGH).toBe(false);
  });
  it('ca kho: cam bien mat ket noi luc khoi dong, thiet bi dang bat -> chot tat, decide khong tat thiet bi', () => {
    const latches = initLatches({ ...base, readings: { TEMP: stale(31) }, actuators: [fan({ isOn: true, level: 100 }), mist(), heater()] });
    expect(latches.TEMP_HIGH).toBe(false);
    expect(decide({ ...base, readings: { TEMP: stale(31) }, latches, actuators: [fan({ isOn: true, level: 100 }), mist(), heater()] }).commands).toEqual([]);
  });
});
```

Ca "hai khu vực cùng có số đo trong một lô" (spec 4.5) thuộc `ControlLoopService` (Task 14): `decide()` chỉ nhận một khu vực.

Run: `npx jest src/control-loop/rules`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/control-loop/rules.ts`**

Thuật toán (spec backend 4.4):
1. Với từng luật trong `RULES`: lấy `bounds[metric]`; luật HIGH cần `max`, LOW cần `min` — thiếu → chốt `false` ("luật đó tắt hẳn").
2. **Chưa từng có số đo** của chỉ số đó → chốt `false` (luật không áp được, như thiếu ngưỡng).
3. **Số đo cũ hơn `staleMinutes`** (`nowUtc − at > staleMinutes·60000`) → **giữ chốt cũ**, đánh dấu luật "bị bỏ qua vì cũ".
4. HIGH: `value > max` → `true`; `value <= offHi` → `false`; còn lại giữ. LOW: `value < min` → `true`; `value >= offLo` → `false`; còn lại giữ. Khi **khởi tạo** (`initLatches`), "giữ" nghĩa là "thiết bị của luật đang bật"; số đo cũ → `false`.
5. Thiết bị cần bật = ít nhất một chốt của nó bật (FAN: `TEMP_HIGH | HUMID_HIGH | CO2_HIGH`; HEATER: `TEMP_LOW`; MIST: `HUMID_LOW`). **Không chốt nào bật mà có luật bị bỏ qua vì cũ → giữ nguyên trạng thái thiết bị** (hạn chế 4; ca khó lúc khởi động).
6. Chỉ cơ cấu chấp hành `mode === 'AUTO'`. Mức mong muốn FAN `isOn ? 100 : 0`, MIST/HEATER `null`. Sinh lệnh khi `isOn` khác, hoặc (FAN) `level` khác.
7. `reason`: bật → mô tả các luật đang bật, nối `; ` (VD `TEMP 30.6 > Max 30`); tắt → `Nha chot: <metric> <value>` của luật vừa nhả, không có thì `Khong con luat nao can bat`.

```ts
export type Metric = 'TEMP' | 'HUMID' | 'CO2' | 'LIGHT';
export type ActuatorType = 'FAN' | 'MIST' | 'HEATER';
export type RuleKey = 'TEMP_HIGH' | 'TEMP_LOW' | 'HUMID_LOW' | 'HUMID_HIGH' | 'CO2_HIGH';
export interface Reading { value: number; at: Date }
export interface Bounds { min: number | null; max: number | null; target: number | null; hysteresis: number }
export interface ActuatorState { deviceId: number; type: ActuatorType; mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null }
export type Latches = Partial<Record<RuleKey, boolean>>;
export interface ZoneInput { readings: Partial<Record<Metric, Reading>>; bounds: Partial<Record<Metric, Bounds>>; actuators: ActuatorState[]; latches: Latches; nowUtc: Date; staleMinutes: number }
export interface Command { deviceId: number; isOn: boolean; level: number | null; reason: string }

export const RULES: ReadonlyArray<{ key: RuleKey; metric: Metric; dir: 'HIGH' | 'LOW'; device: ActuatorType }> = [
  { key: 'TEMP_HIGH', metric: 'TEMP', dir: 'HIGH', device: 'FAN' },
  { key: 'TEMP_LOW', metric: 'TEMP', dir: 'LOW', device: 'HEATER' },
  { key: 'HUMID_LOW', metric: 'HUMID', dir: 'LOW', device: 'MIST' },
  { key: 'HUMID_HIGH', metric: 'HUMID', dir: 'HIGH', device: 'FAN' },
  { key: 'CO2_HIGH', metric: 'CO2', dir: 'HIGH', device: 'FAN' },
];

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function offThresholds(b: Bounds): { h: number; offHi: number | null; offLo: number | null } {
  const h = b.min !== null && b.max !== null ? Math.min(b.hysteresis, (b.max - b.min) / 4) : b.hysteresis;
  // Lay muc chat hon vi rang buoc cho phep Target = Max (hoac = Min) (spec backend 4.4).
  const offHi = b.max === null ? null : round(b.target !== null ? Math.min(b.target, b.max - h) : b.max - h);
  const offLo = b.min === null ? null : round(b.target !== null ? Math.max(b.target, b.min + h) : b.min + h);
  return { h: round(h), offHi, offLo };
}

interface Evaluation { latches: Latches; stale: Set<RuleKey>; why: Partial<Record<RuleKey, string>> }

function evaluate(input: Omit<ZoneInput, 'latches'>, prev: Latches, onInit: boolean): Evaluation {
  const ev: Evaluation = { latches: {}, stale: new Set(), why: {} };
  for (const rule of RULES) {
    const b = input.bounds[rule.metric];
    const limit = rule.dir === 'HIGH' ? b?.max : b?.min;
    const r = input.readings[rule.metric];
    if (!b || limit === null || limit === undefined || !r) { ev.latches[rule.key] = false; continue; }
    if (input.nowUtc.getTime() - r.at.getTime() > input.staleMinutes * 60_000) {
      ev.latches[rule.key] = onInit ? false : (prev[rule.key] ?? false);
      ev.stale.add(rule.key);
      continue;
    }
    const { offHi, offLo } = offThresholds(b);
    const keep = onInit ? input.actuators.some((a) => a.type === rule.device && a.isOn) : (prev[rule.key] ?? false);
    const on = rule.dir === 'HIGH'
      ? (r.value > limit ? true : r.value <= (offHi as number) ? false : keep)
      : (r.value < limit ? true : r.value >= (offLo as number) ? false : keep);
    ev.latches[rule.key] = on;
    ev.why[rule.key] = on
      ? `${rule.metric} ${r.value} ${rule.dir === 'HIGH' ? '> Max' : '< Min'} ${limit}`
      : `Nha chot: ${rule.metric} ${r.value}`;
  }
  return ev;
}

export function initLatches(input: Omit<ZoneInput, 'latches'>): Latches {
  return evaluate(input, {}, true).latches;
}

export function decide(input: ZoneInput): { commands: Command[]; latches: Latches } {
  const ev = evaluate(input, input.latches, false);
  const commands: Command[] = [];
  for (const a of input.actuators) {
    if (a.mode !== 'AUTO') continue;
    const rules = RULES.filter((r) => r.device === a.type);
    const isOn = rules.some((r) => ev.latches[r.key]);
    if (!isOn && rules.some((r) => ev.stale.has(r.key))) continue; // so do cu -> thiet bi giu trang thai
    const level = a.type === 'FAN' ? (isOn ? 100 : 0) : null;
    if (a.isOn === isOn && (a.type !== 'FAN' || a.level === level)) continue;
    const reason = isOn
      ? rules.filter((r) => ev.latches[r.key]).map((r) => ev.why[r.key]).join('; ')
      : rules.map((r) => (input.latches[r.key] && !ev.latches[r.key] ? ev.why[r.key] : undefined)).find(Boolean) ?? 'Khong con luat nao can bat';
    commands.push({ deviceId: a.deviceId, isOn, level, reason });
  }
  return { commands, latches: ev.latches };
}
```
- [ ] **Step 3: Chạy test**

Run: `npx jest src/control-loop/rules`
Expected: PASS mọi ca.

- [ ] **Step 4: Commit**

```powershell
git add backend/src/control-loop/rules.ts backend/src/control-loop/rules.spec.ts
git commit -m "feat(backend): luật điều khiển bật/tắt có vùng trễ, chốt từng luật, bảng ca

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Bộ nhớ đệm của vòng điều khiển (giá trị mới nhất, ngưỡng, trạng thái thiết bị, chốt)

**Files:**
- Create: `backend/src/control-loop/cache.service.ts`, `backend/src/control-loop/cache.service.spec.ts`

**Interfaces:**
- Consumes: `DbService` (Task 6), `AcceptedRow`, `ActuatorResult` (Task 6), `rules.ts` (Task 11).
- Produces: `ControlCache` (constructor `(db: DbService, clock?: () => Date)`, token `CLOCK`) với
  - `interface DeviceEntry { deviceId: number; code: string; zoneId: number; houseId: number; deviceType: 'FAN' | 'MIST' | 'HEATER' | 'SPEAKER'; mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null }`
  - `isLoaded(): boolean`, `load(): Promise<void>` (đăng ký làm loader của `DbService` ở Task 14), `applyReadings(rows: AcceptedRow[]): void`, `applyDeviceState(deviceId: number, s: { mode; isOn; level }): void`, `removeDevice(id: number): void`, `reloadDevice(id: number): Promise<void>`, `reloadThresholds(zoneId: number): Promise<void>`, `addZone(zoneId: number, houseId: number): void`, `zoneInput(zoneId: number, now: Date): ZoneInput | null`, `setLatches(zoneId: number, l: Latches): void`, `device(id: number): DeviceEntry | undefined`, `actuators(): DeviceEntry[]`, `houseOfZone(zoneId: number): number | undefined`, `STALE_MINUTES = 2`.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/control-loop/cache.service.spec.ts`:

```ts
import { ControlCache } from './cache.service';

const T0 = new Date(Date.UTC(2026, 9, 12, 10, 40, 0));
const later = (s: number) => new Date(T0.getTime() + s * 1000);

function fakeDb(latestAt = T0, latestTemp = 31) {
  const prisma = {
    metrics: { findMany: async () => [{ MetricCode: 'TEMP', Hysteresis: 0.5 }, { MetricCode: 'HUMID', Hysteresis: 2 }, { MetricCode: 'CO2', Hysteresis: 50 }, { MetricCode: 'LIGHT', Hysteresis: 2 }] },
    zones: { findMany: async () => [{ ZoneId: 10, HouseId: 1 }] },
    thresholds: { findMany: jest.fn(async () => [{ ZoneId: 10, MetricCode: 'TEMP', MinValue: 26, MaxValue: 30, TargetValue: 28 }]) },
    devices: {
      findMany: async () => [
        { DeviceId: 20, Code: 'H1-F1-FAN', ZoneId: 10, DeviceType: 'FAN', Mode: 'AUTO', IsOn: false, Level: 0, Zone: { HouseId: 1 } },
        { DeviceId: 21, Code: 'H1-F0-SPEAKER', ZoneId: 10, DeviceType: 'SPEAKER', Mode: 'AUTO', IsOn: false, Level: null, Zone: { HouseId: 1 } },
      ],
      findUnique: jest.fn(async () => ({ DeviceId: 22, Code: 'H1-F1-MIST', ZoneId: 10, DeviceType: 'MIST', Mode: 'AUTO', IsOn: false, Level: null, IsActive: true, Zone: { HouseId: 1, House: { IsActive: true } } })),
    },
    $queryRawUnsafe: jest.fn(async () => [{ ZoneId: 10, MetricCode: 'TEMP', Value: latestTemp, RecordedAt: latestAt }]),
  };
  return { prisma };
}

describe('ControlCache', () => {
  it('load: nap nguong + Hysteresis, thiet bi (ca SPEAKER), gia tri moi nhat, khoi tao chot', async () => {
    const c = new ControlCache(fakeDb() as never, () => later(1));
    await c.load();
    expect(c.isLoaded()).toBe(true);
    const z = c.zoneInput(10, later(1))!;
    expect(z.bounds.TEMP).toEqual({ min: 26, max: 30, target: 28, hysteresis: 0.5 });
    expect(z.actuators.map((a) => a.type)).toEqual(['FAN']);
    expect(c.actuators().map((d) => d.code)).toEqual(['H1-F1-FAN', 'H1-F0-SPEAKER']);
    expect(z.latches.TEMP_HIGH).toBe(true);
    expect(c.houseOfZone(10)).toBe(1);
  });

  it('khong ghi de gia tri moi hon: ca khi nap lai va khi applyReadings', async () => {
    const db = fakeDb(T0, 31);
    const c = new ControlCache(db as never);
    await c.load();
    c.applyReadings([{ DeviceId: 5, DeviceCode: 'H1-F1-SENSOR', HouseId: 1, ZoneId: 10, MetricCode: 'TEMP', Value: 27, RecordedAt: later(10).toISOString() }]);
    await c.load();                     // vw_LatestReadings van tra T0 (cu hon)
    expect(c.zoneInput(10, later(11))!.readings.TEMP).toEqual({ value: 27, at: later(10) });
    c.applyReadings([{ DeviceId: 5, DeviceCode: 'H1-F1-SENSOR', HouseId: 1, ZoneId: 10, MetricCode: 'TEMP', Value: 40, RecordedAt: later(5).toISOString() }]);
    expect(c.zoneInput(10, later(11))!.readings.TEMP!.value).toBe(27);
  });

  it('applyDeviceState, removeDevice, reloadDevice', async () => {
    const c = new ControlCache(fakeDb() as never);
    await c.load();
    c.applyDeviceState(20, { mode: 'MANUAL', isOn: true, level: 80 });
    expect(c.device(20)).toMatchObject({ mode: 'MANUAL', isOn: true, level: 80 });
    c.removeDevice(20);
    expect(c.device(20)).toBeUndefined();
    await c.reloadDevice(22);
    expect(c.device(22)).toMatchObject({ code: 'H1-F1-MIST', houseId: 1 });
  });

  it('zoneInput khu vuc khong co -> null; addZone -> co (chua nguong, chua thiet bi)', async () => {
    const c = new ControlCache(fakeDb() as never);
    await c.load();
    expect(c.zoneInput(99, T0)).toBeNull();
    c.addZone(99, 1);
    expect(c.zoneInput(99, T0)).toMatchObject({ bounds: {}, actuators: [] });
  });
});
```

Run: `npx jest src/control-loop/cache`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/control-loop/cache.service.ts`**

```ts
import { Inject, Injectable, Optional } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { AcceptedRow } from '../db/sp';
import { ActuatorType, Bounds, Latches, Metric, Reading, ZoneInput, initLatches } from './rules';

export const STALE_MINUTES = 2; // = @StaleMinutes mac dinh cua sp_IngestReadings
export const CLOCK = 'CLOCK';
const ACTUATORS = ['FAN', 'MIST', 'HEATER', 'SPEAKER'];
const RULE_DEVICES: string[] = ['FAN', 'MIST', 'HEATER'];

export interface DeviceEntry {
  deviceId: number; code: string; zoneId: number; houseId: number;
  deviceType: 'FAN' | 'MIST' | 'HEATER' | 'SPEAKER'; mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null;
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const toEntry = (d: Row & { Zone: { HouseId: number } }): DeviceEntry => ({
  deviceId: d.DeviceId as number, code: d.Code as string, zoneId: d.ZoneId as number, houseId: d.Zone.HouseId,
  deviceType: d.DeviceType as DeviceEntry['deviceType'], mode: d.Mode as 'AUTO' | 'MANUAL', isOn: Boolean(d.IsOn), level: num(d.Level),
});

// Mot tien trinh, mot backend (han che 7, 9). Trang thai thiet bi chi cap nhat tu ket qua sp_SetActuator (spec 3.1).
@Injectable()
export class ControlCache {
  private loaded = false;
  private zoneHouse = new Map<number, number>();
  private hysteresis = new Map<string, number>();
  private bounds = new Map<number, Partial<Record<Metric, Bounds>>>();
  private devices = new Map<number, DeviceEntry>();
  private latches = new Map<number, Latches>();
  private readonly latest = new Map<number, Partial<Record<Metric, Reading>>>();

  constructor(private readonly db: DbService, @Optional() @Inject(CLOCK) private readonly clock: () => Date = () => new Date()) {}

  isLoaded(): boolean { return this.loaded; }

  async load(): Promise<void> {
    const p = this.db.prisma;
    const metrics = await p.metrics.findMany();
    const zones = await p.zones.findMany({ where: { House: { IsActive: true } }, select: { ZoneId: true, HouseId: true } });
    const zoneIds = zones.map((z) => z.ZoneId);
    const thresholds = await p.thresholds.findMany({ where: { ZoneId: { in: zoneIds } } });
    const devices = await p.devices.findMany({
      where: { IsActive: true, DeviceType: { in: ACTUATORS }, Zone: { House: { IsActive: true } } },
      select: { DeviceId: true, Code: true, ZoneId: true, DeviceType: true, Mode: true, IsOn: true, Level: true, Zone: { select: { HouseId: true } } },
      orderBy: { DeviceId: 'asc' },
    });
    const latest = await p.$queryRawUnsafe<Row[]>('SELECT ZoneId, MetricCode, Value, RecordedAt FROM dbo.vw_LatestReadings');

    this.hysteresis = new Map(metrics.map((m) => [m.MetricCode, Number(m.Hysteresis)]));
    this.zoneHouse = new Map(zones.map((z) => [z.ZoneId, z.HouseId]));
    this.bounds = new Map(zoneIds.map((id) => [id, {}]));
    for (const t of thresholds) this.setBound(t as unknown as Row);
    this.devices = new Map(devices.map((d) => [d.DeviceId, toEntry(d as unknown as Row & { Zone: { HouseId: number } })]));
    for (const r of latest) this.put(Number(r.ZoneId), r.MetricCode as Metric, Number(r.Value), new Date(r.RecordedAt as Date));
    const now = this.clock();
    // Khoi tao chot moi lan nap (spec backend 4.4 "khoi dong hoac nap lai bo nho dem").
    this.latches = new Map(zoneIds.map((id) => [id, initLatches(this.zoneInputRaw(id, now))]));
    this.loaded = true;
  }

  applyReadings(rows: AcceptedRow[]): void {
    for (const r of rows) if (this.zoneHouse.has(r.ZoneId)) this.put(r.ZoneId, r.MetricCode as Metric, Number(r.Value), new Date(r.RecordedAt));
  }

  applyDeviceState(deviceId: number, s: { mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null }): void {
    const d = this.devices.get(deviceId);
    if (d) Object.assign(d, s);
  }

  removeDevice(id: number): void { this.devices.delete(id); }

  async reloadDevice(id: number): Promise<void> {
    const d = await this.db.prisma.devices.findUnique({
      where: { DeviceId: id },
      select: { DeviceId: true, Code: true, ZoneId: true, DeviceType: true, Mode: true, IsOn: true, Level: true, IsActive: true, Zone: { select: { HouseId: true, House: { select: { IsActive: true } } } } },
    });
    if (!d || !d.IsActive || !d.Zone.House.IsActive || !ACTUATORS.includes(d.DeviceType)) { this.devices.delete(id); return; }
    this.devices.set(id, toEntry(d as unknown as Row & { Zone: { HouseId: number } }));
  }

  async reloadThresholds(zoneId: number): Promise<void> {
    const rows = await this.db.prisma.thresholds.findMany({ where: { ZoneId: zoneId } });
    this.bounds.set(zoneId, {});
    for (const t of rows) this.setBound(t as unknown as Row);
  }

  addZone(zoneId: number, houseId: number): void {
    this.zoneHouse.set(zoneId, houseId);
    if (!this.bounds.has(zoneId)) this.bounds.set(zoneId, {});
    if (!this.latches.has(zoneId)) this.latches.set(zoneId, {});
  }

  zoneInput(zoneId: number, now: Date): ZoneInput | null {
    return this.zoneHouse.has(zoneId) ? this.zoneInputRaw(zoneId, now) : null;
  }

  setLatches(zoneId: number, l: Latches): void { this.latches.set(zoneId, l); }
  device(id: number): DeviceEntry | undefined { return this.devices.get(id); }
  actuators(): DeviceEntry[] { return [...this.devices.values()]; }
  houseOfZone(zoneId: number): number | undefined { return this.zoneHouse.get(zoneId); }

  private zoneInputRaw(zoneId: number, now: Date): ZoneInput {
    return {
      readings: { ...(this.latest.get(zoneId) ?? {}) },
      bounds: { ...(this.bounds.get(zoneId) ?? {}) },
      actuators: [...this.devices.values()]
        .filter((d) => d.zoneId === zoneId && RULE_DEVICES.includes(d.deviceType))
        .map((d) => ({ deviceId: d.deviceId, type: d.deviceType as ActuatorType, mode: d.mode, isOn: d.isOn, level: d.level })),
      latches: { ...(this.latches.get(zoneId) ?? {}) },
      nowUtc: now,
      staleMinutes: STALE_MINUTES,
    };
  }

  private setBound(t: Row): void {
    const zone = this.bounds.get(Number(t.ZoneId)) ?? {};
    zone[t.MetricCode as Metric] = { min: num(t.MinValue), max: num(t.MaxValue), target: num(t.TargetValue), hysteresis: this.hysteresis.get(t.MetricCode as string) ?? 0 };
    this.bounds.set(Number(t.ZoneId), zone);
  }

  // Chi thay khi moi hon (spec backend 3.1: khong ghi de gia tri moi hon).
  private put(zoneId: number, metric: Metric, value: number, at: Date): void {
    const zone = this.latest.get(zoneId) ?? {};
    const cur = zone[metric];
    if (!cur || at.getTime() > cur.at.getTime()) zone[metric] = { value, at };
    this.latest.set(zoneId, zone);
  }
}
```

- [ ] **Step 3: Chạy test**

Run: `npx jest src/control-loop`
Expected: PASS (cả Task 11).

- [ ] **Step 4: Commit**

```powershell
git add backend/src/control-loop/cache.service.ts backend/src/control-loop/cache.service.spec.ts
git commit -m "feat(backend): bộ nhớ đệm vòng điều khiển, không ghi đè giá trị mới hơn

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Client MQTT — kết nối giữ phiên, subscribe, publish lệnh retained, sai tài khoản thì dừng

**Files:**
- Create: `backend/src/mqtt/mqtt.service.ts`, `backend/src/mqtt/mqtt.service.spec.ts`, `backend/src/mqtt/mqtt.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `MqttModule`), `backend/src/main.ts` (gọi `MqttService.start()` sau `DbService.start()`)

**Interfaces:**
- Consumes: `APP_CONFIG` (Task 2), `EXIT` (Task 6), `MqttStatus` (Task 8), kết quả S9 (Task 1: mã lỗi sai tài khoản).
- Produces: `MqttService extends MqttStatus`:
  - `start(): void`, `isConnected(): boolean`, `end(): Promise<void>` (ngắt giữ phiên)
  - `onReadings(fn: (code: string, payload: Buffer) => void)`, `onHeartbeat(fn: (code: string, payload: Buffer) => void)` (đăng ký trước `start()`; có handler heartbeat thì mới subscribe topic heartbeat), `onConnect(fn: () => void)`
  - `publishCommand(code: string, s: { isOn: boolean; level: number | null; mode: 'AUTO' | 'MANUAL' }): Promise<void>` — topic `swiftlet/devices/{code}/command`, QoS 1, retained, payload `{isOn, level, mode, issuedAt}`.
  - Token `MQTT_CONNECT` (hàm `connect` của mqtt.js, thay được trong test). `MqttModule` (global) cung cấp `MqttService` và `MqttStatus` (useExisting).

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/mqtt/mqtt.service.spec.ts`:

```ts
import { EventEmitter } from 'node:events';
import { MqttService } from './mqtt.service';

const cfg = { mqtt: { url: 'mqtt://localhost:1883', username: 'backend', password: 'mk' } } as never;

function fake() {
  const client = Object.assign(new EventEmitter(), {
    subscribe: jest.fn(),
    publishAsync: jest.fn(async () => undefined),
    endAsync: jest.fn(async () => undefined),
  });
  const connect = jest.fn(() => client);
  return { client, connect };
}

describe('MqttService', () => {
  it('ket noi: client id swiftlet-backend, clean false, tai khoan backend; subscribe readings QoS 1', () => {
    const { client, connect } = fake();
    const m = new MqttService(cfg, connect as never, jest.fn());
    m.onReadings(() => undefined);
    m.start();
    expect(connect).toHaveBeenCalledWith('mqtt://localhost:1883', expect.objectContaining({ clientId: 'swiftlet-backend', clean: false, username: 'backend', password: 'mk' }));
    client.emit('connect');
    expect(m.isConnected()).toBe(true);
    expect(client.subscribe).toHaveBeenCalledWith('swiftlet/devices/+/readings', { qos: 1 });
    expect(client.subscribe).not.toHaveBeenCalledWith('swiftlet/devices/+/heartbeat', expect.anything());
  });

  it('co handler heartbeat -> subscribe heartbeat QoS 0; dinh tuyen tin theo topic, bo topic la', () => {
    const { client, connect } = fake();
    const m = new MqttService(cfg, connect as never, jest.fn());
    const got: string[] = [];
    m.onReadings((code) => got.push(`r:${code}`));
    m.onHeartbeat((code) => got.push(`h:${code}`));
    m.start();
    client.emit('connect');
    expect(client.subscribe).toHaveBeenCalledWith('swiftlet/devices/+/heartbeat', { qos: 0 });
    client.emit('message', 'swiftlet/devices/H1-F1-SENSOR/readings', Buffer.from('[]'));
    client.emit('message', 'swiftlet/devices/H1-F1-FAN/heartbeat', Buffer.from('{}'));
    client.emit('message', 'swiftlet/devices/h1 bad/readings', Buffer.from('[]'));
    client.emit('message', 'khac/topic', Buffer.from('x'));
    expect(got).toEqual(['r:H1-F1-SENSOR', 'h:H1-F1-FAN']);
  });

  it('publishCommand: retained QoS 1, payload dung 4 khoa, issuedAt co Z', async () => {
    const { client, connect } = fake();
    const m = new MqttService(cfg, connect as never, jest.fn());
    m.start();
    await m.publishCommand('H1-F1-FAN', { isOn: true, level: 80, mode: 'MANUAL' });
    const [topic, body, opts] = client.publishAsync.mock.calls[0] as [string, string, object];
    expect(topic).toBe('swiftlet/devices/H1-F1-FAN/command');
    expect(opts).toEqual({ qos: 1, retain: true });
    const p = JSON.parse(body);
    expect(Object.keys(p)).toEqual(['isOn', 'level', 'mode', 'issuedAt']);
    expect(p.issuedAt).toMatch(/Z$/);
  });

  it('goi onConnect moi lan ket noi', () => {
    const { client, connect } = fake();
    const m = new MqttService(cfg, connect as never, jest.fn());
    const onConnect = jest.fn();
    m.onConnect(onConnect);
    m.start();
    client.emit('connect');
    client.emit('connect');
    expect(onConnect).toHaveBeenCalledTimes(2);
  });

  // S9: mqtt.js khong tu ket noi lai sau CONNACK 4/5, nen dung ngay lan dau.
  it.each([
    [5, 'Connection refused: Not authorized'],
    [4, 'Connection refused: Bad username or password'],
  ])('sai tai khoan (CONNACK %i) -> exit(1) ngay lan dau', (code, msg) => {
    const { client, connect } = fake();
    const exit = jest.fn();
    const m = new MqttService(cfg, connect as never, exit);
    m.start();
    client.emit('error', Object.assign(new Error(msg), { code }));
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('loi khac (ECONNREFUSED) -> khong dung, de mqtt.js tu ket noi lai', () => {
    const { client, connect } = fake();
    const exit = jest.fn();
    const m = new MqttService(cfg, connect as never, exit);
    m.start();
    for (let i = 0; i < 6; i++) client.emit('error', Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
    expect(exit).not.toHaveBeenCalled();
  });

  it('close -> het ket noi', () => {
    const { client, connect } = fake();
    const m = new MqttService(cfg, connect as never, jest.fn());
    m.start();
    client.emit('connect');
    client.emit('close');
    expect(m.isConnected()).toBe(false);
  });
});
```

Run: `npx jest src/mqtt/mqtt.service`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/mqtt/mqtt.service.ts`**

```ts
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { connect as mqttConnect, MqttClient } from 'mqtt';
import { APP_CONFIG, AppConfig } from '../config/config';
import { MqttStatus } from '../common/status';
import { EXIT } from '../db/db.service';

export const MQTT_CONNECT = 'MQTT_CONNECT';
const TOPIC = /^swiftlet\/devices\/([A-Z0-9-]+)\/(readings|heartbeat)$/;
type Handler = (code: string, payload: Buffer) => void;

// Cua duy nhat noi chuyen voi broker (spec backend 2.2). Client id co dinh, giu phien (hop dong 2.2).
@Injectable()
export class MqttService extends MqttStatus {
  private readonly log = new Logger('MQTT');
  private client: MqttClient | null = null;
  private connected = false;
  private readingsHandler: Handler | null = null;
  private heartbeatHandler: Handler | null = null;
  private readonly connectHandlers: Array<() => void> = [];

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Optional() @Inject(MQTT_CONNECT) private readonly connectFn: typeof mqttConnect = mqttConnect,
    @Optional() @Inject(EXIT) private readonly exit: (code: number) => void = (code) => process.exit(code),
  ) {
    super();
  }

  onReadings(fn: Handler): void { this.readingsHandler = fn; }
  onHeartbeat(fn: Handler): void { this.heartbeatHandler = fn; }
  onConnect(fn: () => void): void { this.connectHandlers.push(fn); }
  isConnected(): boolean { return this.connected; }

  start(): void {
    const c = this.connectFn(this.cfg.mqtt.url, {
      clientId: 'swiftlet-backend', clean: false, username: this.cfg.mqtt.username, password: this.cfg.mqtt.password, reconnectPeriod: 1000,
    });
    this.client = c;
    c.on('connect', () => {
      if (!this.connected) this.log.log('Da ket noi broker');
      this.connected = true;
      c.subscribe('swiftlet/devices/+/readings', { qos: 1 });
      if (this.heartbeatHandler) c.subscribe('swiftlet/devices/+/heartbeat', { qos: 0 });
      for (const fn of this.connectHandlers) {
        try { fn(); } catch (e) { this.log.error(`onConnect loi: ${(e as Error).message}`); }
      }
    });
    c.on('close', () => {
      if (this.connected) this.log.warn('Mat ket noi broker, mqtt.js tu ket noi lai');
      this.connected = false;
    });
    c.on('error', (err: Error & { code?: number | string }) => {
      // CONNACK 4 "Bad username or password" / 5 "Not authorized": mqtt.js khong tu ket noi lai (S9) -> dung ngay.
      if (err.code === 4 || err.code === 5) {
        this.log.error(`Broker tu choi tai khoan (CONNACK ${err.code}), kiem tra MQTT_USERNAME/MQTT_PASSWORD; dung backend`);
        this.exit(1);
        return;
      }
      this.log.warn(`Loi MQTT: ${err.code ?? err.message}`);
    });
    c.on('message', (topic: string, payload: Buffer) => {
      const m = TOPIC.exec(topic);
      if (!m) return;
      const h = m[2] === 'readings' ? this.readingsHandler : this.heartbeatHandler;
      try { h?.(m[1], payload); } catch (e) { this.log.error(`Xu ly tin ${m[2]} loi: ${(e as Error).message}`); }
    });
  }

  async publishCommand(code: string, s: { isOn: boolean; level: number | null; mode: 'AUTO' | 'MANUAL' }): Promise<void> {
    if (!this.client) throw new Error('MQTT chua khoi dong');
    const payload = JSON.stringify({ isOn: s.isOn, level: s.level, mode: s.mode, issuedAt: new Date().toISOString() });
    await this.client.publishAsync(`swiftlet/devices/${code}/command`, payload, { qos: 1, retain: true });
  }

  async end(): Promise<void> {
    await this.client?.endAsync(false);
    this.connected = false;
  }
}
```

- [ ] **Step 3: Viết `backend/src/mqtt/mqtt.module.ts`; nối vào app**

```ts
import { Global, Module } from '@nestjs/common';
import { MqttStatus } from '../common/status';
import { MqttService } from './mqtt.service';

@Global()
@Module({ providers: [MqttService, { provide: MqttStatus, useExisting: MqttService }], exports: [MqttService, MqttStatus] })
export class MqttModule {}
```

`app.module.ts`: thêm `MqttModule` vào `FEATURE_MODULES` (trước `HealthModule` để `MqttStatus` có sẵn). `main.ts`: sau `app.get(DbService).start();` thêm `app.get(MqttService).start();`.

- [ ] **Step 4: Chạy test**

Run: `npx jest src/mqtt; npm run test:e2e`
Expected: PASS (e2e không gọi `start()`).

- [ ] **Step 5: Kiểm tay với Mosquitto**

`npm run build; npm run start`, rồi `curl.exe -s http://localhost:3000/api/health` → `{"status":"ok","db":"ok","mqtt":"connected"}`. Đổi tạm `MQTT_PASSWORD` sai trong `.env`, chạy lại → **ngay lần đầu** log "Broker tu choi tai khoan (CONNACK 5)" backend dừng mã 1 trong vài giây. Trả `.env` về đúng.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/mqtt backend/src/app.module.ts backend/src/main.ts
git commit -m "feat(backend): client MQTT giữ phiên, subscribe theo topic, publish lệnh retained

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Vòng điều khiển — hàng đợi tuần tự, bước thực thi chung, đồng bộ lệnh retained, điều khiển tay

**Files:**
- Create: `backend/src/control-loop/control-loop.service.ts`, `backend/src/control-loop/control-loop.service.spec.ts`, `backend/src/control-loop/control-loop.module.ts`, `backend/src/common/paging.ts`, `backend/src/control/dto.ts`, `backend/src/control/control.controller.ts`, `backend/src/control/control.controller.spec.ts`, `backend/src/control/control.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `ControlLoopModule`, `ControlModule`)

**Interfaces:**
- Consumes: `ControlCache`, `CLOCK` (Task 12), `decide` (Task 11), `SpService.setActuator`, `SetActuatorArgs`, `ActuatorResult` (Task 6), `MqttService` (Task 13), `RealtimeService` (Task 9), `DbService` (Task 6), `withTimeout` (Task 6), `sqlNumberOf` (Task 4).
- Produces:
  - `ControlLoopService`: `runZones(zoneIds: number[]): Promise<void>` (tuần tự, không chồng), `executeManual(a: SetActuatorArgs): Promise<ActuatorResult>` (cùng hàng đợi), `requestResync(): void` (≤ 1 lần / 5 giây, chờ bộ nhớ đệm nạp xong), hằng `COMMAND_TIMEOUT_MS = 5000`, `RESYNC_MIN_GAP_MS = 5000`. Đăng ký `ControlCache.load` làm loader của `DbService` và `requestResync` làm `MqttService.onConnect`.
  - `ControlLoopModule` (global) export `ControlCache`, `ControlLoopService`.
  - `common/paging.ts`: `class PageQuery { limit: number = 50; before?: number }` (1 ≤ limit ≤ 200, before ≥ 1), `toPage<T>(rows: T[], limit: number, idOf: (r: T) => number, map: (r: T) => unknown): { items: unknown[]; nextBefore: number | null }`.
  - Route `POST /api/devices/:deviceId/control` (200), `GET /api/devices/:deviceId/control-logs?limit=&before=`.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/control-loop/control-loop.service.spec.ts`:

```ts
import { ControlLoopService } from './control-loop.service';
import { ControlCache } from './cache.service';

const NOW = new Date(Date.UTC(2026, 9, 12, 10, 40, 7));

function setup(opts: { setActuator?: jest.Mock } = {}) {
  const cache = new ControlCache({} as never, () => NOW);
  // Nap tay khong qua CSDL: 2 khu vuc, moi khu vuc FAN + MIST.
  Object.assign(cache as unknown as Record<string, unknown>, { loaded: true });
  cache.addZone(10, 1); cache.addZone(11, 1);
  for (const [zone, base] of [[10, 100], [11, 200]]) {
    (cache as unknown as { devices: Map<number, unknown> }).devices.set(base, { deviceId: base, code: `Z${zone}-FAN`, zoneId: zone, houseId: 1, deviceType: 'FAN', mode: 'AUTO', isOn: false, level: 0 });
    (cache as unknown as { devices: Map<number, unknown> }).devices.set(base + 1, { deviceId: base + 1, code: `Z${zone}-MIST`, zoneId: zone, houseId: 1, deviceType: 'MIST', mode: 'AUTO', isOn: false, level: null });
    (cache as unknown as { bounds: Map<number, unknown> }).bounds.set(zone, { TEMP: { min: 26, max: 30, target: 28, hysteresis: 0.5 }, HUMID: { min: 75, max: 90, target: 82, hysteresis: 2 } });
  }
  const setActuator = opts.setActuator ?? jest.fn(async (a) => ({ changed: true, deviceCode: `D${a.deviceId}`, mode: 'AUTO', isOn: a.isOn, level: a.level }));
  const sp = { setActuator };
  const mqtt = { publishCommand: jest.fn(async () => undefined), onConnect: jest.fn() };
  const rt = { emitToHouse: jest.fn() };
  const db = { addLoader: jest.fn() };
  const loop = new ControlLoopService(cache, sp as never, mqtt as never, rt as never, db as never, () => NOW);
  const read = (zone: number, metric: string, value: number) => cache.applyReadings([{ DeviceId: 1, DeviceCode: 'S', HouseId: 1, ZoneId: zone, MetricCode: metric, Value: value, RecordedAt: NOW.toISOString() }]);
  return { loop, cache, sp, mqtt, rt, read, setActuator };
}

describe('ControlLoopService.runZones', () => {
  it('TEMP > Max -> sp_SetActuator AUTO Level 100; cap nhat bo nho dem tu KET QUA SP; publish + device.state', async () => {
    const { loop, cache, read, setActuator, mqtt, rt } = setup({
      setActuator: jest.fn(async () => ({ changed: true, deviceCode: 'Z10-FAN', mode: 'AUTO', isOn: true, level: 100 })),
    });
    read(10, 'TEMP', 30.6);
    await loop.runZones([10]);
    expect(setActuator).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 100, isOn: true, level: 100, source: 'AUTO', mode: null, userId: null, reason: 'TEMP 30.6 > Max 30' }));
    expect(cache.device(100)).toMatchObject({ isOn: true, level: 100 });
    expect(mqtt.publishCommand).toHaveBeenCalledWith('Z10-FAN', { isOn: true, level: 100, mode: 'AUTO' });
    expect(rt.emitToHouse).toHaveBeenCalledWith(1, 'device.state', expect.objectContaining({ deviceId: 100, deviceCode: 'Z10-FAN', houseId: 1, zoneId: 10, source: 'AUTO', at: NOW }));
  });

  it('Changed = 0 -> khong publish, khong phat; van cap nhat bo nho dem', async () => {
    const { loop, cache, read, mqtt, rt } = setup({ setActuator: jest.fn(async () => ({ changed: false, deviceCode: 'Z10-FAN', mode: 'MANUAL', isOn: false, level: 0 })) });
    read(10, 'TEMP', 31);
    await loop.runZones([10]);
    expect(mqtt.publishCommand).not.toHaveBeenCalled();
    expect(rt.emitToHouse).not.toHaveBeenCalled();
    expect(cache.device(100)?.mode).toBe('MANUAL');
  });

  it('mot lenh loi khong chan lenh khac cung luot; hai khu vuc doc lap trong mot lo', async () => {
    const setActuator = jest.fn(async (a) => {
      if (a.deviceId === 100) throw new Error('loi gia');
      return { changed: true, deviceCode: `D${a.deviceId}`, mode: 'AUTO', isOn: a.isOn, level: a.level };
    });
    const { loop, read } = setup({ setActuator });
    read(10, 'TEMP', 31); read(10, 'HUMID', 70);  // FAN 100 (loi) + MIST
    read(11, 'TEMP', 27);                         // khong lenh
    await loop.runZones([10, 11, 10]);
    expect(setActuator.mock.calls.map((c) => c[0].deviceId).sort()).toEqual([100, 101]);
  });

  it('lenh qua 5 giay -> bo, chay lenh tiep', async () => {
    jest.useFakeTimers();
    const setActuator = jest.fn((a) => (a.deviceId === 100 ? new Promise(() => undefined) : Promise.resolve({ changed: true, deviceCode: 'x', mode: 'AUTO', isOn: true, level: null })));
    const { loop, read } = setup({ setActuator });
    read(10, 'TEMP', 31); read(10, 'HUMID', 70);
    const p = loop.runZones([10]);
    await jest.advanceTimersByTimeAsync(5001);
    await p;
    expect(setActuator).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('lenh AUTO nhan 50003 -> bo thiet bi khoi bo nho dem', async () => {
    const { loop, cache, read } = setup({ setActuator: jest.fn(async () => { throw Object.assign(new Error('x'), { number: 50003 }); }) });
    read(10, 'TEMP', 31);
    await loop.runZones([10]);
    expect(cache.device(100)).toBeUndefined();
  });
});

describe('ControlLoopService.executeManual (Review Focus 5)', () => {
  it('cung hang doi voi vong tu dong: bo nho dem = ket qua SP sau cung', async () => {
    let release!: () => void;
    const setActuator = jest.fn()
      .mockImplementationOnce(() => new Promise((r) => { release = () => r({ changed: true, deviceCode: 'Z10-FAN', mode: 'AUTO', isOn: true, level: 100 }); }))
      .mockImplementationOnce(async () => ({ changed: true, deviceCode: 'Z10-FAN', mode: 'MANUAL', isOn: false, level: 0 }));
    const { loop, cache, read } = setup({ setActuator });
    read(10, 'TEMP', 31);
    const auto = loop.runZones([10]);
    const manual = loop.executeManual({ deviceId: 100, isOn: false, level: 0, source: 'MANUAL', mode: 'MANUAL', userId: 2, reason: null });
    await Promise.resolve();
    expect(setActuator).toHaveBeenCalledTimes(1);     // lenh tay cho lenh tu dong xong
    release();
    await Promise.all([auto, manual]);
    expect(cache.device(100)).toMatchObject({ mode: 'MANUAL', isOn: false, level: 0 });
  });
});

describe('ControlLoopService.requestResync', () => {
  it('cho bo nho dem nap xong; toi da 1 lan moi 5 giay; publish moi co cau chap hanh', async () => {
    jest.useFakeTimers();
    const { loop, cache, mqtt } = setup();
    Object.assign(cache as unknown as Record<string, unknown>, { loaded: false });
    loop.requestResync();
    await jest.advanceTimersByTimeAsync(1000);
    expect(mqtt.publishCommand).not.toHaveBeenCalled();
    Object.assign(cache as unknown as Record<string, unknown>, { loaded: true });
    await jest.advanceTimersByTimeAsync(1000);
    expect(mqtt.publishCommand).toHaveBeenCalledTimes(4);
    loop.requestResync();
    await jest.advanceTimersByTimeAsync(1000);
    expect(mqtt.publishCommand).toHaveBeenCalledTimes(4);
    await jest.advanceTimersByTimeAsync(5000);
    expect(mqtt.publishCommand).toHaveBeenCalledTimes(8);
    jest.useRealTimers();
  });
});
```

`backend/src/control/control.controller.spec.ts`:

```ts
import { ControlController } from './control.controller';

const U = { userId: 2, role: 'OWNER' as const, username: 'owner1', exp: 0 };

function setup(isOnInDb: boolean | null = true) {
  const loop = { executeManual: jest.fn(async (a) => ({ changed: true, deviceCode: 'H1-F1-FAN', mode: a.mode, isOn: a.isOn, level: a.level ?? 80 })), runZones: jest.fn(async () => undefined) };
  const db = { prisma: { devices: { findUnique: jest.fn(async () => ({ IsOn: isOnInDb, ZoneId: 10 })) }, controlLogs: { findMany: jest.fn(async () => []) } } };
  return { c: new ControlController(loop as never, db as never), loop, db };
}

describe('ControlController.control', () => {
  it('MANUAL thieu isOn -> 400 fields [isOn]', async () => {
    const { c } = setup();
    await expect(c.control(3, { mode: 'MANUAL' }, U)).rejects.toMatchObject({ status: 400, details: { fields: ['isOn'] } });
  });

  it('MANUAL: Source MANUAL, UserId tu JWT, mode mac dinh MANUAL; khong chay vong', async () => {
    const { c, loop } = setup();
    await c.control(3, { isOn: true, level: 80, reason: 'thu' }, U);
    expect(loop.executeManual).toHaveBeenCalledWith({ deviceId: 3, isOn: true, level: 80, source: 'MANUAL', mode: 'MANUAL', userId: 2, reason: 'thu' });
    expect(loop.runZones).not.toHaveBeenCalled();
  });

  it('AUTO khong isOn: dien IsOn hien tai, level giu (null), chay vong cho khu vuc', async () => {
    const { c, loop } = setup(true);
    const r = await c.control(3, { mode: 'AUTO' }, U);
    expect(loop.executeManual).toHaveBeenCalledWith(expect.objectContaining({ isOn: true, level: null, mode: 'AUTO', source: 'MANUAL' }));
    expect(loop.runZones).toHaveBeenCalledWith([10]);
    expect(r).toEqual({ changed: true, deviceCode: 'H1-F1-FAN', mode: 'AUTO', isOn: true, level: 80 });
  });
});
```

Run: `npx jest src/control-loop/control-loop src/control`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/common/paging.ts`**

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Phan trang theo con tro id (hop dong 3.1).
export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit: number = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) before?: number;
}

export function toPage<T>(rows: T[], limit: number, idOf: (r: T) => number, map: (r: T) => unknown) {
  const items = rows.slice(0, limit);
  return { items: items.map(map), nextBefore: rows.length > limit && items.length ? idOf(items[items.length - 1]) : null };
}
```

- [ ] **Step 3: Viết `backend/src/control-loop/control-loop.service.ts`**

```ts
import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { withTimeout } from '../common/async';
import { DbService } from '../db/db.service';
import { ActuatorResult, SetActuatorArgs, SpService } from '../db/sp';
import { sqlNumberOf } from '../db/sql-errors';
import { MqttService } from '../mqtt/mqtt.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CLOCK, ControlCache } from './cache.service';
import { decide } from './rules';

export const COMMAND_TIMEOUT_MS = 5000;
export const RESYNC_MIN_GAP_MS = 5000;

@Injectable()
export class ControlLoopService implements OnModuleInit {
  private readonly log = new Logger('Dieu khien');
  private chain: Promise<unknown> = Promise.resolve();
  private lastResync = 0;
  private resyncTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly cache: ControlCache,
    private readonly sp: SpService,
    private readonly mqtt: MqttService,
    private readonly rt: RealtimeService,
    private readonly db: DbService,
    @Optional() @Inject(CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  onModuleInit(): void {
    this.db.addLoader('bo nho dem', () => this.cache.load());
    this.mqtt.onConnect(() => this.requestResync());
  }

  // Mot hang doi tuan tu duy nhat: hai lan chay khong chong nhau (spec backend 4.4).
  runZones(zoneIds: number[]): Promise<void> {
    return this.enqueue(() => this.runOnce([...new Set(zoneIds)]));
  }

  // Dieu khien tay di qua cung hang doi: bo nho dem luon khop ket qua SP sau cung (Review Focus 5).
  executeManual(a: SetActuatorArgs): Promise<ActuatorResult> {
    return this.enqueue(() => this.execute(a));
  }

  requestResync(): void {
    if (this.resyncTimer) return;
    const wait = Math.max(0, this.lastResync + RESYNC_MIN_GAP_MS - this.clock().getTime());
    this.resyncTimer = setTimeout(() => {
      this.resyncTimer = null;
      if (!this.cache.isLoaded()) { setTimeout(() => this.requestResync(), 1000); return; }
      this.lastResync = this.clock().getTime();
      void this.resync();
    }, wait);
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async runOnce(zoneIds: number[]): Promise<void> {
    for (const zoneId of zoneIds) {
      const input = this.cache.zoneInput(zoneId, this.clock());
      if (!input) continue;
      const { commands, latches } = decide(input);
      this.cache.setLatches(zoneId, latches);
      for (const c of commands) {
        try {
          await this.execute({ deviceId: c.deviceId, isOn: c.isOn, level: c.level, source: 'AUTO', mode: null, userId: null, reason: c.reason });
        } catch (e) {
          if (sqlNumberOf(e) === 50003) {
            this.cache.removeDevice(c.deviceId);
            this.log.warn(`Thiet bi ${c.deviceId} khong dieu khien duoc (50003), bo khoi bo nho dem`);
          } else {
            this.log.error(`Lenh tu dong cho thiet bi ${c.deviceId} loi: ${(e as Error).message}`);
          }
        }
      }
    }
  }

  // Buoc thuc thi chung cho tay va tu dong (spec backend 4.4).
  private async execute(a: SetActuatorArgs): Promise<ActuatorResult> {
    const r = await withTimeout(this.sp.setActuator(a), COMMAND_TIMEOUT_MS, `sp_SetActuator ${a.deviceId}`);
    this.cache.applyDeviceState(a.deviceId, { mode: r.mode, isOn: r.isOn, level: r.level });
    if (r.changed) {
      try {
        await this.mqtt.publishCommand(r.deviceCode, { isOn: r.isOn, level: r.level, mode: r.mode });
      } catch (e) {
        this.log.error(`Publish lenh ${r.deviceCode} loi: ${(e as Error).message}; dong bo lai khi MQTT ket noi lai`);
      }
      const d = this.cache.device(a.deviceId);
      if (d) {
        this.rt.emitToHouse(d.houseId, 'device.state', {
          deviceId: a.deviceId, deviceCode: r.deviceCode, houseId: d.houseId, zoneId: d.zoneId,
          mode: r.mode, isOn: r.isOn, level: r.level, source: a.source, at: this.clock(),
        });
      }
    }
    return r;
  }

  private async resync(): Promise<void> {
    const list = this.cache.actuators();
    for (const d of list) {
      try {
        await this.mqtt.publishCommand(d.code, { isOn: d.isOn, level: d.level, mode: d.mode });
      } catch (e) {
        this.log.warn(`Dong bo lenh ${d.code} loi: ${(e as Error).message}`);
      }
    }
    this.log.log(`Da publish lai trang thai ${list.length} co cau chap hanh`);
  }
}
```

Thiết bị đang có trong `devices` nhưng chưa có trong bộ nhớ đệm (VD vừa tạo, phát `device.state` cần `houseId`): `execute` bỏ phát nếu `cache.device()` không có; Task 16 gọi `cache.reloadDevice` ngay sau khi tạo thiết bị nên trường hợp này chỉ xảy ra với cảm biến (không phải cơ cấu chấp hành, SP trả 50003 trước).

- [ ] **Step 4: Viết `backend/src/control-loop/control-loop.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { ControlCache } from './cache.service';
import { ControlLoopService } from './control-loop.service';

@Global()
@Module({ providers: [ControlCache, ControlLoopService], exports: [ControlCache, ControlLoopService] })
export class ControlLoopModule {}
```

- [ ] **Step 5: Viết DTO, controller, module điều khiển**

`backend/src/control/dto.ts`:

```ts
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ControlDto {
  @IsOptional() @IsBoolean() isOn?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) level?: number;
  @IsOptional() @IsIn(['AUTO', 'MANUAL']) mode?: 'AUTO' | 'MANUAL';
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
```

`backend/src/control/control.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiError } from '../common/errors';
import { AuthUser, CurrentUser } from '../common/decorators';
import { PageQuery, toPage } from '../common/paging';
import * as pick from '../common/pickers';
import { ControlLoopService } from '../control-loop/control-loop.service';
import { DbService } from '../db/db.service';
import { ControlDto } from './dto';

@Controller('devices/:deviceId')
export class ControlController {
  constructor(private readonly loop: ControlLoopService, private readonly db: DbService) {}

  @Post('control') @HttpCode(200)
  async control(@Param('deviceId', ParseIntPipe) deviceId: number, @Body() dto: ControlDto, @CurrentUser() u: AuthUser) {
    if (dto.mode !== 'AUTO' && dto.isOn === undefined) throw new ApiError(400, 'VALIDATION_ERROR', null, { fields: ['isOn'] });
    const current = await this.db.prisma.devices.findUnique({ where: { DeviceId: deviceId }, select: { IsOn: true, ZoneId: true } });
    // mode AUTO: isOn khong bat buoc, dien gia tri hien tai (hop dong 3.3); cam bien (IsOn NULL) -> SP bao 50003.
    const isOn = dto.isOn ?? current?.IsOn ?? false;
    const r = await this.loop.executeManual({ deviceId, isOn, level: dto.level ?? null, source: 'MANUAL', mode: dto.mode ?? 'MANUAL', userId: u.userId, reason: dto.reason ?? null });
    if (dto.mode === 'AUTO' && current) void this.loop.runZones([current.ZoneId]);
    return r;
  }

  @Get('control-logs')
  async logs(@Param('deviceId', ParseIntPipe) deviceId: number, @Query() q: PageQuery) {
    const rows = await this.db.prisma.controlLogs.findMany({
      where: { DeviceId: deviceId, ...(q.before ? { LogId: { lt: q.before } } : {}) },
      orderBy: { LogId: 'desc' }, take: q.limit + 1,
    });
    return toPage(rows, q.limit, (r) => r.LogId, pick.controlLog);
  }
}
```

`backend/src/control/control.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ControlController } from './control.controller';

@Module({ controllers: [ControlController] })
export class ControlModule {}
```

`app.module.ts`: thêm `ControlLoopModule`, `ControlModule` vào `FEATURE_MODULES` (sau `MqttModule`).

- [ ] **Step 6: Chạy test**

Run: `npx jest src/control-loop src/control; npm run build`
Expected: PASS; build không lỗi.

- [ ] **Step 7: Kiểm tay (cần SP thật hoặc SP giả)**

`npm run start`; đăng nhập `owner1` (mật khẩu dev ghi trong README database) bằng `curl.exe`, lấy `accessToken`; `curl.exe -s -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"isOn\":true,\"level\":80,\"mode\":\"MANUAL\"}" http://localhost:3000/api/devices/<id H1-F1-FAN>/control` → `{"changed":true,...}`; cửa sổ `mosquitto_sub -u simulator -P <mk> -t swiftlet/devices/H1-F1-FAN/command -v` thấy tin retained có `issuedAt`.

- [ ] **Step 8: Commit**

```powershell
git add backend/src/control-loop backend/src/control backend/src/common/paging.ts backend/src/app.module.ts
git commit -m "feat(backend): vòng điều khiển tuần tự, bước thực thi chung, đồng bộ lệnh retained, điều khiển tay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: Thu nhận số đo MQTT — kiểm từng phần tử, gom lô, thử lại có giới hạn, phát sự kiện, chạy vòng điều khiển

**Files:**
- Create: `backend/src/mqtt/ingest.ts`, `backend/src/mqtt/ingest.spec.ts`, `backend/src/mqtt/ingest.service.ts`, `backend/src/mqtt/ingest.service.spec.ts`
- Modify: `backend/src/mqtt/mqtt.module.ts` (thêm `IngestService`)

**Interfaces:**
- Consumes: `isUtcIso` (Task 4), `SpService.ingestReadings`, `ReadingItem`, `IngestResult` (Task 6), `sqlNumberOf`, `isConnectionError` (Task 4), `retryDelay` (Task 6), `ControlCache.applyReadings`, `CLOCK` (Task 12), `ControlLoopService.runZones` (Task 14), `RealtimeService.emitToHouse` (Task 9), `MqttService.onReadings` (Task 13), `pickers.alertFromSp`, `readingEvent` (Task 5).
- Produces:
  - `ingest.ts`: `type RejectReason = 'KHONG_PHAI_JSON' | 'KHONG_PHAI_MANG' | 'THIEU_TRUONG' | 'SAI_KIEU' | 'THOI_GIAN' | 'SAI_THIET_BI'`, `validateReadings(code: string, payload: Buffer): { items: ReadingItem[]; rejected: Array<{ reason: RejectReason; example: string }> }`, `BATCH_SIZE = 200`, `NO_RETRY = [50030, 50042, 547]`, `UNKNOWN_RETRY_MS = [1000, 2000, 5000]`.
  - `IngestService`: `receive(code: string, payload: Buffer): void`, `tick(): Promise<void>`, `queueLength(): number`, `flush(timeoutMs: number): Promise<number>` (trả số phần tử mất; Task 21 gọi khi tắt), `emitResolved(ids: number[]): Promise<void>` (Task 26 dùng lại).

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/mqtt/ingest.spec.ts`:

```ts
import { validateReadings } from './ingest';

const AT = '2026-10-12T10:40:07Z';
const el = (o: Record<string, unknown> = {}) => ({ device: 'H1-F1-SENSOR', metric: 'TEMP', value: 28.5, at: AT, ...o });
const run = (payload: unknown, raw?: string) => validateReadings('H1-F1-SENSOR', Buffer.from(raw ?? JSON.stringify(payload)));

describe('validateReadings (hop dong 2.3, spec backend 4.1)', () => {
  it('phan tu hop le vao items, giu thu tu', () => {
    const r = run([el(), el({ metric: 'HUMID', value: 82 })]);
    expect(r.items.map((i) => i.metric)).toEqual(['TEMP', 'HUMID']);
    expect(r.rejected).toEqual([]);
  });

  it.each([
    ['thieu Z', el({ at: '2026-10-12T10:40:07' }), 'THOI_GIAN'],
    ['+07:00', el({ at: '2026-10-12T17:40:07+07:00' }), 'THOI_GIAN'],
    ['device khac topic', el({ device: 'H1-F2-SENSOR' }), 'SAI_THIET_BI'],
    ['thieu metric', { device: 'H1-F1-SENSOR', value: 1, at: AT }, 'THIEU_TRUONG'],
    ['value chuoi so (Review Focus 1)', el({ value: '28.5' }), 'SAI_KIEU'],
    ['value null', el({ value: null }), 'SAI_KIEU'],
    ['metric khong phai chuoi', el({ metric: 5 }), 'SAI_KIEU'],
    ['phan tu khong phai object', 42, 'SAI_KIEU'],
  ])('%s -> bo phan tu, ly do %s; phan tu dung van nhan', (_l, bad, reason) => {
    const r = run([el(), bad]);
    expect(r.items).toHaveLength(1);
    expect(r.rejected.map((x) => x.reason)).toEqual([reason]);
    expect(r.rejected[0].example.length).toBeLessThanOrEqual(200);
  });

  it('so vo han (1e999) -> SAI_KIEU', () => {
    expect(run(null, `[{"device":"H1-F1-SENSOR","metric":"TEMP","value":1e999,"at":"${AT}"}]`).rejected[0].reason).toBe('SAI_KIEU');
  });

  it('khong phai JSON / khong phai mang -> bo ca tin', () => {
    expect(run(null, '{hong').rejected).toEqual([{ reason: 'KHONG_PHAI_JSON', example: '{hong' }]);
    expect(run(el()).items).toEqual([]);
    expect(run(el()).rejected[0].reason).toBe('KHONG_PHAI_MANG');
  });
});
```

`backend/src/mqtt/ingest.service.spec.ts`:

```ts
import { IngestService } from './ingest.service';

const NOW = new Date(Date.UTC(2026, 9, 12, 10, 40, 7));
const AT = NOW.toISOString();
const payload = (n: number, start = 0) => Buffer.from(JSON.stringify(
  Array.from({ length: n }, (_, i) => ({ device: 'H1-F1-SENSOR', metric: 'TEMP', value: start + i, at: AT }))));
const ok = (o: Record<string, unknown> = {}) => ({ received: 1, accepted: 1, duplicates: 0, rejected: 0, newAlerts: [], resolvedAlertIds: [],
  acceptedRows: [{ DeviceId: 5, DeviceCode: 'H1-F1-SENSOR', HouseId: 1, ZoneId: 10, MetricCode: 'TEMP', Value: 31.2, RecordedAt: AT },
    { DeviceId: 9, DeviceCode: 'H2-F1-SENSOR', HouseId: 2, ZoneId: 20, MetricCode: 'TEMP', Value: 28, RecordedAt: AT }], ...o });

function setup(ingest: jest.Mock, opts: { ready?: boolean; max?: number } = {}) {
  let now = NOW.getTime();
  const deps = {
    cfg: { ingestRetryMaxItems: opts.max ?? 10000 },
    db: { isReady: () => opts.ready ?? true, reportFailure: jest.fn(), prisma: { alerts: { findMany: jest.fn(async () => [{ AlertId: 9, HouseId: 1, Status: 'RESOLVED', ResolvedAt: NOW, ResolvedBy: null }]) } } },
    sp: { ingestReadings: ingest },
    cache: { applyReadings: jest.fn() },
    loop: { runZones: jest.fn(async () => undefined) },
    rt: { emitToHouse: jest.fn() },
    mqtt: { onReadings: jest.fn() },
  };
  const svc = new IngestService(deps.cfg as never, deps.db as never, deps.sp as never, deps.cache as never, deps.loop as never, deps.rt as never, deps.mqtt as never, () => new Date(now));
  return { svc, ...deps, advance: (ms: number) => { now += ms; } };
}

describe('IngestService', () => {
  it('lo toi da 200 phan tu, hang cho dai thi goi nhieu lan lien tiep, giu thu tu', async () => {
    const ingest = jest.fn(async () => ok());
    const { svc } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(450));
    await svc.tick();
    expect(ingest.mock.calls.map((c) => c[0].length)).toEqual([200, 200, 50]);
    expect(ingest.mock.calls[1][0][0].value).toBe(200);
  });

  it('thanh cong: bo nho dem, readings.new moi nha, alert.created, alert.updated, chay vong cho khu vuc', async () => {
    const alert = { AlertId: 7, HouseId: 1, ZoneId: 10, DeviceId: null, AlertType: 'THRESHOLD', Severity: 'WARNING', MetricCode: 'TEMP', Value: 31.2, DetectedClass: null, Confidence: null, HasSnapshot: false, Message: 'm', Status: 'NEW', CreatedAt: AT };
    const { svc, cache, rt, loop } = setup(jest.fn(async () => ok({ newAlerts: [alert], resolvedAlertIds: [9] })));
    svc.receive('H1-F1-SENSOR', payload(1));
    await svc.tick();
    expect(cache.applyReadings).toHaveBeenCalled();
    const events = rt.emitToHouse.mock.calls.map((c) => [c[0], c[1]]);
    expect(events).toEqual([[1, 'readings.new'], [2, 'readings.new'], [1, 'alert.created'], [1, 'alert.updated']]);
    expect(rt.emitToHouse.mock.calls[0][2]).toEqual({ houseId: 1, readings: [{ deviceId: 5, deviceCode: 'H1-F1-SENSOR', zoneId: 10, metric: 'TEMP', value: 31.2, at: AT }] });
    expect(rt.emitToHouse.mock.calls[3][2]).toEqual({ alertId: 9, houseId: 1, status: 'RESOLVED', resolvedAt: NOW, resolvedBy: null });
    expect(loop.runZones).toHaveBeenCalledWith([10, 20]);
  });

  it('loi phat Socket.IO khong chan vong dieu khien', async () => {
    const { svc, rt, loop } = setup(jest.fn(async () => ok()));
    rt.emitToHouse.mockImplementation(() => { throw new Error('hong'); });
    svc.receive('H1-F1-SENSOR', payload(1));
    await svc.tick();
    expect(loop.runZones).toHaveBeenCalled();
  });

  it('mat ket noi: giu lo o dau hang cho, thu lai theo lich, so do moi noi vao cuoi, bao DbHealth', async () => {
    const ingest = jest.fn().mockRejectedValueOnce({ code: 'P1001' }).mockResolvedValue(ok());
    const { svc, db, advance } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(2, 0));
    await svc.tick();
    svc.receive('H1-F1-SENSOR', payload(1, 100));
    await svc.tick();                      // chua toi 1 giay -> khong goi
    expect(ingest).toHaveBeenCalledTimes(1);
    advance(1000);
    await svc.tick();
    expect(ingest.mock.calls[1][0].map((x: { value: number }) => x.value)).toEqual([0, 1, 100]);
    expect(db.reportFailure).toHaveBeenCalled();
  });

  it('vuot INGEST_RETRY_MAX_ITEMS -> bo phan cu nhat', async () => {
    const { svc } = setup(jest.fn().mockRejectedValue({ code: 'P1001' }), { max: 5 });
    svc.receive('H1-F1-SENSOR', payload(4, 0));
    await svc.tick();
    svc.receive('H1-F1-SENSOR', payload(3, 10));
    expect(svc.queueLength()).toBe(5);
  });

  it.each([50030, 50042, 547])('%i -> bo lo, khong thu lai', async (n) => {
    const ingest = jest.fn().mockRejectedValueOnce({ number: n }).mockResolvedValue(ok());
    const { svc } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(2));
    await svc.tick();
    expect(svc.queueLength()).toBe(0);
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it('loi chua biet -> thu lai 3 lan theo 1, 2, 5 giay roi bo', async () => {
    const ingest = jest.fn().mockRejectedValue(new Error('la'));
    const { svc, advance } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(2));
    await svc.tick();
    for (const ms of [1000, 2000, 5000]) { advance(ms); await svc.tick(); }
    expect(ingest).toHaveBeenCalledTimes(4);
    expect(svc.queueLength()).toBe(0);
  });

  it('khong bao gio hai lan goi SP song song; CSDL chua san sang thi khong goi', async () => {
    let release!: () => void;
    const ingest = jest.fn(() => new Promise((r) => { release = () => r(ok()); }));
    const { svc } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(1));
    const t1 = svc.tick();
    await svc.tick();
    expect(ingest).toHaveBeenCalledTimes(1);
    release();
    await t1;
    const notReady = setup(jest.fn(), { ready: false });
    notReady.svc.receive('H1-F1-SENSOR', payload(1));
    await notReady.svc.tick();
    expect(notReady.sp.ingestReadings).not.toHaveBeenCalled();
  });
});
```

Run: `npx jest src/mqtt`
Expected: FAIL (`ingest.ts`, `ingest.service.ts` chưa có).

- [ ] **Step 2: Viết `backend/src/mqtt/ingest.ts`**

```ts
import { isUtcIso } from '../common/validation';
import { ReadingItem } from '../db/sp';

export type RejectReason = 'KHONG_PHAI_JSON' | 'KHONG_PHAI_MANG' | 'THIEU_TRUONG' | 'SAI_KIEU' | 'THOI_GIAN' | 'SAI_THIET_BI';
export const BATCH_SIZE = 200;
export const NO_RETRY = [50030, 50042, 547];
export const UNKNOWN_RETRY_MS = [1000, 2000, 5000];

const example = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v) ?? String(v)).slice(0, 200);

function reasonOf(code: string, e: unknown): RejectReason | null {
  if (e === null || typeof e !== 'object' || Array.isArray(e)) return 'SAI_KIEU';
  const o = e as Record<string, unknown>;
  if (!['device', 'metric', 'value', 'at'].every((k) => k in o)) return 'THIEU_TRUONG';
  if (typeof o.device !== 'string' || typeof o.metric !== 'string' || !o.metric || typeof o.value !== 'number' || !Number.isFinite(o.value) || typeof o.at !== 'string') return 'SAI_KIEU';
  if (!isUtcIso(o.at)) return 'THOI_GIAN';
  if (o.device !== code) return 'SAI_THIET_BI';
  return null;
}

// Kiem tung phan tu; phan tu sai bi bo, phan tu dung van vao hang cho (hop dong 2.3).
export function validateReadings(code: string, payload: Buffer) {
  const text = payload.toString('utf8');
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { items: [], rejected: [{ reason: 'KHONG_PHAI_JSON' as RejectReason, example: example(text) }] }; }
  if (!Array.isArray(data)) return { items: [], rejected: [{ reason: 'KHONG_PHAI_MANG' as RejectReason, example: example(data) }] };
  const items: ReadingItem[] = [];
  const rejected: Array<{ reason: RejectReason; example: string }> = [];
  for (const e of data) {
    const reason = reasonOf(code, e);
    if (reason) { rejected.push({ reason, example: example(e) }); continue; }
    const o = e as ReadingItem;
    items.push({ device: o.device, metric: o.metric, value: o.value, at: o.at });
  }
  return { items, rejected };
}
```

- [ ] **Step 3: Viết `backend/src/mqtt/ingest.service.ts`**

```ts
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/config';
import { retryDelay } from '../common/async';
import * as pick from '../common/pickers';
import { CLOCK, ControlCache } from '../control-loop/cache.service';
import { ControlLoopService } from '../control-loop/control-loop.service';
import { DbService } from '../db/db.service';
import { IngestResult, ReadingItem, SpService } from '../db/sp';
import { isConnectionError, sqlNumberOf } from '../db/sql-errors';
import { RealtimeService } from '../realtime/realtime.service';
import { BATCH_SIZE, NO_RETRY, RejectReason, UNKNOWN_RETRY_MS, validateReadings } from './ingest';
import { MqttService } from './mqtt.service';

@Injectable()
export class IngestService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Thu nhan');
  private queue: ReadingItem[] = [];
  private busy = false;
  private nextAt = 0;
  private retryAttempt = 0;
  private unknownFailures = 0;
  private failing = false;
  private timer: NodeJS.Timeout | null = null;
  private rejects = new Map<RejectReason, { count: number; example: string }>();

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly db: DbService,
    private readonly sp: SpService,
    private readonly cache: ControlCache,
    private readonly loop: ControlLoopService,
    private readonly rt: RealtimeService,
    private readonly mqtt: MqttService,
    @Optional() @Inject(CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  onModuleInit(): void {
    this.mqtt.onReadings((code, payload) => this.receive(code, payload));
    this.timer = setInterval(() => void this.tick(), 1000); // gom lo moi 1 giay (hop dong 2.3)
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }
  queueLength(): number { return this.queue.length; }

  receive(code: string, payload: Buffer): void {
    const { items, rejected } = validateReadings(code, payload);
    for (const r of rejected) {
      const cur = this.rejects.get(r.reason);
      this.rejects.set(r.reason, { count: (cur?.count ?? 0) + 1, example: cur?.example ?? r.example });
    }
    this.queue.push(...items);
    const excess = this.queue.length - this.cfg.ingestRetryMaxItems;
    if (excess > 0) {
      this.queue.splice(0, excess);
      this.log.warn(`Hang cho vuot INGEST_RETRY_MAX_ITEMS: bo ${excess} so do cu nhat`);
    }
    if (this.queue.length >= BATCH_SIZE) void this.tick();
  }

  async tick(): Promise<void> {
    this.flushRejectLog();
    if (this.busy || !this.db.isReady() || this.clock().getTime() < this.nextAt) return;
    this.busy = true;
    try {
      while (this.queue.length) {
        const batch = this.queue.slice(0, BATCH_SIZE);
        let res: IngestResult;
        try {
          res = await this.sp.ingestReadings(batch);
        } catch (e) {
          this.onFailure(e, batch.length);
          return;
        }
        this.queue.splice(0, batch.length);
        if (this.failing) this.log.log('Ghi so do da hoi phuc');
        this.failing = false; this.retryAttempt = 0; this.unknownFailures = 0; this.nextAt = 0;
        await this.afterSuccess(res);
      }
    } finally {
      this.busy = false;
    }
  }

  async flush(timeoutMs: number): Promise<number> {
    if (!this.db.isReady()) return this.queue.length; // CSDL dang loi: khong cho (spec backend 3.6)
    const end = Date.now() + timeoutMs;
    this.nextAt = 0;
    while (this.queue.length && Date.now() < end) {
      await this.tick();
      if (this.queue.length && this.failing) break;
    }
    return this.queue.length;
  }

  async emitResolved(ids: number[]): Promise<void> {
    if (!ids.length) return;
    // SP chi tra AlertId -> doc dong canh bao lay houseId, status, resolvedAt, resolvedBy (spec backend 4.2).
    const rows = await this.db.prisma.alerts.findMany({ where: { AlertId: { in: ids } }, select: { AlertId: true, HouseId: true, Status: true, ResolvedAt: true, ResolvedBy: true } });
    for (const a of rows) this.rt.emitToHouse(a.HouseId, 'alert.updated', { alertId: a.AlertId, houseId: a.HouseId, status: a.Status, resolvedAt: a.ResolvedAt, resolvedBy: a.ResolvedBy });
  }

  private onFailure(e: unknown, size: number): void {
    const n = sqlNumberOf(e);
    const now = this.clock().getTime();
    if (isConnectionError(e) || n === 1205 || (e as Error)?.message?.startsWith('timeout')) {
      if (!this.failing) this.log.warn('Ghi so do loi (mat ket noi/het thoi gian/1205), giu lo va thu lai');
      this.failing = true;
      this.nextAt = now + retryDelay(this.retryAttempt++);
      this.db.reportFailure(e);
      return;
    }
    if (n !== null && NO_RETRY.includes(n)) {
      this.dropHead(size, `loi ${n}, khong thu lai`);
      return;
    }
    this.unknownFailures += 1;
    if (this.unknownFailures > UNKNOWN_RETRY_MS.length) {
      this.dropHead(size, `loi chua biet sau ${UNKNOWN_RETRY_MS.length} lan thu lai: ${(e as Error)?.message ?? n}`);
      this.unknownFailures = 0;
      return;
    }
    this.nextAt = now + UNKNOWN_RETRY_MS[this.unknownFailures - 1];
  }

  private dropHead(size: number, why: string): void {
    const first = this.queue[0];
    this.queue.splice(0, size);
    this.nextAt = 0;
    this.log.error(`Bo lo ${size} so do (${why}); phan tu dau: ${JSON.stringify(first)}`);
  }

  // Moi buoc tu bat loi: loi buoc nay khong lam bo qua buoc sau (spec backend 4.2).
  private async afterSuccess(res: IngestResult): Promise<void> {
    const step = async (name: string, fn: () => unknown) => {
      try { await fn(); } catch (e) { this.log.error(`Sau ghi so do, buoc ${name} loi: ${(e as Error).message}`); }
    };
    await step('bo nho dem', () => this.cache.applyReadings(res.acceptedRows));
    await step('readings.new', () => {
      const byHouse = new Map<number, unknown[]>();
      for (const r of res.acceptedRows) byHouse.set(r.HouseId, [...(byHouse.get(r.HouseId) ?? []), pick.readingEvent(r as never)]);
      for (const [houseId, readings] of byHouse) this.rt.emitToHouse(houseId, 'readings.new', { houseId, readings });
    });
    await step('alert.created', () => {
      for (const a of res.newAlerts) this.rt.emitToHouse(Number(a.HouseId), 'alert.created', { alert: pick.alertFromSp(a) });
    });
    await step('alert.updated', () => this.emitResolved(res.resolvedAlertIds));
    await step('vong dieu khien', () => { void this.loop.runZones([...new Set(res.acceptedRows.map((r) => r.ZoneId))]); });
    if (res.rejected > 0 || res.duplicates > 0) this.log.warn(`Lo so do: ${res.rejected} bi SP loai, ${res.duplicates} trung`);
  }

  // Mot dong log gop moi nhip (spec backend 4.1).
  private flushRejectLog(): void {
    if (!this.rejects.size) return;
    const parts = [...this.rejects].map(([r, v]) => `${r} x${v.count} (vd ${v.example})`);
    this.log.warn(`Bo phan tu so do: ${parts.join('; ')}`);
    this.rejects.clear();
  }
}
```

Trong `mqtt.module.ts`: thêm `IngestService` vào `providers` và `exports`.

- [ ] **Step 4: Chạy test**

Run: `npx jest src/mqtt; npm run build`
Expected: PASS.

- [ ] **Step 5: Kiểm tay đầu-cuối nhỏ (Mosquitto + CSDL Dev, SP thật hoặc giả)**

`npm run start`; cửa sổ khác:

```powershell
mosquitto_pub -i manual-test -u simulator -P <mk simulator> -t swiftlet/devices/H1-F1-SENSOR/readings -q 1 -m "[{\"device\":\"H1-F1-SENSOR\",\"metric\":\"TEMP\",\"value\":28.4,\"at\":\"$((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))\"}]"
```

Expected (SP thật): `sqlcmd … -Q "SELECT TOP 1 Value, RecordedAt FROM dbo.SensorReadings ORDER BY RecordedAt DESC"` thấy 28.40. Gửi thêm một tin thiếu `Z` → log một dòng `Bo phan tu so do: THOI_GIAN x1 (vd …)`.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/mqtt
git commit -m "feat(backend): thu nhận số đo MQTT, gom lô 1 giây/200 phần tử, thử lại có giới hạn, phát sự kiện

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 16: Nhà, khu vực, thiết bị, ngưỡng, chỉ số — chống gán trường lạ, làm mới bộ nhớ đệm

**Files:**
- Create: `backend/src/houses/dto.ts`, `backend/src/houses/dto.spec.ts`, `backend/src/houses/houses.service.ts`, `backend/src/houses/houses.service.spec.ts`, `backend/src/houses/houses.controller.ts`, `backend/src/houses/houses.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `HousesModule`)

**Interfaces:**
- Consumes: `DbService` (Task 6), `ControlCache` (Task 12), `ControlLoopService.runZones` (Task 14), `RealtimeService` (Task 9), `pickers` (Task 5), kết quả S7 (Task 1), `validateDto` (Task 4).
- Produces: `HousesService` với `listHouses(u)`, `createHouse(u, dto)`, `getHouse(id)`, `updateHouse(id, dto)`, `listZones(houseId)`, `createZone(houseId, dto)`, `updateZone(zoneId, dto)`, `listDevices(houseId)`, `createDevice(zoneId, dto)`, `updateDevice(deviceId, dto)`, `metrics()`, `thresholds(zoneId)`, `putThreshold(u, zoneId, metricCode, dto)`; hằng `INITIAL_STATE` (spec backend 5.3); các route trong bảng hợp đồng 3.3 nhóm Nhà, Khu vực, Thiết bị, Chỉ số, Ngưỡng.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/houses/dto.spec.ts`:

```ts
import { validateDto } from '../common/validation';
import { CreateDeviceDto, CreateHouseDto, UpdateHouseDto } from './dto';

describe('DTO nha/thiet bi (spec backend 5.3)', () => {
  it('code thiet bi khop ^[A-Z0-9-]{3,50}$', async () => {
    await expect(validateDto(CreateDeviceDto, { code: 'H1-F9-FAN', name: 'Quat', deviceType: 'FAN' })).resolves.toBeDefined();
    for (const code of ['h1-f9-fan', 'H1 F9', 'AB', 'H1/F9', 'H1-F9-FAN#']) {
      await expect(validateDto(CreateDeviceDto, { code, name: 'x', deviceType: 'FAN' })).rejects.toMatchObject({ details: { fields: ['code'] } });
    }
  });
  it('PATCH nha khong nhan ownerId; deviceType la -> 400', async () => {
    await expect(validateDto(UpdateHouseDto, { ownerId: 3 })).rejects.toMatchObject({ details: { fields: ['ownerId'] } });
    await expect(validateDto(CreateDeviceDto, { code: 'H1-F9-X', name: 'x', deviceType: 'LAMP' })).rejects.toMatchObject({ details: { fields: ['deviceType'] } });
    await expect(validateDto(CreateHouseDto, { name: 'Nha moi', ownerId: 2 })).resolves.toBeDefined();
  });
});
```

`backend/src/houses/houses.service.spec.ts`:

```ts
import { HousesService } from './houses.service';

const OWNER = { userId: 2, role: 'OWNER' as const, username: 'owner1', exp: 0 };
const ADMIN = { userId: 1, role: 'ADMIN' as const, username: 'admin', exp: 0 };
const NOW = new Date(Date.UTC(2026, 9, 12));

function setup() {
  const prisma = {
    houses: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }) => ({ HouseId: 5, IsActive: true, CreatedAt: NOW, Address: null, ...data })),
      findUniqueOrThrow: jest.fn(async () => ({ HouseId: 5, OwnerId: 2, Name: 'N', Address: null, IsActive: true, CreatedAt: NOW })),
      update: jest.fn(async ({ data }) => ({ HouseId: 5, OwnerId: 2, Name: 'N', Address: null, IsActive: true, CreatedAt: NOW, ...data })),
    },
    zones: { create: jest.fn(async ({ data }) => ({ ZoneId: 30, ...data })) },
    devices: { findUniqueOrThrow: jest.fn(async () => ({ DeviceId: 40, ZoneId: 30, Code: 'H1-F9-FAN', Name: 'Q', DeviceType: 'FAN', Status: 'OFFLINE', LastSeenAt: null, Mode: 'AUTO', IsOn: false, Level: 0, IsActive: true })) },
    thresholds: { upsert: jest.fn(async ({ create }) => ({ ...create, UpdatedAt: NOW })) },
    $queryRawUnsafe: jest.fn(async () => [{ DeviceId: 40 }]),
    $executeRawUnsafe: jest.fn(async () => 1),
  };
  const cache = { load: jest.fn(async () => undefined), addZone: jest.fn(), reloadDevice: jest.fn(async () => undefined), removeDevice: jest.fn(), reloadThresholds: jest.fn(async () => undefined) };
  const loop = { runZones: jest.fn(async () => undefined) };
  const rt = { houseActivated: jest.fn(), houseDeactivated: jest.fn() };
  return { svc: new HousesService({ prisma } as never, cache as never, loop as never, rt as never), prisma, cache, loop, rt };
}

describe('HousesService', () => {
  it('OWNER gui ownerId -> 400; ADMIN khong gui ownerId -> 400; OWNER tao nha -> ownerId tu JWT, vao phong', async () => {
    const { svc, prisma, rt } = setup();
    await expect(svc.createHouse(OWNER, { name: 'N', ownerId: 3 })).rejects.toMatchObject({ status: 400, details: { fields: ['ownerId'] } });
    await expect(svc.createHouse(ADMIN, { name: 'N' })).rejects.toMatchObject({ status: 400, details: { fields: ['ownerId'] } });
    await svc.createHouse(OWNER, { name: 'N' });
    expect(prisma.houses.create.mock.calls[0][0].data).toEqual({ Name: 'N', Address: null, OwnerId: 2 });
    expect(rt.houseActivated).toHaveBeenCalledWith(5, 2);
  });

  it('ngung dung nha -> roi phong, nap lai bo nho dem; dung lai -> vao phong', async () => {
    const { svc, rt, cache, prisma } = setup();
    prisma.houses.update.mockResolvedValueOnce({ HouseId: 5, OwnerId: 2, Name: 'N', Address: null, IsActive: false, CreatedAt: NOW });
    await svc.updateHouse(5, { isActive: false });
    expect(rt.houseDeactivated).toHaveBeenCalledWith(5);
    expect(cache.load).toHaveBeenCalled();
    await svc.updateHouse(5, { isActive: true });
    expect(rt.houseActivated).toHaveBeenCalledWith(5, 2);
  });

  it('tao khu vuc -> them vao bo nho dem', async () => {
    const { svc, cache } = setup();
    await svc.createZone(5, { name: 'F9', floorNo: 9 });
    expect(cache.addZone).toHaveBeenCalledWith(30, 5);
  });

  it.each([
    ['FAN', 'AUTO', false, 0], ['MIST', 'AUTO', false, null], ['SPEAKER', 'AUTO', false, null], ['SENSOR', null, null, null], ['CAMERA', null, null, null],
  ])('tao thiet bi %s: trang thai dau Mode=%s IsOn=%s Level=%s, qua $queryRaw, nap vao bo nho dem', async (type, mode, isOn, level) => {
    const { svc, prisma, cache } = setup();
    await svc.createDevice(30, { code: 'H1-F9-X', name: 'x', deviceType: type as never });
    const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls[0] as [string, ...unknown[]];
    expect(sql).toMatch(/INSERT INTO dbo\.Devices/);
    expect(sql).toMatch(/OUTPUT INSERTED\.DeviceId INTO @t/);
    expect(params).toEqual([30, 'H1-F9-X', 'x', type, mode, isOn, level]);
    expect(cache.reloadDevice).toHaveBeenCalledWith(40);
  });

  it('ngung dung thiet bi: UPDATE qua $executeRaw (khong OUTPUT), bo khoi bo nho dem', async () => {
    const { svc, prisma, cache } = setup();
    await svc.updateDevice(40, { isActive: false });
    const [sql, ...params] = prisma.$executeRawUnsafe.mock.calls[0] as [string, ...unknown[]];
    expect(sql).toMatch(/^UPDATE dbo\.Devices SET/);
    expect(sql).not.toMatch(/OUTPUT/);
    expect(params).toEqual([null, false, 40]);
    expect(cache.removeDevice).toHaveBeenCalledWith(40);
  });

  it('PUT nguong: upsert UpdatedBy tu JWT, lam moi nguong roi chay vong cho khu vuc', async () => {
    const { svc, prisma, cache, loop } = setup();
    const r = await svc.putThreshold(OWNER, 10, 'TEMP', { minValue: 25, maxValue: 31, targetValue: 28 });
    expect(prisma.thresholds.upsert.mock.calls[0][0].update).toMatchObject({ MinValue: 25, MaxValue: 31, TargetValue: 28, UpdatedBy: 2 });
    expect(cache.reloadThresholds).toHaveBeenCalledWith(10);
    expect(loop.runZones).toHaveBeenCalledWith([10]);
    expect(r).toMatchObject({ zoneId: 10, metricCode: 'TEMP', updatedBy: 2 });
  });
});
```

Run: `npx jest src/houses`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/houses/dto.ts`**

```ts
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export const DEVICE_TYPES = ['SENSOR', 'MIST', 'FAN', 'HEATER', 'SPEAKER', 'CAMERA'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export class CreateHouseDto {
  @IsString() @Length(1, 100) name!: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string | null;
  @IsOptional() @IsInt() @Min(1) ownerId?: number;
}
export class UpdateHouseDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class CreateZoneDto {
  @IsString() @Length(1, 50) name!: string;
  @IsInt() @Min(0) @Max(255) floorNo!: number;
}
export class UpdateZoneDto {
  @IsOptional() @IsString() @Length(1, 50) name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(255) floorNo?: number;
}
export class CreateDeviceDto {
  // Code noi vao topic MQTT va la client id: khop bieu thuc topic ([A-Z0-9-]+) cua test hop dong.
  @Matches(/^[A-Z0-9-]{3,50}$/) code!: string;
  @IsString() @Length(1, 100) name!: string;
  @IsIn(DEVICE_TYPES) deviceType!: DeviceType;
}
export class UpdateDeviceDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class ThresholdDto {
  @IsOptional() @IsNumber() minValue?: number | null;
  @IsOptional() @IsNumber() maxValue?: number | null;
  @IsOptional() @IsNumber() targetValue?: number | null;
}
```

- [ ] **Step 3: Viết `backend/src/houses/houses.service.ts`**

INSERT `Devices` theo **kết quả S7**: mặc định dùng batch `OUTPUT … INTO @t` dưới đây; nếu S7 cho thấy `$queryRaw` không trả dòng từ batch nhiều câu lệnh và R1 cho phép `OUTPUT` không `INTO`, thay phần thân `createDevice` bằng `this.db.prisma.devices.create({ data: {...} })` và sửa ca test tương ứng.

```ts
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/errors';
import { AuthUser } from '../common/decorators';
import * as pick from '../common/pickers';
import { ControlCache } from '../control-loop/cache.service';
import { ControlLoopService } from '../control-loop/control-loop.service';
import { DbService } from '../db/db.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateDeviceDto, CreateHouseDto, CreateZoneDto, DeviceType, ThresholdDto, UpdateDeviceDto, UpdateHouseDto, UpdateZoneDto } from './dto';

// Trang thai dau khi INSERT (thoa CK_Devices_ActuatorState, spec backend 5.3).
export const INITIAL_STATE: Record<DeviceType, { mode: string | null; isOn: boolean | null; level: number | null }> = {
  FAN: { mode: 'AUTO', isOn: false, level: 0 },
  MIST: { mode: 'AUTO', isOn: false, level: null },
  HEATER: { mode: 'AUTO', isOn: false, level: null },
  SPEAKER: { mode: 'AUTO', isOn: false, level: null },
  SENSOR: { mode: null, isOn: null, level: null },
  CAMERA: { mode: null, isOn: null, level: null },
};

const badField = (f: string) => new ApiError(400, 'VALIDATION_ERROR', null, { fields: [f] });

@Injectable()
export class HousesService {
  constructor(private readonly db: DbService, private readonly cache: ControlCache, private readonly loop: ControlLoopService, private readonly rt: RealtimeService) {}

  async listHouses(u: AuthUser) {
    const rows = await this.db.prisma.houses.findMany({ where: u.role === 'ADMIN' ? {} : { OwnerId: u.userId }, orderBy: { HouseId: 'asc' } });
    return rows.map(pick.house);
  }

  async createHouse(u: AuthUser, dto: CreateHouseDto) {
    // ownerId chi ADMIN duoc chi dinh; OWNER thi lay tu JWT (spec backend 5.3).
    if (u.role === 'OWNER' && dto.ownerId !== undefined) throw badField('ownerId');
    if (u.role === 'ADMIN' && dto.ownerId === undefined) throw badField('ownerId');
    const ownerId = u.role === 'ADMIN' ? (dto.ownerId as number) : u.userId;
    const h = await this.db.prisma.houses.create({ data: { Name: dto.name, Address: dto.address ?? null, OwnerId: ownerId } });
    this.rt.houseActivated(h.HouseId, h.OwnerId);
    return pick.house(h);
  }

  async getHouse(id: number) {
    return pick.house(await this.db.prisma.houses.findUniqueOrThrow({ where: { HouseId: id } }));
  }

  async updateHouse(id: number, dto: UpdateHouseDto) {
    const h = await this.db.prisma.houses.update({ where: { HouseId: id }, data: { Name: dto.name, Address: dto.address, IsActive: dto.isActive } });
    if (dto.isActive === false) this.rt.houseDeactivated(id);
    if (dto.isActive === true) this.rt.houseActivated(id, h.OwnerId);
    if (dto.isActive !== undefined) await this.cache.load(); // bo/nap lai toan bo khu vuc, thiet bi cua nha
    return pick.house(h);
  }

  async listZones(houseId: number) {
    return (await this.db.prisma.zones.findMany({ where: { HouseId: houseId }, orderBy: { ZoneId: 'asc' } })).map(pick.zone);
  }

  async createZone(houseId: number, dto: CreateZoneDto) {
    const z = await this.db.prisma.zones.create({ data: { HouseId: houseId, Name: dto.name, FloorNo: dto.floorNo } });
    this.cache.addZone(z.ZoneId, houseId);
    return pick.zone(z);
  }

  async updateZone(zoneId: number, dto: UpdateZoneDto) {
    return pick.zone(await this.db.prisma.zones.update({ where: { ZoneId: zoneId }, data: { Name: dto.name, FloorNo: dto.floorNo } }));
  }

  async listDevices(houseId: number) {
    return (await this.db.prisma.devices.findMany({ where: { Zone: { HouseId: houseId } }, orderBy: { DeviceId: 'asc' } })).map(pick.device);
  }

  // Devices co trigger -> khong dung prisma.devices.create/update (R1, hop dong 3.2).
  async createDevice(zoneId: number, dto: CreateDeviceDto) {
    const s = INITIAL_STATE[dto.deviceType];
    const [row] = await this.db.prisma.$queryRawUnsafe<Array<{ DeviceId: number }>>(
      `DECLARE @t TABLE (DeviceId INT);
       INSERT INTO dbo.Devices (ZoneId, Code, Name, DeviceType, Mode, IsOn, Level)
       OUTPUT INSERTED.DeviceId INTO @t
       VALUES (@P1, @P2, @P3, @P4, @P5, @P6, @P7);
       SELECT DeviceId FROM @t;`,
      zoneId, dto.code, dto.name, dto.deviceType, s.mode, s.isOn, s.level);
    await this.cache.reloadDevice(row.DeviceId);
    return pick.device(await this.db.prisma.devices.findUniqueOrThrow({ where: { DeviceId: row.DeviceId } }));
  }

  async updateDevice(deviceId: number, dto: UpdateDeviceDto) {
    await this.db.prisma.$executeRawUnsafe(
      'UPDATE dbo.Devices SET Name = COALESCE(@P1, Name), IsActive = COALESCE(@P2, IsActive) WHERE DeviceId = @P3',
      dto.name ?? null, dto.isActive ?? null, deviceId);
    if (dto.isActive === false) this.cache.removeDevice(deviceId);
    if (dto.isActive === true) await this.cache.reloadDevice(deviceId);
    return pick.device(await this.db.prisma.devices.findUniqueOrThrow({ where: { DeviceId: deviceId } }));
  }

  async metrics() {
    return (await this.db.prisma.metrics.findMany({ orderBy: { MetricCode: 'asc' } })).map(pick.metric);
  }

  async thresholds(zoneId: number) {
    return (await this.db.prisma.thresholds.findMany({ where: { ZoneId: zoneId }, orderBy: { MetricCode: 'asc' } })).map(pick.threshold);
  }

  async putThreshold(u: AuthUser, zoneId: number, metricCode: string, dto: ThresholdDto) {
    const values = { MinValue: dto.minValue ?? null, MaxValue: dto.maxValue ?? null, TargetValue: dto.targetValue ?? null, UpdatedBy: u.userId };
    // Thresholds khong co trigger -> Prisma upsert duoc; Min >= Max -> CHECK 547 -> CONSTRAINT_VIOLATION.
    const t = await this.db.prisma.thresholds.upsert({
      where: { ZoneId_MetricCode: { ZoneId: zoneId, MetricCode: metricCode } },
      update: { ...values, UpdatedAt: new Date() },
      create: { ZoneId: zoneId, MetricCode: metricCode, ...values },
    });
    await this.cache.reloadThresholds(zoneId);
    void this.loop.runZones([zoneId]);
    return pick.threshold(t);
  }
}
```

- [ ] **Step 4: Viết controller và module**

`backend/src/houses/houses.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiError } from '../common/errors';
import { AuthUser, CurrentUser } from '../common/decorators';
import { CreateDeviceDto, CreateHouseDto, CreateZoneDto, ThresholdDto, UpdateDeviceDto, UpdateHouseDto, UpdateZoneDto } from './dto';
import { HousesService } from './houses.service';

@Controller()
export class HousesController {
  constructor(private readonly svc: HousesService) {}

  @Get('houses') list(@CurrentUser() u: AuthUser) { return this.svc.listHouses(u); }
  @Post('houses') create(@CurrentUser() u: AuthUser, @Body() dto: CreateHouseDto) { return this.svc.createHouse(u, dto); }
  @Get('houses/:houseId') get(@Param('houseId', ParseIntPipe) id: number) { return this.svc.getHouse(id); }
  @Patch('houses/:houseId') update(@Param('houseId', ParseIntPipe) id: number, @Body() dto: UpdateHouseDto) { return this.svc.updateHouse(id, dto); }

  @Get('houses/:houseId/zones') zones(@Param('houseId', ParseIntPipe) id: number) { return this.svc.listZones(id); }
  @Post('houses/:houseId/zones') createZone(@Param('houseId', ParseIntPipe) id: number, @Body() dto: CreateZoneDto) { return this.svc.createZone(id, dto); }
  @Patch('zones/:zoneId') updateZone(@Param('zoneId', ParseIntPipe) id: number, @Body() dto: UpdateZoneDto) { return this.svc.updateZone(id, dto); }

  @Get('houses/:houseId/devices') devices(@Param('houseId', ParseIntPipe) id: number) { return this.svc.listDevices(id); }
  @Post('zones/:zoneId/devices') createDevice(@Param('zoneId', ParseIntPipe) id: number, @Body() dto: CreateDeviceDto) { return this.svc.createDevice(id, dto); }
  @Patch('devices/:deviceId') updateDevice(@Param('deviceId', ParseIntPipe) id: number, @Body() dto: UpdateDeviceDto) { return this.svc.updateDevice(id, dto); }

  @Get('metrics') metrics() { return this.svc.metrics(); }
  @Get('zones/:zoneId/thresholds') thresholds(@Param('zoneId', ParseIntPipe) id: number) { return this.svc.thresholds(id); }

  @Put('zones/:zoneId/thresholds/:metricCode')
  put(@CurrentUser() u: AuthUser, @Param('zoneId', ParseIntPipe) id: number, @Param('metricCode') metricCode: string, @Body() dto: ThresholdDto) {
    if (!/^[A-Z0-9]{1,10}$/.test(metricCode)) throw new ApiError(404, 'NOT_FOUND');
    return this.svc.putThreshold(u, id, metricCode, dto);
  }
}
```

`backend/src/houses/houses.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HousesController } from './houses.controller';
import { HousesService } from './houses.service';

@Module({ controllers: [HousesController], providers: [HousesService] })
export class HousesModule {}
```

`app.module.ts`: thêm `HousesModule`.

- [ ] **Step 5: Chạy test**

Run: `npx jest src/houses; npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/houses backend/src/app.module.ts
git commit -m "feat(backend): CRUD nhà, khu vực, thiết bị, ngưỡng; chống gán trường lạ; làm mới bộ nhớ đệm

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 17: API số đo (mới nhất, lịch sử, thống kê ngày) và đếm chim (theo ngày, theo cửa sổ)

**Files:**
- Create: `backend/src/readings/dto.ts`, `backend/src/readings/readings.controller.ts`, `backend/src/readings/readings.controller.spec.ts`, `backend/src/readings/readings.module.ts`, `backend/src/birds/birds.controller.ts`, `backend/src/birds/birds.controller.spec.ts`, `backend/src/birds/birds.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `ReadingsModule`, `BirdsModule`)

**Interfaces:**
- Consumes: `SpService.readingHistory` (Task 6), `DbService` (Task 6), `IsUtcIso`, `IsVnDate`, `validateDto` (Task 4), `pickers` (Task 5).
- Produces:
  - `readings/dto.ts`: `HistoryQuery { metric: string; from: string; to: string; bucketMinutes: number = 60 }`, `UtcRangeQuery { from: string; to: string }`, `VnRangeQuery { fromVnDate: string; toVnDate: string }`, `assertVnRange(q: VnRangeQuery): void` (from ≥ to → 400 `fields: ['toVnDate']`).
  - Khoảng ngày VN là **nửa mở `[fromVnDate, toVnDate)`**, giống `sp_Report_EnvStabilityVsYield` (fixture `report-env-vs-yield.cut`: 01/09 → 01/10 = tháng 9).
  - Route: `GET /api/houses/:houseId/latest-readings`, `GET /api/zones/:zoneId/readings`, `GET /api/zones/:zoneId/daily-stats`, `GET /api/houses/:houseId/bird-flow`, `GET /api/devices/:deviceId/bird-counts`.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/readings/readings.controller.spec.ts`:

```ts
import { validateDto } from '../common/validation';
import { HistoryQuery, VnRangeQuery } from './dto';
import { ReadingsController } from './readings.controller';

describe('HistoryQuery', () => {
  it('from thieu Z -> fields [from]; bucketMinutes mac dinh 60, khong chan <= 0 (SP bao 50040)', async () => {
    await expect(validateDto(HistoryQuery, { metric: 'TEMP', from: '2026-10-12T09:40:07', to: '2026-10-12T10:41:07Z' }))
      .rejects.toMatchObject({ details: { fields: ['from'] } });
    const q = await validateDto(HistoryQuery, { metric: 'TEMP', from: '2026-10-12T09:41:07Z', to: '2026-10-12T10:41:07Z' });
    expect(q.bucketMinutes).toBe(60);
    await expect(validateDto(HistoryQuery, { metric: 'TEMP', from: '2026-10-12T09:41:07Z', to: '2026-10-12T10:41:07Z', bucketMinutes: '0' })).resolves.toMatchObject({ bucketMinutes: 0 });
  });
});

describe('ReadingsController', () => {
  const sp = { readingHistory: jest.fn(async () => [{ BucketUtc: new Date(Date.UTC(2026, 9, 12, 9, 41, 7)), AvgValue: 31.2, MinValue: 31.2, MaxValue: 31.2 }]) };
  const db = { prisma: { $queryRawUnsafe: jest.fn(async () => []) } };
  const c = new ReadingsController(sp as never, db as never);

  it('lich su: doi chuoi thanh Date, tra bucketUtc...Z', async () => {
    const r = await c.history(10, { metric: 'TEMP', from: '2026-10-12T09:41:07Z', to: '2026-10-12T10:41:07Z', bucketMinutes: 60 });
    expect(sp.readingHistory).toHaveBeenCalledWith(10, 'TEMP', new Date('2026-10-12T09:41:07Z'), new Date('2026-10-12T10:41:07Z'), 60);
    expect(r).toEqual([{ bucketUtc: '2026-10-12T09:41:07.000Z', avgValue: 31.2, minValue: 31.2, maxValue: 31.2 }]);
  });

  it('thong ke ngay: from >= to -> 400 fields [toVnDate]; nua mo [from, to)', async () => {
    await expect(c.dailyStats(10, { fromVnDate: '2026-10-12', toVnDate: '2026-10-12' })).rejects.toMatchObject({ status: 400, details: { fields: ['toVnDate'] } });
    await c.dailyStats(10, { fromVnDate: '2026-10-05', toVnDate: '2026-10-13' });
    const [sql, ...params] = db.prisma.$queryRawUnsafe.mock.calls[0] as [string, ...unknown[]];
    expect(sql).toMatch(/DayVn >= @P2 AND DayVn < @P3/);
    expect(params).toEqual([10, '2026-10-05', '2026-10-13']);
  });

  it('VnRangeQuery tu choi dang ngay khac YYYY-MM-DD', async () => {
    await expect(validateDto(VnRangeQuery, { fromVnDate: '12/10/2026', toVnDate: '2026-10-13' })).rejects.toMatchObject({ details: { fields: ['fromVnDate'] } });
  });
});
```

`backend/src/birds/birds.controller.spec.ts`:

```ts
import { BirdsController } from './birds.controller';

describe('BirdsController', () => {
  it('bird-flow: ngay VN dang chuoi; bird-counts: khoang [from, to) theo camera', async () => {
    const findMany = jest.fn(async () => [{ CountId: 1, CameraId: 7, WindowStart: new Date(Date.UTC(2026, 9, 12, 10)), InCount: 5, OutCount: 1 }]);
    const db = { prisma: { $queryRawUnsafe: jest.fn(async () => [{ HouseId: 1, DayVn: new Date(Date.UTC(2026, 9, 12)), InTotal: 10, OutTotal: 3, Net: 7 }]), birdCounts: { findMany } } };
    const c = new BirdsController(db as never);
    expect(await c.flow(1, { fromVnDate: '2026-10-05', toVnDate: '2026-10-13' })).toEqual([{ houseId: 1, dayVn: '2026-10-12', inTotal: 10, outTotal: 3, net: 7 }]);
    expect(await c.counts(7, { from: '2026-10-12T00:00:00Z', to: '2026-10-13T00:00:00Z' })).toEqual([{ countId: 1, cameraId: 7, windowStart: '2026-10-12T10:00:00.000Z', inCount: 5, outCount: 1 }]);
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { CameraId: 7, WindowStart: { gte: new Date('2026-10-12T00:00:00Z'), lt: new Date('2026-10-13T00:00:00Z') } } });
  });
});
```

Run: `npx jest src/readings src/birds`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/readings/dto.ts`**

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches } from 'class-validator';
import { ApiError } from '../common/errors';
import { IsUtcIso, IsVnDate } from '../common/validation';

export class HistoryQuery {
  @Matches(/^[A-Z0-9]{1,10}$/) metric!: string;
  @IsUtcIso() from!: string;
  @IsUtcIso() to!: string;
  // Khong chan <= 0 o day: SP bao 50040 (hop dong 3.5).
  @IsOptional() @Type(() => Number) @IsInt() bucketMinutes: number = 60;
}

export class UtcRangeQuery {
  @IsUtcIso() from!: string;
  @IsUtcIso() to!: string;
}

export class VnRangeQuery {
  @IsVnDate() fromVnDate!: string;
  @IsVnDate() toVnDate!: string;
}

// Chuoi YYYY-MM-DD so sanh duoc theo thu tu tu dien; khong doi qua Date.
export function assertVnRange(q: VnRangeQuery): void {
  if (q.fromVnDate >= q.toVnDate) throw new ApiError(400, 'VALIDATION_ERROR', null, { fields: ['toVnDate'] });
}
```

- [ ] **Step 3: Viết controller, module**

`backend/src/readings/readings.controller.ts`:

```ts
import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';
import { SpService } from '../db/sp';
import { HistoryQuery, VnRangeQuery, assertVnRange } from './dto';

@Controller()
export class ReadingsController {
  constructor(private readonly sp: SpService, private readonly db: DbService) {}

  @Get('houses/:houseId/latest-readings')
  async latest(@Param('houseId', ParseIntPipe) houseId: number) {
    const rows = await this.db.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT HouseId, ZoneId, ZoneName, DeviceId, DeviceCode, DeviceStatus, MetricCode, Unit, Value, RecordedAt FROM dbo.vw_LatestReadings WHERE HouseId = @P1 ORDER BY ZoneId, MetricCode', houseId);
    return rows.map(pick.latestReading);
  }

  @Get('zones/:zoneId/readings')
  async history(@Param('zoneId', ParseIntPipe) zoneId: number, @Query() q: HistoryQuery) {
    const rows = await this.sp.readingHistory(zoneId, q.metric, new Date(q.from), new Date(q.to), q.bucketMinutes);
    return rows.map(pick.readingBucket);
  }

  @Get('zones/:zoneId/daily-stats')
  async dailyStats(@Param('zoneId', ParseIntPipe) zoneId: number, @Query() q: VnRangeQuery) {
    assertVnRange(q);
    const rows = await this.db.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT ZoneId, MetricCode, DayVn, AvgValue, MinValue, MaxValue, Samples FROM dbo.vw_DailyEnvStats WHERE ZoneId = @P1 AND DayVn >= @P2 AND DayVn < @P3 ORDER BY DayVn, MetricCode',
      zoneId, q.fromVnDate, q.toVnDate);
    return rows.map(pick.dailyStats);
  }
}
```

`backend/src/readings/readings.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ReadingsController } from './readings.controller';

@Module({ controllers: [ReadingsController] })
export class ReadingsModule {}
```

`backend/src/birds/birds.controller.ts`:

```ts
import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';
import { UtcRangeQuery, VnRangeQuery, assertVnRange } from '../readings/dto';

@Controller()
export class BirdsController {
  constructor(private readonly db: DbService) {}

  @Get('houses/:houseId/bird-flow')
  async flow(@Param('houseId', ParseIntPipe) houseId: number, @Query() q: VnRangeQuery) {
    assertVnRange(q);
    const rows = await this.db.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT HouseId, DayVn, InTotal, OutTotal, Net FROM dbo.vw_DailyBirdFlow WHERE HouseId = @P1 AND DayVn >= @P2 AND DayVn < @P3 ORDER BY DayVn',
      houseId, q.fromVnDate, q.toVnDate);
    return rows.map(pick.birdFlow);
  }

  @Get('devices/:deviceId/bird-counts')
  async counts(@Param('deviceId', ParseIntPipe) cameraId: number, @Query() q: UtcRangeQuery) {
    const rows = await this.db.prisma.birdCounts.findMany({
      where: { CameraId: cameraId, WindowStart: { gte: new Date(q.from), lt: new Date(q.to) } },
      orderBy: { WindowStart: 'asc' },
    });
    return rows.map(pick.birdCount);
  }
}
```

`backend/src/birds/birds.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { BirdsController } from './birds.controller';

@Module({ controllers: [BirdsController] })
export class BirdsModule {}
```

`app.module.ts`: thêm `ReadingsModule`, `BirdsModule`. Tên model `birdCounts` lấy theo client Prisma sinh ra (S3); khác tên thì sửa đúng tên đó.

- [ ] **Step 4: Chạy test**

Run: `npx jest src/readings src/birds; npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/readings backend/src/birds backend/src/app.module.ts
git commit -m "feat(backend): API số đo mới nhất, lịch sử, thống kê ngày và đếm chim

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 18: Cảnh báo — danh sách phân trang, chi tiết kèm lịch sử, ACK/RESOLVED, ảnh chụp

**Files:**
- Create: `backend/src/alerts/dto.ts`, `backend/src/alerts/alerts.service.ts`, `backend/src/alerts/alerts.service.spec.ts`, `backend/src/alerts/alerts.controller.ts`, `backend/src/alerts/alerts.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `AlertsModule`)

**Interfaces:**
- Consumes: `ownerOf` (Task 8), `PageQuery`, `toPage` (Task 14), `SpService.updateAlertStatus` (Task 6), `RealtimeService` (Task 9), `pickers.alert`, `alertWithHistory`, `alertStatus` (Task 5), `APP_CONFIG.storageRoot` (Task 2).
- Produces:
  - `dto.ts`: `ListAlertsQuery extends PageQuery { houseId?: number; status?: string; type?: string }`, `UpdateAlertDto { status: 'ACK' | 'RESOLVED'; note?: string }`, `ALERT_TYPES`.
  - `alerts.service.ts`: `resolveSnapshot(storageRoot: string, snapshotPath: string | null): string | null` (hàm thuần, export), `AlertsService` với `list(u, q)`, `get(id)`, `updateStatus(u, id, dto)`, `snapshotFile(id): Promise<string>` (đường dẫn tuyệt đối đã kiểm, không có → 404).
  - Route `GET /api/alerts`, `GET /api/alerts/:alertId`, `PATCH /api/alerts/:alertId`, `GET /api/alerts/:alertId/snapshot` (`image/jpeg`).

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/alerts/alerts.service.spec.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateDto } from '../common/validation';
import { ListAlertsQuery } from './dto';
import { AlertsService, resolveSnapshot } from './alerts.service';

const OWNER = { userId: 2, role: 'OWNER' as const, username: 'owner1', exp: 0 };
const ADMIN = { userId: 1, role: 'ADMIN' as const, username: 'admin', exp: 0 };
const NOW = new Date(Date.UTC(2026, 9, 12));
const row = (id: number) => ({ AlertId: id, HouseId: 1, ZoneId: 2, DeviceId: null, AlertType: 'THRESHOLD', Severity: 'WARNING', MetricCode: 'HUMID', Value: 72, DetectedClass: null, Confidence: null, SnapshotPath: null, Message: 'm', Status: 'NEW', CreatedAt: NOW });

describe('resolveSnapshot (Review Focus 3)', () => {
  const root = join(tmpdir(), 'sc-root');
  it.each([
    ['snapshots/2026/10/12/a.jpg', join(root, 'snapshots', '2026', '10', '12', 'a.jpg')],
    ['../../etc/passwd', null], ['snapshots/../../x.jpg', null], ['C:\\Windows\\win.ini', null], ['/etc/passwd', null], [null, null], ['', null],
  ])('%p -> %p', (p, expected) => expect(resolveSnapshot(root, p)).toBe(expected));
});

describe('ListAlertsQuery (Review Focus 4)', () => {
  it.each([
    [{ limit: '0' }, 'limit'], [{ limit: '1000' }, 'limit'], [{ limit: 'abc' }, 'limit'], [{ before: '-5' }, 'before'],
    [{ status: 'NEW,DONE' }, 'status'], [{ type: 'FIRE' }, 'type'], [{ houseId: 'x' }, 'houseId'],
  ])('%j -> 400 fields [%s]', async (q, field) => {
    await expect(validateDto(ListAlertsQuery, q)).rejects.toMatchObject({ status: 400, details: { fields: [field] } });
  });
  it('mac dinh limit 50', async () => {
    expect((await validateDto(ListAlertsQuery, {})).limit).toBe(50);
  });
});

function setup(houseOwner: number | null = 2) {
  const findMany = jest.fn(async ({ take }: { take: number }) => Array.from({ length: take }, (_, i) => row(100 - i)));
  const prisma = {
    alerts: { findMany, findUnique: jest.fn(async () => ({ ...row(9), SnapshotPath: 'snapshots/a.jpg', History: [{ HistoryId: 1, OldStatus: null, NewStatus: 'NEW', UserId: null, Note: null, ChangedAt: NOW }] })) },
    houses: { findUnique: jest.fn(async () => (houseOwner === null ? null : { HouseId: 1, OwnerId: houseOwner })) },
  };
  const sp = { updateAlertStatus: jest.fn(async () => ({ AlertId: 9, HouseId: 1, ZoneId: 4, AlertType: 'THRESHOLD', Status: 'ACK', ResolvedAt: null, ResolvedBy: null })) };
  const rt = { emitToHouse: jest.fn() };
  const root = mkdtempSync(join(tmpdir(), 'sc-snap-'));
  return { svc: new AlertsService({ prisma } as never, sp as never, rt as never, { storageRoot: root } as never), prisma, sp, rt, root, findMany };
}

describe('AlertsService', () => {
  it('list: id giam dan, lay limit+1 de biet trang sau, nextBefore = id cuoi trang', async () => {
    const { svc, findMany } = setup();
    const r = await svc.list(OWNER, { houseId: 1, status: 'NEW,ACK', limit: 2 } as never);
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { HouseId: 1, Status: { in: ['NEW', 'ACK'] } }, orderBy: { AlertId: 'desc' }, take: 3 });
    expect(r.items.map((a) => (a as { alertId: number }).alertId)).toEqual([100, 99]);
    expect(r.nextBefore).toBe(99);
  });

  it('OWNER khong truyen houseId -> chi nha minh; truyen nha nguoi khac/khong ton tai -> 404', async () => {
    const a = setup();
    await a.svc.list(OWNER, { limit: 50 } as never);
    expect(a.findMany.mock.calls[0][0].where).toMatchObject({ House: { OwnerId: 2 } });
    await expect(setup(3).svc.list(OWNER, { houseId: 1, limit: 50 } as never)).rejects.toMatchObject({ status: 404 });
    await expect(setup(null).svc.list(ADMIN, { houseId: 1, limit: 50 } as never)).rejects.toMatchObject({ status: 404 });
  });

  it('get: kem history, khong lo SnapshotPath', async () => {
    const { svc } = setup();
    const r = await svc.get(9);
    expect(r).toMatchObject({ alertId: 9, hasSnapshot: true, history: [{ historyId: 1, newStatus: 'NEW' }] });
    expect(JSON.stringify(r)).not.toContain('snapshots/');
  });

  it('PATCH: goi SP voi UserId tu JWT, phat alert.updated, tra cot SP', async () => {
    const { svc, sp, rt } = setup();
    const r = await svc.updateStatus(OWNER, 9, { status: 'ACK', note: 'Đã kiểm tra' });
    expect(sp.updateAlertStatus).toHaveBeenCalledWith(9, 'ACK', 2, 'Đã kiểm tra');
    expect(rt.emitToHouse).toHaveBeenCalledWith(1, 'alert.updated', { alertId: 9, houseId: 1, status: 'ACK', resolvedAt: null, resolvedBy: null });
    expect(r).toEqual({ alertId: 9, houseId: 1, zoneId: 4, alertType: 'THRESHOLD', status: 'ACK', resolvedAt: null, resolvedBy: null });
  });

  it('snapshotFile: file co -> duong dan; file khong co hoac duong dan la -> 404', async () => {
    const { svc, root, prisma } = setup();
    await expect(svc.snapshotFile(9)).rejects.toMatchObject({ status: 404 });
    mkdirSync(join(root, 'snapshots'), { recursive: true });
    writeFileSync(join(root, 'snapshots', 'a.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
    await expect(svc.snapshotFile(9)).resolves.toBe(join(root, 'snapshots', 'a.jpg'));
    prisma.alerts.findUnique.mockResolvedValueOnce({ ...row(9), SnapshotPath: '../../secret.jpg', History: [] });
    await expect(svc.snapshotFile(9)).rejects.toMatchObject({ status: 404 });
  });
});
```

Run: `npx jest src/alerts`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/alerts/dto.ts`**

```ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { PageQuery } from '../common/paging';

export const ALERT_TYPES = ['THRESHOLD', 'PREDATOR', 'DEVICE_OFFLINE', 'POPULATION_DROP'] as const;

export class ListAlertsQuery extends PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) houseId?: number;
  @IsOptional() @Matches(/^(NEW|ACK|RESOLVED)(,(NEW|ACK|RESOLVED))*$/) status?: string;
  @IsOptional() @IsIn(ALERT_TYPES) type?: string;
}

export class UpdateAlertDto {
  @IsIn(['ACK', 'RESOLVED']) status!: 'ACK' | 'RESOLVED';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
```

- [ ] **Step 3: Viết `backend/src/alerts/alerts.service.ts`**

```ts
import { Inject, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import { APP_CONFIG, AppConfig } from '../config/config';
import { ApiError } from '../common/errors';
import { AuthUser } from '../common/decorators';
import { toPage } from '../common/paging';
import * as pick from '../common/pickers';
import { ownerOf } from '../auth/ownership.guard';
import { DbService } from '../db/db.service';
import { SpService } from '../db/sp';
import { RealtimeService } from '../realtime/realtime.service';
import { ListAlertsQuery, UpdateAlertDto } from './dto';

const notFound = () => new ApiError(404, 'NOT_FOUND');

// Duong dan sau ghep phai nam trong storage/ (spec backend 5.6); khong bao gio nhan duong dan tu client.
export function resolveSnapshot(storageRoot: string, snapshotPath: string | null): string | null {
  if (!snapshotPath || isAbsolute(snapshotPath) || /^[A-Za-z]:/.test(snapshotPath)) return null;
  const root = resolve(storageRoot);
  const full = resolve(root, snapshotPath);
  return full.startsWith(root + sep) ? full : null;
}

@Injectable()
export class AlertsService {
  constructor(private readonly db: DbService, private readonly sp: SpService, private readonly rt: RealtimeService, @Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  async list(u: AuthUser, q: ListAlertsQuery) {
    if (q.houseId !== undefined) {
      const h = await ownerOf(this.db, 'houseId', q.houseId);
      if (!h || (u.role !== 'ADMIN' && h.ownerId !== u.userId)) throw notFound();
    }
    const where = {
      ...(q.houseId !== undefined ? { HouseId: q.houseId } : u.role === 'ADMIN' ? {} : { House: { OwnerId: u.userId } }),
      ...(q.status ? { Status: { in: q.status.split(',') } } : {}),
      ...(q.type ? { AlertType: q.type } : {}),
      ...(q.before ? { AlertId: { lt: q.before } } : {}),
    };
    const rows = await this.db.prisma.alerts.findMany({ where, orderBy: { AlertId: 'desc' }, take: q.limit + 1 });
    return toPage(rows, q.limit, (r) => r.AlertId, pick.alert);
  }

  async get(id: number) {
    const a = await this.db.prisma.alerts.findUnique({ where: { AlertId: id }, include: { History: { orderBy: { HistoryId: 'asc' } } } });
    if (!a) throw notFound();
    return pick.alertWithHistory(a as never);
  }

  async updateStatus(u: AuthUser, id: number, dto: UpdateAlertDto) {
    const r = await this.sp.updateAlertStatus(id, dto.status, u.userId, dto.note ?? null);
    this.rt.emitToHouse(Number(r.HouseId), 'alert.updated', { alertId: r.AlertId, houseId: r.HouseId, status: r.Status, resolvedAt: r.ResolvedAt, resolvedBy: r.ResolvedBy });
    return pick.alertStatus(r);
  }

  async snapshotFile(id: number): Promise<string> {
    const a = await this.db.prisma.alerts.findUnique({ where: { AlertId: id }, select: { SnapshotPath: true } });
    const full = resolveSnapshot(this.cfg.storageRoot, a?.SnapshotPath ?? null);
    if (!full || !existsSync(full)) throw notFound();
    return full;
  }
}
```

Lưu ý test `snapshotFile` đầu tiên: mock `findUnique` trả bản ghi có `History` — không sao, service chỉ đọc `SnapshotPath`.

- [ ] **Step 4: Viết controller, module**

`backend/src/alerts/alerts.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { AuthUser, CurrentUser } from '../common/decorators';
import { AlertsService } from './alerts.service';
import { ListAlertsQuery, UpdateAlertDto } from './dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly svc: AlertsService) {}

  @Get() list(@CurrentUser() u: AuthUser, @Query() q: ListAlertsQuery) { return this.svc.list(u, q); }
  @Get(':alertId') get(@Param('alertId', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Patch(':alertId') update(@CurrentUser() u: AuthUser, @Param('alertId', ParseIntPipe) id: number, @Body() dto: UpdateAlertDto) { return this.svc.updateStatus(u, id, dto); }

  @Get(':alertId/snapshot')
  async snapshot(@Param('alertId', ParseIntPipe) id: number): Promise<StreamableFile> {
    return new StreamableFile(createReadStream(await this.svc.snapshotFile(id)), { type: 'image/jpeg' });
  }
}
```

`backend/src/alerts/alerts.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({ controllers: [AlertsController], providers: [AlertsService] })
export class AlertsModule {}
```

`app.module.ts`: thêm `AlertsModule`.

- [ ] **Step 5: Chạy test**

Run: `npx jest src/alerts; npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/alerts backend/src/app.module.ts
git commit -m "feat(backend): cảnh báo phân trang theo con trỏ id, ACK/RESOLVED qua SP, ảnh chụp trong storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 19: Endpoint AI — đếm chim, thiên địch (8 bước, file tạm luôn được dọn), khóa dịch vụ

**Files:**
- Create: `backend/src/ai/dto.ts`, `backend/src/ai/predator.service.ts`, `backend/src/ai/predator.service.spec.ts`, `backend/src/ai/ai.controller.ts`, `backend/src/ai/ai.controller.spec.ts`, `backend/src/ai/ai.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `AiModule`)

**Interfaces:**
- Consumes: `ServiceKeyGuard`, `Public` (Task 7), `SpService.recordBirdCount`, `createPredatorAlert` (Task 6), `validateDto`, `validationError` (Task 4), `RealtimeService` (Task 9), `pickers.alertFromSp` (Task 5), `APP_CONFIG` (Task 2).
- Produces:
  - `dto.ts`: `BirdCountItemDto { camera; windowStart; in; out }`, `PredatorMetadataDto { camera; class; confidence; at }`, `CODE_RE = /^[A-Z0-9-]{3,50}$/`, `MAX_BIRD_ITEMS = 500`.
  - `PredatorService.handle(metadataRaw: unknown, file: { buffer: Buffer } | undefined): Promise<{ created: boolean; alertId: number | null; skipReason: string | null }>`, hàm thuần `snapshotRelPath(camera: string, cls: string, atIso: string): string`.
  - Route `POST /api/ai/bird-counts` (200), `POST /api/ai/predator-detections` (200, multipart `metadata` + `image`). Heartbeat AI thêm ở Task 26.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/ai/predator.service.spec.ts`:

```ts
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PredatorService, snapshotRelPath } from './predator.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const META = { camera: 'H1-F0-CAMERA', class: 'snake', confidence: 0.87, at: '2026-10-12T10:40:07Z' };
const ALERT = { AlertId: 11, HouseId: 1, ZoneId: 2, DeviceId: 3, AlertType: 'PREDATOR', Severity: 'CRITICAL', MetricCode: null, Value: null, DetectedClass: 'snake', Confidence: 0.87, HasSnapshot: true, Message: 'm', Status: 'NEW', CreatedAt: META.at };

function setup(createPredatorAlert?: jest.Mock, camera: object | null = { DeviceId: 3 }) {
  const root = mkdtempSync(join(tmpdir(), 'sc-ai-'));
  const sp = { createPredatorAlert: createPredatorAlert ?? jest.fn(async () => ({ created: true, alertId: 11, skipReason: null, alert: ALERT })) };
  const db = { prisma: { devices: { findFirst: jest.fn(async () => camera) } } };
  const rt = { emitToHouse: jest.fn() };
  const svc = new PredatorService({ storageRoot: root } as never, db as never, sp as never, rt as never);
  return { svc, sp, db, rt, root, tmp: () => (existsSync(join(root, 'tmp')) ? readdirSync(join(root, 'tmp')) : []) };
}

describe('snapshotRelPath (hop dong 2.4 buoc 4)', () => {
  it('chi tu gia tri da kiem, UTC', () => {
    expect(snapshotRelPath('H1-F0-CAMERA', 'snake', '2026-10-12T23:59:59.000Z')).toBe('snapshots/2026/10/12/H1-F0-CAMERA_snake_20261012T235959Z.jpg');
  });
});

describe('PredatorService.handle', () => {
  it('Created = 1: file chinh thuc dung cho, khong con file tam, phat alert.created, tra {created, alertId, skipReason}', async () => {
    const { svc, sp, rt, root, tmp } = setup();
    const r = await svc.handle(JSON.stringify(META), { buffer: JPEG });
    expect(r).toEqual({ created: true, alertId: 11, skipReason: null });
    expect(sp.createPredatorAlert).toHaveBeenCalledWith({ ...META, snapshot: 'snapshots/2026/10/12/H1-F0-CAMERA_snake_20261012T104007Z.jpg' });
    expect(existsSync(join(root, 'snapshots', '2026', '10', '12', 'H1-F0-CAMERA_snake_20261012T104007Z.jpg'))).toBe(true);
    expect(tmp()).toEqual([]);
    expect(rt.emitToHouse).toHaveBeenCalledWith(1, 'alert.created', { alert: expect.objectContaining({ alertId: 11, alertType: 'PREDATOR', hasSnapshot: true }) });
  });

  it('COOLDOWN / LOW_CONFIDENCE: khong giu file nao, khong phat', async () => {
    const { svc, root, tmp, rt } = setup(jest.fn(async () => ({ created: false, alertId: null, skipReason: 'COOLDOWN', alert: null })));
    expect(await svc.handle(JSON.stringify(META), { buffer: JPEG })).toEqual({ created: false, alertId: null, skipReason: 'COOLDOWN' });
    expect(existsSync(join(root, 'snapshots', '2026'))).toBe(false);
    expect(tmp()).toEqual([]);
    expect(rt.emitToHouse).not.toHaveBeenCalled();
  });

  it('SP loi -> file tam bi xoa, loi duoc nem tiep', async () => {
    const { svc, tmp } = setup(jest.fn(async () => { throw Object.assign(new Error('x'), { number: 50013 }); }));
    await expect(svc.handle(JSON.stringify(META), { buffer: JPEG })).rejects.toMatchObject({ number: 50013 });
    expect(tmp()).toEqual([]);
  });

  it.each([
    ['metadata khong phai JSON', '{hong', JPEG, 400, ['metadata']],
    ['class la', JSON.stringify({ ...META, class: 'cat' }), JPEG, 400, ['class']],
    ['at +07:00', JSON.stringify({ ...META, at: '2026-10-12T17:40:07+07:00' }), JPEG, 400, ['at']],
    ['thieu image', JSON.stringify(META), undefined, 400, ['image']],
  ])('%s -> %i fields %j, khong ghi file', async (_l, meta, buffer, status, fields) => {
    const { svc, sp, tmp } = setup();
    await expect(svc.handle(meta, buffer ? { buffer } : undefined)).rejects.toMatchObject({ status, details: { fields } });
    expect(sp.createPredatorAlert).not.toHaveBeenCalled();
    expect(tmp()).toEqual([]);
  });

  it('camera khong ton tai/ngung dung/khong phai CAMERA -> 404 CAMERA_NOT_FOUND truoc khi ghi file', async () => {
    const { svc, tmp } = setup(undefined, null);
    await expect(svc.handle(JSON.stringify(META), { buffer: JPEG })).rejects.toMatchObject({ status: 404, code: 'CAMERA_NOT_FOUND' });
    expect(tmp()).toEqual([]);
  });

  it('khong phai JPEG that (PNG) -> 415', async () => {
    const { svc } = setup();
    await expect(svc.handle(JSON.stringify(META), { buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) })).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('cung su kien gui hai lan song song: dung mot file chinh thuc, khong con file tam (spec backend 5.9)', async () => {
    let n = 0;
    const sp = jest.fn(async () => (n++ === 0 ? { created: true, alertId: 11, skipReason: null, alert: ALERT } : { created: false, alertId: null, skipReason: 'COOLDOWN', alert: null }));
    const { svc, root, tmp } = setup(sp);
    const rs = await Promise.all([svc.handle(JSON.stringify(META), { buffer: JPEG }), svc.handle(JSON.stringify(META), { buffer: JPEG })]);
    expect(rs.map((r) => r.created).sort()).toEqual([false, true]);
    expect(readdirSync(join(root, 'snapshots', '2026', '10', '12'))).toHaveLength(1);
    expect(tmp()).toEqual([]);
  });
});
```

`backend/src/ai/ai.controller.spec.ts`:

```ts
import { AiController } from './ai.controller';

const item = (camera = 'H1-F0-CAMERA') => ({ camera, windowStart: '2026-10-12T10:40:00Z', in: 5, out: 1 });

function setup(upserted = 1) {
  const sp = { recordBirdCount: jest.fn(async () => ({ windowsUpserted: upserted, windowsUnchanged: 0 })) };
  const db = { prisma: { devices: { findMany: jest.fn(async () => [{ DeviceId: 3, Zone: { HouseId: 1 } }, { DeviceId: 8, Zone: { HouseId: 2 } }]) } } };
  const rt = { emitToHouse: jest.fn() };
  return { c: new AiController(sp as never, db as never, rt as never, {} as never), sp, db, rt };
}

describe('AiController.birdCounts (spec backend 5.7)', () => {
  it('mang rong -> 400; > 500 phan tu -> 413', async () => {
    const { c } = setup();
    await expect(c.birdCounts([])).rejects.toMatchObject({ status: 400, details: { fields: ['body'] } });
    await expect(c.birdCounts(Array.from({ length: 501 }, () => item()) as never)).rejects.toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });

  it('windowsUpserted > 0 -> birdcount.updated moi camera trong lo (mot truy van)', async () => {
    const { c, rt, db } = setup(2);
    expect(await c.birdCounts([item(), item('H2-F0-CAMERA'), item()] as never)).toEqual({ windowsUpserted: 2, windowsUnchanged: 0 });
    expect(db.prisma.devices.findMany).toHaveBeenCalledTimes(1);
    expect(db.prisma.devices.findMany.mock.calls[0][0]).toMatchObject({ where: { Code: { in: ['H1-F0-CAMERA', 'H2-F0-CAMERA'] } } });
    expect(rt.emitToHouse.mock.calls).toEqual([[1, 'birdcount.updated', { houseId: 1, cameraId: 3 }], [2, 'birdcount.updated', { houseId: 2, cameraId: 8 }]]);
  });

  it('windowsUpserted = 0 -> khong phat', async () => {
    const { c, rt } = setup(0);
    await c.birdCounts([item()] as never);
    expect(rt.emitToHouse).not.toHaveBeenCalled();
  });
});
```

Run: `npx jest src/ai`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/ai/dto.ts`**

```ts
import { IsIn, IsInt, IsNumber, Matches, Max, Min } from 'class-validator';
import { IsUtcIso } from '../common/validation';

export const CODE_RE = /^[A-Z0-9-]{3,50}$/;
export const MAX_BIRD_ITEMS = 500;

// Chi kiem kieu, Z, class; KHONG kiem so am va moc 5 phut de SP bao 50012/50014 (spec backend 5.3).
export class BirdCountItemDto {
  @Matches(CODE_RE) camera!: string;
  @IsUtcIso() windowStart!: string;
  @IsInt() in!: number;
  @IsInt() out!: number;
}

export class PredatorMetadataDto {
  @Matches(CODE_RE) camera!: string;
  @IsIn(['rat', 'snake', 'owl']) class!: string;
  @IsNumber() @Min(0) @Max(1) confidence!: number;
  @IsUtcIso() at!: string;
}
```

- [ ] **Step 3: Viết `backend/src/ai/predator.service.ts`**

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { APP_CONFIG, AppConfig } from '../config/config';
import { ApiError } from '../common/errors';
import * as pick from '../common/pickers';
import { validateDto } from '../common/validation';
import { DbService } from '../db/db.service';
import { SpService } from '../db/sp';
import { RealtimeService } from '../realtime/realtime.service';
import { PredatorMetadataDto } from './dto';

const bad = (f: string) => new ApiError(400, 'VALIDATION_ERROR', null, { fields: [f] });

export function snapshotRelPath(camera: string, cls: string, atIso: string): string {
  const s = new Date(atIso).toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ (UTC)
  const stamp = `${s.slice(0, 4)}${s.slice(5, 7)}${s.slice(8, 10)}T${s.slice(11, 13)}${s.slice(14, 16)}${s.slice(17, 19)}Z`;
  return `snapshots/${s.slice(0, 4)}/${s.slice(5, 7)}/${s.slice(8, 10)}/${camera}_${cls}_${stamp}.jpg`;
}

// Dung 8 buoc hop dong 2.4; file tam bi xoa trong finally cho moi duong khong doi ten thanh cong.
@Injectable()
export class PredatorService {
  private readonly log = new Logger('AI');

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig, private readonly db: DbService, private readonly sp: SpService, private readonly rt: RealtimeService) {}

  async handle(metadataRaw: unknown, file: { buffer: Buffer } | undefined) {
    // 1. Kiem metadata, thieu anh.
    let plain: unknown;
    try { plain = JSON.parse(String(metadataRaw)); } catch { throw bad('metadata'); }
    const meta = await validateDto(PredatorMetadataDto, plain);
    if (!file?.buffer?.length) throw bad('image');
    // 2. Kiem camera truoc khi dung duong dan, chua ghi file.
    const cam = await this.db.prisma.devices.findFirst({ where: { Code: meta.camera, IsActive: true, DeviceType: 'CAMERA' }, select: { DeviceId: true } });
    if (!cam) throw new ApiError(404, 'CAMERA_NOT_FOUND');
    // 3. Chu ky JPEG that (kich thuoc do multer chan).
    const b = file.buffer;
    if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE');
    // 4. Duong dan chi tu gia tri da kiem.
    const rel = snapshotRelPath(meta.camera, meta.class, meta.at);
    const finalPath = join(this.cfg.storageRoot, ...rel.split('/'));
    // 5. Ghi file tam.
    const tmpDir = join(this.cfg.storageRoot, 'tmp');
    const tmp = join(tmpDir, `${randomUUID()}.jpg`);
    await mkdir(tmpDir, { recursive: true });
    await writeFile(tmp, b);
    try {
      // 6. Goi SP.
      const r = await this.sp.createPredatorAlert({ camera: meta.camera, class: meta.class, confidence: meta.confidence, at: meta.at, snapshot: rel });
      if (r.created) {
        // 7. Doi ten file tam thanh file chinh thuc. 8. Loi doi ten -> log, canh bao van giu.
        try {
          await mkdir(dirname(finalPath), { recursive: true });
          await rename(tmp, finalPath);
        } catch (e) {
          this.log.error(`Doi ten anh canh bao ${r.alertId} loi: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`);
        }
        if (r.alert) this.rt.emitToHouse(Number(r.alert.HouseId), 'alert.created', { alert: pick.alertFromSp(r.alert) });
      }
      return { created: r.created, alertId: r.alertId, skipReason: r.skipReason };
    } finally {
      await unlink(tmp).catch(() => undefined); // da doi ten -> ENOENT, bo qua
    }
  }
}
```

Thứ tự trong spec 2.4: bước 1 là kiểm `metadata` **rồi** thiếu `image`; code trên giữ đúng thứ tự đó. Thứ tự khóa trong object gửi SP không ảnh hưởng SP (đọc theo tên bằng `OPENJSON`), nên test dùng `{ ...META, snapshot }`.

- [ ] **Step 4: Viết controller và module**

`backend/src/ai/ai.controller.ts`:

```ts
import { Body, Controller, HttpCode, ParseArrayPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ServiceKeyGuard } from '../auth/service-key.guard';
import { ApiError } from '../common/errors';
import { Public } from '../common/decorators';
import { validationError } from '../common/validation';
import { DbService } from '../db/db.service';
import { SpService } from '../db/sp';
import { RealtimeService } from '../realtime/realtime.service';
import { BirdCountItemDto, MAX_BIRD_ITEMS } from './dto';
import { PredatorService } from './predator.service';

// AI khong dung JWT: chi X-Service-Key (hop dong 1.x, spec backend 5.1).
@Public()
@UseGuards(ServiceKeyGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly sp: SpService, private readonly db: DbService, private readonly rt: RealtimeService, private readonly predator: PredatorService) {}

  @Post('bird-counts') @HttpCode(200)
  async birdCounts(@Body(new ParseArrayPipe({ items: BirdCountItemDto, whitelist: true, forbidNonWhitelisted: true, exceptionFactory: validationError as never })) items: BirdCountItemDto[]) {
    if (!items.length) throw new ApiError(400, 'VALIDATION_ERROR', null, { fields: ['body'] });
    if (items.length > MAX_BIRD_ITEMS) throw new ApiError(413, 'PAYLOAD_TOO_LARGE');
    const r = await this.sp.recordBirdCount(items.map((i) => ({ camera: i.camera, windowStart: i.windowStart, in: i.in, out: i.out })));
    if (r.windowsUpserted > 0) {
      const codes = [...new Set(items.map((i) => i.camera))];
      const cams = await this.db.prisma.devices.findMany({ where: { Code: { in: codes } }, select: { DeviceId: true, Zone: { select: { HouseId: true } } } });
      for (const c of cams) this.rt.emitToHouse(c.Zone.HouseId, 'birdcount.updated', { houseId: c.Zone.HouseId, cameraId: c.DeviceId });
    }
    return r;
  }

  @Post('predator-detections') @HttpCode(200)
  @UseInterceptors(FileInterceptor('image'))
  predatorDetection(@Body('metadata') metadata: unknown, @UploadedFile() image?: { buffer: Buffer }) {
    return this.predator.handle(metadata, image);
  }
}
```

`ParseArrayPipe` của Nest gọi `exceptionFactory` với danh sách lỗi đã làm phẳng theo chỉ số (`[0].windowStart …`) **hoặc** với `ValidationError[]` tùy bản; nếu `details.fields` của fixture `bird-counts.invalid-missing-z` ra khác `["windowStart"]`, thay `exceptionFactory` bằng hàm tự gọi `leafFields` trên `ValidationError[]` (kiểm ở Task 22, ghi kết quả vào RESULTS.md).

Global `ValidationPipe` bỏ qua tham số kiểu mảng (`BirdCountItemDto[]` có metatype `Array`), nên chỉ `ParseArrayPipe` kiểm.

`backend/src/ai/ai.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { APP_CONFIG, AppConfig } from '../config/config';
import { AiController } from './ai.controller';
import { PredatorService } from './predator.service';

@Module({
  imports: [MulterModule.registerAsync({
    inject: [APP_CONFIG],
    // memoryStorage: moi request giu <= SNAPSHOT_MAX_BYTES trong bo nho; 1 file (spec backend 5.7).
    useFactory: (cfg: AppConfig) => ({ storage: memoryStorage(), limits: { fileSize: cfg.snapshotMaxBytes, files: 1 } }),
  })],
  controllers: [AiController],
  providers: [PredatorService],
})
export class AiModule {}
```

`multer` có sẵn qua `@nestjs/platform-express` (không cài riêng); import `memoryStorage` từ `multer` dùng bản đó. `app.module.ts`: thêm `AiModule`.

- [ ] **Step 5: Chạy test**

Run: `npx jest src/ai; npm run build`
Expected: PASS.

- [ ] **Step 6: Kiểm tay (S17) và báo TV3**

`npm run start` trên CSDL Dev; tạo ảnh lớn 3 MB (`fsutil file createnew big.jpg 3145728`), rồi:

```powershell
curl.exe -s -i -H "X-Service-Key: <AI_SERVICE_KEY>" -F "metadata={\"camera\":\"H1-F0-CAMERA\",\"class\":\"snake\",\"confidence\":0.9,\"at\":\"<UTC now>Z\"}" -F "image=@big.jpg;type=image/jpeg" http://localhost:3000/api/ai/predator-detections
```

Expected: `HTTP/1.1 413`, body `PAYLOAD_TOO_LARGE`. Ghi S17. Gửi lại với `contracts/fixtures/ai/snake.jpg` → 200 `created: true`; `backend/storage/tmp/` rỗng. Báo TV3: endpoint AI đã sẵn sàng (mốc trước 29/10).

- [ ] **Step 7: Commit**

```powershell
git add backend/src/ai backend/src/app.module.ts backend/spikes/RESULTS.md
git commit -m "feat(backend): endpoint AI đếm chim và thiên địch, lưu ảnh an toàn, dọn file tạm

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 20: Nhịp `sp_DetectAnomalies` mỗi phút (không chạy chồng) và endpoint admin cho demo

**Điều kiện cho phần fixture:** endpoint admin là thay đổi hợp đồng (Task 3). Code theo spec backend 5.8 (đã duyệt) làm được ngay; fixture `rest/admin-anomalies-detect.*` chỉ chạy được sau khi PR của Task 3 merge.

**Files:**
- Create: `backend/src/scheduler/anomaly.service.ts`, `backend/src/scheduler/anomaly.service.spec.ts`, `backend/src/scheduler/scheduler.module.ts`, `backend/src/admin/admin.controller.ts`, `backend/src/admin/admin.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `ScheduleModule.forRoot()`, `SchedulerModule`, `AdminModule` có điều kiện), `backend/test/app.e2e-spec.ts` (ca 404 khi `DEMO_TOOLS=false`)

**Interfaces:**
- Consumes: `SpService.detectAnomalies` (Task 6), `DbService` (Task 6), `RealtimeService` (Task 9), `withTimeout`, `sleep` (Task 6), `pickers.alertFromSp` (Task 5), `Roles`, `IsUtcIso` (Task 4, 7), `APP_CONFIG` (Task 2), kết quả S10 (Task 1).
- Produces: `AnomalyService` với `tick(): Promise<void>`, `detectNow(nowUtc: Date): Promise<object[]>` (alert 14 khóa), `stop(): void`, hằng `TICK_MS = 60000`, `CALL_TIMEOUT_MS = 30000` (chỉnh theo S10), `ADMIN_WAIT_MS = 10000`, `ADMIN_OFFLINE_MINUTES = 525600`. Route `POST /api/admin/anomalies/detect` (200, chỉ khi `DEMO_TOOLS=true`).

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/scheduler/anomaly.service.spec.ts`:

```ts
import { AnomalyService } from './anomaly.service';

const ALERT = { AlertId: 50, HouseId: 2, ZoneId: null, DeviceId: null, AlertType: 'POPULATION_DROP', Severity: 'CRITICAL', MetricCode: null, Value: null, DetectedClass: null, Confidence: null, HasSnapshot: false, Message: 'm', Status: 'NEW', CreatedAt: '2026-10-12T13:30:00Z' };

function setup(detect: jest.Mock, opts: { ready?: boolean; scheduler?: boolean } = {}) {
  const registry = { addInterval: jest.fn(), deleteInterval: jest.fn(), doesExist: jest.fn(() => true) };
  const rt = { emitToHouse: jest.fn() };
  const svc = new AnomalyService({ anomalyScheduler: opts.scheduler ?? true } as never, { isReady: () => opts.ready ?? true } as never, { detectAnomalies: detect } as never, rt as never, registry as never);
  return { svc, registry, rt };
}

describe('AnomalyService', () => {
  afterEach(() => jest.useRealTimers());

  it('ANOMALY_SCHEDULER=off -> khong dang ky nhip; on -> dang ky 60 giay', () => {
    const off = setup(jest.fn(), { scheduler: false });
    off.svc.onModuleInit();
    expect(off.registry.addInterval).not.toHaveBeenCalled();
    const on = setup(jest.fn());
    on.svc.onModuleInit();
    expect(on.registry.addInterval).toHaveBeenCalledWith('detect-anomalies', expect.anything());
    on.svc.stop();
  });

  it('tick: tham so mac dinh, phat alert.created moi canh bao', async () => {
    const detect = jest.fn(async () => [ALERT]);
    const { svc, rt } = setup(detect);
    await svc.tick();
    expect(detect).toHaveBeenCalledWith({});
    expect(rt.emitToHouse).toHaveBeenCalledWith(2, 'alert.created', { alert: expect.objectContaining({ alertId: 50, alertType: 'POPULATION_DROP' }) });
  });

  it('CSDL chua san sang -> bo luot; dang chay -> bo luot; SP loi -> luot sau van chay', async () => {
    const notReady = setup(jest.fn(), { ready: false });
    await notReady.svc.tick();
    expect(notReady.svc).toBeDefined();

    let release!: () => void;
    const detect = jest.fn()
      .mockImplementationOnce(() => new Promise((r) => { release = () => r([]); }))
      .mockRejectedValueOnce(new Error('loi SP'))
      .mockResolvedValue([]);
    const { svc } = setup(detect);
    const first = svc.tick();
    await svc.tick();                  // dang chay -> bo luot
    expect(detect).toHaveBeenCalledTimes(1);
    release(); await first;
    await svc.tick();                  // loi -> khong nem
    await svc.tick();
    expect(detect).toHaveBeenCalledTimes(3);
  });

  it('detectNow: @NowUtc = nowUtc, @OfflineMinutes = 525600, tra alert 14 khoa', async () => {
    const detect = jest.fn(async () => [ALERT]);
    const { svc } = setup(detect);
    const now = new Date('2026-10-12T13:30:00Z');
    const r = await svc.detectNow(now);
    expect(detect).toHaveBeenCalledWith({ nowUtc: now, offlineMinutes: 525600 });
    expect(Object.keys(r[0])).toHaveLength(14);
  });

  it('detectNow cho nhip dang chay toi da 10 giay roi 503 RETRY_LATER', async () => {
    jest.useFakeTimers();
    const detect = jest.fn(() => new Promise(() => undefined));
    const { svc } = setup(detect);
    void svc.tick();
    const p = svc.detectNow(new Date());
    const assertion = expect(p).rejects.toMatchObject({ status: 503, code: 'RETRY_LATER' });
    await jest.advanceTimersByTimeAsync(10_100);
    await assertion;
  });

  it('mot lan goi qua 30 giay -> nha khoa', async () => {
    jest.useFakeTimers();
    const detect = jest.fn().mockImplementationOnce(() => new Promise(() => undefined)).mockResolvedValue([]);
    const { svc } = setup(detect);
    void svc.tick();
    await jest.advanceTimersByTimeAsync(30_001);
    await svc.tick();
    expect(detect).toHaveBeenCalledTimes(2);
  });
});
```

Thêm vào `backend/test/app.e2e-spec.ts` (app có `DEMO_TOOLS=false`):

```ts
  it('DEMO_TOOLS=false -> endpoint admin la 404 nhu route khong ton tai (truoc ca kiem token)', async () => {
    const r = await request(app.getHttpServer()).post('/api/admin/anomalies/detect').send({ nowUtc: '2026-10-12T13:30:00Z' });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
  });
```

Run: `npx jest src/scheduler; npm run test:e2e`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/scheduler/anomaly.service.ts`**

```ts
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { APP_CONFIG, AppConfig } from '../config/config';
import { ApiError } from '../common/errors';
import { sleep, withTimeout } from '../common/async';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';
import { SpAlert, SpService } from '../db/sp';
import { RealtimeService } from '../realtime/realtime.service';

export const TICK_MS = 60_000;
export const CALL_TIMEOUT_MS = 30_000; // de xuat; chinh theo S10 (Task 1)
export const ADMIN_WAIT_MS = 10_000;
export const ADMIN_OFFLINE_MINUTES = 525_600; // 1 nam: chi phan sut dan (spec backend 5.8)

@Injectable()
export class AnomalyService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Bat thuong');
  private running = false;
  private skipping = false;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly db: DbService,
    private readonly sp: SpService,
    private readonly rt: RealtimeService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (this.cfg.anomalyScheduler) this.registry.addInterval('detect-anomalies', setInterval(() => void this.tick(), TICK_MS));
  }

  onModuleDestroy(): void { this.stop(); }

  stop(): void {
    try { if (this.registry.doesExist('interval', 'detect-anomalies')) this.registry.deleteInterval('detect-anomalies'); } catch { /* chua dang ky */ }
  }

  async tick(): Promise<void> {
    if (!this.db.isReady()) return;
    if (this.running) {
      if (!this.skipping) this.log.warn('Luot truoc chua xong, bat dau bo luot');
      this.skipping = true;
      return;
    }
    if (this.skipping) this.log.log('Het bo luot');
    this.skipping = false;
    try { await this.run({}); } catch (e) { this.log.error(`sp_DetectAnomalies loi: ${(e as Error).message}`); }
  }

  // Dung chung khoa voi nhip nen: cho toi da 10 giay, qua thi 503 (spec backend 5.8).
  async detectNow(nowUtc: Date): Promise<object[]> {
    const end = Date.now() + ADMIN_WAIT_MS;
    while (this.running) {
      if (Date.now() >= end) throw new ApiError(503, 'RETRY_LATER');
      await sleep(100);
    }
    return this.run({ nowUtc, offlineMinutes: ADMIN_OFFLINE_MINUTES });
  }

  private async run(opts: { nowUtc?: Date; offlineMinutes?: number }): Promise<object[]> {
    this.running = true;
    try {
      const alerts: SpAlert[] = await withTimeout(this.sp.detectAnomalies(opts), CALL_TIMEOUT_MS, 'sp_DetectAnomalies');
      const out = alerts.map((a) => pick.alertFromSp(a));
      // NewAlertsJson da gom DEVICE_OFFLINE do trigger tao: chi phat lai (spec backend 6.4).
      for (const a of out) this.rt.emitToHouse(Number(a.houseId), 'alert.created', { alert: a });
      return out;
    } finally {
      this.running = false;
    }
  }
}
```

Test "tick: tham số mặc định" mong `detectAnomalies({})`: `run({})` truyền đúng `{}`.

- [ ] **Step 3: Viết module, admin; nối có điều kiện**

`backend/src/scheduler/scheduler.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { AnomalyService } from './anomaly.service';

@Global()
@Module({ providers: [AnomalyService], exports: [AnomalyService] })
export class SchedulerModule {}
```

`backend/src/admin/admin.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { IsUtcIso } from '../common/validation';
import { AnomalyService } from '../scheduler/anomaly.service';

class DetectDto { @IsUtcIso() nowUtc!: string }

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly anomalies: AnomalyService) {}

  @Post('anomalies/detect') @HttpCode(200)
  async detect(@Body() dto: DetectDto) {
    return { newAlerts: await this.anomalies.detectNow(new Date(dto.nowUtc)) };
  }
}
```

`backend/src/admin/admin.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';

@Module({ controllers: [AdminController] })
export class AdminModule {}
```

`app.module.ts`: `imports: [ConfigModule.forRoot(cfg), ScheduleModule.forRoot(), DbModule, AuthModule, ...FEATURE_MODULES, SchedulerModule, ...(cfg.demoTools ? [AdminModule] : [])]` (import `ScheduleModule` từ `@nestjs/schedule`). **Không đăng ký route khi `DEMO_TOOLS=false`** → 404 giống route không tồn tại.

Lưu ý thứ tự guard: route không tồn tại không qua guard nào, nên 404 có trước 401 — đúng ý spec 5.8.

- [ ] **Step 4: Chạy test**

Run: `npx jest src/scheduler; npm run test:e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/scheduler backend/src/admin backend/src/app.module.ts backend/test
git commit -m "feat(backend): nhịp sp_DetectAnomalies mỗi phút không chạy chồng, endpoint admin demo khi DEMO_TOOLS=true

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 21: Tắt êm (Ctrl+C), hoàn thiện `main.ts`, README backend

**Files:**
- Create: `backend/src/shutdown.ts`, `backend/src/shutdown.spec.ts`, `backend/README.md`
- Modify: `backend/src/main.ts`

**Interfaces:**
- Consumes: `AnomalyService.stop` (Task 20), `IngestService.flush` (Task 15), `MqttService.end` (Task 13), kết quả S12 (Task 1).
- Produces: `createShutdown(d: { closeHttp(): Promise<void>; stopTimers(): void; flush(ms: number): Promise<number>; endMqtt(): Promise<void>; closeApp(): Promise<void>; exit(code: number): void; log: { log(m: string): void; warn(m: string): void } }): (signal: string) => Promise<void>`.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/shutdown.spec.ts`:

```ts
import { createShutdown } from './shutdown';

function deps(lost = 0) {
  const order: string[] = [];
  const d = {
    closeHttp: jest.fn(async () => { order.push('http'); }),
    stopTimers: jest.fn(() => { order.push('timers'); }),
    flush: jest.fn(async () => { order.push('flush'); return lost; }),
    endMqtt: jest.fn(async () => { order.push('mqtt'); }),
    closeApp: jest.fn(async () => { order.push('app'); }),
    exit: jest.fn((code: number) => { order.push(`exit ${code}`); }),
    log: { log: jest.fn(), warn: jest.fn() },
  };
  return { d, order };
}

describe('createShutdown (spec backend 3.6)', () => {
  it('thu tu: ngung nhan request -> ngung nhip -> ghi not lo (5 giay) -> ngat MQTT giu phien -> dong app -> exit 0', async () => {
    const { d, order } = deps();
    await createShutdown(d)('SIGINT');
    expect(order).toEqual(['http', 'timers', 'flush', 'mqtt', 'app', 'exit 0']);
    expect(d.flush).toHaveBeenCalledWith(5000);
  });

  it('khong kip ghi -> log so phan tu mat', async () => {
    const { d } = deps(12);
    await createShutdown(d)('SIGINT');
    expect(d.log.warn).toHaveBeenCalledWith(expect.stringContaining('12'));
  });

  it('Ctrl+C lan hai -> thoat ngay, khong cho buoc nao', async () => {
    const { d } = deps();
    d.flush.mockImplementation(() => new Promise(() => undefined));
    const stop = createShutdown(d);
    void stop('SIGINT');
    await stop('SIGINT');
    expect(d.exit).toHaveBeenCalledWith(1);
    expect(d.endMqtt).not.toHaveBeenCalled();
  });

  it('loi o mot buoc khong chan buoc sau', async () => {
    const { d, order } = deps();
    d.endMqtt.mockRejectedValue(new Error('x'));
    await createShutdown(d)('SIGTERM');
    expect(order).toEqual(['http', 'timers', 'flush', 'app', 'exit 0']);
  });
});
```

Run: `npx jest src/shutdown`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/shutdown.ts`**

```ts
export interface ShutdownDeps {
  closeHttp(): Promise<void>;
  stopTimers(): void;
  flush(ms: number): Promise<number>;
  endMqtt(): Promise<void>;
  closeApp(): Promise<void>;
  exit(code: number): void;
  log: { log(m: string): void; warn(m: string): void };
}

export const FLUSH_ON_EXIT_MS = 5000;

export function createShutdown(d: ShutdownDeps): (signal: string) => Promise<void> {
  let stopping = false;
  const step = async (fn: () => unknown) => { try { await fn(); } catch { /* buoc loi khong chan buoc sau */ } };
  return async (signal: string) => {
    if (stopping) { d.log.warn('Nhan tin hieu lan hai: thoat ngay'); d.exit(1); return; }
    stopping = true;
    d.log.log(`Nhan ${signal}, dang tat`);
    await step(() => d.closeHttp());
    await step(() => d.stopTimers());
    let lost = 0;
    await step(async () => { lost = await d.flush(FLUSH_ON_EXIT_MS); });
    if (lost > 0) d.log.warn(`Khong kip ghi ${lost} so do trong hang cho`);
    await step(() => d.endMqtt());
    await step(() => d.closeApp());
    d.exit(0);
  };
}
```

- [ ] **Step 3: Hoàn thiện `backend/src/main.ts`**

Thay thân `bootstrap()` sau `app.get(MqttService).start();` bằng:

```ts
  const stop = createShutdown({
    closeHttp: () => new Promise((r) => app.getHttpServer().close(() => r())),
    stopTimers: () => app.get(AnomalyService).stop(),
    flush: (ms) => app.get(IngestService).flush(ms),
    endMqtt: () => app.get(MqttService).end(),
    closeApp: () => app.close(),
    exit: (code) => process.exit(code),
    log,
  });
  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));
```

(import `createShutdown` từ `./shutdown`, `AnomalyService`, `IngestService`, `MqttService`.)

- [ ] **Step 4: Chạy test, kiểm tay S12**

Run: `npx jest; npm run build`
Expected: PASS toàn bộ Jest.

`npm run start`, đợi `CSDL san sang`, nhấn Ctrl+C một lần → log `Nhan SIGINT, dang tat`, tiến trình thoát. Ghi S12 vào RESULTS.md. Nếu không thấy log (Windows không gửi SIGINT qua `npm run`), chạy bằng `node dist/main.js` trực tiếp và ghi cách đó vào README.

- [ ] **Step 5: Viết `backend/README.md`**

Nội dung (tiếng Việt), đủ các mục:
1. **Cài đặt**: Node theo CLAUDE.md; `npm ci`; chép `.env.example` → `.env`, `.env.test.example` → `.env.test`; cách tạo `JWT_SECRET`/`AI_SERVICE_KEY` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`); mật khẩu dev của tài khoản seed ghi trong README database (không chép vào đây).
2. **Chạy**: `npm run build; npm run start` (`.env`); `ENV_FILE=.env.test` cho test; cổng 3000; health `http://localhost:3000/api/health`.
3. **Test**: `npm test` (Jest, không cần CSDL/MQTT); `npm run test:e2e`; `npm run test:contract` (Task 22) — **tắt backend dev và simulator trước; không chạy lúc đang demo hay tập demo** (spec 2.4).
4. **SP giả** (`test-support/fake-sps.sql`): chỉ cho `SwiftletCare_Dev` khi TV1 chưa giao SP.
5. **Kết quả bước kiểm chứng**: trỏ tới `spikes/RESULTS.md`.
6. **Thứ tự bật khi demo**: SQL Server → Mosquitto → simulator → backend → AI → web, mobile (spec 7.4).
7. **Log**: không chứa mật khẩu, khóa, token; không log body request.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/shutdown.ts backend/src/shutdown.spec.ts backend/src/main.ts backend/README.md backend/spikes/RESULTS.md
git commit -m "feat(backend): tắt êm ghi nốt lô số đo, Ctrl+C lần hai thoát ngay; README backend

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 22: Trình chạy test hợp đồng hộp đen (`npm run test:contract`)

**Điều kiện:** PR fixture của plan hợp đồng (Task 6) đã merge; PR bổ sung (Task 3) đã merge để có 4 fixture mới. Chưa merge PR bổ sung thì đưa 4 tên `rest/health.invalid-db-down`, `rest/houses-list.invalid-db-not-ready`, `rest/admin-anomalies-detect.invalid-*` khỏi danh sách đặc biệt (chúng chưa tồn tại) và chạy phần còn lại.

**Files:**
- Create: `backend/test-contract/lib/env.mjs`, `backend/test-contract/lib/sql.mjs`, `backend/test-contract/lib/precheck.mjs`, `backend/test-contract/lib/backend.mjs`, `backend/test-contract/lib/chain.mjs`, `backend/test-contract/lib/util.mjs`, `backend/test-contract/run.test.mjs`
- Modify: `backend/package.json` (script `test:contract`)

**Interfaces:**
- Consumes: `contracts/lib/fixtures.mjs` (`baseNow`, `expand`, `match`, `loadChain`, `FIXTURES_DIR`), backend đã build (`dist/main.js`), `.env.test`.
- Produces (cho Task 23, 24):
  - `util.mjs`: `sleep(ms)`, `waitFor(fn, timeoutMs, label)`, `signHs256(secret, payload)`.
  - `env.mjs`: `readEnvFile(path)`, `loadTestEnv(path = '.env.test')`.
  - `sql.mjs`: `sql(env, db, query): string[]`, `restore(env): number` (ms), `loadRefs(env): (kind, key) => number`, `bakExists(env): boolean`.
  - `backend.mjs`: `startBackend(env, overrides?) → { child, logs: string[], port }`, `waitHealth(port, status, timeoutMs)`, `stopBackend(b)`.
  - `precheck.mjs`: `precheck(env): Promise<void>` — build, backend dev đã tắt, Mosquitto, file backup; mỗi file test gọi trong `before` (`node --test` chạy file theo tên, `extras` trước `run`).
  - `chain.mjs`: `runChain(name, opts) → Promise<void>`, `transcript: { bodies: unknown[]; logs: string[] }`, `login(port, username, password)`.

- [ ] **Step 1: Tạo file backup dữ liệu mẫu (một lần mỗi máy, spec hợp đồng 4.3 quy tắc 12)**

```powershell
cd ..\database
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Database SwiftletCare_Test -Reset
sqlcmd -S localhost,1433 -U swiftlet_dev -d master -b -Q "BACKUP DATABASE SwiftletCare_Test TO DISK = N'SwiftletCare_Test_seed.bak' WITH INIT, COPY_ONLY;"
cd ..\backend
```

Ghi S11 (quyền, thời gian `RESTORE`) và S5 phần `RESTORE` vào `spikes/RESULTS.md`.

- [ ] **Step 2: Viết `backend/test-contract/lib/util.mjs`, `env.mjs`, `sql.mjs`**

`util.mjs`:

```js
import { createHmac } from 'node:crypto';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cho dieu kien, khong ngu co dinh (spec backend 7.2).
export async function waitFor(fn, timeoutMs, label) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await sleep(200);
  }
  throw new Error(`Qua ${timeoutMs} ms cho ${label}${last ? `: ${last.message}` : ''}`);
}

// Ky JWT HS256 tai cho cho chuoi "CSDL chua san sang" (khong dang nhap duoc).
export function signHs256(secret, payload) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${b({ alg: 'HS256', typ: 'JWT' })}.${b(payload)}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}
```

`env.mjs`:

```js
import { existsSync, readFileSync } from 'node:fs';

export function readEnvFile(path) {
  if (!existsSync(path)) throw new Error(`Thieu ${path}: chep tu ${path}.example roi dien gia tri`);
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return env;
}

// Chi doc .env.test, khong bao gio .env (spec backend 7.2).
export function loadTestEnv(path = '.env.test') {
  const env = readEnvFile(path);
  if (!/^[A-Za-z0-9_]+_Test$/.test(env.DB_NAME ?? '')) throw new Error('DB_NAME trong .env.test phai ket thuc bang _Test');
  const need = ['DB_SERVER', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'PORT', 'MQTT_URL', 'JWT_SECRET', 'AI_SERVICE_KEY', 'DEV_SEED_PASSWORD', 'SIM_MQTT_USERNAME', 'SIM_MQTT_PASSWORD'];
  for (const k of need) if (!env[k]) throw new Error(`Thieu ${k} trong .env.test`);
  return env;
}
```

`sql.mjs`:

```js
import { execFileSync } from 'node:child_process';

export function sql(env, db, query) {
  const out = execFileSync('sqlcmd', ['-S', `${env.DB_SERVER},${env.DB_PORT}`, '-U', env.DB_USER, '-d', db, '-b', '-I', '-h', '-1', '-W', '-Q', `SET NOCOUNT ON; ${query}`],
    { env: { ...process.env, SQLCMDPASSWORD: env.DB_PASSWORD }, encoding: 'utf8' });
  return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

export function bakExists(env) {
  try { sql(env, 'master', `RESTORE HEADERONLY FROM DISK = N'${env.DB_NAME}_seed.bak';`); return true; } catch { return false; }
}

// Nguyen van spec hop dong 4.3 quy tac 12; chay qua ket noi vao master.
export function restore(env) {
  const t = Date.now();
  const db = env.DB_NAME;
  sql(env, 'master', `ALTER DATABASE ${db} SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE ${db} FROM DISK = N'${db}_seed.bak' WITH REPLACE; ALTER DATABASE ${db} SET MULTI_USER;`);
  return Date.now() - t;
}

// {{ref:kind:key}} suy tu ma thiet bi (khong phu thuoc ten nha/khu vuc trong seed).
const REFS_SQL = `
SELECT 'device|' + Code + '|' + CAST(DeviceId AS VARCHAR(12)) FROM dbo.Devices
UNION ALL SELECT 'zone|' + LEFT(Code, LEN(Code) - 7) + '|' + CAST(ZoneId AS VARCHAR(12)) FROM dbo.Devices WHERE DeviceType = 'SENSOR'
UNION ALL SELECT 'house|' + LEFT(d.Code, CHARINDEX('-', d.Code) - 1) + '|' + CAST(z.HouseId AS VARCHAR(12))
  FROM dbo.Devices d JOIN dbo.Zones z ON z.ZoneId = d.ZoneId WHERE d.DeviceType = 'CAMERA'
UNION ALL SELECT 'user|' + Username + '|' + CAST(UserId AS VARCHAR(12)) FROM dbo.Users
UNION ALL SELECT 'alert|' + LEFT(d.Code, LEN(d.Code) - 7) + '-' + a.MetricCode + '|' + CAST(a.AlertId AS VARCHAR(12))
  FROM dbo.Alerts a JOIN dbo.Devices d ON d.ZoneId = a.ZoneId AND d.DeviceType = 'SENSOR'
  WHERE a.AlertType = 'THRESHOLD' AND a.Status <> 'RESOLVED';`;

export function loadRefs(env) {
  const map = new Map();
  for (const row of sql(env, env.DB_NAME, REFS_SQL)) {
    const [kind, key, id] = row.split('|');
    map.set(`${kind}:${key}`, Number(id));
  }
  return (kind, key) => {
    const id = map.get(`${kind}:${key}`);
    if (!id) throw new Error(`Khong tra duoc {{ref:${kind}:${key}}}`);
    return id;
  };
}
```

`precheck.mjs`:

```js
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import mqtt from 'mqtt';
import { bakExists } from './sql.mjs';

let done = false;

// Kiem truoc khi chay (spec backend 7.2); thieu thi dung, thong bao ro. Chay mot lan moi tien trinh test.
export async function precheck(env) {
  if (done) return;
  execSync('npm run build', { stdio: 'inherit' }); // khong test ma cu
  const dev = await fetch('http://localhost:3000/api/health').then(() => true, () => false);
  assert.equal(dev, false, 'Backend dev dang chay o cong 3000: tat backend dev va simulator truoc khi test (spec backend 2.4)');
  await new Promise((resolve, reject) => {
    const c = mqtt.connect(env.MQTT_URL, { clientId: 'contract-test-probe', username: env.SIM_MQTT_USERNAME, password: env.SIM_MQTT_PASSWORD, reconnectPeriod: 0, connectTimeout: 5000 });
    c.once('connect', () => { c.end(true); resolve(); });
    c.once('error', (e) => reject(new Error(`Mosquitto khong ket noi duoc bang tai khoan simulator: ${e.message}`)));
  });
  assert.ok(bakExists(env), `Chua co ${env.DB_NAME}_seed.bak: lam Task 22 Step 1 (spec hop dong 4.3 quy tac 12)`);
  done = true;
}
```

- [ ] **Step 3: Viết `backend/test-contract/lib/backend.mjs`**

```js
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sleep, waitFor } from './util.mjs';

// Ghi file .env tam (trong thu muc tam, xoa khi dung) roi chay node dist/main.js voi ENV_FILE.
export function startBackend(env, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sc-contract-'));
  const file = join(dir, 'backend.env');
  const merged = { ...env, ...overrides };
  writeFileSync(file, Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n'));
  const childEnv = { ...process.env, ENV_FILE: file, NODE_ENV: 'test' };
  for (const k of Object.keys(merged)) delete childEnv[k]; // khong de bien cua shell lan gia tri file
  const child = spawn(process.execPath, ['dist/main.js'], { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  const logs = [];
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  return { child, logs, port: Number(merged.PORT), dir };
}

export async function waitHealth(port, status, timeoutMs = 30_000) {
  return waitFor(async () => {
    const r = await fetch(`http://localhost:${port}/api/health`);
    const body = await r.json();
    return r.status === status && body.mqtt === 'connected' ? body : null;
  }, timeoutMs, `/api/health ${status}`);
}

// SIGINT, cho toi da 10 giay roi kill (spec backend 7.2). Tren Windows kill('SIGINT') co the ket thuc ngay.
export async function stopBackend(b) {
  if (b.child.exitCode === null) {
    const exited = new Promise((r) => b.child.once('exit', r));
    b.child.kill('SIGINT');
    const done = await Promise.race([exited.then(() => true), sleep(10_000).then(() => false)]);
    if (!done) b.child.kill('SIGKILL');
  }
  rmSync(b.dir, { recursive: true, force: true });
}
```

- [ ] **Step 4: Viết `backend/test-contract/lib/chain.mjs`**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mqtt from 'mqtt';
import { io } from 'socket.io-client';
import { FIXTURES_DIR, baseNow, expand, loadChain, match } from '../../../contracts/lib/fixtures.mjs';
import { sql } from './sql.mjs';
import { signHs256, sleep, waitFor } from './util.mjs';

export const transcript = { bodies: [], logs: [] };

export async function login(port, username, password) {
  const r = await fetch(`http://localhost:${port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(r.status, 200, `dang nhap ${username} that bai (${r.status})`);
  return (await r.json()).accessToken;
}

// So do mong luu sau moi fixture MQTT gui len (kiem tac dung phu, khong co "response").
const MQTT_EXPECT = {
  'mqtt/readings': [['H1-F1-SENSOR', 4]],
  'mqtt/readings.invalid-missing-z': [['H1-F1-SENSOR', 1]],
  'mqtt/readings.invalid-offset': [['H1-F1-SENSOR', 1]],
  'mqtt/readings.invalid-device-mismatch': [['H1-F1-SENSOR', 1], ['H1-F2-SENSOR', 0]],
  'mqtt/readings.invalid-not-array': [['H1-F1-SENSOR', 0]],
};

const countAt = (env, code, nowIso) => Number(sql(env, env.DB_NAME,
  `SELECT COUNT(*) FROM dbo.SensorReadings s JOIN dbo.Devices d ON d.DeviceId = s.DeviceId WHERE d.Code = '${code}' AND s.RecordedAt = CONVERT(DATETIME2(0), '${nowIso.slice(0, 19)}', 126)`)[0]);

const mqttConnect = (env, clientId) => new Promise((resolve, reject) => {
  const c = mqtt.connect(env.MQTT_URL, { clientId, username: env.SIM_MQTT_USERNAME, password: env.SIM_MQTT_PASSWORD, reconnectPeriod: 0 });
  c.once('connect', () => resolve(c));
  c.once('error', reject);
});

/**
 * Chay mot chuoi fixture tren backend dang chay. opts: { env, port, refs, localTokens?: boolean }
 * Ca chuoi dung mot "now" (bo sung hop dong B6).
 */
export async function runChain(name, opts) {
  const { env, port, refs } = opts;
  const chain = loadChain(name);
  const text = chain.map((c) => JSON.stringify(c.fixture)).join('\n');
  const users = [...new Set([...text.matchAll(/\{\{token:(\w+)\}\}/g)].map((m) => m[1]))];
  const tokens = new Map();
  for (const u of users) {
    tokens.set(u, opts.localTokens
      ? signHs256(env.JWT_SECRET, { sub: refs('user', u), role: 'X', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })
      : await login(port, u, env.DEV_SEED_PASSWORD));
  }
  const ctx = { now: baseNow(), ref: refs, token: (u) => tokens.get(u), serviceKey: env.AI_SERVICE_KEY, devPassword: env.DEV_SEED_PASSWORD };
  const nowIso = ctx.now.toISOString();

  // Nghe truoc roi moi gui tac nhan (spec backend 7.2).
  const events = [];
  const commands = [];
  const closers = [];
  if (chain.some((c) => c.name.startsWith('ws/'))) {
    const socket = io(`http://localhost:${port}`, { auth: { token: await login(port, 'admin', env.DEV_SEED_PASSWORD) }, transports: ['websocket'], reconnection: false });
    socket.onAny((ev, payload) => { events.push({ ev, payload, t: Date.now() }); transcript.bodies.push(payload); });
    await waitFor(() => socket.connected, 5000, 'socket ket noi');
    closers.push(() => socket.disconnect());
  }
  let pub = null;
  if (chain.some((c) => c.name.startsWith('mqtt/') && !c.fixture.topic.endsWith('/command'))) {
    pub = await mqttConnect(env, 'contract-test');
    closers.push(() => pub.end(true));
  }
  if (chain.some((c) => c.name.startsWith('mqtt/') && c.fixture.topic.endsWith('/command'))) {
    const sub = await mqttConnect(env, 'contract-test-sub');
    sub.on('message', (topic, payload, packet) => { if (!packet.retain) commands.push({ topic, payload: JSON.parse(String(payload)), t: Date.now() }); });
    await sub.subscribeAsync('swiftlet/devices/+/command', { qos: 1 });
    closers.push(() => sub.end(true));
  }

  try {
    let since = Date.now();
    for (const { name: step, fixture } of chain) {
      const f = expand(fixture, ctx);
      const folder = step.split('/')[0];
      if (folder === 'ws') {
        await expectOne(step, () => events.filter((e) => e.ev === f.event && e.t >= since), (e) => match(f.payload, e.payload));
      } else if (folder === 'mqtt' && f.topic.endsWith('/command')) {
        await expectOne(step, () => commands.filter((c) => c.topic === f.topic && c.t >= since), (c) => match(f.payload, c.payload));
      } else if (folder === 'mqtt') {
        since = Date.now();
        await pub.publishAsync(f.topic, JSON.stringify(f.payload), { qos: 1 });
        for (const [code, n] of MQTT_EXPECT[step] ?? []) {
          if (n === 0) { await sleep(3000); assert.equal(countAt(env, code, nowIso), 0, `${step}: ${code} khong duoc luu`); }
          else await waitFor(() => countAt(env, code, nowIso) === n, 5000, `${step}: ${code} luu ${n} so do`);
        }
      } else {
        since = Date.now();
        await http(step, f, port);
      }
    }
  } finally {
    for (const c of closers) c();
  }
}

async function expectOne(step, candidates, diff) {
  try {
    await waitFor(() => candidates().find((x) => diff(x).length === 0), 5000, step);
  } catch {
    const near = candidates().map(diff);
    assert.fail(`${step}: khong co su kien/tin khop trong 5 giay. ${near.length ? `Gan nhat: ${near[0].join('; ')}` : 'Khong nhan duoc gi.'}`);
  }
}

async function http(step, f, port) {
  const headers = { ...(f.headers ?? {}) };
  let body;
  if (f.body && typeof f.body === 'object' && !Array.isArray(f.body) && Object.values(f.body).some((v) => typeof v === 'string' && v.startsWith('@'))) {
    body = new FormData();
    for (const [k, v] of Object.entries(f.body)) {
      if (typeof v === 'string' && v.startsWith('@')) {
        const file = v.slice(1);
        body.append(k, new Blob([readFileSync(join(FIXTURES_DIR, step.split('/')[0], file))], { type: file.endsWith('.png') ? 'image/png' : 'image/jpeg' }), file);
      } else {
        body.append(k, typeof v === 'string' ? v : JSON.stringify(v)); // metadata gui dang chuoi JSON (B5)
      }
    }
  } else if (f.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(f.body);
  }
  const r = await fetch(`http://localhost:${port}${f.path}`, { method: f.method, headers, body });
  const raw = await r.text();
  let json;
  try { json = JSON.parse(raw); } catch { json = raw; }
  transcript.bodies.push(json);
  assert.equal(r.status, f.status, `${step}: HTTP ${r.status} (mong ${f.status}): ${raw.slice(0, 300)}`);
  assert.deepEqual(match(f.response, json), [], `${step}: phan hoi lech`);
}
```

- [ ] **Step 5: Viết `backend/test-contract/run.test.mjs`**

```js
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { FIXTURES_DIR, loadChain, loadFixture } from '../../contracts/lib/fixtures.mjs';
import { loadTestEnv } from './lib/env.mjs';
import { loadRefs, restore } from './lib/sql.mjs';
import { precheck } from './lib/precheck.mjs';
import { startBackend, stopBackend, waitHealth } from './lib/backend.mjs';
import { runChain, transcript } from './lib/chain.mjs';

const env = loadTestEnv();

// Fixture duoi ranh gioi cat: bo qua TUONG MINH, in trong bao cao. Lam muc 9/10 thi xoa khoi danh sach (spec 7.2).
const SKIP_CUT = ['mqtt/heartbeat.cut', 'ai/heartbeat.cut', 'rest/harvests-post.cut', 'rest/report-env-vs-yield.cut'];
// Chuoi chay voi backend tro CSDL toi cong khong ai nghe (PR hop dong Task 3).
const DB_DOWN = ['rest/health.invalid-db-down', 'rest/houses-list.invalid-db-not-ready'];

const all = ['rest', 'ws', 'mqtt', 'ai'].flatMap((d) => readdirSync(join(FIXTURES_DIR, d)).filter((f) => f.endsWith('.json')).map((f) => `${d}/${f.slice(0, -5)}`));
const referenced = new Set(all.map((n) => loadFixture(n).after).filter(Boolean));
const leaves = all.filter((n) => !referenced.has(n) && !SKIP_CUT.includes(n)).sort();
const ran = new Set();
const restoreTimes = [];

before(() => precheck(env));


for (const name of leaves) {
  test(`chuoi ${name}`, async () => {
    const dbDown = DB_DOWN.includes(name);
    if (!dbDown) restoreTimes.push(restore(env));
    const refs = loadRefs(env);
    const b = startBackend(env, dbDown ? { DB_PORT: '1' } : {});
    try {
      await waitHealth(b.port, dbDown ? 503 : 200);
      await runChain(name, { env, port: b.port, refs, localTokens: dbDown });
      for (const step of loadChain(name)) ran.add(step.name);
    } finally {
      await stopBackend(b);
      transcript.logs.push(...b.logs);
    }
  });
}

test('do phu fixture: moi file da chay, tru danh sach bo qua tuong minh', () => {
  console.log(`Bo qua (duoi ranh gioi cat): ${SKIP_CUT.join(', ') || '(khong)'}`);
  console.log(`Thoi gian RESTORE (ms): ${restoreTimes.join(', ')}`);
  assert.deepEqual(all.filter((n) => !ran.has(n) && !SKIP_CUT.includes(n)), []);
});

test('an toan du lieu tra ra (spec backend 7.2)', () => {
  const bodies = JSON.stringify(transcript.bodies);
  assert.doesNotMatch(bodies, /passwordHash|snapshotPath/i);
  const pascal = [];
  const walk = (v, path) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (/^[A-Z]/.test(k)) pascal.push(`${path}.${k}`); walk(x, `${path}.${k}`); }
  };
  walk(transcript.bodies, '$');
  assert.deepEqual(pascal, [], 'khoa PascalCase lot ra');
  for (const m of bodies.matchAll(/"message":"([^"]*)"/g)) assert.doesNotMatch(m[1], /SQL|constraint|statement|[A-Z]:\\\\|\/home\//i, `message lo chi tiet: ${m[1]}`);
  const logs = transcript.logs.join('');
  for (const k of ['AI_SERVICE_KEY', 'JWT_SECRET', 'DB_PASSWORD', 'MQTT_PASSWORD', 'SIM_MQTT_PASSWORD', 'DEV_SEED_PASSWORD']) {
    if (env[k]?.length >= 6) assert.ok(!logs.includes(env[k]), `log chua gia tri ${k}`);
  }
  assert.ok(!logs.includes('Bearer '), 'log chua token');
});

after(() => console.log(`Da chay ${ran.size}/${all.length} fixture`));
```

`backend/package.json` → `"test:contract": "node --test --test-concurrency=1 test-contract/"`.

- [ ] **Step 6: Chạy (máy đã tắt backend dev và simulator)**

Run: `npm run test:contract`
Expected: mọi chuỗi PASS; in "Bo qua (duoi ranh gioi cat): …", thời gian `RESTORE`; `do phu fixture` và `an toan du lieu` PASS.

Chuỗi lỗi → đọc thông báo `phan hoi lech` (danh sách đường lệch của `match`), sửa **backend**, không sửa fixture (fixture đổi phải qua PR hợp đồng). Tổng thời gian quá 15 phút do `RESTORE` → chỉ gom các chuỗi **chỉ đọc** (`rest/health`, `rest/house.invalid-not-owner`, `rest/auth-login*`, `rest/alerts-list.page`, `ai/ai.invalid-service-key`) vào một lần phục hồi, ghi danh sách gom vào plan này và RESULTS.md (spec 7.2 "chỉ gom khi chắc chắn").

**Danh sách đã gom (28/10/2026, máy nhóm 21,9 phút):** `rest/health`, `rest/house.invalid-not-owner`, `rest/auth-login`, `rest/auth-login.invalid-credentials`, `rest/alerts-list.page`, `ai/ai.invalid-service-key` — một lần phục hồi + một backend (`READ_ONLY` trong `run.test.mjs`).

Ghi kết quả `ParseArrayPipe` (Task 19, `bird-counts.invalid-missing-z` phải ra `fields: ["windowStart"]`).

- [ ] **Step 7: Commit**

```powershell
git add backend/test-contract backend/package.json backend/spikes/RESULTS.md
git commit -m "test(backend): trình chạy fixture hợp đồng hộp đen, phục hồi CSDL trước mỗi chuỗi, kiểm độ phủ và an toàn dữ liệu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 23: Test hộp đen ngoài fixture (DEVICE_OFFLINE, CSDL lỗi giữa chừng, cấu hình sai, endpoint admin, gửi trùng song song, Socket.IO, LAST_ADMIN đồng thời)

**Files:**
- Create: `backend/test-contract/extras.test.mjs`

**Interfaces:**
- Consumes: mọi hàm của `test-contract/lib/*` (Task 22).
- Produces: các ca hộp đen của spec backend 5.9, 6.5, 7.2 không có fixture.

- [ ] **Step 1: Viết `backend/test-contract/extras.test.mjs`**

```js
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, test } from 'node:test';
import mqtt from 'mqtt';
import { io } from 'socket.io-client';
import { FIXTURES_DIR } from '../../contracts/lib/fixtures.mjs';
import { loadTestEnv } from './lib/env.mjs';
import { loadRefs, restore, sql } from './lib/sql.mjs';
import { startBackend, stopBackend, waitHealth } from './lib/backend.mjs';
import { login } from './lib/chain.mjs';
import { precheck } from './lib/precheck.mjs';
import { signHs256, sleep, waitFor } from './lib/util.mjs';

const env = loadTestEnv();
const pw = env.DEV_SEED_PASSWORD;

async function withBackend(overrides, fn, { restoreDb = true, health = 200 } = {}) {
  if (restoreDb) restore(env);
  const b = startBackend(env, overrides);
  try {
    await waitHealth(b.port, health);
    return await fn(b, loadRefs(env));
  } finally {
    await stopBackend(b);
  }
}

const api = (port, token) => async (method, path, body) => {
  const r = await fetch(`http://localhost:${port}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const socketOf = (port, token) => new Promise((resolve, reject) => {
  const s = io(`http://localhost:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false });
  const events = [];
  s.onAny((ev, p) => events.push({ ev, p }));
  s.once('connect', () => resolve({ s, events }));
  s.once('connect_error', (e) => reject(Object.assign(new Error('connect_error'), { data: e.data })));
});

const simClient = (id) => new Promise((resolve, reject) => {
  const c = mqtt.connect(env.MQTT_URL, { clientId: id, username: env.SIM_MQTT_USERNAME, password: env.SIM_MQTT_PASSWORD, reconnectPeriod: 0 });
  c.once('connect', () => resolve(c));
  c.once('error', reject);
});

before(() => precheck(env));

test('DEVICE_OFFLINE tu nhip sp_DetectAnomalies (ANOMALY_SCHEDULER=on, toi da ~100 giay)', async () => {
  restore(env);
  // Cam bien ONLINE nhung LastSeenAt cu hon 5 phut -> nhip dau danh dau OFFLINE, trigger tao DEVICE_OFFLINE.
  sql(env, env.DB_NAME, "UPDATE dbo.Devices SET Status = 'ONLINE', LastSeenAt = DATEADD(MINUTE, -10, SYSUTCDATETIME()) WHERE Code = 'H1-F1-SENSOR';");
  await withBackend({ ANOMALY_SCHEDULER: 'on' }, async (b, refs) => {
    const { s, events } = await socketOf(b.port, await login(b.port, 'admin', pw));
    const t0 = Date.now();
    await waitFor(() => events.find((e) => e.ev === 'alert.created' && e.p.alert.alertType === 'DEVICE_OFFLINE' && e.p.alert.deviceId === refs('device', 'H1-F1-SENSOR')), 110_000, 'DEVICE_OFFLINE');
    console.log(`DEVICE_OFFLINE sau ${Math.round((Date.now() - t0) / 1000)} giay (ghi vao bao cao test)`);
    s.disconnect();
  }, { restoreDb: false });
});

test('CSDL loi khi dang gui so do (cau 6.6): du so do, khong ban ghi trung', async () => {
  await withBackend({}, async () => {
    const pub = await simClient('contract-test');
    const base = Date.now() - 120_000;
    const send = async (from, to) => {
      for (let i = from; i < to; i++) {
        const at = new Date(base + i * 1000).toISOString().slice(0, 19) + 'Z';
        await pub.publishAsync('swiftlet/devices/H1-F2-SENSOR/readings', JSON.stringify([{ device: 'H1-F2-SENSOR', metric: 'CO2', value: 600 + i, at }]), { qos: 1 });
        await sleep(100);
      }
    };
    await send(0, 20);
    sql(env, 'master', `ALTER DATABASE ${env.DB_NAME} SET OFFLINE WITH ROLLBACK IMMEDIATE;`);
    await send(20, 40);
    await sleep(5000);
    sql(env, 'master', `ALTER DATABASE ${env.DB_NAME} SET ONLINE;`);
    await send(40, 60);
    const count = () => Number(sql(env, env.DB_NAME, `SELECT COUNT(*) FROM dbo.SensorReadings s JOIN dbo.Devices d ON d.DeviceId = s.DeviceId WHERE d.Code = 'H1-F2-SENSOR' AND s.MetricCode = 'CO2' AND s.Value >= 600 AND s.Value < 660 AND s.RecordedAt >= CONVERT(DATETIME2(0), '${new Date(base).toISOString().slice(0, 19)}', 126)`)[0]);
    await waitFor(() => count() === 60, 90_000, 'du 60 so do sau khi CSDL ONLINE');
    pub.end(true);
  });
});

test('cau hinh sai -> dung ma khac 0, neu ten bien, khong in gia tri', async () => {
  for (const [k, v] of [['ANOMALY_SCHEDULER', 'maybe'], ['DEMO_TOOLS', 'yes'], ['JWT_SECRET', 'ngan-qua-123']]) {
    const b = startBackend(env, { [k]: v });
    const code = await new Promise((r) => b.child.once('exit', r));
    await stopBackend(b);
    const out = b.logs.join('');
    assert.notEqual(code, 0, `${k}=${v} phai lam backend dung`);
    assert.match(out, new RegExp(k));
    assert.ok(!out.includes(v), `log chua gia tri sai cua ${k}`);
  }
});

test('endpoint admin (DEMO_TOOLS=true): POPULATION_DROP H2, alert.created, lan hai rong', async () => {
  await withBackend({ DEMO_TOOLS: 'true' }, async (b, refs) => {
    const token = await login(b.port, 'admin', pw);
    const { s, events } = await socketOf(b.port, token);
    const call = api(b.port, token);
    const r1 = await call('POST', '/api/admin/anomalies/detect', { nowUtc: '2026-10-12T13:30:00Z' });
    assert.equal(r1.status, 200);
    const drop = r1.body.newAlerts.find((a) => a.alertType === 'POPULATION_DROP');
    assert.ok(drop && drop.houseId === refs('house', 'H2'), 'phai co POPULATION_DROP cho H2');
    assert.equal(Date.parse(drop.createdAt), Date.parse('2026-10-12T13:30:00Z'), 'createdAt = nowUtc');
    await waitFor(() => events.find((e) => e.ev === 'alert.created' && e.p.alert.alertId === drop.alertId), 5000, 'alert.created');
    const r2 = await call('POST', '/api/admin/anomalies/detect', { nowUtc: '2026-10-12T13:30:00Z' });
    assert.deepEqual(r2.body, { newAlerts: [] });
    s.disconnect();
  });
});

test('gui cung su kien thien dich hai lan song song (spec 5.9): mot canh bao, khong file tam', async () => {
  await withBackend({}, async (b) => {
    const at = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().slice(0, 19) + 'Z';
    const send = () => {
      const fd = new FormData();
      fd.append('metadata', JSON.stringify({ camera: 'H1-F0-CAMERA', class: 'owl', confidence: 0.9, at }));
      fd.append('image', new Blob([readFileSync(join(FIXTURES_DIR, 'ai', 'snake.jpg'))], { type: 'image/jpeg' }), 'snake.jpg');
      return fetch(`http://localhost:${b.port}/api/ai/predator-detections`, { method: 'POST', headers: { 'X-Service-Key': env.AI_SERVICE_KEY }, body: fd }).then((r) => r.json());
    };
    const rs = await Promise.all([send(), send()]);
    assert.deepEqual(rs.map((r) => r.created).sort(), [false, true]);
    assert.ok(rs.some((r) => r.skipReason === 'COOLDOWN'));
    assert.deepEqual(existsSync('storage/tmp') ? readdirSync('storage/tmp') : [], []);
  });
});

test('Socket.IO: token sai UNAUTHENTICATED, cach ly chu nha, bi khoa thi bi ngat, ADMIN nhan nha moi tao', async () => {
  await withBackend({}, async (b, refs) => {
    await assert.rejects(socketOf(b.port, 'sai'), (e) => e.data?.code === 'UNAUTHENTICATED');
    const admin = await login(b.port, 'admin', pw);
    const a = await socketOf(b.port, admin);
    const o2 = await socketOf(b.port, await login(b.port, 'owner2', pw));
    const o1 = await socketOf(b.port, await login(b.port, 'owner1', pw));
    // Cach ly: so do H1 -> owner2 khong nhan.
    const pub = await simClient('contract-test');
    const at = new Date().toISOString().slice(0, 19) + 'Z';
    await pub.publishAsync('swiftlet/devices/H1-F1-SENSOR/readings', JSON.stringify([{ device: 'H1-F1-SENSOR', metric: 'TEMP', value: 28, at }]), { qos: 1 });
    await waitFor(() => o1.events.find((e) => e.ev === 'readings.new'), 5000, 'owner1 nhan readings.new');
    await sleep(1000);
    assert.equal(o2.events.filter((e) => e.p?.houseId === refs('house', 'H1')).length, 0, 'owner2 khong duoc nhan su kien H1');
    // ADMIN ket noi TRUOC khi nha moi duoc tao van nhan su kien cua nha do.
    const call = api(b.port, admin);
    const h = await call('POST', '/api/houses', { name: 'Nha test socket', ownerId: refs('user', 'owner2') });
    assert.equal(h.status, 201);
    const z = await call('POST', `/api/houses/${h.body.houseId}/zones`, { name: 'F9', floorNo: 9 });
    const d = await call('POST', `/api/zones/${z.body.zoneId}/devices`, { code: 'HT-F9-FAN', name: 'Quat test', deviceType: 'FAN' });
    await call('POST', `/api/devices/${d.body.deviceId}/control`, { isOn: true, level: 50, mode: 'MANUAL' });
    await waitFor(() => a.events.find((e) => e.ev === 'device.state' && e.p.houseId === h.body.houseId), 5000, 'ADMIN nhan device.state nha moi');
    // Su kien trong luc nha ngung dung khong duoc phat bu khi dung lai.
    await call('PATCH', `/api/houses/${h.body.houseId}`, { isActive: false });
    await call('POST', `/api/devices/${d.body.deviceId}/control`, { isOn: false, mode: 'MANUAL' });
    await call('PATCH', `/api/houses/${h.body.houseId}`, { isActive: true });
    await sleep(1000);
    assert.equal(a.events.filter((e) => e.ev === 'device.state' && e.p.deviceId === d.body.deviceId && e.p.isOn === false).length, 0, 'khong phat bu');
    // Khoa owner1 -> socket cua owner1 bi ngat.
    const disconnected = new Promise((r) => o1.s.once('disconnect', r));
    await call('PATCH', `/api/users/${refs('user', 'owner1')}`, { isActive: false });
    await Promise.race([disconnected, sleep(5000).then(() => assert.fail('owner1 khong bi ngat'))]);
    for (const x of [a, o2]) x.s.disconnect();
    pub.end(true);
  });
});

test('Socket.IO: CSDL chua san sang -> connect_error.data.code = RETRY_LATER', async () => {
  const refs = loadRefs(env);
  await withBackend({ DB_PORT: '1' }, async (b) => {
    const token = signHs256(env.JWT_SECRET, { sub: refs('user', 'owner1'), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 });
    await assert.rejects(socketOf(b.port, token), (e) => e.data?.code === 'RETRY_LATER');
  }, { restoreDb: false, health: 503 });
});

test('LAST_ADMIN: hai ADMIN ha nhau dong thoi -> mot 200, mot 409, con it nhat mot ADMIN', async () => {
  await withBackend({}, async (b, refs) => {
    const admin = await login(b.port, 'admin', pw);
    const c = await api(b.port, admin)('POST', '/api/users', { username: 'admin2', password: 'mat-khau-admin2', fullName: 'Admin 2', email: 'admin2@swiftletcare.local', role: 'ADMIN' });
    assert.equal(c.status, 201);
    const admin2 = await login(b.port, 'admin2', 'mat-khau-admin2');
    const [r1, r2] = await Promise.all([
      api(b.port, admin)('PATCH', `/api/users/${c.body.userId}`, { role: 'OWNER' }),
      api(b.port, admin2)('PATCH', `/api/users/${refs('user', 'admin')}`, { role: 'OWNER' }),
    ]);
    assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
    assert.equal([r1, r2].find((r) => r.status === 409).body.error.code, 'LAST_ADMIN');
    assert.ok(Number(sql(env, env.DB_NAME, "SELECT COUNT(*) FROM dbo.Users WHERE Role = 'ADMIN' AND IsActive = 1")[0]) >= 1);
  });
});
```

Ca "CSDL chưa sẵn sàng → health 503, endpoint 503" đã có trong fixture (`DB_DOWN`, Task 22). Ca LAST_ADMIN có thể ra `[200, 200]` nếu hai request không chồng nhau thật sự (máy nhanh); chạy lại 3 lần, vẫn `[200, 200]` thì thêm `WAITFOR DELAY '00:00:01'` **tạm** sau câu `SELECT COUNT(*)` trong `users.service.ts` để kiểm, rồi gỡ ra (ghi vào RESULTS.md).

- [ ] **Step 2: Chạy**

Run: `npm run test:contract`
Expected: `run.test.mjs` và `extras.test.mjs` PASS; log in "DEVICE_OFFLINE sau N giay" — ghi N vào báo cáo test. Nếu `ALTER DATABASE … SET OFFLINE` không chạy được bằng tài khoản test (S11) thì đổi ca 6.6 thành Jest với SP giả ném lỗi kết nối (đã có ở Task 15) và ghi lý do vào RESULTS.md.

- [ ] **Step 3: Commit**

```powershell
git add backend/test-contract/extras.test.mjs backend/spikes/RESULTS.md
git commit -m "test(backend): ca hộp đen DEVICE_OFFLINE, CSDL lỗi giữa chừng, cấu hình sai, admin, gửi trùng, Socket.IO, LAST_ADMIN

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 24: Script đo độ trễ (câu 7) — `backend/scripts/measure-latency.mjs`

**Files:**
- Create: `backend/scripts/latency-lib.mjs`, `backend/scripts/latency-lib.test.mjs`, `backend/scripts/measure-latency.mjs`, `backend/results/.gitkeep`

**Interfaces:**
- Consumes: `readEnvFile` (Task 22), backend dev đang chạy, simulator đang chạy (spec simulator), Socket.IO, REST.
- Produces: `latency-lib.mjs`: `percentile(values: number[], p: number): number`, `summarize(values: number[], targetMs: number): { n: number; p50: number; p95: number; max: number; overTarget: number }`, `toCsv(rows: Array<{ kind: string; zone: string; ms: number | ''; status: string }>): string`. CSV + tóm tắt trong `backend/results/latency-<yyyyMMdd-HHmm>.csv`.

- [ ] **Step 1: Viết test (phải fail)**

`backend/scripts/latency-lib.test.mjs`:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { percentile, summarize, toCsv } from './latency-lib.mjs';

test('percentile theo hang gan nhat', () => {
  const v = [5, 1, 4, 2, 3];
  assert.equal(percentile(v, 50), 3);
  assert.equal(percentile(v, 95), 5);
  assert.equal(percentile([7], 95), 7);
});

test('summarize: so mau, p50, p95, max, ty le vuot chi tieu; mang rong khong loi', () => {
  assert.deepEqual(summarize([100, 200, 3000, 400], 2000), { n: 4, p50: 200, p95: 3000, max: 3000, overTarget: 0.25 });
  assert.deepEqual(summarize([], 2000), { n: 0, p50: 0, p95: 0, max: 0, overTarget: 0 });
});

test('toCsv: dong tieu de, mau mat de trong ms', () => {
  assert.equal(toCsv([{ kind: 'alert', zone: 'H1-F1', ms: '', status: 'mat' }]), 'kind,zone,ms,status\nalert,H1-F1,,mat\n');
});
```

Run: `node --test scripts/`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/scripts/latency-lib.mjs`**

```js
export function percentile(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

export function summarize(values, targetMs) {
  if (!values.length) return { n: 0, p50: 0, p95: 0, max: 0, overTarget: 0 };
  return { n: values.length, p50: percentile(values, 50), p95: percentile(values, 95), max: Math.max(...values), overTarget: values.filter((v) => v > targetMs).length / values.length };
}

export function toCsv(rows) {
  return ['kind,zone,ms,status', ...rows.map((r) => `${r.kind},${r.zone},${r.ms},${r.status}`)].join('\n') + '\n';
}
```

- [ ] **Step 3: Viết `backend/scripts/measure-latency.mjs`**

```js
// Do do tre (spec backend 7.3). Chi chay tren SwiftletCare_Dev; simulator, backend, Mosquitto, SQL Server cung mot may.
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import mqtt from 'mqtt';
import { io } from 'socket.io-client';
import { readEnvFile } from '../test-contract/lib/env.mjs';
import { sleep } from '../test-contract/lib/util.mjs';
import { summarize, toCsv } from './latency-lib.mjs';

const env = readEnvFile('.env');
if (env.DB_NAME !== 'SwiftletCare_Dev') { console.error('Tu choi: chi do tren SwiftletCare_Dev (DB_NAME trong .env)'); process.exit(2); }
const secrets = readEnvFile('.env.test'); // chi lay SIM_MQTT_*, DEV_SEED_PASSWORD
const BASE = `http://localhost:${env.PORT}`;
const TARGET_MS = 2000;
const READINGS_SECONDS = Number(process.argv[2] ?? 120);
const ALERT_SAMPLES = Number(process.argv[3] ?? 20);

const post = (path, body, token) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }).then((r) => r.json());
const get = (path, token) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
const isoSec = (ms) => new Date(Math.floor(ms / 1000) * 1000).toISOString().slice(0, 19) + 'Z';

const { accessToken: token } = await post('/api/auth/login', { username: 'admin', password: secrets.DEV_SEED_PASSWORD });
const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
await new Promise((r) => socket.once('connect', r));
const rows = [];

// 1. So do: thoi diem nhan readings.new tru at (at do simulator gan -> gom ca 1 giay gom lo).
const readingMs = [];
socket.on('readings.new', (e) => { const now = Date.now(); for (const r of e.readings) readingMs.push(now - Date.parse(r.at)); });
console.log(`Do so do trong ${READINGS_SECONDS} giay (simulator phai dang chay)...`);
await sleep(READINGS_SECONDS * 1000);
socket.off('readings.new');
for (const ms of readingMs) rows.push({ kind: 'reading', zone: '', ms, status: 'ok' });

// 2. Canh bao: tu publish so do vuot nguong, ghep alert.created cung khu vuc + chi so; dong canh bao truoc mau ke tiep.
const pub = mqtt.connect(env.MQTT_URL, { clientId: 'latency-probe', username: secrets.SIM_MQTT_USERNAME, password: secrets.SIM_MQTT_PASSWORD });
await new Promise((r) => pub.once('connect', r));
const houses = await get('/api/houses', token);
const zones = [];
for (const h of houses) for (const d of await get(`/api/houses/${h.houseId}/devices`, token)) if (d.deviceType === 'SENSOR') zones.push({ zoneId: d.zoneId, code: d.code });
const alertMs = [];
for (let i = 0; i < ALERT_SAMPLES; i++) {
  const z = zones[i % zones.length];
  const th = (await get(`/api/zones/${z.zoneId}/thresholds`, token)).find((t) => t.metricCode === 'TEMP');
  if (!th?.maxValue) continue;
  const sentAt = Date.now();
  const opened = new Promise((resolve) => {
    const h = (e) => { if (e.alert.zoneId === z.zoneId && e.alert.metricCode === 'TEMP') { socket.off('alert.created', h); resolve(e.alert); } };
    socket.on('alert.created', h);
    setTimeout(() => { socket.off('alert.created', h); resolve(null); }, 10_000);
  });
  await pub.publishAsync(`swiftlet/devices/${z.code}/readings`, JSON.stringify([{ device: z.code, metric: 'TEMP', value: th.maxValue + 1.5, at: isoSec(sentAt) }]), { qos: 1 });
  const alert = await opened;
  if (!alert) { rows.push({ kind: 'alert', zone: z.code, ms: '', status: 'mat' }); continue; }
  const ms = Date.now() - Math.floor(sentAt / 1000) * 1000;
  alertMs.push(ms);
  rows.push({ kind: 'alert', zone: z.code, ms, status: 'ok' });
  // Dong: so do trong vung dong (qua vung tre) roi cho alert.updated.
  const closed = new Promise((resolve) => {
    const h = (e) => { if (e.alertId === alert.alertId) { socket.off('alert.updated', h); resolve(true); } };
    socket.on('alert.updated', h);
    setTimeout(() => { socket.off('alert.updated', h); resolve(false); }, 10_000);
  });
  await sleep(1100);
  await pub.publishAsync(`swiftlet/devices/${z.code}/readings`, JSON.stringify([{ device: z.code, metric: 'TEMP', value: th.targetValue ?? th.maxValue - 2, at: isoSec(Date.now()) }]), { qos: 1 });
  if (!(await closed)) console.warn(`Canh bao ${alert.alertId} chua dong sau 10 giay, khu vuc ke tiep co the bi anh huong`);
}
pub.end(true);
socket.disconnect();

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
const machine = `${os.cpus()[0]?.model} x${os.cpus().length}, RAM ${Math.round(os.totalmem() / 2 ** 30)} GB, Windows ${os.release()}, Node ${process.version}`;
const sr = summarize(readingMs, TARGET_MS);
const sa = summarize(alertMs, TARGET_MS);
const summary = [
  `# May: ${machine}`,
  `# So do: n=${sr.n} p50=${sr.p50} p95=${sr.p95} max=${sr.max} vuot ${TARGET_MS} ms: ${(sr.overTarget * 100).toFixed(1)}% (gom ca 1 giay gom lo)`,
  `# Canh bao: n=${sa.n} p50=${sa.p50} p95=${sa.p95} max=${sa.max} vuot ${TARGET_MS} ms: ${(sa.overTarget * 100).toFixed(1)}%; mat: ${rows.filter((r) => r.status === 'mat').length}`,
].join('\n');
mkdirSync('results', { recursive: true });
writeFileSync(`results/latency-${stamp}.csv`, `${summary}\n${toCsv(rows)}`);
console.log(summary);
```

`package.json` → `"measure:latency": "node scripts/measure-latency.mjs"`; `"test"` giữ Jest; thêm `"test:scripts": "node --test scripts/"`.

- [ ] **Step 4: Chạy test thuần, rồi đo thật**

Run: `npm run test:scripts`
Expected: PASS 3 test.

Đo thật (máy demo, spec 7.4): bật SQL Server → Mosquitto → simulator → backend (`.env` trỏ `SwiftletCare_Dev`), rồi `npm run measure:latency -- 120 20`. Expected: in 3 dòng tóm tắt, có file `results/latency-*.csv`. Báo cáo ghi rõ: số đo gồm 1 giây gom lô; chưa đo mobile và thông báo đẩy (hạn chế 10).

- [ ] **Step 5: Commit**

```powershell
git add backend/scripts backend/results backend/package.json
git commit -m "feat(backend): script đo độ trễ số đo và cảnh báo, kết quả CSV cho báo cáo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 25 (dưới ranh giới cắt, mục 9 của backend): Thu hoạch và báo cáo sản lượng

**Chỉ làm khi Task 1–24 xong** và nhóm quyết giữ mục 9 ở M3 (01/11).

**Files:**
- Create: `backend/src/harvests/dto.ts`, `backend/src/harvests/harvests.controller.ts`, `backend/src/harvests/harvests.controller.spec.ts`, `backend/src/harvests/harvests.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `HarvestsModule`), `backend/test-contract/run.test.mjs` (xóa `rest/harvests-post.cut`, `rest/report-env-vs-yield.cut` khỏi `SKIP_CUT`)

**Interfaces:**
- Consumes: `pickers.harvest`, `serialize` (Task 5), `SpService.reportEnvVsYield` (Task 6), `VnRangeQuery`, `assertVnRange` (Task 17), `IsVnDate` (Task 4).
- Produces: `GET/POST /api/zones/:zoneId/harvests` (POST 201), `GET /api/houses/:houseId/reports/env-vs-yield?fromVnDate=&toVnDate=`.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/harvests/harvests.controller.spec.ts`:

```ts
import { HarvestsController } from './harvests.controller';

const U = { userId: 2, role: 'OWNER' as const, username: 'owner1', exp: 0 };

describe('HarvestsController', () => {
  const create = jest.fn(async ({ data }) => ({ HarvestId: 1, CreatedAt: new Date(0), ...data }));
  const db = { prisma: { harvests: { create, findMany: jest.fn(async () => []) } } };
  const sp = { reportEnvVsYield: jest.fn(async () => [{ ZoneId: 2, ZoneName: 'F1', MonthVn: '2026-09', AvgTemp: null, StdevTemp: null, AvgHumid: null, StdevHumid: null, PctInRange: null, NestCount: 120, WeightGram: 950.5 }]) };
  const c = new HarvestsController(db as never, sp as never);

  it('POST: ngay VN giu la ngay (khong lech mui gio), RecordedBy tu JWT', async () => {
    const r = await c.create(2, { harvestDate: '2026-09-15', nestCount: 120, weightGram: 950.5, grade: 'A' }, U);
    expect(create.mock.calls[0][0].data).toMatchObject({ ZoneId: 2, HarvestDate: new Date('2026-09-15T00:00:00Z'), RecordedBy: 2 });
    expect(r).toMatchObject({ harvestDate: '2026-09-15', recordedBy: 2, grade: 'A' });
  });

  it('bao cao: chuoi ngay VN qua SP nguyen van, cot camelCase dung fixture', async () => {
    const r = await c.report(1, { fromVnDate: '2026-09-01', toVnDate: '2026-10-01' });
    expect(sp.reportEnvVsYield).toHaveBeenCalledWith(1, '2026-09-01', '2026-10-01');
    expect(Object.keys(r[0] as object)).toEqual(['zoneId', 'zoneName', 'monthVn', 'avgTemp', 'stdevTemp', 'avgHumid', 'stdevHumid', 'pctInRange', 'nestCount', 'weightGram']);
  });
});
```

Run: `npx jest src/harvests`
Expected: FAIL.

- [ ] **Step 2: Viết DTO, controller, module**

`backend/src/harvests/dto.ts`:

```ts
import { IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { IsVnDate } from '../common/validation';

export class CreateHarvestDto {
  @IsVnDate() harvestDate!: string;
  @IsInt() @Min(0) nestCount!: number;
  @IsNumber() @Min(0) weightGram!: number;
  @IsOptional() @IsIn(['A', 'B', 'C']) grade?: 'A' | 'B' | 'C' | null;
}
```

`backend/src/harvests/harvests.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators';
import * as pick from '../common/pickers';
import { serialize } from '../common/serialize';
import { DbService } from '../db/db.service';
import { SpService } from '../db/sp';
import { VnRangeQuery, assertVnRange } from '../readings/dto';
import { CreateHarvestDto } from './dto';

@Controller()
export class HarvestsController {
  constructor(private readonly db: DbService, private readonly sp: SpService) {}

  @Get('zones/:zoneId/harvests')
  async list(@Param('zoneId', ParseIntPipe) zoneId: number) {
    return (await this.db.prisma.harvests.findMany({ where: { ZoneId: zoneId }, orderBy: { HarvestDate: 'desc' } })).map(pick.harvest);
  }

  // Harvests khong co trigger -> Prisma create duoc; HarvestDate la ngay VN (cot DATE), luu nguyen ngay.
  @Post('zones/:zoneId/harvests')
  async create(@Param('zoneId', ParseIntPipe) zoneId: number, @Body() dto: CreateHarvestDto, @CurrentUser() u: AuthUser) {
    const h = await this.db.prisma.harvests.create({
      data: { ZoneId: zoneId, HarvestDate: new Date(`${dto.harvestDate}T00:00:00Z`), NestCount: dto.nestCount, WeightGram: dto.weightGram, Grade: dto.grade ?? null, RecordedBy: u.userId },
    });
    return pick.harvest(h);
  }

  @Get('houses/:houseId/reports/env-vs-yield')
  async report(@Param('houseId', ParseIntPipe) houseId: number, @Query() q: VnRangeQuery) {
    assertVnRange(q);
    return (await this.sp.reportEnvVsYield(houseId, q.fromVnDate, q.toVnDate)).map((r) => serialize(r));
  }
}
```

`backend/src/harvests/harvests.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HarvestsController } from './harvests.controller';

@Module({ controllers: [HarvestsController] })
export class HarvestsModule {}
```

Tên cột kết quả `sp_Report_EnvStabilityVsYield` lấy theo database-core (`ZoneId, ZoneName, MonthVn, AvgTemp, …`); nếu SP thật trả tên khác (VD `Month`), đổi tên trong `report()` cho khớp fixture `report-env-vs-yield.cut` thay vì sửa fixture.

- [ ] **Step 3: Chạy test, bật fixture**

`app.module.ts`: thêm `HarvestsModule`. `run.test.mjs`: xóa hai tên `rest/harvests-post.cut`, `rest/report-env-vs-yield.cut` khỏi `SKIP_CUT`.

Run: `npx jest src/harvests; npm run test:contract`
Expected: PASS, hai fixture `.cut` chạy và đạt.

- [ ] **Step 4: Commit**

```powershell
git add backend/src/harvests backend/src/app.module.ts backend/test-contract/run.test.mjs
git commit -m "feat(backend): thu hoạch và báo cáo môi trường - sản lượng (dưới ranh giới cắt)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 26 (dưới ranh giới cắt, mục 10 của backend): Heartbeat MQTT và HTTP → `sp_RecordHeartbeat`

**Chỉ làm khi** Task 1–24 xong, mục 11 của database-core (`sp_RecordHeartbeat`, `trg_Devices_Status`) **không bị cắt**, và nhóm quyết giữ mục 10. Cắt mục 11 database-core thì cắt luôn task này (spec 1.2).

**Files:**
- Create: `backend/src/mqtt/heartbeat.service.ts`, `backend/src/mqtt/heartbeat.service.spec.ts`
- Modify: `backend/src/mqtt/mqtt.module.ts` (thêm `HeartbeatService`), `backend/src/ai/ai.controller.ts`, `backend/src/ai/dto.ts` (endpoint `POST /api/ai/heartbeat`), `backend/test-contract/lib/chain.mjs` (kiểm `mqtt/heartbeat.cut`), `backend/test-contract/run.test.mjs` (xóa `mqtt/heartbeat.cut`, `ai/heartbeat.cut` khỏi `SKIP_CUT`)

**Interfaces:**
- Consumes: `SpService.recordHeartbeat`, `HeartbeatItem` (Task 6), `IngestService.emitResolved` (Task 15), `MqttService.onHeartbeat` (Task 13), `isUtcIso` (Task 4).
- Produces: `validateHeartbeat(code: string, payload: Buffer): HeartbeatItem | null`, `HeartbeatService` (`receive`, `tick`); `POST /api/ai/heartbeat` → `{accepted, rejected}`.

- [ ] **Step 1: Viết test (phải fail)**

`backend/src/mqtt/heartbeat.service.spec.ts`:

```ts
import { HeartbeatService, validateHeartbeat } from './heartbeat.service';

const AT = '2026-10-12T10:40:07Z';
const buf = (o: unknown) => Buffer.from(JSON.stringify(o));

describe('validateHeartbeat', () => {
  it.each([
    [{ device: 'H1-F1-FAN', at: AT }, true], [{ device: 'H1-F2-FAN', at: AT }, false], [{ device: 'H1-F1-FAN', at: '2026-10-12T10:40:07' }, false], [[], false],
  ])('%j -> hop le %s', (p, ok) => expect(validateHeartbeat('H1-F1-FAN', buf(p)) !== null).toBe(ok));
});

describe('HeartbeatService', () => {
  it('gom cung nhip, goi sp_RecordHeartbeat, phat alert.updated; loi thi bo, khong thu lai', async () => {
    const recordHeartbeat = jest.fn().mockResolvedValueOnce({ accepted: 2, rejected: 0, resolvedAlertIds: [5] }).mockRejectedValueOnce(new Error('x'));
    const ingest = { emitResolved: jest.fn(async () => undefined) };
    const svc = new HeartbeatService({ isReady: () => true } as never, { recordHeartbeat } as never, ingest as never, { onHeartbeat: jest.fn() } as never);
    svc.receive('H1-F1-FAN', buf({ device: 'H1-F1-FAN', at: AT }));
    svc.receive('H1-F2-FAN', buf({ device: 'H1-F2-FAN', at: AT }));
    await svc.tick();
    expect(recordHeartbeat).toHaveBeenCalledWith([{ device: 'H1-F1-FAN', at: AT }, { device: 'H1-F2-FAN', at: AT }]);
    expect(ingest.emitResolved).toHaveBeenCalledWith([5]);
    svc.receive('H1-F1-FAN', buf({ device: 'H1-F1-FAN', at: AT }));
    await svc.tick();
    await svc.tick();
    expect(recordHeartbeat).toHaveBeenCalledTimes(2);
  });
});
```

Run: `npx jest src/mqtt/heartbeat`
Expected: FAIL.

- [ ] **Step 2: Viết `backend/src/mqtt/heartbeat.service.ts`**

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { isUtcIso } from '../common/validation';
import { DbService } from '../db/db.service';
import { HeartbeatItem, SpService } from '../db/sp';
import { IngestService } from './ingest.service';
import { MqttService } from './mqtt.service';

export function validateHeartbeat(code: string, payload: Buffer): HeartbeatItem | null {
  try {
    const p = JSON.parse(payload.toString('utf8'));
    return p && typeof p === 'object' && !Array.isArray(p) && p.device === code && isUtcIso(p.at) ? { device: p.device, at: p.at } : null;
  } catch {
    return null;
  }
}

// Hang cho rieng, cung nhip 1 giay; loi thi bo, khong thu lai (mat mot nhip vo hai, hop dong 2.2).
@Injectable()
export class HeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Heartbeat');
  private queue: HeartbeatItem[] = [];
  private busy = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly db: DbService, private readonly sp: SpService, private readonly ingest: IngestService, private readonly mqtt: MqttService) {}

  onModuleInit(): void {
    this.mqtt.onHeartbeat((code, payload) => this.receive(code, payload)); // co handler -> MqttService subscribe heartbeat
    this.timer = setInterval(() => void this.tick(), 1000);
  }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  receive(code: string, payload: Buffer): void {
    const item = validateHeartbeat(code, payload);
    if (item) this.queue.push(item);
  }

  async tick(): Promise<void> {
    if (this.busy || !this.queue.length || !this.db.isReady()) return;
    this.busy = true;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const r = await this.sp.recordHeartbeat(batch);
      await this.ingest.emitResolved(r.resolvedAlertIds);
    } catch (e) {
      this.log.warn(`Bo ${batch.length} heartbeat: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }
}
```

Thêm `HeartbeatService` vào `providers` của `MqttModule`. **Đăng ký phải xảy ra trước `MqttService.start()`** (`onModuleInit` chạy trước `main.ts` gọi `start()`), để lần kết nối đầu đã subscribe topic heartbeat.

- [ ] **Step 3: Endpoint `POST /api/ai/heartbeat`**

`backend/src/ai/dto.ts` thêm:

```ts
export class HeartbeatDto {
  @Matches(CODE_RE) device!: string;
  @IsUtcIso() at!: string;
}
```

`backend/src/ai/ai.controller.ts` thêm (constructor nhận thêm `IngestService`):

```ts
  @Post('heartbeat') @HttpCode(200)
  async heartbeat(@Body() dto: HeartbeatDto) {
    const r = await this.sp.recordHeartbeat([{ device: dto.device, at: dto.at }]);
    await this.ingest.emitResolved(r.resolvedAlertIds);
    return { accepted: r.accepted, rejected: r.rejected };
  }
```

Sửa `ai.controller.spec.ts`: `new AiController(sp, db, rt, {} as never, { emitResolved: jest.fn() } as never)`.

- [ ] **Step 4: Bật fixture `.cut`**

`test-contract/lib/chain.mjs`, trong nhánh `folder === 'mqtt'` sau `publishAsync`, thêm:

```js
        if (step === 'mqtt/heartbeat.cut') {
          await waitFor(() => sql(env, env.DB_NAME, `SELECT CASE WHEN LastSeenAt >= CONVERT(DATETIME2(0), '${nowIso.slice(0, 19)}', 126) THEN 1 ELSE 0 END FROM dbo.Devices WHERE Code = 'H1-F1-FAN'`)[0] === '1', 5000, 'LastSeenAt cap nhat');
        }
```

`run.test.mjs`: xóa `mqtt/heartbeat.cut`, `ai/heartbeat.cut` khỏi `SKIP_CUT`.

Run: `npx jest; npm run test:contract`
Expected: PASS, hai fixture heartbeat chạy và đạt.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/mqtt backend/src/ai backend/test-contract
git commit -m "feat(backend): heartbeat MQTT và HTTP gọi sp_RecordHeartbeat, tự đóng DEVICE_OFFLINE (dưới ranh giới cắt)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Kiểm tra cuối cùng (trước khi mở PR `backend` → `main`)

- [ ] `cd backend; npx jest; npm run test:e2e; npm run test:scripts` → PASS.
- [ ] Tắt backend dev và simulator; `npm run test:contract` → PASS, danh sách bỏ qua `.cut` đúng phần chưa làm.
- [ ] `git status --short` không có `.env`, `.env.test`, `storage/`, `spikes/s6-output.txt`.
- [ ] Dùng `code-review` (plugin) rà nhánh; sửa vấn đề nghiêm trọng.
- [ ] Mở PR `backend` → `main`, người duyệt ít nhất một người (CLAUDE.md); nội dung PR liệt kê mục đã làm, mục `.cut` còn bỏ qua, kết quả bước kiểm chứng chính (S3, S6, S7, S12).
