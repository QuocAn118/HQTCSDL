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
