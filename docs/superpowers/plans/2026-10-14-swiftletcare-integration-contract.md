# SwiftletCare integration-contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Người thực thi:** TV2 (chủ hợp đồng), theo cách Native (`superpowers:executing-plans`) trên máy mình. TV1 cùng duyệt PR.

**Goal:** Dựng `contracts/` (fixture cho mọi payload MQTT/AI/REST/WebSocket + thư viện thay chỗ giữ chỗ và so khớp + test kiểm fixture khớp hợp đồng) và `infra/mosquitto/` (cấu hình mẫu + hướng dẫn tài khoản), đúng spec integration-contract.

**Architecture:** Fixture là file JSON thuần trong `contracts/fixtures/{mqtt,ai,rest,ws}/`. `contracts/lib/fixtures.mjs` (không phụ thuộc gói nào) thay chỗ giữ chỗ (`{{now}}`, `{{ref:…}}`, …) và so khớp kết quả (`{{any:id}}`, …); backend import thư viện này cho test tích hợp, simulator/AI dùng để kiểm payload tự tạo. `contracts/test/*.test.mjs` chạy bằng `node --test`, kiểm cấu trúc fixture theo các quy tắc của hợp đồng, không cần CSDL hay broker.

**Tech Stack:** Node.js (≥ 20.19, máy nhóm dùng 25) với `node:test`, `node:assert` — không có dependency; PowerShell 5.1 (sinh ảnh mẫu bằng `System.Drawing`); Mosquitto 2.x cho Windows.

**Spec:** [docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md](../specs/2026-10-13-swiftletcare-integration-contract-design.md) · dữ liệu mẫu và SP: [database-core](../specs/2026-10-12-swiftletcare-database-core-design.md), [plan database-core](2026-10-14-swiftletcare-database-core.md) (Task 3, 12)

## Global Constraints

- **Mọi thay đổi hợp đồng đi qua Pull Request**, sửa spec và fixture **trong cùng một PR**; TV2 duyệt, thay đổi đụng SP thì TV1 cùng duyệt; merge xong báo cả nhóm (spec 1.6). Plan này làm trên nhánh `contract/fixtures`, mở **một PR** ở cuối.
- Tên trường camelCase; payload MQTT/AI dùng **đúng khóa JSON SP đọc** (`device`, `metric`, `value`, `at`, `camera`, `windowStart`, `in`, `out`, `class`, `confidence`). `snapshot` không do AI gửi.
- Mốc thời gian ISO 8601 UTC **bắt buộc có `Z`**; thiếu `Z` hoặc `+07:00` bị từ chối (REST 400, MQTT loại bản ghi). Ngày nghiệp vụ VN (`harvestDate`, `fromVnDate`, `toVnDate`) dạng `YYYY-MM-DD`.
- Trường không có giá trị trả `null`, không bỏ khóa. DECIMAL ra `number`.
- Cảnh báo (14 khóa, đúng thứ tự): `alertId, houseId, zoneId, deviceId, alertType, severity, metricCode, value, detectedClass, confidence, hasSnapshot, message, status, createdAt`.
- Fixture **không chứa mốc thời gian cố định** và **không chứa id cố định** (spec 4.3): mốc dùng `{{now…}}`/`{{window…}}`, id trong đầu vào dùng `{{ref:…}}`, id trong kết quả dùng `{{any:id}}` hoặc `{{ref:…}}`.
- Giá trị khớp dữ liệu mẫu database-core (ngày neo mặc định `2026-10-12`): người dùng `admin`/`owner1`/`owner2`; nhà `H1` (owner1), `H2` (owner2); khu vực `H1-F0..F3`, `H2-F0..F1`; thiết bị `<Nhà>-F<tầng>-<SENSOR|MIST|FAN|HEATER>` + `<Nhà>-F0-<SPEAKER|CAMERA>`; ngưỡng TEMP 26–30, HUMID 75–90, CO2 Max 1000, LIGHT Max 10; cảnh báo đang mở trong seed: H1-F3 HUMID (NEW), PREDATOR snake H1-F0 (ACK).
- Fixture cảnh báo ngưỡng mới dùng **H1-F1 TEMP**, không dùng H1-F3 HUMID.
- Fixture dưới ranh giới cắt có hậu tố `.cut`.
- Ảnh mẫu tự tạo bằng script, vài KB, không lấy từ internet.
- File fixture **UTF-8 không BOM** (`JSON.parse` lỗi với BOM; PowerShell 5.1 `Out-File`/`Set-Content` mặc định thêm BOM — tạo file bằng editor hoặc tool Write).
- File `.ps1` chỉ chứa ký tự ASCII (PowerShell 5.1 đọc file không BOM theo bảng mã ANSI).
- Không ghi mật khẩu vào repo: `infra/mosquitto/passwd`, `infra/mosquitto/data/` nằm trong `.gitignore`; fixture dùng `{{devPassword}}`, `{{serviceKey}}`, `{{token:…}}`.
- Commit message tiếng Việt, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Các chuỗi fixture sửa trạng thái của nhau** — `rest/alert-ack` đổi cảnh báo seed sang ACK; `mqtt/readings.invalid-*` ghi thêm số đo H1-F1 làm lệch trung bình của `rest/readings-history`; chuỗi AI tạo thêm cảnh báo PREDATOR làm đổi `rest/alerts-list.page`. Mong: **mỗi chuỗi `after` bắt đầu từ CSDL vừa phục hồi về dữ liệu mẫu** (`BACKUP` một lần sau `deploy.ps1`, `RESTORE … WITH REPLACE` trước mỗi chuỗi). Quy tắc ghi vào spec 4.3 (quy tắc 12) và `contracts/README.md` ở Task 1; bộ chạy thật thuộc plan backend.
2. **Chuỗi `after` dùng nhiều `now` khác nhau** — fixture `rest/readings-history` chạy sau `mqtt/readings`; nếu bộ chạy thay `{{now}}` riêng cho từng file thì khoảng thời gian lệch, kết quả rỗng. Mong: cả chuỗi dùng một `now`. `loadChain` + test ở Task 1.
3. **`{{now}}` rơi đúng lưới 5 phút** (VD 10:40:00) — trùng mốc số đo seed/ cửa sổ đếm chim, ra `duplicates`. Mong: cộng 7 giây. Test `baseNow` ở Task 1.
4. **Backend trả `…:00.000Z` (`toISOString`) còn fixture ghi `…:00Z`** — so chuỗi sẽ báo lệch giả. Mong: so mốc thời gian theo thời điểm. Test `match` ở Task 1.
5. **Dịch vụ Mosquitto do bộ cài Windows tạo đang giữ cổng 1883** — `mosquitto -c …` báo lỗi cổng bận hoặc client vào nhầm broker cho phép ẩn danh. Mong: README hướng dẫn dừng dịch vụ, bước kiểm tra ẩn danh bị từ chối. Ở Task 2.
6. **File fixture có BOM hoặc tiếng Việt sai mã** (`Nhiệt độ`, `Đã kiểm tra`) — `JSON.parse` lỗi hoặc so khớp `message` sai. Mong: test báo rõ file có BOM, chuỗi tiếng Việt giữ nguyên. Kiểm ở Task 3 (áp cho mọi thư mục).

## Cấu trúc file

```
contracts/
  package.json                 # type: module; scripts.test = node --test; không dependency
  README.md                    # cách dùng fixture, chỗ giữ chỗ, bộ so khớp, cách backend chạy fixture
  lib/fixtures.mjs             # baseNow, expand, match, loadFixture, loadChain, FIXTURES_DIR
  lib/seed-refs.mjs            # danh sách khóa {{ref:…}} hợp lệ theo seed database-core
  test/lib.test.mjs            # test thư viện
  test/fixtures.test.mjs       # test fixture khớp hợp đồng (mọi thư mục)
  test/mosquitto-conf.test.mjs # test cấu hình Mosquitto mẫu
  scripts/make-images.ps1      # sinh snake.jpg, not-jpeg.png
  fixtures/mqtt/*.json
  fixtures/ai/*.json, snake.jpg, not-jpeg.png
  fixtures/rest/*.json
  fixtures/ws/*.json
infra/mosquitto/
  mosquitto.conf               # mẫu, không mật khẩu
  acl                          # (Nên có, Task 7)
  README.md                    # checklist thiết lập trên Windows, mosquitto_passwd
.gitignore                     # thêm infra/mosquitto/passwd, infra/mosquitto/data/
```

## Bổ sung hợp đồng (Task 1 ghi vào spec, cùng PR với fixture)

Khi viết fixture thật, spec 4.3 còn thiếu các quy ước sau. Plan này **chốt chúng trong cùng PR** (spec 1.6):

| # | Bổ sung | Lý do |
|---|---|---|
| B1 | Chỗ giữ chỗ id theo seed: `{{ref:house:H1}}`, `{{ref:zone:H1-F1}}`, `{{ref:device:H1-F1-FAN}}`, `{{ref:user:owner1}}`, `{{ref:alert:H1-F3-HUMID}}` (cảnh báo THRESHOLD đang mở của khu vực + chỉ số). Chuỗi **chỉ gồm** một `{{ref:…}}` → số; nằm trong chuỗi dài hơn (đường dẫn) → chữ số | Đường dẫn REST cần id (`/api/devices/:deviceId/…`) mà quy tắc 2 cấm id cố định |
| B2 | `{{token:<username>}}` (JWT của người dùng seed), `{{serviceKey}}`, `{{devPassword}}` — bộ chạy test điền từ `.env` | Không ghi khóa/mật khẩu vào fixture |
| B3 | Ngữ pháp mốc thời gian: `{{now|window}}` + tùy chọn `±N(s|m|h)` + tùy chọn `:noZ` hoặc `:+07:00` (VD `{{window:noZ}}`, `{{now-1h:noZ}}`) | Spec chỉ liệt kê vài dạng; fixture cần thêm `{{now+1m}}`, `{{window:noZ}}` |
| B4 | Mốc thời gian trong kết quả so theo **thời điểm** (`…:00Z` khớp `…:00.000Z`) | Backend trả bằng `toISOString()` (spec 1.3) |
| B5 | Thân multipart: `"body": {"metadata": {…}, "image": "@snake.jpg"}` — `metadata` gửi dạng chuỗi JSON, giá trị bắt đầu bằng `@` là file cùng thư mục | Spec 4.3 chưa nói cách ghi multipart |
| B6 | `after` ghi dạng `<thư mục>/<tên không .json>` (VD `"rest/control.manual"`); cả chuỗi dùng **một** `now` | Fixture WS/MQTT phụ thuộc fixture ở thư mục khác |
| B7 | `details` của lỗi: `VALIDATION_ERROR` → `{"fields": [...]}` (tên trường lá); 50012 → `["in","out"]`, 50013 → `["class"]`, 50014 → `["windowStart"]`; mã khác → `null` | Spec 3.5 nói "details nêu trường sai" nhưng chưa có dạng |
| B8 | HTTP: tạo tài nguyên (`POST` tạo nhà, khu vực, thiết bị, người dùng, thu hoạch) → **201**; các `POST` hành động (login, control, AI, reset-password) → **200** | NestJS mặc định 201 cho mọi POST |
| B9 | `users.invalid-last-admin.json` **thay bằng** `users.invalid-modify-self.json` (409 `CANNOT_MODIFY_SELF`). `LAST_ADMIN` chỉ xảy ra khi hai ADMIN hạ nhau **đồng thời** (gọi tuần tự thì luôn còn người gọi là ADMIN) → backend kiểm bằng test đồng thời của riêng mình, không có fixture | Fixture tuần tự không tạo được tình huống này |
| B10 | Dạng phản hồi REST chưa ghi trong spec, lấy theo cột CSDL đổi camelCase: `user` = `{userId, username, fullName, email, phone, role, isActive}`; ngưỡng = `{zoneId, metricCode, minValue, maxValue, targetValue, updatedBy, updatedAt}`; lịch sử số đo = mảng `{bucketUtc, avgValue, minValue, maxValue}`; `PATCH /api/alerts/:id` = cột `sp_UpdateAlertStatus` `{alertId, houseId, zoneId, alertType, status, resolvedAt, resolvedBy}`; `POST /api/ai/heartbeat` = `{accepted, rejected}`; thu hoạch = `{harvestId, zoneId, harvestDate, nestCount, weightGram, grade, recordedBy, createdAt}`; báo cáo = mảng cột `sp_Report_EnvStabilityVsYield` camelCase; mục danh sách cảnh báo = 14 khóa cảnh báo | Fixture cần tập khóa chính xác |

---

### Task 1: Gói `contracts/` — thư viện chỗ giữ chỗ và so khớp, ghi bổ sung hợp đồng

**Files:**
- Create: `contracts/package.json`, `contracts/lib/fixtures.mjs`, `contracts/lib/seed-refs.mjs`, `contracts/test/lib.test.mjs`, `contracts/README.md`
- Modify: `docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md` (Phần 3.4, 4.3)

**Interfaces:**
- Produces (`contracts/lib/fixtures.mjs`, ES module):
  - `FIXTURES_DIR: string` — đường dẫn tuyệt đối `contracts/fixtures`.
  - `baseNow(date?: Date): Date` — làm tròn xuống giây; rơi đúng `mm:00` với `mm % 5 = 0` thì cộng 7 giây.
  - `expand(value: any, ctx: {now: Date, ref(kind, key): number, token(username): string, serviceKey: string, devPassword: string}): any` — thay mọi chỗ giữ chỗ trong giá trị JSON đã parse; giữ nguyên `{{any:…}}`; chỗ giữ chỗ lạ → `Error`.
  - `match(expected: any, actual: any): string[]` — danh sách chỗ lệch (rỗng = khớp); tập khóa object phải khớp chính xác.
  - `loadFixture(name: string, dir?: string): object` — `name` dạng `"mqtt/readings"`.
  - `loadChain(name: string, dir?: string): {name, fixture}[]` — các fixture theo `after`, cái chạy trước đứng trước; vòng lặp → `Error`.
- Produces (`contracts/lib/seed-refs.mjs`): `SEED_REFS: {house: string[], zone: string[], device: string[], user: string[], alert: string[]}`.

- [ ] **Step 1: Tạo nhánh và `contracts/package.json`**

```powershell
git switch -c contract/fixtures
```

`contracts/package.json`:

```json
{
  "name": "swiftletcare-contracts",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Fixture và thư viện so khớp hợp đồng tích hợp SwiftletCare",
  "exports": "./lib/fixtures.mjs",
  "scripts": {
    "test": "node --test"
  },
  "engines": {
    "node": ">=20.19"
  }
}
```

- [ ] **Step 2: Viết test thư viện `contracts/test/lib.test.mjs` (phải fail)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baseNow, expand, match, loadChain } from '../lib/fixtures.mjs';

const ctx = {
  now: new Date('2026-10-14T10:42:13Z'),
  ref: (kind, key) => ({ 'house:H1': 1, 'device:H1-F1-FAN': 17 })[`${kind}:${key}`] ?? assert.fail(`ref la ${kind}:${key}`),
  token: (u) => `tok-${u}`,
  serviceKey: 'svc',
  devPassword: 'pw',
};

test('baseNow: lam tron xuong giay, tranh luoi 5 phut', () => {
  assert.equal(baseNow(new Date('2026-10-14T10:40:00.500Z')).toISOString(), '2026-10-14T10:40:07.000Z');
  assert.equal(baseNow(new Date('2026-10-14T10:41:00.000Z')).toISOString(), '2026-10-14T10:41:00.000Z');
  assert.equal(baseNow(new Date('2026-10-14T10:40:03.900Z')).toISOString(), '2026-10-14T10:40:03.000Z');
});

test('expand: moc thoi gian', () => {
  const out = expand({
    a: '{{now}}', b: '{{now-30s}}', c: '{{now-10m}}', d: '{{now+1h}}',
    e: '{{window}}', f: '{{window-5m}}', g: '{{window+1m}}',
    h: '{{now:noZ}}', i: '{{now:+07:00}}', j: '{{window:noZ}}', k: '{{now-1h:noZ}}',
  }, ctx);
  assert.deepEqual(out, {
    a: '2026-10-14T10:42:13Z', b: '2026-10-14T10:41:43Z', c: '2026-10-14T10:32:13Z', d: '2026-10-14T11:42:13Z',
    e: '2026-10-14T10:40:00Z', f: '2026-10-14T10:35:00Z', g: '2026-10-14T10:41:00Z',
    h: '2026-10-14T10:42:13', i: '2026-10-14T17:42:13+07:00', j: '2026-10-14T10:40:00', k: '2026-10-14T09:42:13',
  });
});

test('expand: ref nguyen chuoi -> so, trong duong dan -> chu so; token, khoa', () => {
  const out = expand({
    houseId: '{{ref:house:H1}}',
    path: '/api/devices/{{ref:device:H1-F1-FAN}}/control?h={{ref:house:H1}}',
    auth: 'Bearer {{token:owner1}}', key: '{{serviceKey}}', pw: '{{devPassword}}',
    list: [{ at: '{{now}}' }], n: 5, z: null, t: true,
  }, ctx);
  assert.deepEqual(out, {
    houseId: 1, path: '/api/devices/17/control?h=1', auth: 'Bearer tok-owner1', key: 'svc', pw: 'pw',
    list: [{ at: '2026-10-14T10:42:13Z' }], n: 5, z: null, t: true,
  });
});

test('expand: giu nguyen bo so khop, cho giu cho la -> loi', () => {
  assert.deepEqual(expand({ id: '{{any:id}}', m: '{{any:string}}' }, ctx), { id: '{{any:id}}', m: '{{any:string}}' });
  assert.throws(() => expand('{{bogus}}', ctx), /bogus/);
  assert.throws(() => expand('{{now-5x}}', ctx), /now-5x/);
});

test('match: bo so khop', () => {
  assert.deepEqual(match({ a: '{{any:id}}' }, { a: 3 }), []);
  for (const bad of [0, -1, 1.5, '3', null]) assert.equal(match({ a: '{{any:id}}' }, { a: bad }).length, 1);
  assert.deepEqual(match('{{any:iso}}', '2026-10-14T10:42:13.000Z'), []);
  assert.equal(match('{{any:iso}}', '2026-10-14T17:42:13+07:00').length, 1);
  assert.equal(match('{{any:iso}}', '2026-10-14T10:42:13').length, 1);
  assert.deepEqual(match('{{any:string}}', 'x'), []);
  assert.equal(match('{{any:string}}', '').length, 1);
});

test('match: tap khoa chinh xac, mang, moc thoi gian theo thoi diem', () => {
  assert.equal(match({ a: 1 }, { a: 1, b: 2 }).length, 1);
  assert.equal(match({ a: 1, b: 2 }, { a: 1 }).length, 1);
  assert.equal(match([1, 2], [1]).length, 1);
  assert.deepEqual(match({ at: '2026-10-14T10:42:13Z' }, { at: '2026-10-14T10:42:13.000Z' }), []);
  assert.equal(match({ at: '2026-10-14T10:42:13Z' }, { at: '2026-10-14T10:42:14.000Z' }).length, 1);
  assert.deepEqual(match({ m: 'Nhiệt độ' }, { m: 'Nhiệt độ' }), []);
  assert.match(match({ a: { b: 1 } }, { a: { b: 2 } })[0], /\$\.a\.b/);
  assert.equal(match({ v: null }, { v: 0 }).length, 1);
});

test('loadChain: theo after, cai chay truoc dung truoc; vong lap -> loi', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fx-'));
  mkdirSync(join(dir, 'rest'));
  mkdirSync(join(dir, 'ws'));
  writeFileSync(join(dir, 'rest', 'a.json'), '{"method":"GET"}');
  writeFileSync(join(dir, 'rest', 'b.json'), '{"after":"rest/a"}');
  writeFileSync(join(dir, 'ws', 'c.json'), '{"after":"rest/b"}');
  assert.deepEqual(loadChain('ws/c', dir).map((x) => x.name), ['rest/a', 'rest/b', 'ws/c']);
  writeFileSync(join(dir, 'rest', 'a.json'), '{"after":"ws/c"}');
  assert.throws(() => loadChain('ws/c', dir), /vong lap/);
});
```

- [ ] **Step 3: Chạy test để thấy fail**

Run: `cd contracts; npm test`
Expected: FAIL — `Cannot find module '…/contracts/lib/fixtures.mjs'`.

- [ ] **Step 4: Viết `contracts/lib/fixtures.mjs`**

```js
// Thu vien fixture hop dong SwiftletCare: thay cho giu cho va so khop ket qua (spec integration-contract 4.3).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000 };
const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const TIME = /^(now|window)(?:([+-])(\d+)([smh]))?(?::(noZ|\+07:00))?$/;
const TOKEN = /\{\{([^{}]+)\}\}/g;
const MATCHER = /^\{\{any:(id|iso|string)\}\}$/;

const MATCHERS = {
  id: (v) => Number.isInteger(v) && v > 0,
  iso: (v) => typeof v === 'string' && ISO_Z.test(v),
  string: (v) => typeof v === 'string' && v.length > 0,
};

// Moc "now" cua mot ca test: lam tron xuong giay, lech khoi luoi 5 phut (tranh trung moc seed / cua so dem chim).
export function baseNow(date = new Date()) {
  const t = Math.floor(date.getTime() / 1000) * 1000;
  const d = new Date(t);
  return d.getUTCSeconds() === 0 && d.getUTCMinutes() % 5 === 0 ? new Date(t + 7000) : d;
}

function formatTime(ms, suffix) {
  if (suffix === '+07:00') return new Date(ms + UNIT_MS.h * 7).toISOString().slice(0, 19) + '+07:00';
  const s = new Date(ms).toISOString().slice(0, 19);
  return suffix === 'noZ' ? s : s + 'Z';
}

function resolve(name, ctx) {
  const t = TIME.exec(name);
  if (t) {
    const now = ctx.now.getTime();
    const base = t[1] === 'now' ? now : Math.floor(now / (5 * UNIT_MS.m)) * (5 * UNIT_MS.m);
    const delta = t[2] ? (t[2] === '-' ? -1 : 1) * Number(t[3]) * UNIT_MS[t[4]] : 0;
    return formatTime(base + delta, t[5]);
  }
  const [kind, a, b] = name.split(':');
  if (kind === 'ref' && a && b) return ctx.ref(a, b);
  if (kind === 'token' && a) return ctx.token(a);
  if (name === 'serviceKey') return ctx.serviceKey;
  if (name === 'devPassword') return ctx.devPassword;
  throw new Error(`Cho giu cho la: {{${name}}}`);
}

export function expand(value, ctx) {
  if (Array.isArray(value)) return value.map((v) => expand(v, ctx));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v, ctx)]));
  }
  if (typeof value !== 'string' || MATCHER.test(value)) return value;
  const whole = /^\{\{(ref:[^{}]+)\}\}$/.exec(value);
  if (whole) return resolve(whole[1], ctx); // id dung mot minh -> so
  return value.replace(TOKEN, (_, name) => String(resolve(name, ctx)));
}

export function match(expected, actual, path = '$') {
  if (typeof expected === 'string') {
    const m = MATCHER.exec(expected);
    if (m) return MATCHERS[m[1]](actual) ? [] : [`${path}: ${JSON.stringify(actual)} khong khop any:${m[1]}`];
    if (ISO_Z.test(expected) && typeof actual === 'string' && ISO_Z.test(actual)) {
      return Date.parse(expected) === Date.parse(actual) ? [] : [`${path}: ${actual} khac ${expected}`];
    }
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      return [`${path}: mong mang ${expected.length} phan tu, nhan ${JSON.stringify(actual)}`];
    }
    return expected.flatMap((e, i) => match(e, actual[i], `${path}[${i}]`));
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
      return [`${path}: mong object, nhan ${JSON.stringify(actual)}`];
    }
    const missing = Object.keys(expected).filter((k) => !Object.hasOwn(actual, k));
    const extra = Object.keys(actual).filter((k) => !Object.hasOwn(expected, k));
    if (missing.length || extra.length) return [`${path}: thieu [${missing}] thua [${extra}]`];
    return Object.keys(expected).flatMap((k) => match(expected[k], actual[k], `${path}.${k}`));
  }
  return Object.is(expected, actual) ? [] : [`${path}: ${JSON.stringify(actual)} khac ${JSON.stringify(expected)}`];
}

export function loadFixture(name, dir = FIXTURES_DIR) {
  return JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
}

// Ca chuoi after chay trong mot ca test, dung chung mot ctx (mot "now").
export function loadChain(name, dir = FIXTURES_DIR, seen = new Set()) {
  if (seen.has(name)) throw new Error(`after tao vong lap tai ${name}`);
  seen.add(name);
  const fixture = loadFixture(name, dir);
  const before = fixture.after ? loadChain(fixture.after, dir, seen) : [];
  return [...before, { name, fixture }];
}
```

- [ ] **Step 5: Viết `contracts/lib/seed-refs.mjs`**

```js
// Khoa {{ref:<kind>:<key>}} hop le theo du lieu mau database-core (seed/01-reference.sql, seed/04-alerts.sql).
const zones = ['H1-F0', 'H1-F1', 'H1-F2', 'H1-F3', 'H2-F0', 'H2-F1'];

export const SEED_REFS = {
  house: ['H1', 'H2'],
  zone: zones,
  device: [
    ...zones.flatMap((z) => ['SENSOR', 'MIST', 'FAN', 'HEATER'].map((t) => `${z}-${t}`)),
    'H1-F0-SPEAKER', 'H1-F0-CAMERA', 'H2-F0-SPEAKER', 'H2-F0-CAMERA',
  ],
  user: ['admin', 'owner1', 'owner2'],
  // Canh bao THRESHOLD dang mo: <khu vuc>-<chi so>.
  alert: ['H1-F3-HUMID'],
};
```

- [ ] **Step 6: Chạy test**

Run: `cd contracts; npm test`
Expected: PASS 7 test (`lib.test.mjs`), không lỗi.

- [ ] **Step 7: Ghi bổ sung hợp đồng vào spec**

Trong `docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md`:

(a) Phần 3.4, sau dòng `` `sqlNumber` = `null` khi lỗi không đến từ SQL. … `` thêm:

```markdown
`details`: lỗi `VALIDATION_ERROR` → `{"fields": [<tên trường lá>, …]}` (DTO: các trường sai; SQL 50012 → `["in","out"]`, 50013 → `["class"]`, 50014 → `["windowStart"]`); mã khác → `null`.

Mã HTTP thành công: `POST` tạo tài nguyên (nhà, khu vực, thiết bị, người dùng, thu hoạch) → **201**; `POST` hành động (login, control, reset-password, endpoint AI) → **200**; còn lại 200.
```

(b) Phần 4.3, sau quy tắc 6 thêm:

````markdown
7. **Chỗ giữ chỗ bổ sung** (chốt khi dựng fixture):

   | Chỗ giữ chỗ | Thay bằng |
   |---|---|
   | `{{ref:house:H1}}`, `{{ref:zone:H1-F1}}`, `{{ref:device:H1-F1-FAN}}`, `{{ref:user:owner1}}` | Id của đối tượng seed đó |
   | `{{ref:alert:H1-F3-HUMID}}` | Id cảnh báo THRESHOLD đang mở của (khu vực, chỉ số) |
   | `{{token:<username>}}` | JWT của người dùng seed |
   | `{{serviceKey}}`, `{{devPassword}}` | Khóa dịch vụ AI, mật khẩu dev — bộ chạy test lấy từ `.env` |

   - Chuỗi chỉ gồm một `{{ref:…}}` → **số**; nằm trong chuỗi dài hơn (đường dẫn, query) → chữ số.
   - Mốc thời gian: `{{now|window}}` + tùy chọn `±N` đơn vị `s|m|h` + tùy chọn `:noZ` hoặc `:+07:00` (VD `{{now+1m}}`, `{{window:noZ}}`).
   - Mốc thời gian trong kết quả mong đợi so theo **thời điểm** (`…:00Z` khớp `…:00.000Z`).
8. **Multipart:** `"body": {"metadata": {…}, "image": "@snake.jpg"}` — `metadata` gửi dạng chuỗi JSON; giá trị bắt đầu bằng `@` là file cùng thư mục.
9. **`after`** ghi `<thư mục>/<tên file không .json>` (VD `"rest/control.manual"`), được phép trỏ sang thư mục khác; cả chuỗi `after` chạy trong một ca test và dùng **một** `now`.
10. **Thư viện:** `contracts/lib/fixtures.mjs` (`expand`, `match`, `loadChain`) là cách duy nhất để thay chỗ giữ chỗ và so khớp — backend, simulator, AI import thư viện này, không tự viết lại.
11. Dạng phản hồi REST theo cột CSDL đổi camelCase: `user` = `{userId, username, fullName, email, phone, role, isActive}`; ngưỡng = `{zoneId, metricCode, minValue, maxValue, targetValue, updatedBy, updatedAt}`; lịch sử số đo = mảng `{bucketUtc, avgValue, minValue, maxValue}`; `PATCH /api/alerts/:id` = `{alertId, houseId, zoneId, alertType, status, resolvedAt, resolvedBy}`; `POST /api/ai/heartbeat` = `{accepted, rejected}`; thu hoạch = `{harvestId, zoneId, harvestDate, nestCount, weightGram, grade, recordedBy, createdAt}`; báo cáo = mảng cột `sp_Report_EnvStabilityVsYield` camelCase; mục trong danh sách cảnh báo = 14 khóa cảnh báo.
12. **Mỗi chuỗi `after` chạy trên CSDL vừa phục hồi về dữ liệu mẫu** — các fixture sửa trạng thái của nhau (`rest/alert-ack` đổi cảnh báo seed, `mqtt/readings.invalid-*` thêm số đo cùng khu vực với `rest/readings-history`, chuỗi AI thêm cảnh báo làm đổi `rest/alerts-list.page`):
    - Sau `deploy.ps1 -Database SwiftletCare_Test -Reset` (ngày neo mặc định), backup **một lần**: `BACKUP DATABASE SwiftletCare_Test TO DISK = N'SwiftletCare_Test_seed.bak' WITH INIT, COPY_ONLY;` (tên file không có đường dẫn → nằm trong thư mục backup mặc định của SQL Server, tài khoản dịch vụ SQL Server ghi được).
    - **Trước mỗi chuỗi**: `ALTER DATABASE SwiftletCare_Test SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE SwiftletCare_Test FROM DISK = N'SwiftletCare_Test_seed.bak' WITH REPLACE; ALTER DATABASE SwiftletCare_Test SET MULTI_USER;` — chạy từ kết nối vào `master`. Kết nối cũ của backend bị ngắt; bộ chạy test mở lại pool (hoặc khởi động lại backend) sau khi phục hồi.
    - Không chạy hai chuỗi song song trên cùng một CSDL.
````

(c) Trong bảng fixture `rest/`, cột Không hợp lệ: thay `` `users.invalid-last-admin.json` (409) `` bằng `` `users.invalid-modify-self.json` (409 `CANNOT_MODIFY_SELF`) ``, và thêm ngay dưới bảng:

```markdown
`LAST_ADMIN` không có fixture: gọi tuần tự thì người gọi luôn là một ADMIN đang hoạt động khác người bị hạ, nên chỉ hai ADMIN hạ nhau **đồng thời** mới gặp — backend kiểm bằng test đồng thời của mình.
```

- [ ] **Step 8: Viết `contracts/README.md`**

````markdown
# contracts — fixture hợp đồng tích hợp

Hợp đồng: [integration-contract](../docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md) (Phần 4.3). **Đổi fixture = đổi hợp đồng → qua PR** (spec 1.6).

## Chạy test

```powershell
cd contracts
npm test          # node --test, không cần cài gói nào, không cần CSDL/broker
```

## Định dạng file

| Thư mục | Khóa |
|---|---|
| `mqtt/` | `topic`, `payload`, `after?` |
| `ai/`, `rest/` | `method`, `path`, `headers?`, `body?`, `status`, `response`, `after?` |
| `ws/` | `event`, `payload`, `after?` |

- `*.invalid-<lý do>.json`: đầu vào sai, kết quả là lỗi (`{"error":{code,message,sqlNumber,details}}`) hoặc — với MQTT — phần tử bị backend loại.
- `*.cut.json`: thuộc phần dưới ranh giới cắt.

## Chỗ giữ chỗ và bộ so khớp

Xem spec 4.3. Tóm tắt: `{{now}}`, `{{now-30s}}`, `{{window}}`, `{{window+1m}}`, `{{now:noZ}}`, `{{now:+07:00}}`; `{{ref:house:H1}}`, `{{ref:zone:H1-F1}}`, `{{ref:device:H1-F1-FAN}}`, `{{ref:user:owner1}}`, `{{ref:alert:H1-F3-HUMID}}`; `{{token:owner1}}`, `{{serviceKey}}`, `{{devPassword}}`. Kết quả: `{{any:id}}`, `{{any:iso}}`, `{{any:string}}`.

## Dùng từ module khác

```js
import { baseNow, expand, match, loadChain } from '../../contracts/lib/fixtures.mjs';

const ctx = {
  now: baseNow(),
  ref: (kind, key) => lookupSeedId(kind, key),       // backend: tra CSDL SwiftletCare_Test
  token: (username) => loginAndGetToken(username),
  serviceKey: process.env.AI_SERVICE_KEY,
  devPassword: process.env.DEV_SEED_PASSWORD,
};
for (const { name, fixture } of loadChain('ws/alert.created.threshold')) {
  const f = expand(fixture, ctx);                    // cả chuỗi dùng chung ctx
  // gửi f.payload / f.body, rồi: assert.deepEqual(match(f.response ?? f.payload, actual), []);
}
```

- **Backend — mỗi chuỗi bắt đầu từ dữ liệu mẫu** (spec 4.3 quy tắc 12), vì các fixture sửa trạng thái của nhau (`rest/alert-ack` đổi cảnh báo seed; `mqtt/readings.invalid-*` thêm số đo H1-F1 làm lệch `rest/readings-history`; chuỗi AI thêm cảnh báo làm đổi `rest/alerts-list.page`):

  ```sql
  -- Mot lan, sau deploy.ps1 -Database SwiftletCare_Test -Reset (ngay neo mac dinh):
  BACKUP DATABASE SwiftletCare_Test TO DISK = N'SwiftletCare_Test_seed.bak' WITH INIT, COPY_ONLY;

  -- Truoc MOI chuoi after (ket noi vao master):
  ALTER DATABASE SwiftletCare_Test SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  RESTORE DATABASE SwiftletCare_Test FROM DISK = N'SwiftletCare_Test_seed.bak' WITH REPLACE;
  ALTER DATABASE SwiftletCare_Test SET MULTI_USER;
  ```

  Tên file không đường dẫn → thư mục backup mặc định của SQL Server. Kết nối cũ bị ngắt: mở lại pool Prisma/khởi động lại backend sau khi phục hồi. Không chạy hai chuỗi song song.
- **Backend:** fixture MQTT `readings` cần chờ backend gom lô (≤ 1 giây) trước khi kiểm.
- **Simulator / AI:** `expand` fixture hợp lệ rồi so payload tự tạo bằng `match` (cùng tập khóa, cùng kiểu).
- **Web / mobile (tuần 1):** dùng `payload`/`response` đã `expand` làm dữ liệu giả.
````

- [ ] **Step 9: Commit**

```bash
git add contracts/package.json contracts/lib/fixtures.mjs contracts/lib/seed-refs.mjs contracts/test/lib.test.mjs contracts/README.md docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md
git commit -m "feat(contracts): thư viện thay chỗ giữ chỗ và so khớp fixture, bổ sung quy ước hợp đồng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Mosquitto — cấu hình mẫu, hướng dẫn tài khoản, kiểm tra trên máy

**Files:**
- Create: `infra/mosquitto/mosquitto.conf`, `infra/mosquitto/README.md`, `contracts/test/mosquitto-conf.test.mjs`
- Modify (hoặc Create nếu chưa có): `.gitignore` ở gốc repo
- Modify: `docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md` (1.7 mục 2 — `listener` mặc định `127.0.0.1`)

**Interfaces:**
- Produces: broker chạy bằng `mosquitto -c infra/mosquitto/mosquitto.conf -v` **từ gốc repo**, cổng 1883, hai tài khoản `backend`, `simulator`; `MQTT_URL` mặc định `mqtt://localhost:1883` (backend, simulator đọc từ `.env` của mình).

- [ ] **Step 1: Viết test `contracts/test/mosquitto-conf.test.mjs` (phải fail)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function directives(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split(/\s+/);
    map.set(key, rest.join(' '));
  }
  return map;
}

test('mosquitto.conf: dung cac chi thi spec 1.7', () => {
  const d = directives(read('infra/mosquitto/mosquitto.conf'));
  assert.equal(d.get('listener'), '1883 127.0.0.1', 'mac dinh chi nghe tren may nay');
  assert.equal(d.get('allow_anonymous'), 'false');
  assert.equal(d.get('password_file'), 'infra/mosquitto/passwd');
  assert.equal(d.get('persistence'), 'true');
  assert.equal(d.get('persistence_location'), 'infra/mosquitto/data/');
  assert.equal(d.get('max_queued_messages'), '10000');
});

test('mosquitto.conf: khong chua mat khau hay tai khoan', () => {
  const text = read('infra/mosquitto/mosquitto.conf');
  assert.doesNotMatch(text, /\$7\$|\$6\$/, 'khong chua hash mat khau');
  assert.ok(!directives(text).has('password'), 'khong co chi thi password');
});

test('.gitignore: bo qua file mat khau va du lieu broker', () => {
  const lines = read('.gitignore').split(/\r?\n/).map((l) => l.trim());
  assert.ok(lines.includes('infra/mosquitto/passwd'));
  assert.ok(lines.includes('infra/mosquitto/data/'));
  assert.ok(lines.includes('infra/mosquitto/*.local.conf'));
});
```

Run: `cd contracts; npm test`
Expected: FAIL — `ENOENT … infra/mosquitto/mosquitto.conf`.

- [ ] **Step 2: Viết `infra/mosquitto/mosquitto.conf`**

```conf
# SwiftletCare - cau hinh Mosquitto mau (spec integration-contract 1.7).
# Chay TU GOC REPO (duong dan ben duoi la tuong doi):
#   mosquitto -c infra/mosquitto/mosquitto.conf -v
# File nay KHONG chua mat khau. Tai khoan nam trong infra/mosquitto/passwd (.gitignore),
# tao bang mosquitto_passwd - xem infra/mosquitto/README.md.

# Mac dinh chi may nay ket noi duoc; demo LAN xem README muc 5 (mosquitto.local.conf, 0.0.0.0).
listener 1883 127.0.0.1
allow_anonymous false
password_file infra/mosquitto/passwd

# Giu tin QoS 1 dang cho va tin retained (lenh command) sau khi broker khoi dong lai.
persistence true
persistence_location infra/mosquitto/data/

# Mac dinh 1000. 6 cam bien x 1 tin/10 giay -> du giu khoang 4,5 gio so do khi backend tat.
max_queued_messages 10000
```

- [ ] **Step 3: Thêm dòng vào `.gitignore`**

```powershell
if (-not (Test-Path .gitignore)) { New-Item -ItemType File .gitignore | Out-Null }
$lines = Get-Content .gitignore
foreach ($l in 'infra/mosquitto/passwd', 'infra/mosquitto/data/', 'infra/mosquitto/*.local.conf') {
    if ($lines -notcontains $l) { Add-Content -Path .gitignore -Value $l -Encoding ascii }
}
```

(database-core Task 1 cũng tạo `.gitignore`; lệnh trên chỉ thêm dòng còn thiếu, chạy trước hay sau đều được.)

- [ ] **Step 4: Chạy test**

Run: `cd contracts; npm test`
Expected: PASS (`lib.test.mjs` + 3 test `mosquitto-conf`).

- [ ] **Step 5: Viết `infra/mosquitto/README.md`**

````markdown
# Mosquitto trên máy mỗi thành viên (Windows)

Mỗi người **chạy broker riêng trên máy mình**, không dùng chung. Hợp đồng: spec integration-contract 1.7.

## 1. Cài

1. Tải bộ cài Windows 64-bit từ trang chính thức `https://mosquitto.org/download/` (bản 2.x), cài mặc định vào `C:\Program Files\mosquitto`.
2. Thêm `C:\Program Files\mosquitto` vào biến môi trường `Path` (để gọi `mosquitto`, `mosquitto_passwd`, `mosquitto_sub`, `mosquitto_pub`), mở PowerShell mới.
3. **Bộ cài tạo dịch vụ Windows "Mosquitto Broker" giữ cổng 1883** với cấu hình mặc định. Dừng và chuyển sang chạy tay (PowerShell **Run as Administrator**):

   ```powershell
   Stop-Service mosquitto
   Set-Service mosquitto -StartupType Manual
   ```

   Không dừng dịch vụ thì lệnh ở bước 3 báo cổng bận, hoặc client vào nhầm broker của dịch vụ.

## 2. Tạo tài khoản (một lần)

Chạy **từ gốc repo**:

```powershell
New-Item -ItemType Directory -Force infra/mosquitto/data | Out-Null
mosquitto_passwd -c infra/mosquitto/passwd backend     # -c tạo file mới; hỏi mật khẩu 2 lần
mosquitto_passwd infra/mosquitto/passwd simulator      # KHÔNG có -c (có -c sẽ xóa tài khoản backend)
```

- Mật khẩu tự đặt, ghi vào `.env` của backend (`MQTT_USERNAME=backend`, `MQTT_PASSWORD=…`) và simulator (`MQTT_USERNAME=simulator`, …).
- `infra/mosquitto/passwd` và `infra/mosquitto/data/` nằm trong `.gitignore` — **không commit**.
- Quên mật khẩu: chạy lại `mosquitto_passwd infra/mosquitto/passwd <tên>` để đặt lại.

## 3. Chạy

```powershell
mosquitto -c infra/mosquitto/mosquitto.conf -v
```

Giữ cửa sổ này mở trong lúc làm việc. Backend dùng client id cố định `swiftlet-backend` → **không chạy hai backend cùng lúc trên một broker**.

## 4. Kiểm tra

Mở PowerShell khác, từ gốc repo:

```powershell
# Có tài khoản: kết nối được, chờ tin (Ctrl+C để thoát)
mosquitto_sub -u backend -P <mật khẩu backend> -t 'swiftlet/#' -v

# Cửa sổ thứ ba: gửi thử, cửa sổ trên phải in ra dòng này
mosquitto_pub -u simulator -P <mật khẩu simulator> -t 'swiftlet/devices/H1-F1-SENSOR/readings' -m '[]'

# Không tài khoản: PHẢI bị từ chối ("Connection Refused: not authorised")
mosquitto_sub -t 'swiftlet/#' -v
```

## 5. Demo chung mạng LAN

Mặc định broker **chỉ nghe trên `127.0.0.1`** (máy khác trong mạng không kết nối được), đủ cho làm việc một mình. Khi demo cần thiết bị/máy khác kết nối vào broker của máy mình:

1. Tạo bản cấu hình riêng (đã nằm trong `.gitignore`, **không sửa file mẫu** để khỏi commit nhầm):

   ```powershell
   (Get-Content infra/mosquitto/mosquitto.conf) -replace '^listener 1883 127\.0\.0\.1$', 'listener 1883 0.0.0.0' |
       Set-Content infra/mosquitto/mosquitto.local.conf -Encoding ascii
   mosquitto -c infra/mosquitto/mosquitto.local.conf -v
   ```

2. Mở cổng 1883 trong Windows Defender Firewall (chỉ mạng **Private**). `allow_anonymous false` vẫn giữ — máy khác phải có tài khoản.
3. Máy khác đặt `MQTT_URL=mqtt://<IP LAN của máy này>:1883`. **Kiểm tra `MQTT_URL` trước khi chạy** — trỏ nhầm sang broker máy khác thì simulator của người này điều khiển nhầm backend của người kia.
4. Demo xong quay lại chạy `infra/mosquitto/mosquitto.conf` (chỉ `127.0.0.1`).
````

- [ ] **Step 6: Kiểm tra thủ công trên máy**

Làm đúng mục 1–4 của README vừa viết. Expected: `mosquitto -v` in `Opening ipv4 listen socket on port 1883`; `mosquitto_sub` có tài khoản nhận được tin `[]` từ `mosquitto_pub`; không tài khoản bị từ chối `not authorised`; tắt broker (Ctrl+C) rồi chạy lại thấy file `infra/mosquitto/data/mosquitto.db`. `git status` **không** hiện `passwd` hay `data/`.

- [ ] **Step 7: Ghi vào spec 1.7**

Trong spec integration-contract, mục 1.7 bước 2, thay `` `listener 1883`, `` bằng:

```markdown
`listener 1883 127.0.0.1` (mặc định chỉ máy mình kết nối được; demo qua LAN dùng bản sao `infra/mosquitto/mosquitto.local.conf` với `0.0.0.0`, nằm trong `.gitignore` — xem `infra/mosquitto/README.md` mục 5),
```

- [ ] **Step 8: Commit**

```bash
git add infra/mosquitto/mosquitto.conf infra/mosquitto/README.md contracts/test/mosquitto-conf.test.mjs .gitignore docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md
git commit -m "feat(infra): cấu hình Mosquitto mẫu và hướng dẫn tạo tài khoản trên Windows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Test fixture khớp hợp đồng + fixture MQTT số đo / tín hiệu sống

**Files:**
- Create: `contracts/test/fixtures.test.mjs`, `contracts/fixtures/mqtt/readings.json`, `contracts/fixtures/mqtt/heartbeat.cut.json`, `contracts/fixtures/mqtt/readings.invalid-missing-z.json`, `contracts/fixtures/mqtt/readings.invalid-offset.json`, `contracts/fixtures/mqtt/readings.invalid-device-mismatch.json`, `contracts/fixtures/mqtt/readings.invalid-not-array.json`

**Interfaces:**
- Consumes: `baseNow`, `expand`, `loadFixture`, `FIXTURES_DIR` (Task 1), `SEED_REFS` (Task 1).
- Produces: trong `fixtures.test.mjs` — hằng `EXPECTED` (thư mục → danh sách file), `SHAPE`, `ctx`, hàm `sameKeys(obj, keys)`, `jsonFiles(folder)`, `load(folder, file)`, `isInvalid(file)`, `mqttProblems(fixture)`; Task 4–6 thêm thư mục vào `EXPECTED` và thêm test cuối file. Fixture `mqtt/readings` gửi **TEMP 31,2** (vượt ngưỡng 30) để Task 6 có `alert.created` H1-F1 TEMP; `mqtt/command.*` thêm ở Task 5.

- [ ] **Step 1: Viết `contracts/test/fixtures.test.mjs` (phải fail)**

```js
// Kiem fixture khop hop dong (spec integration-contract 4.3), khong can CSDL hay broker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES_DIR, baseNow, expand, loadFixture } from '../lib/fixtures.mjs';
import { SEED_REFS } from '../lib/seed-refs.mjs';

// Danh sach file theo bang fixture spec 4.3; moi task them thu muc / file cua minh.
const EXPECTED = {
  mqtt: [
    'readings.json', 'heartbeat.cut.json',
    'readings.invalid-missing-z.json', 'readings.invalid-offset.json',
    'readings.invalid-device-mismatch.json', 'readings.invalid-not-array.json',
  ],
};

const SHAPE = {
  mqtt: { required: ['topic', 'payload'], optional: ['after'] },
  ai: { required: ['method', 'path', 'status', 'response'], optional: ['headers', 'body', 'after'] },
  rest: { required: ['method', 'path', 'status', 'response'], optional: ['headers', 'body', 'after'] },
  ws: { required: ['event', 'payload'], optional: ['after'] },
};

const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const METRICS = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];

// ref/token chi hop le khi co trong seed; gia tri tra ve khong quan trong voi test cau truc.
const ctx = {
  now: baseNow(),
  ref: (kind, key) => {
    assert.ok(SEED_REFS[kind]?.includes(key), `ref khong co trong seed: ${kind}:${key}`);
    return 1;
  },
  token: (u) => {
    assert.ok(SEED_REFS.user.includes(u), `token cho nguoi dung la: ${u}`);
    return 'test-token';
  },
  serviceKey: 'test-service-key',
  devPassword: 'test-password',
};

const sameKeys = (obj, keys) => obj !== null && typeof obj === 'object' && !Array.isArray(obj)
  && JSON.stringify(Object.keys(obj).sort()) === JSON.stringify([...keys].sort());
const jsonFiles = (folder) => EXPECTED[folder].filter((f) => f.endsWith('.json'));
const load = (folder, file) => loadFixture(`${folder}/${file.replace(/\.json$/, '')}`);
const isInvalid = (file) => file.includes('.invalid-');

test('thu muc fixture: dung va du danh sach spec 4.3', () => {
  assert.deepEqual(readdirSync(FIXTURES_DIR).sort(), Object.keys(EXPECTED).sort());
  for (const [folder, files] of Object.entries(EXPECTED)) {
    assert.deepEqual(readdirSync(join(FIXTURES_DIR, folder)).sort(), [...files].sort(), folder);
  }
});

for (const folder of Object.keys(EXPECTED)) {
  for (const file of jsonFiles(folder)) {
    test(`${folder}/${file}: ma hoa, khung, khong moc/id co dinh, cho giu cho hop le`, () => {
      const raw = readFileSync(join(FIXTURES_DIR, folder, file));
      assert.notDeepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'file co BOM - luu lai UTF-8 khong BOM');
      const text = raw.toString('utf8');
      assert.ok(!text.includes('�'), 'ky tu hong - file khong phai UTF-8');
      assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'moc thoi gian co dinh - dung {{now…}} / {{window…}}');
      assert.doesNotMatch(text, /"(\w+Id|nextBefore)"\s*:\s*\d/, 'id co dinh - dung {{ref:…}} hoac {{any:id}}');
      assert.doesNotMatch(text, /\/api\/[\w-]+\/\d/, 'id co dinh trong duong dan - dung {{ref:…}}');
      const f = JSON.parse(text);
      const { required, optional } = SHAPE[folder];
      assert.deepEqual(required.filter((k) => !Object.hasOwn(f, k)), [], 'thieu khoa');
      assert.deepEqual(Object.keys(f).filter((k) => !required.includes(k) && !optional.includes(k)), [], 'khoa la');
      if (f.after) assert.ok(existsSync(join(FIXTURES_DIR, `${f.after}.json`)), `after tro toi file khong co: ${f.after}`);
      expand(f, ctx); // nem loi neu cho giu cho la hoac ref ngoai seed
    });
  }
}

// ---------- MQTT ----------
const MQTT_TOPIC = /^swiftlet\/devices\/([A-Z0-9-]+)\/(readings|heartbeat|command)$/;

function mqttProblems(f) {
  const t = MQTT_TOPIC.exec(f.topic);
  if (!t) return ['topic sai dang swiftlet/devices/{code}/(readings|heartbeat|command)'];
  const [, code, kind] = t;
  const p = f.payload;
  if (kind === 'readings') {
    if (!Array.isArray(p)) return ['readings phai la mang'];
    return p.flatMap((r, i) => [
      !sameKeys(r, ['device', 'metric', 'value', 'at']) && `[${i}] khoa phai la device, metric, value, at`,
      r?.device !== code && `[${i}] device khac {code} cua topic`,
      !METRICS.includes(r?.metric) && `[${i}] metric la`,
      typeof r?.value !== 'number' && `[${i}] value phai la so`,
      !ISO_Z.test(r?.at) && `[${i}] at phai la UTC co Z`,
    ].filter(Boolean));
  }
  if (kind === 'heartbeat') {
    return [
      !sameKeys(p, ['device', 'at']) && 'khoa phai la device, at',
      p?.device !== code && 'device khac {code} cua topic',
      !ISO_Z.test(p?.at) && 'at phai la UTC co Z',
    ].filter(Boolean);
  }
  // command: trang thai mong muon do backend publish (retained).
  return [
    !sameKeys(p, ['isOn', 'level', 'mode', 'issuedAt']) && 'khoa phai la isOn, level, mode, issuedAt',
    typeof p?.isOn !== 'boolean' && 'isOn phai la boolean',
    !(p?.level === null || (Number.isInteger(p?.level) && p.level >= 0 && p.level <= 100)) && 'level 0-100 hoac null',
    !['AUTO', 'MANUAL'].includes(p?.mode) && 'mode phai la AUTO | MANUAL',
    p?.issuedAt !== '{{any:iso}}' && 'issuedAt do backend sinh -> {{any:iso}}',
  ].filter(Boolean);
}

test('mqtt: fixture hop le dung hop dong', () => {
  for (const file of jsonFiles('mqtt').filter((f) => !isInvalid(f))) {
    assert.deepEqual(mqttProblems(expand(load('mqtt', file), ctx)), [], file);
  }
});

test('mqtt: fixture khong hop le bi bat dung ly do', () => {
  const reasons = {
    'readings.invalid-missing-z.json': /at phai la UTC/,
    'readings.invalid-offset.json': /at phai la UTC/,
    'readings.invalid-device-mismatch.json': /device khac/,
    'readings.invalid-not-array.json': /phai la mang/,
  };
  assert.deepEqual(Object.keys(reasons).sort(), jsonFiles('mqtt').filter(isInvalid).sort());
  for (const [file, re] of Object.entries(reasons)) {
    const problems = mqttProblems(expand(load('mqtt', file), ctx));
    assert.ok(problems.some((p) => re.test(p)), `${file}: ${problems.join('; ')}`);
  }
});

// <!-- TEST-APPEND -->
```

Lưu ý khi chép: dòng `// <!-- TEST-APPEND -->` là chỗ Task 4–6 chèn thêm test; giữ nguyên.

- [ ] **Step 2: Chạy test để thấy fail**

Run: `cd contracts; npm test`
Expected: FAIL `thu muc fixture: dung va du danh sach spec 4.3` (`ENOENT … fixtures`).

- [ ] **Step 3: Viết fixture MQTT hợp lệ**

`contracts/fixtures/mqtt/readings.json` — TEMP 31,2 vượt ngưỡng trên 30 của H1-F1 (mở cảnh báo ở Task 6), ba chỉ số còn lại trong ngưỡng:

```json
{
  "topic": "swiftlet/devices/H1-F1-SENSOR/readings",
  "payload": [
    {"device": "H1-F1-SENSOR", "metric": "TEMP", "value": 31.2, "at": "{{now}}"},
    {"device": "H1-F1-SENSOR", "metric": "HUMID", "value": 82.1, "at": "{{now}}"},
    {"device": "H1-F1-SENSOR", "metric": "CO2", "value": 650, "at": "{{now}}"},
    {"device": "H1-F1-SENSOR", "metric": "LIGHT", "value": 3, "at": "{{now}}"}
  ]
}
```

`contracts/fixtures/mqtt/heartbeat.cut.json`:

```json
{
  "topic": "swiftlet/devices/H1-F1-FAN/heartbeat",
  "payload": {"device": "H1-F1-FAN", "at": "{{now}}"}
}
```

- [ ] **Step 4: Viết fixture MQTT không hợp lệ**

Mỗi file có **một phần tử hợp lệ và một phần tử sai** (trừ `not-array`) — backend phải nhận phần tử đúng, loại phần tử sai, không bỏ cả tin (spec 2.3).

`contracts/fixtures/mqtt/readings.invalid-missing-z.json`:

```json
{
  "topic": "swiftlet/devices/H1-F1-SENSOR/readings",
  "payload": [
    {"device": "H1-F1-SENSOR", "metric": "TEMP", "value": 28, "at": "{{now}}"},
    {"device": "H1-F1-SENSOR", "metric": "HUMID", "value": 82, "at": "{{now:noZ}}"}
  ]
}
```

`contracts/fixtures/mqtt/readings.invalid-offset.json`:

```json
{
  "topic": "swiftlet/devices/H1-F1-SENSOR/readings",
  "payload": [
    {"device": "H1-F1-SENSOR", "metric": "TEMP", "value": 28, "at": "{{now}}"},
    {"device": "H1-F1-SENSOR", "metric": "HUMID", "value": 82, "at": "{{now:+07:00}}"}
  ]
}
```

`contracts/fixtures/mqtt/readings.invalid-device-mismatch.json`:

```json
{
  "topic": "swiftlet/devices/H1-F1-SENSOR/readings",
  "payload": [
    {"device": "H1-F1-SENSOR", "metric": "TEMP", "value": 28, "at": "{{now}}"},
    {"device": "H1-F2-SENSOR", "metric": "TEMP", "value": 28, "at": "{{now}}"}
  ]
}
```

`contracts/fixtures/mqtt/readings.invalid-not-array.json` — backend bỏ cả tin:

```json
{
  "topic": "swiftlet/devices/H1-F1-SENSOR/readings",
  "payload": {"device": "H1-F1-SENSOR", "metric": "TEMP", "value": 28, "at": "{{now}}"}
}
```

- [ ] **Step 5: Chạy test**

Run: `cd contracts; npm test`
Expected: PASS mọi test (`lib`, `mosquitto-conf`, `fixtures`: danh sách thư mục, 6 file MQTT, 2 test MQTT).

- [ ] **Step 6: Commit**

```bash
git add contracts/test/fixtures.test.mjs contracts/fixtures/mqtt
git commit -m "feat(contracts): test kiểm fixture khớp hợp đồng, fixture MQTT số đo và tín hiệu sống

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Fixture kết quả AI + ảnh mẫu tự tạo + kiểm bảng mã lỗi

**Files:**
- Create: `contracts/scripts/make-images.ps1`, `contracts/fixtures/ai/` (13 file JSON + `snake.jpg` + `not-jpeg.png`)
- Modify: `contracts/test/fixtures.test.mjs` (thêm `ai` vào `EXPECTED`; thêm test tại `// <!-- TEST-APPEND -->`)

**Interfaces:**
- Consumes: `EXPECTED`, `ctx`, `sameKeys`, `jsonFiles`, `load`, `isInvalid`, `ISO_Z` (Task 3).
- Produces: trong `fixtures.test.mjs` — `SQL_ERRORS`, `APP_ERRORS`, `SQL_FIELDS`, `errorProblems(fixture): string[]`, `httpProblems(file, fixture): string[]` (Task 5 dùng lại cho `rest/`).
- Ghi chú hành vi backend mà fixture chốt: số đếm âm **không** chặn ở DTO mà để SP báo 50012 (fixture ghi `sqlNumber: 50012`); camera/class/`at` sai bị chặn **trước** khi dựng đường dẫn ảnh (spec 2.4 bước 2) → `sqlNumber: null`.

- [ ] **Step 1: Thêm test AI (phải fail)**

Trong `contracts/test/fixtures.test.mjs`, thêm vào `EXPECTED` (sau mục `mqtt`):

```js
  ai: [
    'bird-counts.json', 'bird-counts.resend-smaller.json',
    'predator-detection.json', 'snake.jpg', 'predator-detection.cooldown.json', 'predator-detection.low-confidence.json',
    'heartbeat.cut.json',
    'bird-counts.invalid-window-not-aligned.json', 'bird-counts.invalid-negative.json', 'bird-counts.invalid-missing-z.json',
    'predator-detection.invalid-class.json', 'predator-detection.invalid-offset.json',
    'predator-detection.invalid-not-jpeg.json', 'not-jpeg.png', 'ai.invalid-service-key.json',
  ],
```

Thay dòng `// <!-- TEST-APPEND -->` bằng:

```js
// ---------- Loi HTTP (bang doi ma spec 3.5) ----------
const SQL_ERRORS = {
  50003: [409, 'DEVICE_NOT_CONTROLLABLE'], 50010: [404, 'CAMERA_NOT_FOUND'],
  50012: [400, 'VALIDATION_ERROR'], 50013: [400, 'VALIDATION_ERROR'], 50014: [400, 'VALIDATION_ERROR'],
  50020: [404, 'ALERT_NOT_FOUND'], 50021: [409, 'ALERT_INVALID_TRANSITION'], 50030: [400, 'INVALID_JSON'],
  50040: [400, 'INVALID_PARAMETER'], 50041: [400, 'INVALID_PARAMETER'], 50042: [400, 'INVALID_PARAMETER'],
  547: [400, 'CONSTRAINT_VIOLATION'], 2627: [409, 'DUPLICATE'], 2601: [409, 'DUPLICATE'], 1205: [503, 'RETRY_LATER'],
};
const APP_ERRORS = {
  VALIDATION_ERROR: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CANNOT_MODIFY_SELF: 409,
  LAST_ADMIN: 409, PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415, INTERNAL: 500,
};
const SQL_FIELDS = { 50012: ['in', 'out'], 50013: ['class'], 50014: ['windowStart'] };

function errorProblems(f) {
  if (!sameKeys(f.response, ['error'])) return ['phan hoi loi phai la {error:{…}}'];
  const e = f.response.error;
  if (!sameKeys(e, ['code', 'message', 'sqlNumber', 'details'])) return ['error phai co dung code, message, sqlNumber, details'];
  const p = [];
  if (e.message !== '{{any:string}}') p.push('message phai la {{any:string}} (khong khoa nguyen van)');
  if (e.sqlNumber !== null) {
    const m = SQL_ERRORS[e.sqlNumber];
    if (!m) p.push(`sqlNumber ${e.sqlNumber} khong co trong bang 3.5`);
    else if (m[0] !== f.status || m[1] !== e.code) p.push(`sqlNumber ${e.sqlNumber} phai la HTTP ${m[0]} ${m[1]}`);
  } else if (APP_ERRORS[e.code] !== f.status) {
    p.push(`${e.code} phai di voi HTTP ${APP_ERRORS[e.code]}`);
  }
  if (e.code === 'VALIDATION_ERROR') {
    const fields = e.details?.fields;
    if (!sameKeys(e.details, ['fields']) || !Array.isArray(fields) || fields.length === 0) p.push('details phai la {fields:[…]}');
    else if (SQL_FIELDS[e.sqlNumber] && JSON.stringify(fields) !== JSON.stringify(SQL_FIELDS[e.sqlNumber])) {
      p.push(`details.fields cua ${e.sqlNumber} phai la ${JSON.stringify(SQL_FIELDS[e.sqlNumber])}`);
    }
  } else if (e.details !== null) {
    p.push('details phai la null');
  }
  return p;
}

function httpProblems(file, f) {
  if (isInvalid(file)) return f.status >= 400 ? errorProblems(f) : ['fixture invalid phai co status >= 400'];
  return [200, 201].includes(f.status) ? [] : ['fixture hop le phai co status 200 hoac 201'];
}

test('ai, rest: ma HTTP, phan hoi loi, file dinh kem', () => {
  for (const folder of ['ai', 'rest'].filter((x) => EXPECTED[x])) {
    for (const file of jsonFiles(folder)) {
      const f = load(folder, file);
      assert.deepEqual(httpProblems(file, f), [], `${folder}/${file}`);
      for (const v of Object.values(f.body ?? {})) {
        if (typeof v === 'string' && v.startsWith('@')) {
          assert.ok(EXPECTED[folder].includes(v.slice(1)), `${folder}/${file}: file dinh kem ${v} khong co`);
        }
      }
    }
  }
});

// ---------- AI ----------
const PREDATOR_CLASSES = ['rat', 'snake', 'owl'];

function aiProblems(f) {
  const b = f.body;
  if (f.method !== 'POST') return ['endpoint AI deu la POST'];
  if (f.path === '/api/ai/bird-counts') {
    if (!Array.isArray(b)) return ['body phai la mang'];
    return b.flatMap((x, i) => [
      !sameKeys(x, ['camera', 'windowStart', 'in', 'out']) && `[${i}] khoa phai la camera, windowStart, in, out`,
      !ISO_Z.test(x?.windowStart) && `[${i}] windowStart phai la UTC co Z`,
      ISO_Z.test(x?.windowStart) && Date.parse(x.windowStart) % 300_000 !== 0 && `[${i}] windowStart phai dung moc 5 phut`,
      !(Number.isInteger(x?.in) && x.in >= 0 && Number.isInteger(x?.out) && x.out >= 0) && `[${i}] in, out phai la so nguyen >= 0`,
    ].filter(Boolean));
  }
  if (f.path === '/api/ai/predator-detections') {
    const m = b?.metadata;
    return [
      !sameKeys(b, ['metadata', 'image']) && 'body multipart phai co metadata, image',
      !sameKeys(m, ['camera', 'class', 'confidence', 'at']) && 'metadata phai co camera, class, confidence, at (khong co snapshot)',
      !PREDATOR_CLASSES.includes(m?.class) && 'class phai la rat | snake | owl',
      !(typeof m?.confidence === 'number' && m.confidence >= 0 && m.confidence <= 1) && 'confidence phai trong [0, 1]',
      !ISO_Z.test(m?.at) && 'at phai la UTC co Z',
    ].filter(Boolean);
  }
  if (f.path === '/api/ai/heartbeat') {
    return [
      !sameKeys(b, ['device', 'at']) && 'khoa phai la device, at',
      !ISO_Z.test(b?.at) && 'at phai la UTC co Z',
    ].filter(Boolean);
  }
  return [`duong dan AI la: ${f.path}`];
}

// Fixture invalid ma ly do nam o body (AI phai tu tranh); cac invalid con lai co body dung.
const AI_BODY_INVALID = {
  'bird-counts.invalid-window-not-aligned.json': /moc 5 phut/,
  'bird-counts.invalid-negative.json': /so nguyen >= 0/,
  'bird-counts.invalid-missing-z.json': /UTC co Z/,
  'predator-detection.invalid-class.json': /rat \| snake \| owl/,
  'predator-detection.invalid-offset.json': /UTC co Z/,
};

test('ai: header X-Service-Key, body dung hop dong', () => {
  for (const file of jsonFiles('ai')) {
    const f = expand(load('ai', file), ctx);
    assert.ok(sameKeys(f.headers, ['X-Service-Key']), `${file}: headers chi gom X-Service-Key`);
    if (file !== 'ai.invalid-service-key.json') assert.equal(f.headers['X-Service-Key'], ctx.serviceKey, `${file}: dung {{serviceKey}}`);
    const problems = aiProblems(f);
    if (AI_BODY_INVALID[file]) assert.ok(problems.some((p) => AI_BODY_INVALID[file].test(p)), `${file}: ${problems.join('; ')}`);
    else assert.deepEqual(problems, [], file);
  }
});

test('ai: anh mau - snake.jpg la JPEG that <= 2 MB, not-jpeg.png khong phai JPEG', () => {
  const jpg = readFileSync(join(FIXTURES_DIR, 'ai', 'snake.jpg'));
  assert.deepEqual([...jpg.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.ok(jpg.length > 0 && jpg.length <= 2 * 1024 * 1024);
  const png = readFileSync(join(FIXTURES_DIR, 'ai', 'not-jpeg.png'));
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

// <!-- TEST-APPEND -->
```

Run: `cd contracts; npm test`
Expected: FAIL `thu muc fixture: dung va du danh sach spec 4.3` (chưa có thư mục `ai`).

- [ ] **Step 2: Viết `contracts/scripts/make-images.ps1` (chỉ ASCII) và sinh ảnh**

```powershell
# Sinh anh mau tu tao cho fixture AI (khong lay tu internet).
# Chay tu goc repo: powershell -ExecutionPolicy Bypass -File contracts/scripts/make-images.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$dir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\fixtures\ai'))
New-Item -ItemType Directory -Force $dir | Out-Null

function New-SampleImage([string]$Path, [System.Drawing.Imaging.ImageFormat]$Format) {
    $bmp = New-Object System.Drawing.Bitmap -ArgumentList 160, 120
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(40, 40, 40))
    $pen = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(90, 160, 60)), 8
    $g.DrawBezier($pen, 10, 90, 50, 20, 100, 110, 150, 40)   # "con ran" don gian
    $pen.Dispose(); $g.Dispose()
    $bmp.Save($Path, $Format)
    $bmp.Dispose()
}

New-SampleImage (Join-Path $dir 'snake.jpg') ([System.Drawing.Imaging.ImageFormat]::Jpeg)
New-SampleImage (Join-Path $dir 'not-jpeg.png') ([System.Drawing.Imaging.ImageFormat]::Png)
Get-ChildItem $dir -Filter '*.*g' | Select-Object Name, Length
```

Run: `powershell -ExecutionPolicy Bypass -File contracts/scripts/make-images.ps1`
Expected: in ra `snake.jpg` và `not-jpeg.png`, mỗi file vài KB.

- [ ] **Step 3: Viết fixture AI hợp lệ**

`contracts/fixtures/ai/bird-counts.json`:

```json
{
  "method": "POST",
  "path": "/api/ai/bird-counts",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": [{"camera": "H1-F0-CAMERA", "windowStart": "{{window}}", "in": 5, "out": 1}],
  "status": 200,
  "response": {"windowsUpserted": 1, "windowsUnchanged": 0}
}
```

`contracts/fixtures/ai/bird-counts.resend-smaller.json` — gửi lại cùng cửa sổ với số nhỏ hơn, SP giữ số lớn:

```json
{
  "after": "ai/bird-counts",
  "method": "POST",
  "path": "/api/ai/bird-counts",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": [{"camera": "H1-F0-CAMERA", "windowStart": "{{window}}", "in": 3, "out": 1}],
  "status": 200,
  "response": {"windowsUpserted": 0, "windowsUnchanged": 1}
}
```

`contracts/fixtures/ai/predator-detection.json`:

```json
{
  "method": "POST",
  "path": "/api/ai/predator-detections",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": {
    "metadata": {"camera": "H1-F0-CAMERA", "class": "snake", "confidence": 0.87, "at": "{{now}}"},
    "image": "@snake.jpg"
  },
  "status": 200,
  "response": {"created": true, "alertId": "{{any:id}}", "skipReason": null}
}
```

`contracts/fixtures/ai/predator-detection.cooldown.json` — cùng camera, cùng loài, cách 1 phút (trong cooldown 5 phút):

```json
{
  "after": "ai/predator-detection",
  "method": "POST",
  "path": "/api/ai/predator-detections",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": {
    "metadata": {"camera": "H1-F0-CAMERA", "class": "snake", "confidence": 0.9, "at": "{{now-1m}}"},
    "image": "@snake.jpg"
  },
  "status": 200,
  "response": {"created": false, "alertId": null, "skipReason": "COOLDOWN"}
}
```

`contracts/fixtures/ai/predator-detection.low-confidence.json` — dưới ngưỡng 0,5:

```json
{
  "method": "POST",
  "path": "/api/ai/predator-detections",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": {
    "metadata": {"camera": "H2-F0-CAMERA", "class": "rat", "confidence": 0.3, "at": "{{now}}"},
    "image": "@snake.jpg"
  },
  "status": 200,
  "response": {"created": false, "alertId": null, "skipReason": "LOW_CONFIDENCE"}
}
```

`contracts/fixtures/ai/heartbeat.cut.json`:

```json
{
  "method": "POST",
  "path": "/api/ai/heartbeat",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": {"device": "H1-F0-CAMERA", "at": "{{now}}"},
  "status": 200,
  "response": {"accepted": 1, "rejected": 0}
}
```

- [ ] **Step 4: Viết fixture AI không hợp lệ**

`contracts/fixtures/ai/bird-counts.invalid-window-not-aligned.json`:

```json
{
  "method": "POST",
  "path": "/api/ai/bird-counts",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": [{"camera": "H1-F0-CAMERA", "windowStart": "{{window+1m}}", "in": 5, "out": 1}],
  "status": 400,
  "response": {"error": {"code": "VALIDATION_ERROR", "message": "{{any:string}}", "sqlNumber": 50014, "details": {"fields": ["windowStart"]}}}
}
```

`contracts/fixtures/ai/bird-counts.invalid-negative.json`:

```json
{
  "method": "POST",
  "path": "/api/ai/bird-counts",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": [{"camera": "H1-F0-CAMERA", "windowStart": "{{window}}", "in": -1, "out": 0}],
  "status": 400,
  "response": {"error": {"code": "VALIDATION_ERROR", "message": "{{any:string}}", "sqlNumber": 50012, "details": {"fields": ["in", "out"]}}}
}
```

`contracts/fixtures/ai/bird-counts.invalid-missing-z.json`:

```json
{
  "method": "POST",
  "path": "/api/ai/bird-counts",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": [{"camera": "H1-F0-CAMERA", "windowStart": "{{window:noZ}}", "in": 5, "out": 1}],
  "status": 400,
  "response": {"error": {"code": "VALIDATION_ERROR", "message": "{{any:string}}", "sqlNumber": null, "details": {"fields": ["windowStart"]}}}
}
```

`contracts/fixtures/ai/predator-detection.invalid-class.json`:

```json
{
  "method": "POST",
  "path": "/api/ai/predator-detections",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": {
    "metadata": {"camera": "H1-F0-CAMERA", "class": "cat", "confidence": 0.9, "at": "{{now}}"},
    "image": "@snake.jpg"
  },
  "status": 400,
  "response": {"error": {"code": "VALIDATION_ERROR", "message": "{{any:string}}", "sqlNumber": null, "details": {"fields": ["class"]}}}
}
```

`contracts/fixtures/ai/predator-detection.invalid-offset.json`:

```json
{
  "method": "POST",
  "path": "/api/ai/predator-detections",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": {
    "metadata": {"camera": "H1-F0-CAMERA", "class": "snake", "confidence": 0.9, "at": "{{now:+07:00}}"},
    "image": "@snake.jpg"
  },
  "status": 400,
  "response": {"error": {"code": "VALIDATION_ERROR", "message": "{{any:string}}", "sqlNumber": null, "details": {"fields": ["at"]}}}
}
```

`contracts/fixtures/ai/predator-detection.invalid-not-jpeg.json` — ảnh PNG (backend kiểm chữ ký đầu file, không tin đuôi file):

```json
{
  "method": "POST",
  "path": "/api/ai/predator-detections",
  "headers": {"X-Service-Key": "{{serviceKey}}"},
  "body": {
    "metadata": {"camera": "H1-F0-CAMERA", "class": "snake", "confidence": 0.9, "at": "{{now}}"},
    "image": "@not-jpeg.png"
  },
  "status": 415,
  "response": {"error": {"code": "UNSUPPORTED_MEDIA_TYPE", "message": "{{any:string}}", "sqlNumber": null, "details": null}}
}
```

`contracts/fixtures/ai/ai.invalid-service-key.json`:

```json
{
  "method": "POST",
  "path": "/api/ai/bird-counts",
  "headers": {"X-Service-Key": "khoa-sai"},
  "body": [{"camera": "H1-F0-CAMERA", "windowStart": "{{window}}", "in": 5, "out": 1}],
  "status": 401,
  "response": {"error": {"code": "UNAUTHENTICATED", "message": "{{any:string}}", "sqlNumber": null, "details": null}}
}
```

- [ ] **Step 5: Chạy test**

Run: `cd contracts; npm test`
Expected: PASS mọi test, gồm 13 file `ai/*.json`, `ai, rest: ma HTTP…`, `ai: header…`, `ai: anh mau…`.

- [ ] **Step 6: Commit**

```bash
git add contracts/scripts/make-images.ps1 contracts/fixtures/ai contracts/test/fixtures.test.mjs
git commit -m "feat(contracts): fixture kết quả AI, ảnh mẫu tự tạo, kiểm bảng đổi mã lỗi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Fixture REST + lệnh MQTT `command`

**Files:**
- Create: `contracts/fixtures/rest/` (18 file), `contracts/fixtures/mqtt/command.manual.json`, `contracts/fixtures/mqtt/command.auto.json`
- Modify: `contracts/test/fixtures.test.mjs` (`EXPECTED.mqtt` thêm 2 file, thêm `EXPECTED.rest`; thêm test tại `// <!-- TEST-APPEND -->`)

**Interfaces:**
- Consumes: `httpProblems` (Task 4), `mqttProblems` (Task 3), `loadFixture` (Task 1), fixture `mqtt/readings` (Task 3).
- Produces: hằng `ALERT_KEYS` (14 khóa cảnh báo, đúng thứ tự) trong `fixtures.test.mjs` — Task 6 dùng lại. Fixture `rest/control.manual`, `rest/alert-ack`, `rest/control.auto-without-ison` là `after` của Task 6.

- [ ] **Step 1: Thêm test REST (phải fail)**

Trong `EXPECTED.mqtt` thêm `'command.manual.json', 'command.auto.json',`. Thêm mục:

```js
  rest: [
    'auth-login.json', 'control.manual.json', 'control.auto-without-ison.json', 'alert-ack.json',
    'alerts-list.page.json', 'readings-history.json', 'thresholds-put.json', 'health.json',
    'harvests-post.cut.json', 'report-env-vs-yield.cut.json',
    'auth-login.invalid-credentials.json', 'control.invalid-not-controllable.json', 'alert.invalid-transition.json',
    'readings-history.invalid-range.json', 'readings-history.invalid-missing-z.json',
    'thresholds-put.invalid-min-max.json', 'house.invalid-not-owner.json', 'users.invalid-modify-self.json',
  ],
```

Thay dòng `// <!-- TEST-APPEND -->` bằng:

```js
// ---------- REST ----------
const ALERT_KEYS = ['alertId', 'houseId', 'zoneId', 'deviceId', 'alertType', 'severity', 'metricCode', 'value',
  'detectedClass', 'confidence', 'hasSnapshot', 'message', 'status', 'createdAt'];
const USER_KEYS = ['userId', 'username', 'fullName', 'email', 'phone', 'role', 'isActive'];
const CONTROL_KEYS = ['changed', 'deviceCode', 'mode', 'isOn', 'level'];
// Phan hoi la object: tap khoa (bo sung hop dong B10).
const REST_OBJECT_KEYS = {
  'auth-login.json': ['accessToken', 'expiresIn', 'user'],
  'control.manual.json': CONTROL_KEYS,
  'control.auto-without-ison.json': CONTROL_KEYS,
  'alert-ack.json': ['alertId', 'houseId', 'zoneId', 'alertType', 'status', 'resolvedAt', 'resolvedBy'],
  'alerts-list.page.json': ['items', 'nextBefore'],
  'thresholds-put.json': ['zoneId', 'metricCode', 'minValue', 'maxValue', 'targetValue', 'updatedBy', 'updatedAt'],
  'health.json': ['status', 'db', 'mqtt'],
  'harvests-post.cut.json': ['harvestId', 'zoneId', 'harvestDate', 'nestCount', 'weightGram', 'grade', 'recordedBy', 'createdAt'],
};
// Phan hoi la mang dong: tap khoa moi dong.
const REST_ROW_KEYS = {
  'readings-history.json': ['bucketUtc', 'avgValue', 'minValue', 'maxValue'],
  'report-env-vs-yield.cut.json': ['zoneId', 'zoneName', 'monthVn', 'avgTemp', 'stdevTemp', 'avgHumid', 'stdevHumid',
    'pctInRange', 'nestCount', 'weightGram'],
};
const REST_CREATED = ['harvests-post.cut.json']; // B8: POST tao tai nguyen -> 201
const REST_PUBLIC = ['auth-login.json', 'auth-login.invalid-credentials.json', 'health.json'];

test('rest: xac thuc, ma thanh cong, tap khoa phan hoi', () => {
  for (const file of jsonFiles('rest')) {
    const f = load('rest', file);
    if (REST_PUBLIC.includes(file)) assert.equal(f.headers, undefined, `${file}: route cong khai khong gui header`);
    else assert.match(f.headers?.Authorization ?? '', /^Bearer \{\{token:\w+\}\}$/, `${file}: can Authorization: Bearer {{token:…}}`);
    if (isInvalid(file)) continue;
    assert.equal(f.status, REST_CREATED.includes(file) ? 201 : 200, `${file}: ma thanh cong`);
    if (REST_OBJECT_KEYS[file]) {
      assert.ok(sameKeys(f.response, REST_OBJECT_KEYS[file]), `${file}: khoa phan hoi`);
    } else {
      assert.ok(REST_ROW_KEYS[file], `${file}: chua khai bao dang phan hoi trong test`);
      assert.ok(Array.isArray(f.response) && f.response.every((r) => sameKeys(r, REST_ROW_KEYS[file])), `${file}: khoa tung dong`);
    }
  }
  assert.ok(sameKeys(load('rest', 'auth-login.json').response.user, USER_KEYS), 'auth-login: khoa user');
  for (const item of load('rest', 'alerts-list.page.json').response.items) {
    assert.deepEqual(Object.keys(item), ALERT_KEYS, 'alerts-list: 14 khoa canh bao dung thu tu');
  }
});

test('mqtt command: khop ket qua control tuong ung', () => {
  for (const [cmd, ctl] of [['command.manual.json', 'rest/control.manual'], ['command.auto.json', 'rest/control.auto-without-ison']]) {
    const c = load('mqtt', cmd);
    const r = loadFixture(ctl).response;
    assert.equal(c.after, ctl, `${cmd}: after`);
    assert.equal(c.topic, `swiftlet/devices/${r.deviceCode}/command`, `${cmd}: topic tu deviceCode`);
    assert.deepEqual({ isOn: c.payload.isOn, level: c.payload.level, mode: c.payload.mode },
      { isOn: r.isOn, level: r.level, mode: r.mode }, `${cmd}: payload = ket qua sp_SetActuator`);
  }
});

// <!-- TEST-APPEND -->
```

Run: `cd contracts; npm test`
Expected: FAIL `thu muc fixture: dung va du danh sach spec 4.3`.

- [ ] **Step 2: Viết fixture REST hợp lệ**

`contracts/fixtures/rest/auth-login.json` — `expiresIn` tính bằng giây (JWT 8 giờ):

```json
{
  "method": "POST",
  "path": "/api/auth/login",
  "body": {"username": "owner1", "password": "{{devPassword}}"},
  "status": 200,
  "response": {
    "accessToken": "{{any:string}}",
    "expiresIn": 28800,
    "user": {
      "userId": "{{ref:user:owner1}}", "username": "owner1", "fullName": "Chủ nhà yến H1",
      "email": "owner1@swiftletcare.local", "phone": null, "role": "OWNER", "isActive": true
    }
  }
}
```

`contracts/fixtures/rest/control.manual.json`:

```json
{
  "method": "POST",
  "path": "/api/devices/{{ref:device:H1-F1-FAN}}/control",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "body": {"isOn": true, "level": 80, "mode": "MANUAL", "reason": "Thử điều khiển tay"},
  "status": 200,
  "response": {"changed": true, "deviceCode": "H1-F1-FAN", "mode": "MANUAL", "isOn": true, "level": 80}
}
```

`contracts/fixtures/rest/control.auto-without-ison.json` — trả quyền cho bộ điều khiển; backend tự điền `isOn` hiện tại, `level` giữ nguyên:

```json
{
  "after": "rest/control.manual",
  "method": "POST",
  "path": "/api/devices/{{ref:device:H1-F1-FAN}}/control",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "body": {"mode": "AUTO"},
  "status": 200,
  "response": {"changed": true, "deviceCode": "H1-F1-FAN", "mode": "AUTO", "isOn": true, "level": 80}
}
```

`contracts/fixtures/rest/alert-ack.json` — cảnh báo H1-F3 HUMID đang mở trong seed:

```json
{
  "method": "PATCH",
  "path": "/api/alerts/{{ref:alert:H1-F3-HUMID}}",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "body": {"status": "ACK", "note": "Đã kiểm tra"},
  "status": 200,
  "response": {
    "alertId": "{{ref:alert:H1-F3-HUMID}}", "houseId": "{{ref:house:H1}}", "zoneId": "{{ref:zone:H1-F3}}",
    "alertType": "THRESHOLD", "status": "ACK", "resolvedAt": null, "resolvedBy": null
  }
}
```

`contracts/fixtures/rest/alerts-list.page.json` — seed H1 có 2 cảnh báo NEW/ACK; `limit=1`, id giảm dần → cảnh báo PREDATOR (tạo sau) trước, còn trang sau:

```json
{
  "method": "GET",
  "path": "/api/alerts?houseId={{ref:house:H1}}&status=NEW,ACK&limit=1",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "status": 200,
  "response": {
    "items": [{
      "alertId": "{{any:id}}", "houseId": "{{ref:house:H1}}", "zoneId": "{{ref:zone:H1-F0}}",
      "deviceId": "{{ref:device:H1-F0-CAMERA}}", "alertType": "PREDATOR", "severity": "CRITICAL",
      "metricCode": null, "value": null, "detectedClass": "snake", "confidence": 0.91, "hasSnapshot": true,
      "message": "Phát hiện rắn tại H1-F0-CAMERA (độ tin cậy 91.0%)", "status": "ACK", "createdAt": "{{any:iso}}"
    }],
    "nextBefore": "{{any:id}}"
  }
}
```

`contracts/fixtures/rest/readings-history.json` — sau `mqtt/readings` (TEMP 31,2 lúc `{{now}}`); bucket neo theo `from`, `to` loại trừ nên `to = now+1m`:

```json
{
  "after": "mqtt/readings",
  "method": "GET",
  "path": "/api/zones/{{ref:zone:H1-F1}}/readings?metric=TEMP&from={{now-59m}}&to={{now+1m}}&bucketMinutes=60",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "status": 200,
  "response": [{"bucketUtc": "{{now-59m}}", "avgValue": 31.2, "minValue": 31.2, "maxValue": 31.2}]
}
```

`contracts/fixtures/rest/thresholds-put.json`:

```json
{
  "method": "PUT",
  "path": "/api/zones/{{ref:zone:H1-F1}}/thresholds/TEMP",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "body": {"minValue": 25, "maxValue": 31, "targetValue": 28},
  "status": 200,
  "response": {
    "zoneId": "{{ref:zone:H1-F1}}", "metricCode": "TEMP", "minValue": 25, "maxValue": 31, "targetValue": 28,
    "updatedBy": "{{ref:user:owner1}}", "updatedAt": "{{any:iso}}"
  }
}
```

`contracts/fixtures/rest/health.json`:

```json
{
  "method": "GET",
  "path": "/api/health",
  "status": 200,
  "response": {"status": "ok", "db": "ok", "mqtt": "connected"}
}
```

`contracts/fixtures/rest/harvests-post.cut.json` — ngày nghiệp vụ VN tháng 9 (seed không có số đo tháng 9, để báo cáo dưới đây xác định được):

```json
{
  "method": "POST",
  "path": "/api/zones/{{ref:zone:H1-F1}}/harvests",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "body": {"harvestDate": "2026-09-15", "nestCount": 120, "weightGram": 950.5, "grade": "A"},
  "status": 201,
  "response": {
    "harvestId": "{{any:id}}", "zoneId": "{{ref:zone:H1-F1}}", "harvestDate": "2026-09-15", "nestCount": 120,
    "weightGram": 950.5, "grade": "A", "recordedBy": "{{ref:user:owner1}}", "createdAt": "{{any:iso}}"
  }
}
```

`contracts/fixtures/rest/report-env-vs-yield.cut.json` — tháng 9 chỉ có thu hoạch, không có số đo → cột môi trường `null`:

```json
{
  "after": "rest/harvests-post.cut",
  "method": "GET",
  "path": "/api/houses/{{ref:house:H1}}/reports/env-vs-yield?fromVnDate=2026-09-01&toVnDate=2026-10-01",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "status": 200,
  "response": [{
    "zoneId": "{{ref:zone:H1-F1}}", "zoneName": "F1", "monthVn": "2026-09",
    "avgTemp": null, "stdevTemp": null, "avgHumid": null, "stdevHumid": null, "pctInRange": null,
    "nestCount": 120, "weightGram": 950.5
  }]
}
```

- [ ] **Step 3: Viết fixture REST không hợp lệ**

`contracts/fixtures/rest/auth-login.invalid-credentials.json`:

```json
{
  "method": "POST",
  "path": "/api/auth/login",
  "body": {"username": "owner1", "password": "mat-khau-sai"},
  "status": 401,
  "response": {"error": {"code": "UNAUTHENTICATED", "message": "{{any:string}}", "sqlNumber": null, "details": null}}
}
```

`contracts/fixtures/rest/control.invalid-not-controllable.json`:

```json
{
  "method": "POST",
  "path": "/api/devices/{{ref:device:H1-F1-SENSOR}}/control",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "body": {"isOn": true, "mode": "MANUAL"},
  "status": 409,
  "response": {"error": {"code": "DEVICE_NOT_CONTROLLABLE", "message": "{{any:string}}", "sqlNumber": 50003, "details": null}}
}
```

`contracts/fixtures/rest/alert.invalid-transition.json` — ACK → ACK (DTO cho phép `ACK`, SP từ chối):

```json
{
  "after": "rest/alert-ack",
  "method": "PATCH",
  "path": "/api/alerts/{{ref:alert:H1-F3-HUMID}}",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "body": {"status": "ACK"},
  "status": 409,
  "response": {"error": {"code": "ALERT_INVALID_TRANSITION", "message": "{{any:string}}", "sqlNumber": 50021, "details": null}}
}
```

`contracts/fixtures/rest/readings-history.invalid-range.json`:

```json
{
  "method": "GET",
  "path": "/api/zones/{{ref:zone:H1-F1}}/readings?metric=TEMP&from={{now}}&to={{now-1h}}&bucketMinutes=60",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "status": 400,
  "response": {"error": {"code": "INVALID_PARAMETER", "message": "{{any:string}}", "sqlNumber": 50041, "details": null}}
}
```

`contracts/fixtures/rest/readings-history.invalid-missing-z.json`:

```json
{
  "method": "GET",
  "path": "/api/zones/{{ref:zone:H1-F1}}/readings?metric=TEMP&from={{now-1h:noZ}}&to={{now}}&bucketMinutes=60",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "status": 400,
  "response": {"error": {"code": "VALIDATION_ERROR", "message": "{{any:string}}", "sqlNumber": null, "details": {"fields": ["from"]}}}
}
```

`contracts/fixtures/rest/thresholds-put.invalid-min-max.json`:

```json
{
  "method": "PUT",
  "path": "/api/zones/{{ref:zone:H1-F1}}/thresholds/TEMP",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "body": {"minValue": 31, "maxValue": 25, "targetValue": 28},
  "status": 400,
  "response": {"error": {"code": "CONSTRAINT_VIOLATION", "message": "{{any:string}}", "sqlNumber": 547, "details": null}}
}
```

`contracts/fixtures/rest/house.invalid-not-owner.json` — owner1 đọc nhà của owner2 → 404, không lộ sự tồn tại:

```json
{
  "method": "GET",
  "path": "/api/houses/{{ref:house:H2}}",
  "headers": {"Authorization": "Bearer {{token:owner1}}"},
  "status": 404,
  "response": {"error": {"code": "NOT_FOUND", "message": "{{any:string}}", "sqlNumber": null, "details": null}}
}
```

`contracts/fixtures/rest/users.invalid-modify-self.json`:

```json
{
  "method": "PATCH",
  "path": "/api/users/{{ref:user:admin}}",
  "headers": {"Authorization": "Bearer {{token:admin}}"},
  "body": {"isActive": false},
  "status": 409,
  "response": {"error": {"code": "CANNOT_MODIFY_SELF", "message": "{{any:string}}", "sqlNumber": null, "details": null}}
}
```

- [ ] **Step 4: Viết fixture MQTT `command`**

`contracts/fixtures/mqtt/command.manual.json` — backend publish (retained, QoS 1) sau `rest/control.manual`:

```json
{
  "after": "rest/control.manual",
  "topic": "swiftlet/devices/H1-F1-FAN/command",
  "payload": {"isOn": true, "level": 80, "mode": "MANUAL", "issuedAt": "{{any:iso}}"}
}
```

`contracts/fixtures/mqtt/command.auto.json`:

```json
{
  "after": "rest/control.auto-without-ison",
  "topic": "swiftlet/devices/H1-F1-FAN/command",
  "payload": {"isOn": true, "level": 80, "mode": "AUTO", "issuedAt": "{{any:iso}}"}
}
```

- [ ] **Step 5: Chạy test**

Run: `cd contracts; npm test`
Expected: PASS mọi test, gồm 18 file `rest/*.json`, 2 file `mqtt/command.*`, `rest: xac thuc…`, `mqtt command: khop…`.

- [ ] **Step 6: Commit**

```bash
git add contracts/fixtures/rest contracts/fixtures/mqtt/command.manual.json contracts/fixtures/mqtt/command.auto.json contracts/test/fixtures.test.mjs
git commit -m "feat(contracts): fixture REST và lệnh MQTT command

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Fixture sự kiện WebSocket, mở PR hợp đồng

**Files:**
- Create: `contracts/fixtures/ws/readings.new.json`, `alert.created.threshold.json`, `alert.created.predator.json`, `alert.updated.json`, `device.state.json`, `birdcount.updated.json`
- Modify: `contracts/test/fixtures.test.mjs` (thêm `EXPECTED.ws`; thêm test tại `// <!-- TEST-APPEND -->`)

**Interfaces:**
- Consumes: `ALERT_KEYS` (Task 5); fixture `mqtt/readings` (Task 3), `ai/predator-detection`, `ai/bird-counts` (Task 4), `rest/alert-ack`, `rest/control.manual` (Task 5).
- Produces: bộ fixture đủ danh sách spec 4.3 (đã áp B9); PR `contract/fixtures` → `main`.

- [ ] **Step 1: Thêm test WebSocket (phải fail)**

Thêm vào `EXPECTED`:

```js
  ws: [
    'readings.new.json', 'alert.created.threshold.json', 'alert.created.predator.json',
    'alert.updated.json', 'device.state.json', 'birdcount.updated.json',
  ],
```

Thay dòng `// <!-- TEST-APPEND -->` bằng:

```js
// ---------- WebSocket (spec 4.2) ----------
const WS_PAYLOAD_KEYS = {
  'readings.new': ['houseId', 'readings'],
  'alert.created': ['alert'],
  'alert.updated': ['alertId', 'houseId', 'status', 'resolvedAt', 'resolvedBy'],
  'device.state': ['deviceId', 'deviceCode', 'houseId', 'zoneId', 'mode', 'isOn', 'level', 'source', 'at'],
  'birdcount.updated': ['houseId', 'cameraId'],
};

test('ws: moi su kien co fixture, ten file, tap khoa, luon co houseId', () => {
  const events = jsonFiles('ws').map((file) => load('ws', file).event);
  assert.deepEqual([...new Set(events)].sort(), Object.keys(WS_PAYLOAD_KEYS).sort(), 'moi su kien spec 4.2 co it nhat mot fixture');
  for (const file of jsonFiles('ws')) {
    const f = load('ws', file);
    assert.ok(file.startsWith(`${f.event}.`), `${file}: ten file bat dau bang ten su kien`);
    assert.ok(f.after, `${file}: phai co after (hanh dong sinh ra su kien)`);
    assert.ok(sameKeys(f.payload, WS_PAYLOAD_KEYS[f.event] ?? []), `${file}: khoa payload`);
    const houseId = f.event === 'alert.created' ? f.payload.alert.houseId : f.payload.houseId;
    assert.match(String(houseId), /^\{\{ref:house:H\d\}\}$/, `${file}: phai co houseId de chon phong house:{id}`);
    if (f.event === 'alert.created') assert.deepEqual(Object.keys(f.payload.alert), ALERT_KEYS, `${file}: 14 khoa canh bao, khong co snapshotPath`);
    if (f.event === 'readings.new') {
      for (const r of f.payload.readings) {
        assert.ok(sameKeys(r, ['deviceId', 'deviceCode', 'zoneId', 'metric', 'value', 'at']), `${file}: khoa so do`);
      }
    }
  }
});

test('ws readings.new: dung cac so do mqtt/readings da gui, cung thu tu', () => {
  const sent = loadFixture('mqtt/readings').payload;
  const got = load('ws', 'readings.new.json').payload.readings;
  assert.deepEqual(got.map((r) => [r.deviceCode, r.metric, r.value, r.at]), sent.map((r) => [r.device, r.metric, r.value, r.at]));
});
```

Run: `cd contracts; npm test`
Expected: FAIL `thu muc fixture: dung va du danh sach spec 4.3` (chưa có `ws`).

- [ ] **Step 2: Viết fixture WebSocket**

`contracts/fixtures/ws/readings.new.json`:

```json
{
  "after": "mqtt/readings",
  "event": "readings.new",
  "payload": {
    "houseId": "{{ref:house:H1}}",
    "readings": [
      {"deviceId": "{{ref:device:H1-F1-SENSOR}}", "deviceCode": "H1-F1-SENSOR", "zoneId": "{{ref:zone:H1-F1}}", "metric": "TEMP", "value": 31.2, "at": "{{now}}"},
      {"deviceId": "{{ref:device:H1-F1-SENSOR}}", "deviceCode": "H1-F1-SENSOR", "zoneId": "{{ref:zone:H1-F1}}", "metric": "HUMID", "value": 82.1, "at": "{{now}}"},
      {"deviceId": "{{ref:device:H1-F1-SENSOR}}", "deviceCode": "H1-F1-SENSOR", "zoneId": "{{ref:zone:H1-F1}}", "metric": "CO2", "value": 650, "at": "{{now}}"},
      {"deviceId": "{{ref:device:H1-F1-SENSOR}}", "deviceCode": "H1-F1-SENSOR", "zoneId": "{{ref:zone:H1-F1}}", "metric": "LIGHT", "value": 3, "at": "{{now}}"}
    ]
  }
}
```

`contracts/fixtures/ws/alert.created.threshold.json` — TEMP 31,2 > 30 (vượt dưới 10% → WARNING); cảnh báo ngưỡng thuộc khu vực, `deviceId` null:

```json
{
  "after": "mqtt/readings",
  "event": "alert.created",
  "payload": {
    "alert": {
      "alertId": "{{any:id}}", "houseId": "{{ref:house:H1}}", "zoneId": "{{ref:zone:H1-F1}}", "deviceId": null,
      "alertType": "THRESHOLD", "severity": "WARNING", "metricCode": "TEMP", "value": 31.2,
      "detectedClass": null, "confidence": null, "hasSnapshot": false,
      "message": "Nhiệt độ vượt ngưỡng trên 30.00 °C: 31.20 °C", "status": "NEW", "createdAt": "{{any:iso}}"
    }
  }
}
```

`contracts/fixtures/ws/alert.created.predator.json` — `createdAt` = thời điểm phát hiện `at`:

```json
{
  "after": "ai/predator-detection",
  "event": "alert.created",
  "payload": {
    "alert": {
      "alertId": "{{any:id}}", "houseId": "{{ref:house:H1}}", "zoneId": "{{ref:zone:H1-F0}}",
      "deviceId": "{{ref:device:H1-F0-CAMERA}}", "alertType": "PREDATOR", "severity": "CRITICAL",
      "metricCode": null, "value": null, "detectedClass": "snake", "confidence": 0.87, "hasSnapshot": true,
      "message": "Phát hiện rắn tại H1-F0-CAMERA (độ tin cậy 87.0%)", "status": "NEW", "createdAt": "{{now}}"
    }
  }
}
```

`contracts/fixtures/ws/alert.updated.json`:

```json
{
  "after": "rest/alert-ack",
  "event": "alert.updated",
  "payload": {"alertId": "{{ref:alert:H1-F3-HUMID}}", "houseId": "{{ref:house:H1}}", "status": "ACK", "resolvedAt": null, "resolvedBy": null}
}
```

`contracts/fixtures/ws/device.state.json`:

```json
{
  "after": "rest/control.manual",
  "event": "device.state",
  "payload": {
    "deviceId": "{{ref:device:H1-F1-FAN}}", "deviceCode": "H1-F1-FAN", "houseId": "{{ref:house:H1}}", "zoneId": "{{ref:zone:H1-F1}}",
    "mode": "MANUAL", "isOn": true, "level": 80, "source": "MANUAL", "at": "{{any:iso}}"
  }
}
```

`contracts/fixtures/ws/birdcount.updated.json` — chỉ là tín hiệu tải lại, không mang số đếm:

```json
{
  "after": "ai/bird-counts",
  "event": "birdcount.updated",
  "payload": {"houseId": "{{ref:house:H1}}", "cameraId": "{{ref:device:H1-F0-CAMERA}}"}
}
```

- [ ] **Step 3: Chạy toàn bộ test**

Run: `cd contracts; npm test`
Expected: PASS mọi test; số file kiểm = 6 MQTT + 2 command + 13 AI + 18 REST + 6 WS = 45 file JSON.

- [ ] **Step 4: Đối chiếu spec lần cuối**

Mở spec 4.3, so bảng fixture với `EXPECTED` trong `fixtures.test.mjs`: từng tên file khớp (riêng `users.invalid-modify-self.json` thay `users.invalid-last-admin.json` theo B9 đã ghi vào spec ở Task 1). Không khớp → sửa cho khớp, chạy lại `npm test`.

- [ ] **Step 5: Commit**

```bash
git add contracts/fixtures/ws contracts/test/fixtures.test.mjs
git commit -m "feat(contracts): fixture sự kiện WebSocket

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Mở PR hợp đồng**

**Điều kiện tiên quyết** (kiểm trước khi chạy lệnh dưới):

```powershell
git remote -v        # phải có origin trỏ tới repo GitHub của nhóm
gh auth status       # phải báo "Logged in to github.com"; chưa thì chạy: gh auth login
```

- **TV1 phải có quyền vào repo** (Collaborator, ít nhất quyền Write để Approve PR) — chủ repo mời qua GitHub > Settings > Collaborators trước khi mở PR.
- Chưa có remote hoặc không dùng được `gh`: tạo repo / thêm remote (`git remote add origin <url>`), `git push -u origin contract/fixtures`, rồi **mở PR trên giao diện web GitHub** (nút *Compare & pull request*), dán cùng nội dung PR bên dưới, chọn TV1 ở mục *Reviewers*.

```bash
git push -u origin contract/fixtures
gh pr create --base main --reviewer <tài-khoản-GitHub-của-TV1> --title "Hợp đồng: fixture, thư viện so khớp, cấu hình Mosquitto" --body-file -
```

Nội dung PR (dán vào stdin):

```markdown
## Thay đổi hợp đồng
- Thêm `contracts/` (45 fixture + ảnh mẫu, thư viện `expand`/`match`/`loadChain`, test `npm test`) và `infra/mosquitto/`.
- Bổ sung spec integration-contract (3.4, 4.3) — B1–B10 trong plan: chỗ giữ chỗ `{{ref:…}}`/`{{token:…}}`/`{{serviceKey}}`/`{{devPassword}}`, ngữ pháp mốc thời gian, so mốc theo thời điểm, multipart `@file`, `after` liên thư mục, `details.fields`, 201 cho POST tạo tài nguyên, `users.invalid-last-admin` → `users.invalid-modify-self`, dạng phản hồi REST.

## Module bị ảnh hưởng
- backend (TV2): test tích hợp chạy fixture bằng `contracts/lib/fixtures.mjs`; DTO số đếm âm để SP báo 50012.
- simulator (TV5), ai-vision (TV3): kiểm payload tự tạo bằng `match` với fixture.
- web, mobile (TV4): dữ liệu giả tuần 1 lấy từ `response`/`payload` đã `expand`.

## Kiểm tra
- [ ] `cd contracts; npm test` đạt
- [ ] Mosquitto chạy theo `infra/mosquitto/README.md`, ẩn danh bị từ chối
- [ ] TV1 duyệt (dạng kết quả SP trong fixture)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Expected: link PR. **TV1 duyệt** (fixture chứa dạng kết quả SP); TV2 là người mở PR. Merge xong, **báo cả nhóm** (spec 1.6):

```text
[Hợp đồng] Đã merge PR fixture: contracts/ (45 fixture, npm test), infra/mosquitto/.
Đổi/bổ sung: chỗ giữ chỗ {{ref:…}}, {{token:…}}; details.fields cho VALIDATION_ERROR; POST tạo tài nguyên trả 201;
users.invalid-last-admin -> users.invalid-modify-self. Ảnh hưởng: backend, simulator, ai-vision, web, mobile.
Mỗi người: pull main, đọc spec integration-contract 4.3, cài Mosquitto theo infra/mosquitto/README.md.
```

### Task 7 (Nên có): ACL Mosquitto

**Files:**
- Create: `infra/mosquitto/acl`
- Modify: `infra/mosquitto/mosquitto.conf`, `contracts/test/mosquitto-conf.test.mjs`, `infra/mosquitto/README.md`

**Interfaces:**
- Produces: `backend` chỉ đọc `readings`/`heartbeat`, chỉ ghi `command`; mỗi thiết bị (client id = `Devices.Code`) chỉ ghi `readings`/`heartbeat` của **chính mình**, chỉ đọc `command` của chính mình.

- [ ] **Step 1: Thêm test (phải fail)**

Thêm cuối `contracts/test/mosquitto-conf.test.mjs`:

```js
test('ACL (Nen co): conf tro toi acl, backend/thiet bi dung quyen', () => {
  assert.equal(directives(read('infra/mosquitto/mosquitto.conf')).get('acl_file'), 'infra/mosquitto/acl');
  const lines = read('infra/mosquitto/acl').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  assert.deepEqual(lines, [
    'user backend',
    'topic read swiftlet/devices/+/readings',
    'topic read swiftlet/devices/+/heartbeat',
    'topic write swiftlet/devices/+/command',
    'pattern write swiftlet/devices/%c/readings',
    'pattern write swiftlet/devices/%c/heartbeat',
    'pattern read swiftlet/devices/%c/command',
  ]);
});
```

Run: `cd contracts; npm test` → Expected: FAIL (`acl_file` undefined).

- [ ] **Step 2: Viết `infra/mosquitto/acl` và thêm vào conf**

`infra/mosquitto/acl`:

```conf
# SwiftletCare - ACL Mosquitto (Nen co, spec integration-contract Phan 2).
# backend: nhan so do / tin hieu song, gui lenh trang thai mong muon.
user backend
topic read swiftlet/devices/+/readings
topic read swiftlet/devices/+/heartbeat
topic write swiftlet/devices/+/command

# Moi thiet bi (client id = Devices.Code, tai khoan simulator) chi dung topic cua chinh minh.
pattern write swiftlet/devices/%c/readings
pattern write swiftlet/devices/%c/heartbeat
pattern read swiftlet/devices/%c/command
```

Thêm cuối `infra/mosquitto/mosquitto.conf`:

```conf

# Nen co: gioi han topic theo tai khoan / client id.
acl_file infra/mosquitto/acl
```

Thêm vào `infra/mosquitto/README.md`, cuối mục 4:

````markdown
Có ACL (`acl_file`): thiết bị chỉ gửi được lên topic của chính mình. Thử gửi giả từ client id khác — cửa sổ `mosquitto_sub` **không** được nhận tin này:

```powershell
mosquitto_pub -u simulator -P <mật khẩu simulator> -i H1-F2-SENSOR -t 'swiftlet/devices/H1-F1-SENSOR/readings' -m '[]'
```
````

- [ ] **Step 3: Chạy test và kiểm thủ công**

Run: `cd contracts; npm test` → Expected: PASS.
Khởi động lại broker, làm lại mục 4 README: `mosquitto_pub -i H1-F1-SENSOR …` lên topic `H1-F1-SENSOR` → `mosquitto_sub` nhận; `-i H1-F2-SENSOR` lên topic `H1-F1-SENSOR` → không nhận (Mosquitto bỏ tin, log `-v` ghi `Denied PUBLISH`).

- [ ] **Step 4: Commit**

```bash
git add infra/mosquitto/acl infra/mosquitto/mosquitto.conf infra/mosquitto/README.md contracts/test/mosquitto-conf.test.mjs
git commit -m "feat(infra): ACL Mosquitto, thiết bị chỉ dùng topic của mình (Nên có)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Làm trước khi mở PR (Task 6 Step 6) thì đi chung PR; làm sau thì mở PR riêng, cũng do TV1 duyệt.

## Ngoài phạm vi plan này

- **JSON Schema cho từng payload** (spec 1.5, mức "Nếu còn thời gian"): `fixtures.test.mjs` đã kiểm tập khóa và quy tắc chính bằng tay; chỉ thêm schema khi các module bắt buộc đã xong.
- Chạy fixture với backend thật (gọi API, publish MQTT, nghe Socket.IO): thuộc plan backend, dùng `loadChain` + `expand` + `match` của Task 1.
