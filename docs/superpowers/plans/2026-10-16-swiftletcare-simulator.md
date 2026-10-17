# SwiftletCare simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Người thực thi:** TV5, theo cách Native (`superpowers:executing-plans`) trên máy mình — không dùng subagent-driven. Mỗi task: viết test trước, chạy cho fail, code cho đạt, commit. Không bỏ bước test.

## Trước khi chạy

Chạy trong PowerShell ở gốc repo:

```powershell
node -v                               # ^20.19 || ^22.12 || >=24 (máy nhóm: 25)
npm view mqtt@5.16.1 version          # phải in 5.16.1
git status                            # sạch, đang ở nhánh simulator (git switch -c simulator nếu chưa có)
Test-Path contracts/lib/seed-refs.mjs # True sau khi PR plan hợp đồng Task 1 đã merge
```

- `contracts/lib/fixtures.mjs`, `contracts/lib/seed-refs.mjs` và `contracts/fixtures/mqtt/readings.json` phải có (plan hợp đồng Task 1, 3). Chưa có thì xem bảng phụ thuộc bên dưới.
- Mosquitto chạy theo `infra/mosquitto/README.md` (plan hợp đồng Task 2), có tài khoản `simulator`. **Mật khẩu chỉ ghi vào `simulator/.env`** (đã gitignore), không chép vào file nào khác.
- Lúc viết plan (17/10/2026): code và test của Task 2–7, 9–10 đã chạy thử **ngoài repo** (Node 25.8.0, mqtt 5.16.1, `contracts/lib` dựng theo plan hợp đồng, client MQTT giả) — mọi test đạt. Kết nối broker thật (Task 1 Step 4–5, Task 8, Task 11) **chưa chạy**. Cách A của `--drop` thử với một broker Node chạy trong bộ nhớ: sau `reconnect()` các tin QoS 1 gửi lúc ngắt **không tới broker** — vì vậy plan dùng cách B (spec 2.6 cho phép), Task 1 Step 5 vẫn thử cách A trên Mosquitto thật để ghi kết quả.

## Mốc

| Mốc | Phải xong |
|---|---|
| **18/10 (M1)** | Task 1 (khung + bước kiểm chứng), Task 2–4 |
| **20/10** | Task 5–7: simulator publish số đo thật lên Mosquitto, nhận lệnh |
| **25/10 (M2)** | Luồng simulator → MQTT → backend → SP → web chạy (cùng TV2, TV1); Task 8 bước 1–2 nếu backend đã có vòng điều khiển |
| **01/11 (M3)** | Task 8 đủ (kiểm tay `hot`, `dry`, `normal`, FAN Level 50); quyết định giữ/cắt Task 9 |
| Tuần 4 | Task 9 (`--drop`, heartbeat), Task 10 (nhiễu), Task 11 (kiểm tay mất kết nối) nếu còn sức; TV5 song song làm NV6 (kịch bản demo, báo cáo) |

**Goal:** Dựng `simulator/` — chương trình Node.js giả lập 26 thiết bị MQTT của dữ liệu mẫu: 6 cảm biến gửi số đo theo mô hình bậc một có quán tính, 20 cơ cấu chấp hành nhận lệnh retained và tác động ngược lên số đo, để demo được vòng điều khiển của backend.

**Architecture:** ESM thuần, không TypeScript, một phụ thuộc (`mqtt`). Hàm thuần tách riêng từng file: `devices.mjs` (danh sách từ `SEED_REFS`), `model.mjs` (công thức), `scenarios.mjs` (nền theo kịch bản), `readings.mjs` (payload + `at` tăng dần), `commands.mjs` (đọc lệnh, so `issuedAt`), `args.mjs` (tham số). `sim.mjs` ráp lại, nhận hàm `connect(code)` và đồng hồ qua tham số để test bằng client giả; `main.mjs` chỉ đọc `.env`, tham số, hẹn giờ và Ctrl+C.

**Tech Stack:** Node.js 25 (lùi LTS 24 nếu lỗi), ESM `.mjs`, `mqtt` 5.16.1 (ghim chính xác), `node --test`, `node --env-file`.

**Spec:** [docs/superpowers/specs/2026-10-16-swiftletcare-simulator-design.md](../specs/2026-10-16-swiftletcare-simulator-design.md) · hợp đồng: [integration-contract](../specs/2026-10-13-swiftletcare-integration-contract-design.md) Phần 2 · luật điều khiển: [backend](../specs/2026-10-15-swiftletcare-backend-design.md) 4.4–4.5, [plan backend](2026-10-16-swiftletcare-backend.md) Task 11 · fixture và `SEED_REFS`: [plan hợp đồng](2026-10-14-swiftletcare-integration-contract.md) Task 1, 3

## Global Constraints

- Node.js theo CLAUDE.md; **ESM thuần (`.mjs`), không TypeScript**; `package.json` có `"type": "module"`.
- Phụ thuộc duy nhất **`mqtt` 5.16.1**, ghim chính xác (không `^`, `~`), commit `package-lock.json`. Không `dotenv` (dùng `node --env-file=.env`), không thư viện test ngoài `node --test`.
- `.env.example` đúng năm biến: `MQTT_URL=mqtt://localhost:1883`, `MQTT_USERNAME=simulator`, `MQTT_PASSWORD=` (trống), `READING_INTERVAL_SECONDS=10`, `NOISE_SEED=1`. **Mật khẩu không bao giờ xuất hiện trong log hay thông báo lỗi.**
- 26 kết nối, **client id = mã thiết bị**; danh sách lấy từ `contracts/lib/seed-refs.mjs`, bỏ CAMERA, loại = đoạn cuối của mã. Chỉ chạy **một** simulator trên một broker.
- Topic `swiftlet/devices/{code}/readings` (QoS 1, không retained), `…/command` (subscribe QoS 1), `…/heartbeat` (QoS 0).
- Số đo: mỗi cảm biến một tin 4 chỉ số (TEMP, HUMID, CO2, LIGHT) cùng `at`; `at` = UTC làm tròn xuống giây, dạng `YYYY-MM-DDTHH:MM:SSZ`, tăng dần không trùng theo từng cảm biến.
- Mô hình: `cân_bằng = nền + τ·Σtác_động`, `x ← cân_bằng + (x − cân_bằng)·exp(−(dt/60)/τ)`, τ = **3 phút**, `dt` giây đo bằng đồng hồ thật, `dt ≤ 0` → giữ nguyên. Tác động mỗi phút: FAN TEMP −1,5 và CO2 −150; HEATER TEMP +1,5; MIST HUMID +5; SPEAKER không; nhân `Level/100` khi có Level.
- Giá trị gửi đi kẹp [ValidMin, ValidMax] (TEMP −10…60, HUMID 0…100, CO2 0…10000, LIGHT 0…100000) rồi làm tròn 2 chữ số; trạng thái bên trong không làm tròn.
- Lệnh: trạng thái ban đầu tắt; bỏ tin có `issuedAt` **cũ hơn hẳn** (so bằng `Date.parse`); bằng nhau vẫn áp dụng; payload sai → cảnh báo, bỏ qua.
- Không import mã backend; bản sao công thức `h`/`offHi`/`offLo` chỉ nằm trong `test/rules-copy.mjs`.
- **Không tạo hay ghi đè `.gitignore` gốc** (đã có, đã chứa `simulator/.env`, `simulator/node_modules/`); chỉ thêm dòng còn thiếu.
- Chuỗi trong code và log viết không dấu, **trừ câu spec ghi nguyên văn** ("Chưa có simulator/.env, chép từ .env.example"); README viết có dấu.
- Commit message tiếng Việt, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Lệnh retained cũ nằm trên broker từ lần chạy trước có `issuedAt` mới hơn lệnh backend vừa gửi** (đồng hồ hai máy lệch, hoặc backend khởi động lại publish trạng thái với `issuedAt` = lúc khởi động) — người dùng mong lệnh mới nhất theo thời điểm được áp dụng, lệnh cùng thời điểm (gửi lại) không bị bỏ. Test thêm ở Task 6 (`ActuatorState.apply`, ca `issuedAt` có mili giây).
2. **Đồng hồ máy nhảy lùi** (Windows đồng bộ giờ) giữa hai nhịp — người dùng mong không có số đo trùng `at` hay `at` lùi (backend bỏ trùng làm mất số đo), mô hình không chạy ngược. Test thêm ở Task 5 (`nextAt`) và Task 7 (`Simulator.tick`).
3. **Lệnh FAN `level` 0 kèm `isOn: true`, hoặc `level` null cho FAN** (điều khiển tay lạ) — người dùng mong không có `NaN` trong số đo gửi đi. Test thêm ở Task 3 (`effectPerMinute`).
4. **`READING_INTERVAL_SECONDS` rỗng, 0, âm hoặc không phải số trong `.env`** — người dùng mong simulator dừng ngay với câu rõ ràng, không hẹn giờ 0 ms làm ngập broker. Test thêm ở Task 7 (`readConfig`).
5. **Một kết nối MQTT báo lỗi (sai mật khẩu, broker tắt)** — người dùng mong log cảnh báo theo mã thiết bị, **không in mật khẩu**, chương trình không sập. Test thêm ở Task 7 (`Simulator.start`, sự kiện `error`).

## Cấu trúc file

```
simulator/
  package.json  package-lock.json  .env.example  README.md
  scripts/check-env.mjs     dừng với câu rõ ràng khi thiếu simulator/.env (chạy trước node --env-file)
  src/main.mjs              đọc .env, tham số, hẹn giờ, --drop, Ctrl+C
  src/config.mjs            readConfig(env): kiểm biến .env, không in mật khẩu
  src/args.mjs              parseCli(argv, codes): --scenario, --drop, --drop-after, --drop-for
  src/devices.mjs           loadDevices(): 26 thiết bị từ SEED_REFS, bỏ CAMERA
  src/model.mjs             hằng số + step() + outputValue()
  src/scenarios.mjs         loadScenario(), baseFor()
  src/scenarios/            normal.json, hot.json, dry.json
  src/readings.mjs          isoSecond(), nextAt(), buildReadings()
  src/commands.mjs          parseCommand(), ActuatorState
  src/noise.mjs             makeNoise(seed) (Nên có)
  src/sim.mjs               Simulator: kết nối, nhịp gửi, lệnh, drop/restore, heartbeat, stop
  spikes/                   connections.mjs, drop-a.mjs, RESULTS.md
  test/*.test.mjs           node --test
  test/rules-copy.mjs       bản sao công thức offThresholds của backend, chỉ dùng trong test
  test/fake-client.mjs      client MQTT giả cho test
```

## Phụ thuộc vào module khác và cách làm khi chưa có

| Cần | Của | Chưa có thì |
|---|---|---|
| `contracts/lib/seed-refs.mjs` (`SEED_REFS.device`) | plan hợp đồng Task 1 (PR của TV2) | `loadDevices(codes)` nhận danh sách qua tham số; tạm truyền mảng 28 mã chép từ plan hợp đồng Task 1 Step 5 **trong test của mình**, không tạo file trong `contracts/`. Task 2 Step 4 chỉ chạy đủ khi PR đã merge |
| `contracts/lib/fixtures.mjs`, `contracts/fixtures/mqtt/readings.json` | plan hợp đồng Task 1, 3 | Test hình dạng (Task 5) fail có chủ ý với thông báo "chua co contracts/…"; làm tiếp các task khác |
| Mosquitto + tài khoản `simulator` | plan hợp đồng Task 2 | Test dùng client giả; Task 1 Step 4–5, Task 8, Task 11 chờ broker |
| Backend nhận MQTT, gọi `sp_IngestReadings` | plan backend Task 13–15 (hạn 25/10) | Xem số đo bằng `mosquitto_sub -u simulator -P <mật khẩu> -t "swiftlet/#" -v` |
| Vòng điều khiển tự động + publish `command` | plan backend Task 14 | Gửi lệnh tay bằng `mosquitto_pub … -r` để kiểm Task 7; Task 8 chờ backend |
| `sp_IngestReadings`, `sp_SetActuator` | database-core (hạn 20/10) | Backend dùng SP giả (plan backend Task 6); simulator không phụ thuộc trực tiếp |
| Hợp đồng 2.1 "26 kết nối" + cách chốt ACL | PR hợp đồng của TV2 (plan backend Task 3, mục 6–7) | Simulator làm theo spec simulator (26); không bật ACL trên máy dev cho tới khi PR chốt |
| Ngưỡng seed (TEMP 26–30/28/0,5; HUMID 75–90/82/2; CO2 ≤ 1000/50) | database-core seed | Chép vào test (Task 4); seed đổi thì TV1 báo, TV5 sửa test |
| Công thức `offThresholds` của backend | plan backend Task 11 | Bản sao trong `test/rules-copy.mjs`; backend đổi thì TV2 báo TV5 |

## Ngoài phạm vi

- Camera và mọi thứ của ai-vision (gửi qua HTTP).
- Giao diện chọn kịch bản (Nếu còn thời gian — cần PR riêng sau khi Bắt buộc xong).
- Tương tác giữa các khu vực, tác động chéo (MIST lên TEMP, FAN lên HUMID) — hạn chế 2.7.
- Chạy nhiều simulator cùng broker; TLS cho MQTT; bật ACL Mosquitto (chờ PR hợp đồng).
- Sửa `contracts/`, seed, mã backend.

## Quy ước viết test

- `node --test` (chạy `npm test` trong `simulator\`), file `test/<module>.test.mjs`, `assert` từ `node:assert/strict`.
- Không broker thật trong test: dùng `test/fake-client.mjs`. Đồng hồ là hàm `now()` truyền vào.

---

### Task 1: Khung `simulator/`, ghim phiên bản, kiểm chứng mọi mục "chưa kiểm chứng" của spec

**Files:**
- Create: `simulator/package.json`, `simulator/package-lock.json` (do npm sinh), `simulator/.env.example`, `simulator/scripts/check-env.mjs`, `simulator/README.md` (khung, hoàn thiện ở Task 7), `simulator/test/repo.test.mjs`, `simulator/spikes/connections.mjs`, `simulator/spikes/drop-a.mjs`, `simulator/spikes/RESULTS.md`
- Modify: `.gitignore` gốc **chỉ khi thiếu dòng** (Step 6)

**Interfaces:**
- Consumes: không.
- Produces: `npm start` = `node scripts/check-env.mjs && node --env-file=.env src/main.mjs`; `npm test` = `node --test`; `spikes/RESULTS.md` (S1–S7) — Task 9 đọc S4 trước khi code `--drop`.

- [ ] **Step 1: Viết test quy tắc repo (phải fail)**

`simulator/test/repo.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIM = fileURLToPath(new URL('..', import.meta.url));
const ROOT = join(SIM, '..');

test('package.json: ESM, mot phu thuoc mqtt ghim 5.16.1', () => {
  const pkg = JSON.parse(readFileSync(join(SIM, 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.dependencies, { mqtt: '5.16.1' });
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(pkg.scripts.start, 'node scripts/check-env.mjs && node --env-file=.env src/main.mjs');
  assert.equal(pkg.scripts.test, 'node --test');
});

test('.env.example: dung nam bien, mat khau trong', () => {
  const lines = readFileSync(join(SIM, '.env.example'), 'utf8').split(/\r?\n/).filter(Boolean);
  assert.deepEqual(lines, [
    'MQTT_URL=mqtt://localhost:1883', 'MQTT_USERNAME=simulator', 'MQTT_PASSWORD=',
    'READING_INTERVAL_SECONDS=10', 'NOISE_SEED=1',
  ]);
});

test('.gitignore goc co dong simulator', () => {
  const lines = readFileSync(join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/);
  for (const needed of ['simulator/.env', 'simulator/node_modules/']) assert.ok(lines.includes(needed), needed);
});

test('check-env: thieu .env thi dung voi cau ro rang; co .env thi qua', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-'));
  mkdirSync(join(dir, 'scripts'));
  copyFileSync(join(SIM, 'scripts', 'check-env.mjs'), join(dir, 'scripts', 'check-env.mjs'));
  const run = () => spawnSync(process.execPath, [join(dir, 'scripts', 'check-env.mjs')], { encoding: 'utf8' });
  const missing = run();
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Chưa có simulator\/\.env, chép từ \.env\.example/);
  writeFileSync(join(dir, '.env'), 'MQTT_PASSWORD=x\n');
  assert.equal(run().status, 0);
});
```

Run (trong `simulator\`): `node --test`
Expected: FAIL `ENOENT … package.json`.

- [ ] **Step 2: Viết `package.json`, `.env.example`, `scripts/check-env.mjs`, cài `mqtt`**

`simulator/package.json`:

```json
{
  "name": "swiftletcare-simulator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node scripts/check-env.mjs && node --env-file=.env src/main.mjs",
    "test": "node --test"
  },
  "dependencies": {
    "mqtt": "5.16.1"
  }
}
```

`simulator/.env.example`:

```
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=simulator
MQTT_PASSWORD=
READING_INTERVAL_SECONDS=10
NOISE_SEED=1
```

`simulator/scripts/check-env.mjs`:

```js
// Chay truoc `node --env-file=.env`: thieu file thi Node bao loi kho hieu (spec simulator 1.2).
import { existsSync } from 'node:fs';

if (!existsSync(new URL('../.env', import.meta.url))) {
  console.error('Chưa có simulator/.env, chép từ .env.example');
  process.exit(1);
}
```

```powershell
cd simulator
npm install --save-exact mqtt@5.16.1
node --test
```

Expected: `npm install` không lỗi, `package.json` vẫn ghi `"mqtt": "5.16.1"` (không `^`); `node --test` PASS 4 test.

- [ ] **Step 3: Kiểm `node --env-file` khi thiếu file (S1)**

```powershell
node --env-file=.env -e "console.log('ok')"
```

Expected (chưa có `.env`): Node báo lỗi kiểu `node: .env: not found` — ghi nguyên văn vào S1 (lý do cần `check-env.mjs`). Ghi `node -v`.

- [ ] **Step 4: Kiểm 26 kết nối cùng một tài khoản (S3) — cần Mosquitto**

`simulator/spikes/connections.mjs`:

```js
// Mo 26 ket noi cung tai khoan simulator toi Mosquitto (spec simulator 3.5).
// Chay: node --env-file=.env spikes/connections.mjs
import mqtt from 'mqtt';
import { loadDevices } from '../src/devices.mjs';

const codes = loadDevices().map((d) => d.code);
let ok = 0;
const clients = codes.map((code) => {
  const c = mqtt.connect(process.env.MQTT_URL, {
    clientId: code, username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD, reconnectPeriod: 0,
  });
  c.once('connect', () => { ok += 1; });
  c.once('error', (e) => console.log(code, 'loi', e.message));
  return c;
});
await new Promise((r) => setTimeout(r, 10_000));
console.log(`ket noi duoc ${ok}/${codes.length}`);
await Promise.all(clients.map((c) => c.endAsync(true)));
```

Chạy **sau Task 2** (cần `src/devices.mjs`): chép `.env.example` → `.env`, điền mật khẩu `simulator`, bật Mosquitto, rồi `node --env-file=.env spikes/connections.mjs`.
Expected: `ket noi duoc 26/26`. Ghi S3; nhỏ hơn 26 thì ghi lỗi in ra và cấu hình Mosquitto (`max_connections`), báo TV2.

- [ ] **Step 5: Thử cách A của `--drop` trên Mosquitto (S4)**

`simulator/spikes/drop-a.mjs`:

```js
// Cach A (spec simulator 2.6): huy luong mang, de hang doi offline cua mqtt.js giu tin QoS 1, roi reconnect().
// Chay: node --env-file=.env spikes/drop-a.mjs
import mqtt from 'mqtt';

const opts = { username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const got = [];
const sub = mqtt.connect(process.env.MQTT_URL, { ...opts, clientId: 'spike-drop-sub' });
await new Promise((r) => sub.once('connect', r));
await sub.subscribeAsync('spike/drop-a', { qos: 1 });
sub.on('message', (_t, buf) => got.push(buf.toString()));

const pub = mqtt.connect(process.env.MQTT_URL, { ...opts, clientId: 'spike-drop-pub', reconnectPeriod: 1000 });
await new Promise((r) => pub.once('connect', r));
pub.publish('spike/drop-a', '1', { qos: 1 });
await sleep(500);
pub.options.reconnectPeriod = 0;
pub.stream.destroy();
await sleep(500);
console.log('dang ket noi sau khi huy luong:', pub.connected);
for (const n of ['2', '3', '4']) pub.publish('spike/drop-a', n, { qos: 1 });
await sleep(1000);
console.log('nhan trong luc ngat:', got.join(','));
pub.options.reconnectPeriod = 1000;
pub.reconnect();
await sleep(3000);
console.log('nhan sau khi ket noi lai:', got.join(','));
console.log(got.join(',') === '1,2,3,4' ? 'CACH A DAT' : 'CACH A KHONG DAT');
pub.end(true);
sub.end(true);
```

Run: `node --env-file=.env spikes/drop-a.mjs`
Expected: in ba dòng trạng thái và kết luận. Ghi S4. Lần thử lúc viết plan (broker Node trong bộ nhớ, không phải Mosquitto) cho `KHONG DAT`; plan dùng **cách B** (Task 9). Nếu Mosquitto cho `CACH A DAT`, vẫn giữ cách B (đã có code và test không cần broker) và ghi lý do vào S4 + spec 2.6 — báo TV5/nhóm, không cần đổi code.

- [ ] **Step 6: Kiểm `.gitignore` gốc, chỉ thêm dòng thiếu**

```powershell
cd ..
Select-String -Path .gitignore -SimpleMatch -Pattern 'simulator/.env','simulator/node_modules/'
```

Expected: hai dòng đều có. Thiếu dòng nào thì thêm đúng dòng đó vào mục `# simulator`; không tạo file mới, không ghi đè.

- [ ] **Step 7: Ghi `simulator/spikes/RESULTS.md`**

```markdown
# Kết quả bước kiểm chứng simulator

| Mã | Mục (spec) | Cách kiểm | Kết quả | Ngày |
|---|---|---|---|---|
| S1 | `node --env-file` khi thiếu file; bản Node (1.2) | Task 1 Step 3 | | |
| S2 | `mqtt` 5.16.1 cài được, `package.json` ghim chính xác (1.2) | Task 1 Step 2 | | |
| S3 | 26 kết nối cùng tài khoản `simulator` (3.5) | `spikes/connections.mjs` | | |
| S4 | Cách A của `--drop`: mqtt.js giữ và gửi bù tin QoS 1 (2.6, 3.5) | `spikes/drop-a.mjs` | | |
| S5 | ACL Mosquitto xung đột với `contract-test`/`latency-probe` (3.4) | Theo PR hợp đồng (plan backend Task 3 mục 7) | | |
| S6 | Ctrl+C qua `npm start` trên Windows (hỏi "Terminate batch job?") (1.6) | Task 7 Step 8 | | |
| S7 | τ = 3 phút và mức tác động cho chu kỳ ≈ 7 phút (`hot`), ≈ 6 phút (`dry`) (3.5) | Task 8 | | |
```

Mục nào chưa làm được ghi "chưa kiểm được" + lý do, không bỏ dòng.

- [ ] **Step 8: Khung README**

`simulator/README.md`:

```markdown
# simulator

Spec: `docs/superpowers/specs/2026-10-16-swiftletcare-simulator-design.md`. Plan: `docs/superpowers/plans/2026-10-16-swiftletcare-simulator.md`.

## Cài đặt

    cd simulator
    npm ci
    copy .env.example .env      # rồi điền MQTT_PASSWORD của tài khoản simulator
    npm test

**Chép `.env.example` thành `.env` trước khi chạy.** Không commit `.env`.
```

- [ ] **Step 9: Commit**

```powershell
git status   # khong co simulator/.env, node_modules
git add simulator/package.json simulator/package-lock.json simulator/.env.example simulator/scripts/check-env.mjs simulator/README.md simulator/test/repo.test.mjs simulator/spikes
git commit -m "chore(simulator): khung Node ESM, ghim mqtt 5.16.1, kiểm .env, kết quả bước kiểm chứng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Step 4–5 cần broker: nếu chưa có Mosquitto, commit với S3/S4 "chưa kiểm được", làm lại sau Task 2 khi có broker và commit `spikes/RESULTS.md` riêng.)

---

### Task 2: Danh sách 26 thiết bị

**Files:**
- Create: `simulator/src/devices.mjs`, `simulator/test/devices.test.mjs`

**Interfaces:**
- Consumes: `SEED_REFS` từ `contracts/lib/seed-refs.mjs`.
- Produces: `devices.mjs`: `DEVICE_TYPES = ['SENSOR', 'MIST', 'FAN', 'HEATER', 'SPEAKER']`; `parseCode(code: string) -> { code, type, zone }`; `loadDevices(codes = SEED_REFS.device) -> Array<{ code, type, zone }>` (bỏ CAMERA, loại lạ → ném lỗi); `isSensor(d)`, `isActuator(d)`.

- [ ] **Step 1: Viết test (phải fail)**

`simulator/test/devices.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isActuator, isSensor, loadDevices, parseCode } from '../src/devices.mjs';

const count = (list, type) => list.filter((d) => d.type === type).length;

test('du 26 thiet bi: 6 SENSOR, 18 MIST/FAN/HEATER, 2 SPEAKER, khong CAMERA', () => {
  const list = loadDevices();
  assert.equal(list.length, 26);
  assert.equal(count(list, 'SENSOR'), 6);
  assert.equal(count(list, 'MIST') + count(list, 'FAN') + count(list, 'HEATER'), 18);
  assert.equal(count(list, 'SPEAKER'), 2);
  assert.equal(count(list, 'CAMERA'), 0);
  assert.equal(list.filter(isSensor).length, 6);
  assert.equal(list.filter(isActuator).length, 20);
});

test('loai = doan cuoi cua ma, khu vuc = phan con lai', () => {
  assert.deepEqual(parseCode('H1-F2-FAN'), { code: 'H1-F2-FAN', type: 'FAN', zone: 'H1-F2' });
  assert.deepEqual(parseCode('H2-F0-SPEAKER'), { code: 'H2-F0-SPEAKER', type: 'SPEAKER', zone: 'H2-F0' });
});

test('moi khu vuc co dung mot SENSOR', () => {
  const zones = loadDevices().filter(isSensor).map((d) => d.zone).sort();
  assert.deepEqual(zones, ['H1-F0', 'H1-F1', 'H1-F2', 'H1-F3', 'H2-F0', 'H2-F1']);
});

test('loai thiet bi la thi bao loi', () => {
  assert.throws(() => loadDevices(['H1-F1-LAMP']), /LAMP/);
});
```

Run: `node --test test/devices.test.mjs`
Expected: FAIL `Cannot find module …/src/devices.mjs`.

- [ ] **Step 2: Viết `simulator/src/devices.mjs`**

```js
// Danh sach thiet bi gia lap: lay tu SEED_REFS cua hop dong, bo CAMERA (spec simulator 1.1, 1.3).
import { SEED_REFS } from '../../contracts/lib/seed-refs.mjs';

export const DEVICE_TYPES = ['SENSOR', 'MIST', 'FAN', 'HEATER', 'SPEAKER'];

export function parseCode(code) {
  const parts = code.split('-');
  return { code, type: parts.at(-1), zone: parts.slice(0, -1).join('-') };
}

export function loadDevices(codes = SEED_REFS.device) {
  return codes.map(parseCode).filter((d) => {
    if (d.type === 'CAMERA') return false;
    if (!DEVICE_TYPES.includes(d.type)) throw new Error(`loai thiet bi la: ${d.code}`);
    return true;
  });
}

export const isSensor = (d) => d.type === 'SENSOR';
export const isActuator = (d) => d.type !== 'SENSOR';
```

- [ ] **Step 3: Chạy test**

Run: `node --test test/devices.test.mjs`
Expected: PASS 4 test. (Chưa merge PR hợp đồng Task 1 thì import `seed-refs.mjs` lỗi — xem bảng phụ thuộc; làm tiếp Task 3–6, quay lại khi đã merge.)

- [ ] **Step 4: Commit**

```powershell
git add simulator/src/devices.mjs simulator/test/devices.test.mjs
git commit -m "feat(simulator): danh sách 26 thiết bị từ SEED_REFS, bỏ CAMERA

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Mô hình bậc một có quán tính

**Files:**
- Create: `simulator/src/model.mjs`, `simulator/test/model.test.mjs`

**Interfaces:**
- Consumes: không.
- Produces: `model.mjs`: `METRICS = ['TEMP', 'HUMID', 'CO2', 'LIGHT']`, `TAU_MINUTES = 3`, `EFFECTS`, `VALID`; `effectPerMinute(actuators: Array<{type, isOn, level}>, metric) -> number`; `equilibrium(base: number, actuators, metric, tau = TAU_MINUTES) -> number`; `step(state, actuators, scenarioBase, dtSeconds, tau = TAU_MINUTES) -> state mới` (`state`, `scenarioBase` là `{TEMP, HUMID, CO2, LIGHT}`); `outputValue(metric, x, noise = 0) -> number` (kẹp rồi làm tròn 2 chữ số).

- [ ] **Step 1: Viết test (phải fail)**

`simulator/test/model.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAU_MINUTES, effectPerMinute, equilibrium, outputValue, step } from '../src/model.mjs';

const BASE = { TEMP: 28, HUMID: 82, CO2: 600, LIGHT: 2 };
const FAN = { type: 'FAN', isOn: true, level: 100, mode: 'AUTO' };
const close = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (eps ${eps})`);

test('tau mac dinh 3 phut', () => assert.equal(TAU_MINUTES, 3));

test('6 buoc 10 giay = 1 buoc 60 giay khi trang thai thiet bi co dinh', () => {
  const start = { TEMP: 31, HUMID: 70, CO2: 900, LIGHT: 5 };
  const acts = [FAN, { type: 'MIST', isOn: true, level: null }];
  let x = start;
  for (let i = 0; i < 6; i += 1) x = step(x, acts, BASE, 10);
  const y = step(start, acts, BASE, 60);
  for (const m of Object.keys(BASE)) close(x[m], y[m], 1e-9);
});

test('FAN bat 1 phut, x o nen, tau rat lon -> TEMP giam ~1.5, CO2 giam ~150', () => {
  const x = step(BASE, [FAN], BASE, 60, 1e6);
  close(BASE.TEMP - x.TEMP, 1.5, 1e-3);
  close(BASE.CO2 - x.CO2, 150, 1e-1);
});

test('dt <= 0 (dong ho lui) -> khong doi', () => {
  const start = { TEMP: 31, HUMID: 70, CO2: 900, LIGHT: 5 };
  assert.deepEqual(step(start, [FAN], BASE, 0), start);
  assert.deepEqual(step(start, [FAN], BASE, -5), start);
});

test('bat lau -> dung o nen + tau * tac dong', () => {
  const x = step({ TEMP: 35, HUMID: 60, CO2: 2000, LIGHT: 2 }, [FAN, { type: 'MIST', isOn: true, level: null }], BASE, 1e7);
  close(x.TEMP, 28 - 3 * 1.5, 1e-9);
  close(x.CO2, 600 - 3 * 150, 1e-9);
  close(x.HUMID, 82 + 3 * 5, 1e-9);
  close(x.LIGHT, 2, 1e-9);
});

test('HEATER tang TEMP, SPEAKER khong tac dong, thiet bi tat khong tac dong', () => {
  assert.equal(effectPerMinute([{ type: 'HEATER', isOn: true, level: null }], 'TEMP'), 1.5);
  assert.equal(effectPerMinute([{ type: 'SPEAKER', isOn: true, level: 100 }], 'TEMP'), 0);
  assert.equal(effectPerMinute([{ ...FAN, isOn: false }], 'TEMP'), 0);
});

test('FAN Level 50 MANUAL -> tac dong bang nua Level 100', () => {
  const half = equilibrium(28, [{ type: 'FAN', isOn: true, level: 50, mode: 'MANUAL' }], 'TEMP') - 28;
  const full = equilibrium(28, [FAN], 'TEMP') - 28;
  close(half, full / 2, 1e-12);
});

test('FAN level 0 hoac null khong sinh NaN', () => {
  for (const level of [0, null, undefined]) {
    const v = effectPerMinute([{ type: 'FAN', isOn: true, level }], 'TEMP');
    assert.ok(Number.isFinite(v), String(level));
  }
});

test('gia tri gui di: kep [ValidMin, ValidMax] roi lam tron 2 chu so', () => {
  assert.equal(outputValue('TEMP', 70), 60);
  assert.equal(outputValue('TEMP', -20), -10);
  assert.equal(outputValue('HUMID', 100.7), 100);
  assert.equal(outputValue('CO2', -3), 0);
  assert.equal(outputValue('LIGHT', 200000), 100000);
  assert.equal(outputValue('TEMP', 28.123456), 28.12);
  assert.equal(outputValue('TEMP', 59.999, 0.5), 60);
});

test('trang thai ben trong khong bi lam tron', () => {
  const x = step(BASE, [FAN], BASE, 7);
  assert.notEqual(x.TEMP, Math.round(x.TEMP * 100) / 100);
});
```

Run: `node --test test/model.test.mjs`
Expected: FAIL `Cannot find module …/src/model.mjs`.

- [ ] **Step 2: Viết `simulator/src/model.mjs`**

```js
// Mo hinh bac mot co quan tinh (spec simulator 2.1). Ham thuan, khong lam tron ben trong.
export const METRICS = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];
export const TAU_MINUTES = 3;
// Tac dong moi phut khi thiet bi bat o Level 100 (hoac Level NULL).
export const EFFECTS = {
  FAN: { TEMP: -1.5, CO2: -150 },
  HEATER: { TEMP: 1.5 },
  MIST: { HUMID: 5 },
};
// [ValidMin, ValidMax] cua seed.
export const VALID = { TEMP: [-10, 60], HUMID: [0, 100], CO2: [0, 10000], LIGHT: [0, 100000] };

export function effectPerMinute(actuators, metric) {
  let sum = 0;
  for (const a of actuators) {
    const e = a.isOn ? EFFECTS[a.type]?.[metric] : undefined;
    if (e === undefined) continue;
    sum += e * (typeof a.level === 'number' ? a.level / 100 : 1);
  }
  return sum;
}

export function equilibrium(base, actuators, metric, tau = TAU_MINUTES) {
  return base + tau * effectPerMinute(actuators, metric);
}

export function step(state, actuators, scenarioBase, dtSeconds, tau = TAU_MINUTES) {
  if (!(dtSeconds > 0)) return { ...state };
  const k = Math.exp(-(dtSeconds / 60) / tau);
  const next = {};
  for (const m of METRICS) {
    const eq = equilibrium(scenarioBase[m], actuators, m, tau);
    next[m] = eq + (state[m] - eq) * k;
  }
  return next;
}

export function outputValue(metric, x, noise = 0) {
  const [lo, hi] = VALID[metric];
  return Math.round(Math.min(hi, Math.max(lo, x + noise)) * 100) / 100;
}
```

Ghi chú: FAN `isOn: true` với `level` null coi là hệ số 1 (giống MIST/HEATER); `level` 0 cho tác động 0.

- [ ] **Step 3: Chạy test**

Run: `node --test test/model.test.mjs`
Expected: PASS 10 test.

- [ ] **Step 4: Commit**

```powershell
git add simulator/src/model.mjs simulator/test/model.test.mjs
git commit -m "feat(simulator): mô hình bậc một tau 3 phút, tác động FAN/HEATER/MIST theo Level, kẹp và làm tròn giá trị gửi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Kịch bản `normal`/`hot`/`dry` và test bất đẳng thức với bản sao công thức backend

**Files:**
- Create: `simulator/src/scenarios.mjs`, `simulator/src/scenarios/normal.json`, `simulator/src/scenarios/hot.json`, `simulator/src/scenarios/dry.json`, `simulator/test/rules-copy.mjs`, `simulator/test/scenarios.test.mjs`

**Interfaces:**
- Consumes: `equilibrium` (Task 3).
- Produces: `scenarios.mjs`: `SCENARIOS = ['normal', 'hot', 'dry']`; `loadScenario(name) -> { default: {TEMP, HUMID, CO2, LIGHT}, zones: { [zone]: Partial<...> } }` (tên lạ → lỗi kèm danh sách hợp lệ); `baseFor(scenario, zone) -> {TEMP, HUMID, CO2, LIGHT}`. `test/rules-copy.mjs`: `offThresholds(b: {min, max, target, hysteresis}) -> {h, offHi, offLo}` — bản sao **chỉ công thức** của plan backend Task 11.

- [ ] **Step 1: Viết `test/rules-copy.mjs` và test (phải fail)**

`simulator/test/rules-copy.mjs`:

```js
// BAN SAO chi cong thuc offThresholds cua backend (spec backend 4.4; plan backend Task 11, rules.ts).
// Khong import ma backend. Backend doi cong thuc -> TV2 bao TV5 sua file nay (spec simulator 3.2).
const round = (n) => Math.round(n * 1e6) / 1e6;

export function offThresholds(b) {
  const h = b.min !== null && b.max !== null ? Math.min(b.hysteresis, (b.max - b.min) / 4) : b.hysteresis;
  const offHi = b.max === null ? null : round(b.target !== null ? Math.min(b.target, b.max - h) : b.max - h);
  const offLo = b.min === null ? null : round(b.target !== null ? Math.max(b.target, b.min + h) : b.min + h);
  return { h: round(h), offHi, offLo };
}
```

`simulator/test/scenarios.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equilibrium } from '../src/model.mjs';
import { SCENARIOS, baseFor, loadScenario } from '../src/scenarios.mjs';
import { offThresholds } from './rules-copy.mjs';

// Nguong seed database-core (spec simulator 1.5). Seed doi -> TV1 bao, sua o day.
const TEMP = { min: 26, max: 30, target: 28, hysteresis: 0.5 };
const HUMID = { min: 75, max: 90, target: 82, hysteresis: 2 };
const CO2 = { min: null, max: 1000, target: null, hysteresis: 50 };
const ON = (type) => [{ type, isOn: true, level: type === 'FAN' ? 100 : null, mode: 'AUTO' }];

test('ba kich ban, ten la thi bao loi kem danh sach', () => {
  assert.deepEqual(SCENARIOS, ['normal', 'hot', 'dry']);
  assert.throws(() => loadScenario('cold'), /cold.*normal, hot, dry/);
});

test('normal: nen bang Target, CO2 600, LIGHT 2 cho moi khu vuc', () => {
  const n = loadScenario('normal');
  for (const zone of ['H1-F0', 'H1-F2', 'H2-F1']) {
    assert.deepEqual(baseFor(n, zone), { TEMP: 28, HUMID: 82, CO2: 600, LIGHT: 2 });
  }
});

test('hot chi doi TEMP cua H1-F2; dry chi doi HUMID cua H1-F3', () => {
  const hot = loadScenario('hot');
  const dry = loadScenario('dry');
  assert.deepEqual(baseFor(hot, 'H1-F2'), { TEMP: 32, HUMID: 82, CO2: 600, LIGHT: 2 });
  assert.deepEqual(baseFor(hot, 'H1-F3'), { TEMP: 28, HUMID: 82, CO2: 600, LIGHT: 2 });
  assert.deepEqual(baseFor(dry, 'H1-F3'), { TEMP: 28, HUMID: 70, CO2: 600, LIGHT: 2 });
  assert.deepEqual(baseFor(dry, 'H1-F2'), { TEMP: 28, HUMID: 82, CO2: 600, LIGHT: 2 });
});

// Doi chieu ban sao voi bang ca cua backend (plan backend Task 11, describe('offThresholds')).
test('ban sao cong thuc: cung ket qua bang ca backend', () => {
  assert.deepEqual(offThresholds(TEMP), { h: 0.5, offHi: 28, offLo: 28 });
  assert.deepEqual(offThresholds(HUMID), { h: 2, offHi: 82, offLo: 82 });
  assert.deepEqual(offThresholds({ min: 28, max: 30, target: null, hysteresis: 2 }), { h: 0.5, offHi: 29.5, offLo: 28.5 });
  assert.deepEqual(offThresholds(CO2), { h: 50, offHi: 950, offLo: null });
  assert.equal(offThresholds({ min: 26, max: 30, target: 30, hysteresis: 0.5 }).offHi, 29.5);
});

test('hot, H1-F2: nen TEMP > Max va can bang khi FAN bat < offHi (FAN tat duoc)', () => {
  const base = baseFor(loadScenario('hot'), 'H1-F2').TEMP;
  assert.ok(base > TEMP.max, `nen ${base}`);
  const eq = equilibrium(base, ON('FAN'), 'TEMP');
  assert.ok(eq < offThresholds(TEMP).offHi, `can bang ${eq}`);
});

test('dry, H1-F3: nen HUMID < Min va can bang khi MIST bat > offLo (MIST tat duoc)', () => {
  const base = baseFor(loadScenario('dry'), 'H1-F3').HUMID;
  assert.ok(base < HUMID.min, `nen ${base}`);
  const eq = equilibrium(base, ON('MIST'), 'HUMID');
  assert.ok(eq > offThresholds(HUMID).offLo, `can bang ${eq}`);
});

test('normal: moi nen nam trong nguong, khong luat nao bat', () => {
  const b = baseFor(loadScenario('normal'), 'H1-F1');
  assert.ok(b.TEMP >= TEMP.min && b.TEMP <= TEMP.max);
  assert.ok(b.HUMID >= HUMID.min && b.HUMID <= HUMID.max);
  assert.ok(b.CO2 <= CO2.max);
});
```

Run: `node --test test/scenarios.test.mjs`
Expected: FAIL `Cannot find module …/src/scenarios.mjs`.

- [ ] **Step 2: Viết ba file kịch bản**

`simulator/src/scenarios/normal.json`:

```json
{
  "default": { "TEMP": 28, "HUMID": 82, "CO2": 600, "LIGHT": 2 },
  "zones": {}
}
```

`simulator/src/scenarios/hot.json`:

```json
{
  "default": { "TEMP": 28, "HUMID": 82, "CO2": 600, "LIGHT": 2 },
  "zones": { "H1-F2": { "TEMP": 32 } }
}
```

`simulator/src/scenarios/dry.json`:

```json
{
  "default": { "TEMP": 28, "HUMID": 82, "CO2": 600, "LIGHT": 2 },
  "zones": { "H1-F3": { "HUMID": 70 } }
}
```

- [ ] **Step 3: Viết `simulator/src/scenarios.mjs`**

```js
// Kich ban: nen mac dinh + ghi de theo khu vuc (spec simulator 2.2).
import { readFileSync } from 'node:fs';

export const SCENARIOS = ['normal', 'hot', 'dry'];

export function loadScenario(name) {
  if (!SCENARIOS.includes(name)) throw new Error(`kich ban la: ${name}; hop le: ${SCENARIOS.join(', ')}`);
  return JSON.parse(readFileSync(new URL(`./scenarios/${name}.json`, import.meta.url), 'utf8'));
}

export function baseFor(scenario, zone) {
  return { ...scenario.default, ...(scenario.zones[zone] ?? {}) };
}
```

- [ ] **Step 4: Chạy test**

Run: `node --test test/scenarios.test.mjs`
Expected: PASS 7 test.

- [ ] **Step 5: Commit**

```powershell
git add simulator/src/scenarios.mjs simulator/src/scenarios simulator/test/rules-copy.mjs simulator/test/scenarios.test.mjs
git commit -m "feat(simulator): kịch bản normal/hot/dry, bản sao công thức ngưỡng nhả của backend và test bất đẳng thức

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Payload số đo, `at` tăng dần, test hình dạng theo fixture

**Files:**
- Create: `simulator/src/readings.mjs`, `simulator/test/readings.test.mjs`

**Interfaces:**
- Consumes: `METRICS` (Task 3); `loadFixture`, `FIXTURES_DIR` từ `contracts/lib/fixtures.mjs`.
- Produces: `readings.mjs`: `isoSecond(ms: number) -> string` (`YYYY-MM-DDTHH:MM:SSZ`); `nextAt(prevMs: number | null, nowMs: number) -> number` (làm tròn xuống giây; ≤ lần trước → lần trước + 1000); `buildReadings(code: string, values: {TEMP, HUMID, CO2, LIGHT}, atMs: number) -> Array<{device, metric, value, at}>`; `readingsTopic(code) -> string`.

- [ ] **Step 1: Viết test (phải fail)**

`simulator/test/readings.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES_DIR, loadFixture } from '../../contracts/lib/fixtures.mjs';
import { buildReadings, isoSecond, nextAt, readingsTopic } from '../src/readings.mjs';

const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const T = Date.UTC(2026, 9, 12, 10, 40, 7, 850);
const VALUES = { TEMP: 28.12, HUMID: 82, CO2: 600, LIGHT: 2 };

test('isoSecond: lam tron xuong giay, co Z, khong mili giay', () => {
  assert.equal(isoSecond(T), '2026-10-12T10:40:07Z');
});

test('nextAt: lam tron xuong giay; bang hoac lui thi lay lan truoc + 1 giay', () => {
  const first = nextAt(null, T);
  assert.equal(first, Date.UTC(2026, 9, 12, 10, 40, 7));
  assert.equal(nextAt(first, T + 100), first + 1000);            // cung giay
  assert.equal(nextAt(first, T - 60_000), first + 1000);         // dong ho lui
  assert.equal(nextAt(first, T + 10_000), first + 10_000);
});

test('topic readings', () => {
  assert.equal(readingsTopic('H1-F1-SENSOR'), 'swiftlet/devices/H1-F1-SENSOR/readings');
});

// Chi so HINH DANG voi fixture (spec simulator 3.1): fixture ghi gia tri cu the nen khong so gia tri.
test('payload dung hinh dang fixture mqtt/readings', () => {
  assert.ok(existsSync(join(FIXTURES_DIR, 'mqtt', 'readings.json')), 'chua co contracts/fixtures/mqtt/readings.json, can merge integration-contract truoc');
  const fixture = loadFixture('mqtt/readings');
  const code = fixture.topic.split('/')[2];
  const payload = buildReadings(code, VALUES, T);
  assert.equal(payload.length, 4);
  const keys = Object.keys(fixture.payload[0]).sort();
  for (const item of payload) {
    assert.deepEqual(Object.keys(item).sort(), keys);
    assert.equal(typeof item.device, 'string');
    assert.equal(typeof item.value, 'number');
    assert.match(item.at, ISO_Z);
    assert.equal(item.device, code);                               // device khop {code} cua topic
  }
  assert.deepEqual(payload.map((p) => p.metric).sort(), ['CO2', 'HUMID', 'LIGHT', 'TEMP']);
  assert.equal(new Set(payload.map((p) => p.at)).size, 1);         // 4 phan tu cung at
});

test('at tang dan qua nhieu nhip ke ca khi dong ho lui', () => {
  const clock = [T, T + 10_000, T + 5_000, T + 5_000, T + 30_000];
  let prev = null;
  const ats = clock.map((now) => (prev = nextAt(prev, now)));
  for (let i = 1; i < ats.length; i += 1) assert.ok(ats[i] > ats[i - 1], `${ats[i]} <= ${ats[i - 1]}`);
});
```

Run: `node --test test/readings.test.mjs`
Expected: FAIL `Cannot find module …/src/readings.mjs`.

- [ ] **Step 2: Viết `simulator/src/readings.mjs`**

```js
// Payload so do: mot tin 4 chi so cung at; at tang dan khong trung theo tung cam bien (spec simulator 2.3).
import { METRICS } from './model.mjs';

export const isoSecond = (ms) => new Date(ms).toISOString().slice(0, 19) + 'Z';

export function nextAt(prevMs, nowMs) {
  const t = Math.floor(nowMs / 1000) * 1000;
  return prevMs !== null && t <= prevMs ? prevMs + 1000 : t;
}

export function buildReadings(code, values, atMs) {
  const at = isoSecond(atMs);
  return METRICS.map((metric) => ({ device: code, metric, value: values[metric], at }));
}

export const readingsTopic = (code) => `swiftlet/devices/${code}/readings`;
```

- [ ] **Step 3: Chạy test**

Run: `node --test test/readings.test.mjs`
Expected: PASS 5 test (test fixture fail có chủ ý nếu PR hợp đồng chưa merge).

- [ ] **Step 4: Commit**

```powershell
git add simulator/src/readings.mjs simulator/test/readings.test.mjs
git commit -m "feat(simulator): payload số đo 4 chỉ số cùng at, at tăng dần khi đồng hồ lùi, test hình dạng theo fixture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Nhận lệnh — đọc payload, so `issuedAt`

**Files:**
- Create: `simulator/src/commands.mjs`, `simulator/test/commands.test.mjs`

**Interfaces:**
- Consumes: không.
- Produces: `commands.mjs`: `commandTopic(code) -> string`; `parseCommand(buf: Buffer | string) -> { ok: true, cmd: {isOn, level, mode, issuedAt} } | { ok: false, reason: string }`; `class ActuatorState` với thuộc tính `isOn` (mặc định `false`), `level` (`null`), `mode` (`null`), `lastIssuedMs` (`null`) và `apply(cmd) -> boolean` (`false` = bỏ vì cũ hơn hẳn).

- [ ] **Step 1: Viết test (phải fail)**

`simulator/test/commands.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActuatorState, commandTopic, parseCommand } from '../src/commands.mjs';

const cmd = (issuedAt, o = {}) => ({ isOn: true, level: 80, mode: 'MANUAL', issuedAt, ...o });

test('topic command', () => {
  assert.equal(commandTopic('H1-F2-FAN'), 'swiftlet/devices/H1-F2-FAN/command');
});

test('chua co tin retained -> tat', () => {
  const s = new ActuatorState();
  assert.equal(s.isOn, false);
  assert.equal(s.level, null);
});

test('issuedAt cu hon han -> bo qua; bang nhau -> van ap dung', () => {
  const s = new ActuatorState();
  assert.equal(s.apply(cmd('2026-10-12T10:40:05Z')), true);
  assert.equal(s.apply(cmd('2026-10-12T10:40:04Z', { isOn: false })), false);
  assert.equal(s.isOn, true);
  assert.equal(s.apply(cmd('2026-10-12T10:40:05Z', { level: 50 })), true);
  assert.equal(s.level, 50);
});

test('so bang thoi diem da parse, khong so chuoi', () => {
  const s = new ActuatorState();
  s.apply(cmd('2026-10-12T10:40:00Z'));
  // So chuoi: '.' < 'Z' nen '…00.500Z' "nho hon" '…00Z'; so thoi diem: moi hon 500 ms -> phai ap dung.
  assert.equal(s.apply(cmd('2026-10-12T10:40:00.500Z', { level: 30 })), true);
  assert.equal(s.level, 30);
  assert.equal(s.apply(cmd('2026-10-12T10:40:00.000Z', { level: 10 })), false);
});

test('parseCommand hop le', () => {
  const r = parseCommand(Buffer.from(JSON.stringify(cmd('2026-10-12T10:40:00Z', { level: null, mode: 'AUTO' }))));
  assert.deepEqual(r, { ok: true, cmd: { isOn: true, level: null, mode: 'AUTO', issuedAt: '2026-10-12T10:40:00Z' } });
});

test('parseCommand sai -> ok false, khong nem loi', () => {
  const bad = [
    'khong-phai-json',
    '[]',
    JSON.stringify({ level: 80, mode: 'MANUAL', issuedAt: '2026-10-12T10:40:00Z' }),
    JSON.stringify(cmd('2026-10-12T10:40:00')),
    JSON.stringify(cmd('2026-10-12T17:40:00+07:00')),
    JSON.stringify(cmd('2026-10-12T10:40:00Z', { isOn: 'true' })),
    JSON.stringify(cmd('2026-10-12T10:40:00Z', { level: '80' })),
    JSON.stringify(cmd('2026-10-12T10:40:00Z', { mode: 'AUTOMATIC' })),
  ];
  for (const b of bad) {
    const r = parseCommand(Buffer.from(b));
    assert.equal(r.ok, false, b);
    assert.equal(typeof r.reason, 'string');
  }
});
```

Run: `node --test test/commands.test.mjs`
Expected: FAIL `Cannot find module …/src/commands.mjs`.

- [ ] **Step 2: Viết `simulator/src/commands.mjs`**

```js
// Lenh = trang thai mong muon, retained (hop dong 2.1; spec simulator 2.4).
const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const commandTopic = (code) => `swiftlet/devices/${code}/command`;

export function parseCommand(buf) {
  let p;
  try {
    p = JSON.parse(buf.toString());
  } catch {
    return { ok: false, reason: 'khong phai JSON' };
  }
  if (p === null || typeof p !== 'object' || Array.isArray(p)) return { ok: false, reason: 'khong phai object' };
  if (typeof p.isOn !== 'boolean') return { ok: false, reason: 'isOn phai la boolean' };
  if (p.level !== null && typeof p.level !== 'number') return { ok: false, reason: 'level phai la so hoac null' };
  if (p.mode !== 'AUTO' && p.mode !== 'MANUAL') return { ok: false, reason: 'mode phai la AUTO hoac MANUAL' };
  if (typeof p.issuedAt !== 'string' || !ISO_Z.test(p.issuedAt)) return { ok: false, reason: 'issuedAt phai la UTC co Z' };
  return { ok: true, cmd: { isOn: p.isOn, level: p.level, mode: p.mode, issuedAt: p.issuedAt } };
}

export class ActuatorState {
  isOn = false;
  level = null;
  mode = null;
  lastIssuedMs = null;

  apply(cmd) {
    const t = Date.parse(cmd.issuedAt);
    if (this.lastIssuedMs !== null && t < this.lastIssuedMs) return false;
    this.isOn = cmd.isOn;
    this.level = cmd.level;
    this.mode = cmd.mode;
    this.lastIssuedMs = t;
    return true;
  }
}
```

`level` thiếu hẳn (`undefined`) bị từ chối vì `undefined !== null` và không phải số — đúng "thiếu trường".

- [ ] **Step 3: Chạy test**

Run: `node --test test/commands.test.mjs`
Expected: PASS 6 test.

- [ ] **Step 4: Commit**

```powershell
git add simulator/src/commands.mjs simulator/test/commands.test.mjs
git commit -m "feat(simulator): đọc lệnh retained, bỏ issuedAt cũ hơn hẳn theo thời điểm đã parse, payload sai không làm dừng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Ráp simulator — cấu hình, tham số, kết nối, nhịp gửi, lệnh, Ctrl+C

**Files:**
- Create: `simulator/src/config.mjs`, `simulator/src/args.mjs`, `simulator/src/sim.mjs`, `simulator/src/main.mjs`, `simulator/test/fake-client.mjs`, `simulator/test/config.test.mjs`, `simulator/test/args.test.mjs`, `simulator/test/sim.test.mjs`, `simulator/test/main.test.mjs`
- Modify: `simulator/README.md`

**Interfaces:**
- Consumes: `loadDevices`, `isSensor`, `isActuator` (Task 2); `METRICS`, `step`, `outputValue` (Task 3); `SCENARIOS`, `loadScenario`, `baseFor` (Task 4); `nextAt`, `buildReadings`, `readingsTopic`, `isoSecond` (Task 5); `ActuatorState`, `parseCommand`, `commandTopic` (Task 6).
- Produces:
  - `config.mjs`: `readConfig(env: object) -> { url, username, password, intervalSeconds, noiseSeed }` — lỗi → `Error` có tên biến, **không có giá trị mật khẩu**.
  - `args.mjs`: `DROP_MIN_RECOMMENDED = 7`; `parseCli(argv: string[], codes: string[]) -> { scenario, drop: null | { codes: string[], afterMinutes: number, forMinutes: number }, warnings: string[] }`.
  - `sim.mjs`: `class Simulator({ devices, scenario, connect, now = Date.now, log = console, noise = () => 0 })` với `start()`, `tick()`, `onCommand(code, buf)`, `zoneActuators(zone)`, `send(code, topic, payload, qos = 1)`, `stop(): Promise<void>`; thuộc tính `clients: Map<code, client>`, `sensors: Map<code, {device, state, base, lastMs, lastAtMs}>`, `actuators: Map<code, {device, state: ActuatorState}>`.
  - `test/fake-client.mjs`: `FakeClient` (EventEmitter, ghi `published`, `subscriptions`, `ended`), `fakeConnect() -> { connect, clients, latest(code) }`.

- [ ] **Step 1: Viết `test/fake-client.mjs` và test (phải fail)**

`simulator/test/fake-client.mjs`:

```js
// Client MQTT gia: ghi lai publish/subscribe, test phat su kien 'connect', 'message', 'error' bang emit().
import { EventEmitter } from 'node:events';

export class FakeClient extends EventEmitter {
  constructor(code) {
    super();
    this.code = code;
    this.published = [];
    this.subscriptions = [];
    this.ended = false;
  }

  publish(topic, payload, opts) {
    this.published.push({ topic, payload: JSON.parse(payload), opts });
  }

  subscribe(topic, opts) {
    this.subscriptions.push({ topic, opts });
  }

  async endAsync() {
    this.ended = true;
  }
}

export function fakeConnect() {
  const clients = [];
  return {
    clients,
    connect: (code) => {
      const c = new FakeClient(code);
      clients.push(c);
      return c;
    },
    latest: (code) => clients.filter((c) => c.code === code).at(-1),
  };
}
```

`simulator/test/config.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.mjs';

const ENV = { MQTT_URL: 'mqtt://localhost:1883', MQTT_USERNAME: 'simulator', MQTT_PASSWORD: 'bi-mat-123', READING_INTERVAL_SECONDS: '10', NOISE_SEED: '1' };

test('doc du nam bien', () => {
  assert.deepEqual(readConfig(ENV), { url: 'mqtt://localhost:1883', username: 'simulator', password: 'bi-mat-123', intervalSeconds: 10, noiseSeed: 1 });
});

test('NOISE_SEED trong -> khong nhieu (null)', () => {
  assert.equal(readConfig({ ...ENV, NOISE_SEED: '' }).noiseSeed, null);
  assert.equal(readConfig({ ...ENV, NOISE_SEED: undefined }).noiseSeed, null);
});

for (const [name, change, word] of [
  ['mat khau rong', { MQTT_PASSWORD: '' }, 'MQTT_PASSWORD'],
  ['thieu mat khau', { MQTT_PASSWORD: undefined }, 'MQTT_PASSWORD'],
  ['thieu URL', { MQTT_URL: '' }, 'MQTT_URL'],
  ['thieu tai khoan', { MQTT_USERNAME: ' ' }, 'MQTT_USERNAME'],
  ['nhip rong', { READING_INTERVAL_SECONDS: '' }, 'READING_INTERVAL_SECONDS'],
  ['nhip 0', { READING_INTERVAL_SECONDS: '0' }, 'READING_INTERVAL_SECONDS'],
  ['nhip am', { READING_INTERVAL_SECONDS: '-5' }, 'READING_INTERVAL_SECONDS'],
  ['nhip chu', { READING_INTERVAL_SECONDS: 'muoi' }, 'READING_INTERVAL_SECONDS'],
  ['hat giong le', { NOISE_SEED: '1.5' }, 'NOISE_SEED'],
]) {
  test(`loi: ${name} -> bao ten bien, khong lo mat khau`, () => {
    assert.throws(() => readConfig({ ...ENV, ...change }), (e) => e.message.includes(word) && !e.message.includes('bi-mat-123'));
  });
}
```

`simulator/test/args.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCli } from '../src/args.mjs';

const CODES = ['H1-F1-SENSOR', 'H1-F2-FAN'];

test('mac dinh normal, khong drop', () => {
  assert.deepEqual(parseCli([], CODES), { scenario: 'normal', drop: null, warnings: [] });
});

test('--scenario hot', () => {
  assert.equal(parseCli(['--scenario', 'hot'], CODES).scenario, 'hot');
});

test('kich ban la hoac tham so la -> loi', () => {
  assert.throws(() => parseCli(['--scenario', 'cold'], CODES), /cold/);
  assert.throws(() => parseCli(['--speed', '2'], CODES));
});

test('--drop day du', () => {
  const r = parseCli(['--drop', 'H1-F1-SENSOR,H1-F2-FAN', '--drop-after', '1', '--drop-for', '7'], CODES);
  assert.deepEqual(r.drop, { codes: ['H1-F1-SENSOR', 'H1-F2-FAN'], afterMinutes: 1, forMinutes: 7 });
  assert.deepEqual(r.warnings, []);
});

test('--drop-for < 7 -> canh bao, van chay', () => {
  const r = parseCli(['--drop', 'H1-F1-SENSOR', '--drop-after', '0.5', '--drop-for', '2'], CODES);
  assert.equal(r.drop.forMinutes, 2);
  assert.match(r.warnings[0], /7 phut/);
});

test('--drop thieu tham so di kem, ma la, phut sai -> loi', () => {
  assert.throws(() => parseCli(['--drop', 'H1-F1-SENSOR'], CODES), /drop-after/);
  assert.throws(() => parseCli(['--drop', 'H9-F1-SENSOR', '--drop-after', '1', '--drop-for', '7'], CODES), /H9-F1-SENSOR/);
  assert.throws(() => parseCli(['--drop', 'H1-F1-SENSOR', '--drop-after', '-1', '--drop-for', '7'], CODES), /drop-after/);
  assert.throws(() => parseCli(['--drop', 'H1-F1-SENSOR', '--drop-after', '1', '--drop-for', '0'], CODES), /drop-for/);
});
```

`simulator/test/sim.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDevices } from '../src/devices.mjs';
import { loadScenario } from '../src/scenarios.mjs';
import { Simulator } from '../src/sim.mjs';
import { fakeConnect } from './fake-client.mjs';

const T0 = Date.UTC(2026, 9, 12, 10, 40, 7, 300);

function setup(scenario = 'normal') {
  const fc = fakeConnect();
  const clock = { t: T0 };
  const warns = [];
  const sim = new Simulator({
    devices: loadDevices(), scenario: loadScenario(scenario), connect: fc.connect,
    now: () => clock.t, log: { log: () => {}, warn: (m) => warns.push(m) },
  });
  sim.start();
  return { sim, fc, clock, warns };
}

const lastReading = (fc, code) => fc.latest(code).published.at(-1).payload;
const value = (payload, metric) => payload.find((p) => p.metric === metric).value;
const command = (o) => Buffer.from(JSON.stringify({ isOn: true, level: 100, mode: 'AUTO', issuedAt: '2026-10-12T10:40:00Z', ...o }));

test('start: 26 ket noi, client id = ma; co cau chap hanh subscribe command QoS 1 khi ket noi', () => {
  const { fc } = setup();
  assert.equal(fc.clients.length, 26);
  for (const c of fc.clients) c.emit('connect');
  const fan = fc.latest('H1-F2-FAN');
  assert.deepEqual(fan.subscriptions, [{ topic: 'swiftlet/devices/H1-F2-FAN/command', opts: { qos: 1 } }]);
  assert.deepEqual(fc.latest('H1-F2-SENSOR').subscriptions, []);
});

test('tick: 6 cam bien publish QoS 1, payload 4 chi so, gia tri dau = normal', () => {
  const { sim, fc } = setup();
  sim.tick();
  const sensors = fc.clients.filter((c) => c.published.length);
  assert.equal(sensors.length, 6);
  const msg = fc.latest('H1-F1-SENSOR').published[0];
  assert.equal(msg.topic, 'swiftlet/devices/H1-F1-SENSOR/readings');
  assert.deepEqual(msg.opts, { qos: 1 });
  assert.deepEqual(msg.payload.map((p) => [p.metric, p.value]), [['TEMP', 28], ['HUMID', 82], ['CO2', 600], ['LIGHT', 2]]);
  assert.equal(msg.payload[0].at, '2026-10-12T10:40:07Z');
});

test('hot: H1-F2 troi dan tu 28 len 32, khu vuc khac giu 28', () => {
  const { sim, fc, clock } = setup('hot');
  const temps = [];
  for (let i = 0; i < 30; i += 1) {
    clock.t += 60_000;
    sim.tick();
    temps.push(value(lastReading(fc, 'H1-F2-SENSOR'), 'TEMP'));
  }
  assert.equal(temps[0], 29.13);                                   // 32 - 4 * exp(-1/3), tau 3 phut
  for (let i = 1; i < temps.length; i += 1) assert.ok(temps[i] >= temps[i - 1]);
  assert.ok(temps.at(-1) > 31.9 && temps.at(-1) <= 32);
  assert.equal(value(lastReading(fc, 'H1-F1-SENSOR'), 'TEMP'), 28);
});

test('lenh FAN bat H1-F2 -> TEMP va CO2 H1-F2 giam; khu vuc khac khong doi', () => {
  const { sim, fc, clock } = setup();
  fc.latest('H1-F2-FAN').emit('message', 'swiftlet/devices/H1-F2-FAN/command', command({}));
  clock.t += 60_000;
  sim.tick();
  assert.ok(value(lastReading(fc, 'H1-F2-SENSOR'), 'TEMP') < 28);
  assert.ok(value(lastReading(fc, 'H1-F2-SENSOR'), 'CO2') < 600);
  assert.equal(value(lastReading(fc, 'H1-F3-SENSOR'), 'TEMP'), 28);
});

test('dt lay tu dong ho that; dong ho lui -> gia tri khong doi, at van tang 1 giay', () => {
  const { sim, fc, clock } = setup('hot');
  clock.t += 60_000;
  sim.tick();
  const before = lastReading(fc, 'H1-F2-SENSOR');
  clock.t -= 120_000;
  sim.tick();
  const after = lastReading(fc, 'H1-F2-SENSOR');
  assert.equal(value(after, 'TEMP'), value(before, 'TEMP'));
  assert.equal(Date.parse(after[0].at) - Date.parse(before[0].at), 1000);
});

test('lenh sai va lenh cu -> canh bao, khong dung chuong trinh', () => {
  const { sim, fc, warns } = setup();
  const fan = fc.latest('H1-F2-FAN');
  fan.emit('message', 't', Buffer.from('khong-json'));
  fan.emit('message', 't', command({ issuedAt: '2026-10-12T10:40:05Z' }));
  fan.emit('message', 't', command({ issuedAt: '2026-10-12T10:40:01Z', isOn: false }));
  assert.equal(warns.length, 2);
  assert.match(warns[0], /H1-F2-FAN.*khong phai JSON/);
  assert.match(warns[1], /H1-F2-FAN.*cu/);
  assert.equal(sim.actuators.get('H1-F2-FAN').state.isOn, true);
});

test('loi MQTT tren mot ket noi -> canh bao theo ma thiet bi, khong nem', () => {
  const { fc, warns } = setup();
  fc.latest('H1-F1-SENSOR').emit('error', new Error('Connection refused: Not authorized'));
  assert.match(warns[0], /H1-F1-SENSOR.*Not authorized/);
});

test('stop: ngat moi ket noi', async () => {
  const { sim, fc } = setup();
  await sim.stop();
  assert.ok(fc.clients.every((c) => c.ended));
});
```

`simulator/test/main.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAIN = fileURLToPath(new URL('../src/main.mjs', import.meta.url));
const ENV = { MQTT_URL: 'mqtt://127.0.0.1:9', MQTT_USERNAME: 'simulator', MQTT_PASSWORD: 'bi-mat-123', READING_INTERVAL_SECONDS: '10', NOISE_SEED: '1' };
const run = (env, args = []) => spawnSync(process.execPath, [MAIN, ...args], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 10_000 });

test('mat khau rong -> dung ma 1, cau ro rang', () => {
  const r = run({ ...ENV, MQTT_PASSWORD: '' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /MQTT_PASSWORD/);
});

test('kich ban la -> dung ma 2, khong in mat khau', () => {
  const r = run(ENV, ['--scenario', 'cold']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /cold/);
  assert.ok(!(r.stdout + r.stderr).includes('bi-mat-123'));
});

test('nhip sai -> dung ma 1', () => {
  assert.equal(run({ ...ENV, READING_INTERVAL_SECONDS: '0' }).status, 1);
});
```

Run: `node --test`
Expected: FAIL `Cannot find module …/src/config.mjs` (và các module khác chưa có).

- [ ] **Step 2: Viết `simulator/src/config.mjs`**

```js
// Doc bien .env (node --env-file). Thong bao loi chi neu ten bien, khong bao gio in mat khau.
export function readConfig(env) {
  const url = (env.MQTT_URL ?? '').trim();
  if (!url) throw new Error('MQTT_URL rong trong simulator/.env');
  const username = (env.MQTT_USERNAME ?? '').trim();
  if (!username) throw new Error('MQTT_USERNAME rong trong simulator/.env');
  const password = env.MQTT_PASSWORD ?? '';
  if (!password) throw new Error('MQTT_PASSWORD rong trong simulator/.env (dien mat khau tai khoan simulator)');
  const rawInterval = (env.READING_INTERVAL_SECONDS ?? '').trim();
  const intervalSeconds = Number(rawInterval);
  if (rawInterval === '' || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error('READING_INTERVAL_SECONDS phai la so duong (giay)');
  }
  const rawSeed = (env.NOISE_SEED ?? '').trim();
  let noiseSeed = null;
  if (rawSeed !== '') {
    noiseSeed = Number(rawSeed);
    if (!Number.isInteger(noiseSeed)) throw new Error('NOISE_SEED phai la so nguyen (de trong = khong nhieu)');
  }
  return { url, username, password, intervalSeconds, noiseSeed };
}
```

- [ ] **Step 3: Viết `simulator/src/args.mjs`**

```js
// Tham so dong lenh: --scenario, --drop <ma>[,<ma>] --drop-after <phut> --drop-for <phut> (spec simulator 2.2, 2.6).
import { parseArgs } from 'node:util';
import { SCENARIOS } from './scenarios.mjs';

export const DROP_MIN_RECOMMENDED = 7;
const DROP_KEYS = ['drop', 'drop-after', 'drop-for'];

export function parseCli(argv, codes) {
  const { values } = parseArgs({
    args: argv,
    options: {
      scenario: { type: 'string', default: 'normal' },
      drop: { type: 'string' },
      'drop-after': { type: 'string' },
      'drop-for': { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!SCENARIOS.includes(values.scenario)) {
    throw new Error(`kich ban la: ${values.scenario}; hop le: ${SCENARIOS.join(', ')}`);
  }
  const warnings = [];
  const given = DROP_KEYS.filter((k) => values[k] !== undefined);
  if (given.length === 0) return { scenario: values.scenario, drop: null, warnings };
  if (given.length < DROP_KEYS.length) throw new Error('--drop can di cung --drop-after va --drop-for');

  const list = values.drop.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = list.filter((c) => !codes.includes(c));
  if (list.length === 0 || unknown.length) throw new Error(`--drop co ma thiet bi la: ${unknown.join(', ') || '(rong)'}`);
  const afterMinutes = Number(values['drop-after']);
  if (!Number.isFinite(afterMinutes) || afterMinutes < 0) throw new Error('--drop-after phai la so phut >= 0');
  const forMinutes = Number(values['drop-for']);
  if (!Number.isFinite(forMinutes) || forMinutes <= 0) throw new Error('--drop-for phai la so phut > 0');
  if (forMinutes < DROP_MIN_RECOMMENDED) {
    warnings.push(`--drop-for ${forMinutes} < ${DROP_MIN_RECOMMENDED} phut: co the khong thay DEVICE_OFFLINE (nguong 5 phut + nhip 60 giay)`);
  }
  return { scenario: values.scenario, drop: { codes: list, afterMinutes, forMinutes }, warnings };
}
```

- [ ] **Step 4: Viết `simulator/src/sim.mjs`**

```js
// Rap simulator: moi thiet bi mot ket noi (client id = ma), nhip gui so do, nhan lenh (spec simulator 1.6, 2.3, 2.4).
import { ActuatorState, commandTopic, parseCommand } from './commands.mjs';
import { isActuator } from './devices.mjs';
import { METRICS, outputValue, step } from './model.mjs';
import { buildReadings, nextAt, readingsTopic } from './readings.mjs';
import { baseFor, loadScenario } from './scenarios.mjs';

export class Simulator {
  constructor({ devices, scenario, connect, now = () => Date.now(), log = console, noise = () => 0 }) {
    this.devices = devices;
    this.scenario = scenario;
    this.connect = connect;
    this.now = now;
    this.log = log;
    this.noise = noise;
    this.clients = new Map();
    this.sensors = new Map();
    this.actuators = new Map();
  }

  start() {
    const normal = loadScenario('normal');
    const t = this.now();
    for (const d of this.devices) {
      if (isActuator(d)) {
        this.actuators.set(d.code, { device: d, state: new ActuatorState() });
      } else {
        // Moi khu vuc bat dau o muc normal roi troi dan ve nen cua kich ban (spec 2.2).
        this.sensors.set(d.code, { device: d, state: baseFor(normal, d.zone), base: baseFor(this.scenario, d.zone), lastMs: t, lastAtMs: null });
      }
      this.attach(d);
    }
  }

  attach(d) {
    const client = this.connect(d.code);
    this.clients.set(d.code, client);
    client.on('error', (e) => this.log.warn(`${d.code}: loi MQTT: ${e.message}`));
    if (isActuator(d)) {
      client.on('connect', () => client.subscribe(commandTopic(d.code), { qos: 1 }));
      client.on('message', (_topic, buf) => this.onCommand(d.code, buf));
    }
    return client;
  }

  onCommand(code, buf) {
    const r = parseCommand(buf);
    if (!r.ok) {
      this.log.warn(`${code}: bo lenh sai (${r.reason})`);
      return;
    }
    if (!this.actuators.get(code).state.apply(r.cmd)) {
      this.log.warn(`${code}: bo lenh cu hon lenh da ap dung (issuedAt ${r.cmd.issuedAt})`);
    }
  }

  zoneActuators(zone) {
    return [...this.actuators.values()]
      .filter((a) => a.device.zone === zone)
      .map((a) => ({ type: a.device.type, isOn: a.state.isOn, level: a.state.level }));
  }

  tick() {
    for (const [code, s] of this.sensors) {
      const nowMs = this.now();
      s.state = step(s.state, this.zoneActuators(s.device.zone), s.base, (nowMs - s.lastMs) / 1000);
      s.lastMs = nowMs;
      s.lastAtMs = nextAt(s.lastAtMs, nowMs);
      const values = Object.fromEntries(METRICS.map((m) => [m, outputValue(m, s.state[m], this.noise(m))]));
      this.send(code, readingsTopic(code), buildReadings(code, values, s.lastAtMs));
    }
  }

  send(code, topic, payload, qos = 1) {
    this.clients.get(code).publish(topic, JSON.stringify(payload), { qos });
  }

  async stop() {
    await Promise.all([...this.clients.values()].map((c) => c.endAsync()));
  }
}
```

- [ ] **Step 5: Viết `simulator/src/main.mjs`**

```js
// Diem vao: npm start -- --scenario hot (spec simulator 1.2, 1.6). Khong bao gio in mat khau.
import mqtt from 'mqtt';
import { parseCli } from './args.mjs';
import { readConfig } from './config.mjs';
import { loadDevices } from './devices.mjs';
import { loadScenario } from './scenarios.mjs';
import { Simulator } from './sim.mjs';

function fail(message, code) {
  console.error(`Loi: ${message}`);
  process.exit(code);
}

const devices = loadDevices();
let cfg;
let cli;
try {
  cfg = readConfig(process.env);
} catch (e) {
  fail(e.message, 1);
}
try {
  cli = parseCli(process.argv.slice(2), devices.map((d) => d.code));
} catch (e) {
  fail(e.message, 2);
}
for (const w of cli.warnings) console.warn(`Canh bao: ${w}`);

const sim = new Simulator({
  devices,
  scenario: loadScenario(cli.scenario),
  connect: (code) => mqtt.connect(cfg.url, { clientId: code, username: cfg.username, password: cfg.password, reconnectPeriod: 1000 }),
});
sim.start();
console.log(`Simulator: ${devices.length} thiet bi, kich ban ${cli.scenario}, gui so do moi ${cfg.intervalSeconds} giay`);

const timers = [setInterval(() => sim.tick(), cfg.intervalSeconds * 1000)];

let stopping = false;
process.on('SIGINT', async () => {
  if (stopping) process.exit(1); // Ctrl+C lan hai: thoat ngay
  stopping = true;
  console.log('Dang ngat ket noi...');
  for (const t of timers) clearTimeout(t);
  await sim.stop();
  process.exit(0);
});
```

- [ ] **Step 6: Chạy test**

Run: `node --test`
Expected: PASS toàn bộ (config 11, args 6, sim 8, main 3, cùng các test Task 1–6).

- [ ] **Step 7: Viết đủ `simulator/README.md`**

Thay khung Task 1 bằng (tiếng Việt có dấu):
1. **Cài đặt**: Node theo CLAUDE.md; `npm ci`; **chép `.env.example` thành `.env` trước khi chạy**, điền `MQTT_PASSWORD` của tài khoản `simulator` (tạo theo `infra/mosquitto/README.md`). Không commit `.env`, không gửi mật khẩu qua kênh chung.
2. **Chạy**: `npm start` (kịch bản `normal`), `npm start -- --scenario hot`, `npm start -- --scenario dry`. Bật **sau Mosquitto, trước backend** (backend 7.4). Kiểm `MQTT_URL` trước khi chạy khi demo chung LAN.
3. **Chỉ chạy một simulator trên một broker** (client id = mã thiết bị; hai simulator ngắt nhau liên tục).
4. **Dừng**: Ctrl+C một lần (ngắt đúng cách); lần hai thoát ngay. Nếu `npm start` hỏi "Terminate batch job (Y/N)?" thì chạy thẳng `node --env-file=.env src/main.mjs --scenario hot` (ghi theo S6).
5. **Kịch bản** và chu kỳ mong đợi (spec 2.1): `hot` FAN H1-F2 bật/tắt chu kỳ ≈ 7 phút; `dry` MIST H1-F3 ≈ 6 phút; `normal` không thiết bị nào bật. Hằng số chỉ đúng với ngưỡng seed.
6. **Checklist demo** (spec 2.8, nguyên 5 điểm).
7. **Test**: `npm test` (không cần broker).

- [ ] **Step 8: Kiểm tay với Mosquitto (S6) — chưa cần backend**

Cửa sổ 1: Mosquitto. Cửa sổ 2: `mosquitto_sub -u simulator -P <mật khẩu> -t "swiftlet/#" -v`. Cửa sổ 3: `cd simulator; npm start`.

Expected: mỗi 10 giây 6 dòng `swiftlet/devices/H1-…-SENSOR/readings [ … 4 phần tử … ]`, giá trị 28/82/600/2.

Gửi lệnh tay (PowerShell 5.1 cần `\"` trong JSON khi truyền cho chương trình ngoài):

```powershell
mosquitto_pub -u simulator -P <mat khau> -q 1 -r -t swiftlet/devices/H1-F2-FAN/command -m '{\"isOn\":true,\"level\":100,\"mode\":\"MANUAL\",\"issuedAt\":\"2026-10-20T03:00:00Z\"}'
```

Expected: TEMP của H1-F2 giảm dần qua các nhịp (≈ −0,08 °C mỗi 10 giây lúc đầu). Xóa tin retained thử nghiệm: `mosquitto_pub -u simulator -P <mat khau> -r -n -t swiftlet/devices/H1-F2-FAN/command`.

Nhấn Ctrl+C trong cửa sổ 3: có dòng `Dang ngat ket noi...`, thoát. Ghi S6 (có hỏi "Terminate batch job?" không).

- [ ] **Step 9: Commit**

```powershell
git status   # khong co simulator/.env
git add simulator/src/config.mjs simulator/src/args.mjs simulator/src/sim.mjs simulator/src/main.mjs simulator/test/fake-client.mjs simulator/test/config.test.mjs simulator/test/args.test.mjs simulator/test/sim.test.mjs simulator/test/main.test.mjs simulator/README.md simulator/spikes/RESULTS.md
git commit -m "feat(simulator): 26 kết nối MQTT, gửi số đo theo nhịp, nhận lệnh retained tác động lên số đo, Ctrl+C ngắt đúng cách

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Kiểm tay đầu-cuối với backend thật (spec 3.3 bước 1–4)

**Files:**
- Create: `simulator/results/e2e.md`
- Modify: `simulator/spikes/RESULTS.md` (S7)

**Interfaces:**
- Consumes: backend đã xong plan backend Task 13–16 (nhận MQTT, vòng điều khiển, control endpoint) trên `SwiftletCare_Dev`; web hoặc API để xem số đo và trạng thái thiết bị.
- Produces: `results/e2e.md` — bằng chứng vòng điều khiển demo được.

- [ ] **Step 1: Chuẩn bị**

Thứ tự bật (backend 7.4): SQL Server → Mosquitto → **simulator** → backend → web. Ngày neo dữ liệu mẫu = hôm qua (spec 2.8). Mở trang khu vực H1-F2 và H1-F3 trên web (hoặc gọi `GET /api/houses/{houseId}/latest-readings`, plan backend Task 17).

- [ ] **Step 2: Chạy bốn kịch bản kiểm, ghi giờ bắt đầu và quan sát**

1. `npm start -- --scenario hot` ít nhất **20 phút**: FAN H1-F2 bật rồi tắt, lặp lại; TEMP lên xuống quanh 28–30. Ghi giờ mỗi lần bật/tắt (log backend hoặc web) → chu kỳ thật.
2. Ctrl+C, `npm start -- --scenario dry` ≥ 20 phút: MIST H1-F3 bật rồi tắt, lặp lại. Ghi chu kỳ thật.
3. Ctrl+C, `npm start -- --scenario normal` 10 phút: **không thiết bị nào bật** (trừ lệnh còn từ bước trước tự nhả khi số đo về vùng bình thường — ghi rõ).
4. Kịch bản `normal`, điều khiển tay FAN H1-F2 **Level 50** trên web (hoặc `POST /api/devices/{id}/control` `{"mode":"MANUAL","isOn":true,"level":50}`): TEMP giảm chậm hơn khi Level 100 (so độ giảm sau 5 phút). Trả FAN về AUTO sau khi kiểm.

- [ ] **Step 3: Ghi `simulator/results/e2e.md`**

```markdown
# Kiểm tay đầu-cuối simulator ↔ backend (spec simulator 3.3)

- Ngày: _…_ · Người làm: TV5 · Commit simulator: _…_ · Commit backend: _…_ · CSDL: SwiftletCare_Dev

| Bước | Mong đợi | Quan sát (giờ bật/tắt, giá trị) | Đạt |
|---|---|---|---|
| 1 `hot` | FAN H1-F2 bật/tắt lặp lại, chu kỳ ≈ 7 phút | | |
| 2 `dry` | MIST H1-F3 bật/tắt lặp lại, chu kỳ ≈ 6 phút | | |
| 3 `normal` | Không thiết bị nào bật trong 10 phút | | |
| 4 FAN Level 50 | TEMP giảm chậm hơn Level 100 | | |
```

S7 trong `spikes/RESULTS.md`: chu kỳ thật so với tính tay. Chu kỳ lệch nhiều hoặc thiết bị bật mãi: dùng `superpowers:systematic-debugging` (kiểm ngưỡng thật trong CSDL, `issuedAt` lệnh, log `bo lenh cu`), báo TV2 nếu nghi vòng điều khiển; chỉnh hằng số mô hình chỉ khi test bất đẳng thức (Task 4) vẫn đạt, ghi thay đổi vào spec 2.1.

- [ ] **Step 4: Commit**

```powershell
git add simulator/results/e2e.md simulator/spikes/RESULTS.md
git commit -m "docs(simulator): kết quả kiểm tay hot/dry/normal và FAN Level 50 với backend thật

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 (dưới ranh giới cắt): `--drop` mất kết nối thật (cách B) và heartbeat 30 giây

**Files:**
- Create: `simulator/test/drop.test.mjs`
- Modify: `simulator/src/sim.mjs`, `simulator/src/main.mjs`, `simulator/README.md`

**Interfaces:**
- Consumes: `Simulator` (Task 7), `parseCli` (`drop`) (Task 7), `isoSecond` (Task 5), kết quả S4 (Task 1).
- Produces: trong `sim.mjs`: `heartbeatTopic(code) -> string`; `Simulator.dropped: Map<code, Array<{topic, payload}>>`; `send()` giữ tin QoS 1 của thiết bị đang ngắt vào hàng đợi, bỏ tin QoS 0; `heartbeat()` (20 cơ cấu chấp hành, QoS 0, `{"device","at"}`); `drop(codes): Promise<void>` (ngắt thật bằng `endAsync`); `restore(codes): void` (kết nối mới, khi `connect` thì gửi bù theo thứ tự rồi xóa hàng đợi). `main.mjs`: `HEARTBEAT_SECONDS = 30`.

- [ ] **Step 1: Viết test (phải fail)**

`simulator/test/drop.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDevices } from '../src/devices.mjs';
import { loadScenario } from '../src/scenarios.mjs';
import { Simulator, heartbeatTopic } from '../src/sim.mjs';
import { fakeConnect } from './fake-client.mjs';

const T0 = Date.UTC(2026, 9, 12, 10, 40, 7);

function setup() {
  const fc = fakeConnect();
  const clock = { t: T0 };
  const sim = new Simulator({ devices: loadDevices(), scenario: loadScenario('normal'), connect: fc.connect,
    now: () => clock.t, log: { log: () => {}, warn: () => {} } });
  sim.start();
  return { sim, fc, clock };
}

test('heartbeat: 20 co cau chap hanh, QoS 0, payload device + at', () => {
  const { sim, fc } = setup();
  sim.heartbeat();
  const beats = fc.clients.flatMap((c) => c.published);
  assert.equal(beats.length, 20);
  const fan = fc.latest('H1-F2-FAN').published[0];
  assert.deepEqual(fan, { topic: heartbeatTopic('H1-F2-FAN'), payload: { device: 'H1-F2-FAN', at: '2026-10-12T10:40:07Z' }, opts: { qos: 0 } });
  assert.equal(fc.latest('H1-F2-SENSOR').published.length, 0);
});

test('drop: ngat that, so do van sinh va giu trong hang doi; restore gui bu dung thu tu', async () => {
  const { sim, fc, clock } = setup();
  const first = fc.latest('H1-F1-SENSOR');
  await sim.drop(['H1-F1-SENSOR']);
  assert.equal(first.ended, true);
  for (let i = 0; i < 3; i += 1) {
    clock.t += 10_000;
    sim.tick();
  }
  assert.equal(first.published.length, 0);
  assert.equal(sim.dropped.get('H1-F1-SENSOR').length, 3);
  assert.equal(fc.latest('H1-F2-SENSOR').published.length, 3);       // thiet bi khac van gui

  sim.restore(['H1-F1-SENSOR']);
  const second = fc.latest('H1-F1-SENSOR');
  assert.notEqual(second, first);
  clock.t += 10_000;
  sim.tick();                                                          // nhip moi truoc khi ket noi xong: vao cuoi hang doi
  assert.equal(second.published.length, 0);
  second.emit('connect');
  const ats = second.published.map((m) => m.payload[0].at);
  assert.deepEqual(ats, ['2026-10-12T10:40:17Z', '2026-10-12T10:40:27Z', '2026-10-12T10:40:37Z', '2026-10-12T10:40:47Z']);
  assert.ok(second.published.every((m) => m.opts.qos === 1));
  assert.equal(sim.dropped.has('H1-F1-SENSOR'), false);
  clock.t += 10_000;
  sim.tick();
  assert.equal(second.published.length, 5);
});

test('drop co cau chap hanh: khong heartbeat luc ngat; ket noi lai thi subscribe command lai', async () => {
  const { sim, fc } = setup();
  await sim.drop(['H1-F2-FAN']);
  sim.heartbeat();
  assert.equal(fc.latest('H1-F2-FAN').published.length, 0);
  sim.restore(['H1-F2-FAN']);
  fc.latest('H1-F2-FAN').emit('connect');
  assert.deepEqual(fc.latest('H1-F2-FAN').subscriptions, [{ topic: 'swiftlet/devices/H1-F2-FAN/command', opts: { qos: 1 } }]);
  assert.equal(sim.dropped.size, 0);
});
```

Run: `node --test test/drop.test.mjs`
Expected: FAIL `SyntaxError: The requested module '../src/sim.mjs' does not provide an export named 'heartbeatTopic'`.

- [ ] **Step 2: Sửa `simulator/src/sim.mjs`**

Thêm import `isoSecond` vào dòng import `readings.mjs`: `import { buildReadings, isoSecond, nextAt, readingsTopic } from './readings.mjs';`. Thêm sau các import:

```js
export const heartbeatTopic = (code) => `swiftlet/devices/${code}/heartbeat`;
```

Trong `constructor`, thêm dòng cuối:

```js
    this.dropped = new Map(); // ma -> hang doi tin QoS 1 sinh ra trong luc ngat (spec 2.6, cach B)
```

Thay hàm `send` bằng, và thêm ba hàm ngay sau nó:

```js
  send(code, topic, payload, qos = 1) {
    const queue = this.dropped.get(code);
    if (queue) {
      if (qos === 1) queue.push({ topic, payload }); // heartbeat QoS 0 bo luon trong luc ngat
      return;
    }
    this.clients.get(code).publish(topic, JSON.stringify(payload), { qos });
  }

  heartbeat() {
    const at = isoSecond(this.now());
    for (const code of this.actuators.keys()) this.send(code, heartbeatTopic(code), { device: code, at }, 0);
  }

  async drop(codes) {
    for (const code of codes) {
      this.dropped.set(code, []);
      await this.clients.get(code).endAsync(true);
      this.log.log(`${code}: da ngat ket noi (--drop)`);
    }
  }

  restore(codes) {
    for (const code of codes) {
      const client = this.attach(this.devices.find((d) => d.code === code));
      client.once('connect', () => {
        const queue = this.dropped.get(code) ?? [];
        this.dropped.delete(code);
        for (const m of queue) client.publish(m.topic, JSON.stringify(m.payload), { qos: 1 });
        this.log.log(`${code}: ket noi lai, gui bu ${queue.length} tin`);
      });
    }
  }
```

`attach` đăng ký `on('connect')` (subscribe lệnh) trước `once('connect')` (gửi bù), nên thiết bị đã subscribe lại lệnh trước khi gửi bù. `stop()` giữ nguyên: kết nối đã `end` gọi `endAsync` lần nữa vô hại.

- [ ] **Step 3: Sửa `simulator/src/main.mjs`**

Thêm hằng sau các import: `export const HEARTBEAT_SECONDS = 30;`. Thay dòng `const timers = [...]` bằng:

```js
const timers = [
  setInterval(() => sim.tick(), cfg.intervalSeconds * 1000),
  setInterval(() => sim.heartbeat(), HEARTBEAT_SECONDS * 1000),
];
if (cli.drop) {
  const { codes, afterMinutes, forMinutes } = cli.drop;
  console.log(`--drop ${codes.join(',')}: ngat sau ${afterMinutes} phut, trong ${forMinutes} phut`);
  timers.push(setTimeout(() => sim.drop(codes), afterMinutes * 60_000));
  timers.push(setTimeout(() => sim.restore(codes), (afterMinutes + forMinutes) * 60_000));
}
```

(`clearTimeout` trong xử lý Ctrl+C hủy được cả `setInterval` lẫn `setTimeout`.)

- [ ] **Step 4: Chạy test**

Run: `node --test`
Expected: PASS toàn bộ, gồm 3 test mới.

- [ ] **Step 5: README**

Thêm mục **Mất kết nối** (spec 2.6, 2.8 điểm 4–5): cú pháp `npm start -- --drop H1-F1-SENSOR --drop-after 1 --drop-for 7`; khuyến nghị `--drop-for` ≥ 7 phút; sau khi kết nối lại một loạt số đo cũ đến cùng lúc, số đo cũ hơn 2 phút chỉ được lưu, không mở/đóng cảnh báo — người trình bày nói trước. Mục **Heartbeat**: 20 cơ cấu chấp hành gửi mỗi 30 giây; cảm biến không gửi.

- [ ] **Step 6: Commit**

```powershell
git add simulator/src/sim.mjs simulator/src/main.mjs simulator/test/drop.test.mjs simulator/README.md
git commit -m "feat(simulator): --drop ngắt kết nối thật, giữ và gửi bù số đo theo thứ tự; heartbeat 30 giây cho cơ cấu chấp hành

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10 (Nên có): Nhiễu có hạt giống cố định

**Files:**
- Create: `simulator/src/noise.mjs`, `simulator/test/noise.test.mjs`
- Modify: `simulator/src/main.mjs`

**Interfaces:**
- Consumes: `readConfig().noiseSeed` (Task 7), tham số `noise` của `Simulator` (Task 7).
- Produces: `noise.mjs`: `NOISE_AMPLITUDE = { TEMP: 0.05, HUMID: 0.2, CO2: 5, LIGHT: 0.05 }`; `mulberry32(seed: number) -> () => number` (số trong [0, 1)); `makeNoise(seed: number | null) -> (metric) => number` (`null` → luôn 0).

- [ ] **Step 1: Viết test (phải fail)**

`simulator/test/noise.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOISE_AMPLITUDE, makeNoise, mulberry32 } from '../src/noise.mjs';

const seq = (seed, n = 50) => {
  const noise = makeNoise(seed);
  return Array.from({ length: n }, (_, i) => noise(['TEMP', 'HUMID', 'CO2', 'LIGHT'][i % 4]));
};

test('cung hat giong -> cung day; khac hat giong -> khac day', () => {
  assert.deepEqual(seq(1), seq(1));
  assert.notDeepEqual(seq(1), seq(2));
});

test('nhieu deu trong +- bien do tung chi so', () => {
  const noise = makeNoise(7);
  for (let i = 0; i < 1000; i += 1) {
    for (const m of Object.keys(NOISE_AMPLITUDE)) assert.ok(Math.abs(noise(m)) <= NOISE_AMPLITUDE[m]);
  }
});

test('hat giong null -> khong nhieu', () => {
  assert.ok(seq(null).every((v) => v === 0));
});

test('mulberry32 trong [0, 1)', () => {
  const r = mulberry32(123);
  for (let i = 0; i < 1000; i += 1) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});
```

Run: `node --test test/noise.test.mjs`
Expected: FAIL `Cannot find module …/src/noise.mjs`.

- [ ] **Step 2: Viết `simulator/src/noise.mjs`**

```js
// Nhieu deu +- nho cong vao gia tri GUI DI (khong cong vao trang thai), hat giong co dinh (spec simulator 2.2).
export const NOISE_AMPLITUDE = { TEMP: 0.05, HUMID: 0.2, CO2: 5, LIGHT: 0.05 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise(seed) {
  if (seed === null) return () => 0;
  const rand = mulberry32(seed);
  return (metric) => (rand() * 2 - 1) * NOISE_AMPLITUDE[metric];
}
```

- [ ] **Step 3: Nối vào `main.mjs`**

Thêm `import { makeNoise } from './noise.mjs';` và tham số `noise: makeNoise(cfg.noiseSeed),` trong `new Simulator({ … })`.

- [ ] **Step 4: Chạy test**

Run: `node --test`
Expected: PASS toàn bộ (thêm 4 test).

- [ ] **Step 5: Commit**

```powershell
git add simulator/src/noise.mjs simulator/src/main.mjs simulator/test/noise.test.mjs
git commit -m "feat(simulator): nhiễu đều có hạt giống NOISE_SEED, cộng vào giá trị gửi đi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Kiểm tay mất kết nối (spec 3.3 bước 5) và kiểm tra cuối

**Files:**
- Modify: `simulator/results/e2e.md`, `simulator/spikes/RESULTS.md`

**Interfaces:**
- Consumes: Task 9; backend có nhịp kiểm `DEVICE_OFFLINE` (plan backend Task 20) và heartbeat MQTT (plan backend Task 26, dưới ranh giới cắt — chưa có thì bỏ phần heartbeat của bước này).

- [ ] **Step 1: Chạy kịch bản mất kết nối**

```powershell
npm start -- --drop H1-F1-SENSOR --drop-after 1 --drop-for 7
```

Expected: phút 1 log `H1-F1-SENSOR: da ngat ket noi (--drop)`; khoảng phút 6–7 web có cảnh báo `DEVICE_OFFLINE` cho H1-F1-SENSOR; phút 8 log `ket noi lai, gui bu ~42 tin` (7 phút × 6 tin/phút), cảnh báo `DEVICE_OFFLINE` đóng; lịch sử số đo H1-F1 không có lỗ trong 7 phút đó và không trùng (`GET /api/zones/{zoneId}/readings` của H1-F1).

- [ ] **Step 2: Ghi kết quả**

Thêm dòng vào bảng `results/e2e.md`: `| 5 --drop | DEVICE_OFFLINE mở rồi đóng; số đo bù đủ, không trùng | … | … |`. Nếu số đo bù thiếu: dùng `superpowers:systematic-debugging` (log simulator `gui bu N tin`, `duplicates` trong log backend).

- [ ] **Step 3: Kiểm tra cuối cùng (trước khi mở PR `simulator` → `main`)**

- `cd simulator; npm test` → PASS.
- `git status --short` không có `.env`, `node_modules`.
- `spikes/RESULTS.md` không còn dòng trống.
- Rà nhánh bằng `superpowers:requesting-code-review`; sửa vấn đề nghiêm trọng.
- Mở PR `simulator` → `main`, ít nhất một người duyệt; nội dung PR liệt kê task đã làm, kết quả S3, S4, S7, các bước e2e.

- [ ] **Step 4: Commit**

```powershell
git add simulator/results/e2e.md simulator/spikes/RESULTS.md
git commit -m "docs(simulator): kết quả kiểm tay mất kết nối và gửi bù số đo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
