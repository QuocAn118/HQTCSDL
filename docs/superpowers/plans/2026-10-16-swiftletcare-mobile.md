# SwiftletCare mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Người thực thi:** TV4, theo cách Native (`superpowers:executing-plans`) trên máy mình — không dùng subagent-driven. Hàm thuần: viết test trước, chạy cho fail, code cho đạt, commit. Màn hình: spec mobile 3.1 không có test component, nên mỗi task giao diện kiểm bằng `npm run typecheck`, `npm test` và các bước checklist 3.1 tương ứng trên Expo Go (bằng `mobile-mcp` nếu kết nối được). Dùng skill `expo-router`, `expo-ui`, `expo-data-fetching` khi chỉnh màn hình; thiết kế theo `frontend-design`, `taste-skill` — code trong plan là bản chạy được tối thiểu, được chỉnh giao diện miễn giữ nguyên luồng dữ liệu.

## Trước khi chạy

**Hỏi nhóm trước (spec 1.2), ghi câu trả lời vào `mobile/spikes/RESULTS.md` mục S0:**
1. Ai có **iPhone**? Không ai có → chỉ hỗ trợ Android.
2. Ai có **điện thoại Android** chạy được Expo Go? Không ai có → dùng **Android Emulator**; ghi yêu cầu máy (RAM, bật ảo hóa trong BIOS, dung lượng ổ đĩa) vào README sau Task 1.

```powershell
node -v                               # ^20.19 || ^22.12 || >=24 (máy nhóm: 25)
npm view expo@58 version              # có bản 58.x
git status                            # sạch, đang ở nhánh mobile (git switch -c mobile nếu chưa có)
```

- Backend dev chạy trên máy trong LAN, lắng nghe `0.0.0.0:3000`, cổng 3000 mở trên Windows Defender Firewall (mạng Private) — hợp đồng 3.6. Điện thoại/emulator cùng Wi-Fi.
- Mật khẩu dev của tài khoản seed ghi trong README database; không chép vào file nào của `mobile/`.
- Lúc viết plan (17/10/2026), toàn bộ code đã được dựng thử **ngoài repo**: `create-expo-app` template `blank-typescript` cho SDK 58, `npx expo install` chọn các bản ghi ở Tech Stack; `npx tsc --noEmit` sạch; `npm test` 45 test đạt; `npx expo export --platform android` đóng gói được (Metro + Hermes); `check-copies` khớp bản web dựng thử. **Chưa chạy trên Expo Go/điện thoại** và chưa nối backend thật — Task 1 Step 6 và Task 8 làm việc đó.

## Mốc

| Mốc | Phải xong |
|---|---|
| **18/10 (M1)** | Câu hỏi nhóm (S0); Task 1 (khung + S1 gọi HTTP từ Expo Go **đầu tiên**, S2 mobile-mcp, S3 phiên bản Expo Go) |
| **Tuần 2 (19–25/10)** | Task 2–3 (hàm thuần); làm web trước (TV4 làm cả hai module) |
| **01/11 (M3)** | Task 4–6 (Bắt buộc 1–3 trên điện thoại với backend thật); Task 8 bước 1–8; quyết định giữ/cắt Task 7 |
| Tuần 4 | Task 7; Task 8 đủ 13 bước + đo độ trễ; S5 (`expo-notifications`) chỉ thử khi còn thời gian |

Roadmap: TV5 hỗ trợ mobile tuần 3 nếu TV4 trễ.

**Goal:** Dựng `mobile/` — app Expo SDK 58 chạy bằng Expo Go cho chủ nhà yến: đăng nhập (giữ phiên qua `expo-secure-store`), tổng quan số đo trực tiếp, cảnh báo kèm ACK/RESOLVED và ảnh thiên địch, điều khiển tay, banner cảnh báo trong app; đúng hợp đồng REST và sự kiện như web.

**Architecture:** Expo Router: lớp gốc `app/_layout.tsx` giữ màn hình chờ tới khi đọc xong phiên, chọn nhóm màn hình bằng `Stack.Protected`, mở **một** socket cho cả app (đóng khi app vào nền) và đặt banner cảnh báo; ba tab dùng chung "nhà đang chọn" (`lib/house.tsx`). Bốn file hàm thuần (`time`, `merge`, `errors`, `types`) và ba file test **chép nguyên văn từ `web/`**, `scripts/check-copies.mjs` cảnh báo khi lệch. `lib/socket.ts` cũng chép nguyên văn từ web và **cũng kiểm băm** (AppState nằm ở `lib/live.tsx`, `lib/auth.tsx`, không ở `socket.ts`; spec 3.2).

**Tech Stack (bản thật do `npx expo install` chọn cho SDK 58 ngày 17/10/2026, ghim chính xác):** `expo` 58.0.14, `expo-router` 58.0.23, `expo-secure-store` 58.0.2, `expo-splash-screen` 58.0.10, `expo-constants` 58.0.12, `expo-linking` 58.0.13, `expo-status-bar` 58.0.3, `react` 19.3.0, `react-dom` 19.3.0, `react-native` 0.88.0, `react-native-safe-area-context` 5.10.1, `react-native-screens` 4.30.0, `socket.io-client` 4.8.3; dev: `typescript` 6.0.3, `@types/react` 19.3.0, `@types/node` 24.19.2, `vitest` 5.0.5. Task 1 cài lại thật trên máy TV4 và **ghi số thật** nếu khác.

**Spec:** [docs/superpowers/specs/2026-10-16-swiftletcare-mobile-design.md](../specs/2026-10-16-swiftletcare-mobile-design.md) · bản sao hàm thuần: [plan web](2026-10-16-swiftletcare-web.md) Task 2–5 · hợp đồng: [integration-contract](../specs/2026-10-13-swiftletcare-integration-contract-design.md) Phần 3–4 · đo độ trễ: [plan backend](2026-10-16-swiftletcare-backend.md) Task 24

## Global Constraints

- Expo **SDK 58**, chạy bằng **Expo Go** (điện thoại thật hoặc Android Emulator); **không build EAS**, không `ios/`/`android/` trong repo.
- Cài gói Expo bằng **`npx expo install`**; `package.json` ghim **chính xác** mọi gói (không `~`, `^`), commit `package-lock.json`. `socket.io-client` 4.8.3, `vitest` 5.0.5.
- `.env.example` đúng một dòng `EXPO_PUBLIC_API_URL=http://192.168.1.10:3000` (ví dụ); mỗi máy điền **IP LAN** máy backend, không `localhost`; đổi giá trị thì `npx expo start -c`.
- Phiên trong `expo-secure-store` (khóa `swiftletcare.session`), đọc **trước khi** chọn màn hình đầu; hạn 28800 giây; hẹn giờ hết hạn + kiểm lại khi app trở lại.
- Thời gian, ghép dữ liệu, mã lỗi: **chỉ dùng bản chép từ web** (`lib/time.ts`, `lib/merge.ts`, `lib/errors.ts`, `lib/types.ts`), không dùng `Intl`; sửa một bên thì chép sang bên kia **trong cùng PR**.
- Socket: `io(EXPO_PUBLIC_API_URL, { auth })`, token hiện tại mỗi lần kết nối; **đóng khi app vào nền**, mở lại khi trở lại rồi tải lại REST; `UNAUTHENTICATED`/server ngắt → xóa phiên, về Đăng nhập; lỗi khác → giãn 2, 4, 8, 16, 30 giây.
- FAN: Level 0 → `{mode:'MANUAL', isOn:false}` (không gửi `level`); 25/50/75/100 → `isOn: true` kèm `level`. Cập nhật giao diện **từ phản hồi**.
- Ảnh: `<Image source={{ uri, headers: { Authorization } }}>`; lỗi (gồm 404) → "Không có ảnh".
- Banner cảnh báo ở **lớp gốc**, rung bằng `Vibration` có sẵn; **không thông báo đẩy**, không thêm thư viện.
- Giao diện tiếng Việt; chú thích trong code viết không dấu.
- **Không tạo hay ghi đè `.gitignore` gốc**; chỉ thêm các dòng `mobile/…` còn thiếu.
- Commit message tiếng Việt, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Đổi Wi-Fi/IP máy backend hôm demo** mà quên `npx expo start -c` — người dùng mong thấy ngay "Không kết nối được máy chủ" kèm nút "Thử lại", không màn hình trắng; README dặn rõ. Kiểm ở Task 4 Step 6 (`ErrorBox` với `NETWORK`) và Task 8 checklist 3.3.
2. **App vào nền đúng lúc phiên hết hạn**, mở lại sau vài giờ — người dùng mong về Đăng nhập kèm "Phiên đã hết hạn", không gửi request với token cũ. Kiểm ở Task 4 (`AuthProvider` kiểm hạn khi `AppState` = `active`; `loadSession` xóa phiên hết hạn).
3. **Chạm banner cảnh báo khi đang ở chi tiết một cảnh báo khác** — người dùng mong mở đúng cảnh báo mới. Kiểm ở Task 8 bước 8.
4. **Lệnh FAN chọn Level 0** — người dùng mong quạt tắt, không có trạng thái "bật 0%". Test ở Task 3 (`fanBody(0)`).
5. **`check-copies` chạy khi chưa có `web/`** (mobile làm trước) — người dùng mong test vẫn chạy, chỉ in "bỏ qua". Test ở Task 2 (`diffCopies` trả `null`).

## Cấu trúc file

```
mobile/
  package.json  package-lock.json  app.json  tsconfig.json  .env.example  .gitignore (của template)  README.md
  assets/                         icon, splash của template
  app/
    _layout.tsx                   AuthProvider, màn hình chờ, Stack.Protected, LiveProvider + AlertBanner
    login.tsx
    (tabs)/_layout.tsx            ba tab, thanh kết nối, đăng xuất, HouseProvider
    (tabs)/index.tsx              Tổng quan
    (tabs)/alerts.tsx             danh sách cảnh báo
    (tabs)/devices.tsx            điều khiển tay
    alerts/[alertId].tsx          chi tiết, ACK/RESOLVED, ảnh
  components/
    ui.tsx                        ErrorBox, Empty, Loading, Button, Card, Badge, màu, style
    AlertBanner.tsx               banner + rung khi alert.created
  lib/
    time.ts merge.ts errors.ts types.ts socket.ts   CHÉP từ web/lib (kiểm băm)
    session.ts                    phiên trong expo-secure-store
    api.ts                        fetch kèm token, 401 → đăng xuất, snapshotSource, qs
    auth.tsx                      AuthProvider, useAuth
    live.tsx                      LiveProvider (đóng/mở theo AppState), useLive, useReloadOnConnect
    house.tsx                     HouseProvider, useHouse, useLiveDevices, useLiveLatest
    control.ts                    thân lệnh điều khiển (FAN Level 0 = tắt)
    config.ts                     HEARTBEAT_ENABLED, nhãn tiếng Việt, showOffline
  test/
    time.test.ts merge.test.ts errors.test.ts   CHÉP từ web/test
    check-copies.test.ts control.test.ts repo.test.ts
  scripts/check-copies.mjs        so băm 8 file với web/ (CRLF → LF), chỉ cảnh báo
  spikes/RESULTS.md
```

Trùng sơ đồ spec 1.4 (đã cập nhật 17/10/2026). `lib/types.ts` phải chép theo vì `merge.ts` của web import nó — `check-copies` kiểm **8** file (spec 3.2, gồm `socket.ts`). Không có `app/index.tsx` ở gốc (route `/` là tab Tổng quan).

## Phụ thuộc vào module khác và cách làm khi chưa có

| Cần | Của | Chưa có thì |
|---|---|---|
| `web/lib/{time,merge,errors,types,socket}.ts`, `web/test/{time,merge,errors}.test.ts` | plan web Task 2–5 (TV4) | Chép **từ khối code trong plan web** (cùng nội dung); khi `web/` có thật, `check-copies` so lại |
| Backend REST + Socket.IO trên IP LAN, `HOST=0.0.0.0` | plan backend Task 7–9, 16–18 | Task 1 S1 cần ít nhất `/api/health` (backend Task 8); không có thì dựng tạm bất kỳ máy chủ HTTP nào trên máy (VD `npx --yes http-server -p 3000` trả 404 cũng chứng minh được Expo Go gọi được HTTP) — ghi rõ trong S1 |
| Mã lỗi `data.code` của Socket.IO, ngắt khi đổi vai trò | PR hợp đồng (plan backend Task 3 mục 5) | Code theo spec đã duyệt |
| `latency-probe` (đo độ trễ) | plan backend Task 24 | Task 8 bước 13 chờ |
| Heartbeat (simulator Task 9, backend Task 26, ai-vision) | dưới ranh giới cắt | `HEARTBEAT_ENABLED = false` |
| Dữ liệu mẫu, `owner1`/`owner2`/`admin` | database-core | Kiểm tay chờ CSDL Dev |

## Ngoài phạm vi

- Thông báo đẩy (Expo push); build EAS; biểu đồ, nhập thu hoạch (Nếu còn thời gian).
- Quản lý nhà, khu vực, thiết bị, ngưỡng, người dùng (làm trên web hoặc API).
- `expo-notifications`: chỉ **thử** ở S5 khi Bắt buộc 1–3 xong; muốn dùng thì viết bổ sung plan và PR riêng.
- Test component, test tự động trên thiết bị commit vào repo.
- Sửa backend, hợp đồng, fixture, code web (sửa file chép thì sửa ở web trước, trong cùng PR).

## Quy ước viết test

- Vitest 5.0.5, `test/<module>.test.ts`, chỉ hàm thuần. `npm test` = `node scripts/check-copies.mjs && vitest run`. `npm run typecheck` = `tsc --noEmit`.
- File test dùng module Node có dòng đầu `/// <reference types="node" />` (tsconfig gốc của Expo không nạp kiểu Node).

---

### Task 1: Khung Expo SDK 58, ghim phiên bản, kiểm chứng — gọi HTTP từ Expo Go **trước tiên**

**Files:**
- Create: `mobile/` từ `create-expo-app` (template `blank-typescript`), `mobile/.env.example`, `mobile/test/repo.test.ts`, `mobile/app/index.tsx` (**tạm**, xóa ở Task 4), `mobile/README.md` (khung), `mobile/spikes/RESULTS.md`
- Modify: `mobile/package.json`, `mobile/app.json`, `mobile/tsconfig.json`; `.gitignore` gốc — **chỉ thêm** mục `# mobile`
- Delete: `mobile/App.tsx`, `mobile/index.ts`, `mobile/AGENTS.md`, `mobile/CLAUDE.md`, `mobile/LICENSE`, `mobile/.claude/`, `mobile/.git/` (nếu template tạo)

**Interfaces:**
- Consumes: không.
- Produces: `npm start|android|test|typecheck`; alias `@/*` → `mobile/*`; `spikes/RESULTS.md` (S0–S5).

- [ ] **Step 1: Tạo app bằng template SDK 58 và dọn file mẫu**

```powershell
npx --yes create-expo-app@latest mobile --template blank-typescript --no-install
cd mobile
Remove-Item -Recurse -Force App.tsx, index.ts, AGENTS.md, CLAUDE.md, LICENSE, .claude -ErrorAction SilentlyContinue
if (Test-Path .git) { Remove-Item -Recurse -Force .git }   # repo git long nhau se pha repo nhom
Get-Content package.json
```

Expected: `package.json` có `"expo": "~58.…"`. Không phải 58 → dừng, báo nhóm (template `latest` đã sang SDK khác; dùng `--template blank-typescript@sdk-58` và ghi lại). `AGENTS.md`/`CLAUDE.md` của template bị xóa vì chúng nói route ở `src/app/`, trái spec 1.4 (`app/`); quy tắc chung nằm ở `CLAUDE.md` gốc repo.

- [ ] **Step 2: Cài gói bằng `npx expo install`, ghim chính xác**

```powershell
npm install
npx expo install expo-router expo-secure-store expo-splash-screen expo-constants expo-linking react-native-safe-area-context react-native-screens react-dom
npm install --save-exact socket.io-client@4.8.3
npm install --save-exact --save-dev vitest@5.0.5 @types/node@24.19.2
npx expo install --check
```

Expected: `Dependencies are up to date`. Cài `react-dom` bằng `npx expo install` **trước** `socket.io-client`: nếu không, npm báo `ERESOLVE` vì Expo Router kéo `react-dom` 19.3.1 (cho web) trong khi SDK 58 ghim `react` 19.3.0 (đã gặp lúc viết plan).

Rồi sửa `package.json`: `"name": "swiftletcare-mobile"`, `"main": "expo-router/entry"`, `scripts` như dưới, và **đổi mọi `~x.y.z` thành `x.y.z`** theo bản đã cài (`node -p "require('./node_modules/<goi>/package.json').version"`). Kết quả lúc viết plan:

```json
{
  "name": "swiftletcare-mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "dependencies": {
    "expo": "58.0.14",
    "expo-constants": "58.0.12",
    "expo-linking": "58.0.13",
    "expo-router": "58.0.23",
    "expo-secure-store": "58.0.2",
    "expo-splash-screen": "58.0.10",
    "expo-status-bar": "58.0.3",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-native": "0.88.0",
    "react-native-safe-area-context": "5.10.1",
    "react-native-screens": "4.30.0",
    "socket.io-client": "4.8.3"
  },
  "devDependencies": {
    "@types/node": "24.19.2",
    "@types/react": "19.3.0",
    "typescript": "6.0.3",
    "vitest": "5.0.5"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "test": "node scripts/check-copies.mjs && vitest run",
    "typecheck": "tsc --noEmit"
  },
  "private": true
}
```

Số trên máy TV4 khác thì giữ số thật, ghi vào S0 và dòng Tech Stack của plan.

- [ ] **Step 3: `app.json`, `tsconfig.json`, `.env.example`, `.gitignore` gốc**

`mobile/app.json` (giữ phần template, đổi `name`, `slug`, thêm `scheme`):

```json
{
  "expo": {
    "name": "SwiftletCare",
    "slug": "swiftletcare",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-splash-screen"
    ],
    "scheme": "swiftletcare"
  }
}
```

`mobile/tsconfig.json` — `extends` phải có đuôi **`.json`**: Vitest 5 không đọc được `expo/tsconfig.base` không đuôi (`TSCONFIG_ERROR`, đã gặp):

```json
{
  "extends": "expo/tsconfig.base.json",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

`mobile/.env.example`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

`.gitignore` gốc — thêm vào **cuối** những dòng chưa có (không ghi đè):

```
# mobile
mobile/.env
mobile/node_modules/
mobile/.expo/
mobile/dist/
mobile/expo-env.d.ts
```

(`mobile/.gitignore` của template giữ nguyên.)

- [ ] **Step 4: Viết test quy tắc repo và chạy**

`mobile/test/repo.test.ts`:

```ts
/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MOBILE = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(MOBILE, 'package.json'), 'utf8'));

describe('quy tac repo mobile (spec mobile 1.2-1.4)', () => {
  it('moi phien ban ghim chinh xac; socket.io-client 4.8.3, vitest 5.0.5, expo SDK 58', () => {
    for (const [name, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(v, name).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(pkg.dependencies['socket.io-client']).toBe('4.8.3');
    expect(pkg.devDependencies.vitest).toBe('5.0.5');
    expect(pkg.dependencies.expo).toMatch(/^58\./);
    expect(pkg.main).toBe('expo-router/entry');
  });

  it('.env.example chi co EXPO_PUBLIC_API_URL (vi du IP LAN)', () => {
    expect(readFileSync(join(MOBILE, '.env.example'), 'utf8').trim()).toBe('EXPO_PUBLIC_API_URL=http://192.168.1.10:3000');
  });

  it('khong con file mau cua create-expo-app trai cau truc spec', () => {
    for (const f of ['App.tsx', 'index.ts', 'AGENTS.md', 'CLAUDE.md', '.git', '.claude']) expect(existsSync(join(MOBILE, f)), f).toBe(false);
  });

  it('.gitignore goc co dong mobile', () => {
    const lines = readFileSync(join(MOBILE, '..', '.gitignore'), 'utf8').split(/\r?\n/);
    for (const l of ['mobile/.env', 'mobile/node_modules/', 'mobile/.expo/', 'mobile/dist/', 'mobile/expo-env.d.ts']) expect(lines).toContain(l);
  });
});
```

`npm test` lúc này chạy `scripts/check-copies.mjs` chưa có; tạm chạy thẳng: `npx vitest run test/repo.test.ts`.
Expected: PASS 4 test (nếu FAIL ở `.gitignore` hay file mẫu thì làm lại Step 1, 3).

- [ ] **Step 5: Màn hình tạm gọi `/api/health` (S1 — làm trước mọi thứ khác)**

`mobile/app/index.tsx` (**tạm**, Task 4 xóa):

```tsx
// TAM (Task 1, S1): kiem Expo Go goi duoc HTTP thuong toi IP LAN. Task 4 xoa file nay.
import { useState } from 'react';
import { Button, Text, View } from 'react-native';

const URL = process.env.EXPO_PUBLIC_API_URL;

export default function HealthCheck() {
  const [result, setResult] = useState('chua thu');
  async function check() {
    try {
      const res = await fetch(`${URL}/api/health`);
      setResult(`${res.status} ${await res.text()}`);
    } catch (e) {
      setResult(`LOI: ${String(e)}`);
    }
  }
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text>{URL ?? 'chua co EXPO_PUBLIC_API_URL'}</Text>
      <Button title="Goi /api/health" onPress={check} />
      <Text selectable>{result}</Text>
    </View>
  );
}
```

```powershell
copy .env.example .env      # sua thanh IP LAN that cua may backend
npx expo start -c
```

Trên điện thoại (Expo Go, quét mã QR) hoặc emulator (phím `a`): nhấn "Goi /api/health". Expected: `200 {"status":"ok",…}` (hoặc 503 kèm thân JSON nếu CSDL/MQTT chưa sẵn — vẫn chứng minh gọi được HTTP). **`LOI: … Network request failed`** trong khi trình duyệt điện thoại mở được `http://<IP>:3000/api/health` → Expo Go chặn HTTP thường: **dừng, báo nhóm** (spec 1.5.1). Ghi S1 (Android, và iOS nếu có).

- [ ] **Step 6: S2 mobile-mcp, S3 phiên bản Expo Go, ghi `spikes/RESULTS.md`**

- **S2:** trong Claude Code gọi `mobile_list_available_devices` của `mobile-mcp` (điện thoại cắm USB bật gỡ lỗi, hoặc emulator đang chạy). Thấy thiết bị → `mobile_take_screenshot` màn hình tạm. Lỗi (`CONNECT_TIMEOUT` như 15/10) → ghi lỗi, Task 8 dùng cách dự phòng (spec 3.1).
- **S3:** phiên bản Expo Go (Expo Go → Settings / thông tin ứng dụng của Android); chạy được SDK 58 không (Step 5 mở được là chạy được). Ghi cách **tắt tự cập nhật** Expo Go đã làm (spec 3.3).

`mobile/spikes/RESULTS.md`:

```markdown
# Kết quả bước kiểm chứng mobile (spec 1.2, 1.5)

| Mã | Mục | Cách kiểm | Kết quả | Ngày |
|---|---|---|---|---|
| S0 | Ai có iPhone / Android; dùng emulator? Yêu cầu máy emulator; phiên bản gói thật | Hỏi nhóm; Task 1 Step 2 | | |
| S1 | Expo Go gọi HTTP thường tới IP LAN (Android, iOS) | Màn hình tạm Task 1 Step 5 | | |
| S2 | mobile-mcp kết nối được | `mobile_list_available_devices` | | |
| S3 | Phiên bản Expo Go chạy SDK 58; đã tắt tự cập nhật | Task 1 Step 6 | | |
| S4 | socket.io-client 4.8.3 kết nối từ Expo Go qua IP LAN | Task 4 Step 6 | | |
| S5 | `expo-notifications` trong Expo Go SDK 58 (chỉ khi Bắt buộc 1–3 xong) | Thử riêng, không commit code | | |
```

- [ ] **Step 7: README khung và commit**

`mobile/README.md`:

```markdown
# mobile

Spec: `docs/superpowers/specs/2026-10-16-swiftletcare-mobile-design.md`. Plan: `docs/superpowers/plans/2026-10-16-swiftletcare-mobile.md`.

    cd mobile
    npm ci
    copy .env.example .env        # điền IP LAN máy chạy backend, KHÔNG dùng localhost
    npx expo start -c             # quét QR bằng Expo Go, hoặc phím a để mở Android Emulator
```

```powershell
git status   # khong co mobile/.env, node_modules, .expo
git add .gitignore mobile/package.json mobile/package-lock.json mobile/app.json mobile/tsconfig.json mobile/.gitignore mobile/.env.example mobile/assets mobile/app/index.tsx mobile/test/repo.test.ts mobile/README.md mobile/spikes/RESULTS.md
git commit -m "chore(mobile): khung Expo SDK 58 ghim phiên bản, màn hình tạm kiểm gọi HTTP từ Expo Go, kết quả bước kiểm chứng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Chép hàm thuần từ web và kiểm lệch bản sao

**Files:**
- Create: `mobile/lib/time.ts`, `mobile/lib/merge.ts`, `mobile/lib/errors.ts`, `mobile/lib/types.ts`, `mobile/lib/socket.ts`, `mobile/test/time.test.ts`, `mobile/test/merge.test.ts`, `mobile/test/errors.test.ts` (chép), `mobile/scripts/check-copies.mjs`, `mobile/test/check-copies.test.ts`

**Interfaces:**
- Consumes: plan web Task 2–5 (nội dung năm file `lib` và ba file test).
- Produces: như plan web Task 2–4; `check-copies.mjs` xuất `PAIRS` (8 đường dẫn), `hashText(text)`, `diffCopies(mobileDir, webDir): string[] | null` (`null` = chưa có `web/`).

- [ ] **Step 1: Viết test của `check-copies` (phải fail)**

`mobile/test/check-copies.test.ts`:

```ts
/// <reference types="node" />
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAIRS, diffCopies, hashText } from '../scripts/check-copies.mjs';

function tree(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'copies-'));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}
const all = (text: string) => Object.fromEntries((PAIRS as string[]).map((p) => [p, text]));

describe('check-copies (spec mobile 3.2)', () => {
  it('CRLF va LF cho cung bam', () => {
    expect(hashText('a\r\nb\r\n')).toBe(hashText('a\nb\n'));
  });

  it('khop -> rong; lech -> ten file; thieu web -> null', () => {
    const mobile = tree(all('x\n'));
    expect(diffCopies(mobile, tree(all('x\r\n')))).toEqual([]);
    expect(diffCopies(mobile, tree({ ...all('x\n'), 'lib/merge.ts': 'y\n' }))).toEqual(['lib/merge.ts']);
    expect(diffCopies(mobile, join(mobile, 'khong-co'))).toBeNull();
  });
});
```

Run: `npx vitest run test/check-copies.test.ts`
Expected: FAIL `Failed to resolve import "../scripts/check-copies.mjs"`.

- [ ] **Step 2: Viết `mobile/scripts/check-copies.mjs`**

```js
// So bam SHA-256 cac file chep tu web (spec mobile 3.2). Khac nhau chi CANH BAO, khong lam fail npm test.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const MOBILE = fileURLToPath(new URL('..', import.meta.url));
const WEB = join(MOBILE, '..', 'web');
export const PAIRS = [
  'lib/time.ts', 'lib/merge.ts', 'lib/errors.ts', 'lib/types.ts', 'lib/socket.ts',
  'test/time.test.ts', 'test/merge.test.ts', 'test/errors.test.ts',
];

// CRLF -> LF truoc khi bam de Git tren Windows khong gay bao sai.
export const hashText = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

export function diffCopies(mobileDir, webDir) {
  if (!existsSync(webDir)) return null;
  return PAIRS.filter((rel) => {
    const a = join(mobileDir, rel);
    const b = join(webDir, rel);
    if (!existsSync(a) || !existsSync(b)) return true;
    return hashText(readFileSync(a, 'utf8')) !== hashText(readFileSync(b, 'utf8'));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const diff = diffCopies(MOBILE, WEB);
  if (diff === null) console.log('Chua co thu muc web/: bo qua kiem ban sao');
  else if (diff.length) console.warn(`CANH BAO: ban sao lech voi web/: ${diff.join(', ')} - chep lai trong cung PR`);
  else console.log(`Ban sao khop web/ (${PAIRS.length} file)`);
}
```

- [ ] **Step 3: Chép tám file từ web**

```powershell
foreach ($f in 'lib/time.ts','lib/merge.ts','lib/errors.ts','lib/types.ts','lib/socket.ts','test/time.test.ts','test/merge.test.ts','test/errors.test.ts') {
  Copy-Item "web/$f" "mobile/$f"
}
```

Chưa có `web/` (mobile làm trước): tạo tám file bằng **đúng khối code** trong plan web Task 2 (`time`), Task 3 (`errors`), Task 4 (`types`, `merge`), Task 5 (`socket`) — không sửa chữ nào.

- [ ] **Step 4: Chạy test**

```powershell
cd mobile
npm test
```

Expected: dòng đầu `Ban sao khop web/ (8 file)` (hoặc `Chua co thu muc web/: bo qua kiem ban sao`); Vitest PASS 40 test (repo 4, check-copies 2, time 13, errors 13, merge 8).

- [ ] **Step 5: Commit**

```powershell
git add mobile/lib/time.ts mobile/lib/merge.ts mobile/lib/errors.ts mobile/lib/types.ts mobile/test/time.test.ts mobile/test/merge.test.ts mobile/test/errors.test.ts mobile/scripts/check-copies.mjs mobile/test/check-copies.test.ts
git commit -m "feat(mobile): chép hàm thuần thời gian, ghép dữ liệu, mã lỗi từ web; check-copies so băm và chỉ cảnh báo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Thân lệnh điều khiển (FAN Level 0 là tắt)

**Files:**
- Create: `mobile/lib/control.ts`, `mobile/test/control.test.ts`

**Interfaces:**
- Consumes: không.
- Produces: `FAN_STEPS = [0, 25, 50, 75, 100]`, `type ControlBody`, `fanBody(level): ControlBody` (ngoài các bước → lỗi), `switchBody(isOn): ControlBody`, `AUTO_BODY`.

- [ ] **Step 1: Viết test (phải fail)**

`mobile/test/control.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AUTO_BODY, FAN_STEPS, fanBody, switchBody } from '../lib/control';

describe('than lenh dieu khien (spec mobile 2.2)', () => {
  it('cac buoc Level quat 0/25/50/75/100', () => {
    expect([...FAN_STEPS]).toEqual([0, 25, 50, 75, 100]);
  });

  it('FAN Level 0 -> isOn false, khong gui level; khong co trang thai bat Level 0', () => {
    expect(fanBody(0)).toEqual({ mode: 'MANUAL', isOn: false });
    expect(fanBody(0)).not.toHaveProperty('level');
  });

  it('FAN 25..100 -> isOn true kem level', () => {
    expect(fanBody(50)).toEqual({ mode: 'MANUAL', isOn: true, level: 50 });
    expect(fanBody(100)).toEqual({ mode: 'MANUAL', isOn: true, level: 100 });
  });

  it('Level ngoai cac buoc -> loi', () => {
    expect(() => fanBody(60)).toThrow();
  });

  it('MIST/HEATER/SPEAKER chi bat tat; tra ve tu dong khong gui isOn', () => {
    expect(switchBody(true)).toEqual({ mode: 'MANUAL', isOn: true });
    expect(AUTO_BODY).toEqual({ mode: 'AUTO' });
  });
});
```

Run: `npx vitest run test/control.test.ts`
Expected: FAIL `Failed to resolve import "../lib/control"`.

- [ ] **Step 2: Viết `mobile/lib/control.ts`**

```ts
// Than lenh dieu khien tay (spec mobile 2.2). FAN: Level 0 -> isOn false (khong gui level); 25-100 -> isOn true kem level.
export const FAN_STEPS = [0, 25, 50, 75, 100] as const;

export type ControlBody =
  | { mode: 'MANUAL'; isOn: boolean; level?: number }
  | { mode: 'AUTO' };

export function fanBody(level: number): ControlBody {
  if (!(FAN_STEPS as readonly number[]).includes(level)) throw new Error(`Level quat khong hop le: ${level}`);
  return level === 0 ? { mode: 'MANUAL', isOn: false } : { mode: 'MANUAL', isOn: true, level };
}

export function switchBody(isOn: boolean): ControlBody {
  return { mode: 'MANUAL', isOn };
}

export const AUTO_BODY: ControlBody = { mode: 'AUTO' };
```

- [ ] **Step 3: Chạy test**

Run: `npm test`
Expected: PASS 45 test.

- [ ] **Step 4: Commit**

```powershell
git add mobile/lib/control.ts mobile/test/control.test.ts
git commit -m "feat(mobile): thân lệnh điều khiển, quạt Level 0 gửi isOn false, các bước 25-100 gửi kèm level

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Phiên, socket theo vòng đời app, đăng nhập, Tổng quan, banner (Bắt buộc 1)

**Files:**
- Create: `mobile/lib/session.ts`, `mobile/lib/api.ts`, `mobile/lib/auth.tsx`, `mobile/lib/live.tsx`, `mobile/lib/house.tsx`, `mobile/lib/config.ts`, `mobile/components/ui.tsx`, `mobile/components/AlertBanner.tsx`, `mobile/app/_layout.tsx`, `mobile/app/login.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/alerts.tsx` (Task 5 viết đủ; ở task này là bản Task 5 luôn, vì `Tabs` cần đủ ba route), `mobile/app/(tabs)/devices.tsx` (như trên), `mobile/app/alerts/[alertId].tsx` (như trên)
- Delete: `mobile/app/index.tsx` (màn hình tạm Task 1 — trùng route `/` với `(tabs)/index.tsx`)

**Interfaces:**
- Consumes: `createLiveSocket`, `LiveStatus` (bản chép `socket.ts`, Task 2); `ApiError`, `toApiError`, `messageFor`, `GENERIC_MESSAGE` (Task 2); `mergeLatest`, `applyDeviceState`, `replayDeviceStates`, `latestKey` (Task 2); `formatVn` (Task 2).
- Produces:
  - `session.ts`: `Session`, `sessionFromLogin`, `saveSession`, `loadSession(nowMs?)` (hết hạn → xóa, `null`), `clearSession` — đều async.
  - `api.ts`: `API_URL`, `setApiToken`, `getApiToken`, `setOnUnauthorized`, `api<T>(path, method?, body?)`, `snapshotSource(alertId) -> {uri, headers}`, `qs`.
  - `auth.tsx`: `AuthProvider`, `useAuth(): { ready, session, notice, login(res), logout(notice?) }`, hằng `EXPIRED`, `INVALID`.
  - `live.tsx`: `LiveProvider` (đóng socket khi `AppState` khác `active`, mở lại khi trở lại), `useLive()`, `useReloadOnConnect(load)`.
  - `house.tsx`: `HouseProvider`, `useHouse(): { houses, houseId, setHouseId, error, reload }`, `useLiveDevices(houseId)`, `useLiveLatest(houseId)`.
  - `components/ui.tsx`: `colors`, `errorText`, `ErrorBox`, `Empty`, `Loading`, `Button`, `Card`, `Badge`, `s`.

`app/(tabs)/_layout.tsx` khai báo ba tab nên ba file tab và màn chi tiết phải có cùng lúc; code của `alerts.tsx`, `devices.tsx`, `alerts/[alertId].tsx` nằm ở Task 5–6 — **tạo luôn ở task này bằng đúng code Task 5–6**, rồi kiểm hành vi của chúng ở Task 5–6.

- [ ] **Step 1: Viết `session.ts`, `api.ts`, `auth.tsx`** (`socket.ts` đã chép ở Task 2)

```powershell
Remove-Item mobile/app/index.tsx
```

`mobile/lib/session.ts`:

```ts
// Phien dang nhap trong expo-secure-store (spec mobile 2.1): tat mo lai app van con cho toi khi het han.
import * as SecureStore from 'expo-secure-store';
import type { LoginResponse, User } from './types';

export interface Session { accessToken: string; user: User; expiresAt: number }
const KEY = 'swiftletcare.session';

export function sessionFromLogin(res: LoginResponse, nowMs: number = Date.now()): Session {
  return { accessToken: res.accessToken, user: res.user, expiresAt: nowMs + res.expiresIn * 1000 };
}

export async function saveSession(s: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(s));
}

export async function loadSession(nowMs: number = Date.now()): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.accessToken || !(s.expiresAt > nowMs)) {
      await clearSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // bo qua: khong xoa duoc thi lan doc sau van kiem han
  }
}
```

`mobile/lib/api.ts`:

```ts
// fetch toi backend kem token (giu trong bo nho, nap tu SecureStore luc khoi dong); 401 -> dang xuat (spec mobile 2.1).
import { ApiError, toApiError } from './errors';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

let token: string | null = null;
let onUnauthorized: () => void = () => {};
export const setApiToken = (t: string | null) => {
  token = t;
};
export const getApiToken = () => token;
export const setOnUnauthorized = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK', null);
  }
  const data = await res.json().catch(() => null);
  if (res.ok) return data as T;
  if (res.status === 401 && path !== '/api/auth/login') onUnauthorized();
  throw toApiError(res.status, data);
}

// Anh thien dich: Image cua React Native gui duoc header (hop dong 3.3).
export function snapshotSource(alertId: number) {
  return { uri: `${API_URL}/api/alerts/${alertId}/snapshot`, headers: { Authorization: `Bearer ${token ?? ''}` } };
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? '?' + p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : '';
};
```

`mobile/lib/auth.tsx`:

```tsx
// Phien cua ca app: doc SecureStore truoc khi chon man hinh dau, hen gio het han, kiem han khi app tro lai (spec mobile 2.1).
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { setApiToken, setOnUnauthorized } from './api';
import { clearSession, loadSession, saveSession, sessionFromLogin, type Session } from './session';
import type { LoginResponse } from './types';

interface AuthValue {
  ready: boolean;
  session: Session | null;
  notice: string | null;
  login: (res: LoginResponse) => Promise<void>;
  logout: (notice?: string) => void;
}
const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth phai nam trong AuthProvider');
  return v;
}

export const EXPIRED = 'Phiên đã hết hạn, vui lòng đăng nhập lại.';
export const INVALID = 'Phiên không còn hợp lệ, vui lòng đăng nhập lại.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const logout = useCallback((text?: string) => {
    void clearSession();
    setApiToken(null);
    setSession(null);
    setNotice(text ?? null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => logout(INVALID));
    loadSession().then((s) => {
      setApiToken(s?.accessToken ?? null);
      setSession(s);
      setReady(true);
    });
  }, [logout]);

  // Hen gio toi expiresAt khi app dang mo; khi app tro lai tu nen cung kiem han (hen gio co the khong chay o nen).
  useEffect(() => {
    if (!session) return;
    const check = () => {
      if (Date.now() >= session.expiresAt) logout(EXPIRED);
    };
    const timer = setTimeout(check, session.expiresAt - Date.now());
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [session, logout]);

  const login = useCallback(async (res: LoginResponse) => {
    const s = sessionFromLogin(res);
    await saveSession(s);
    setApiToken(s.accessToken);
    setNotice(null);
    setSession(s);
  }, []);

  return <AuthContext.Provider value={{ ready, session, notice, login, logout }}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 2: Viết `live.tsx`, `house.tsx`, `config.ts`**

`mobile/lib/live.tsx`:

```tsx
// Mot socket cho ca app khi da dang nhap; DONG khi app vao nen, mo lai khi tro lai (connectCount tang -> man hinh tai lai REST).
// Spec mobile 2.3.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { API_URL, getApiToken } from './api';
import { INVALID, useAuth } from './auth';
import { createLiveSocket, type LiveStatus } from './socket';

export const LIVE_EVENTS = ['readings.new', 'alert.created', 'alert.updated', 'device.state', 'birdcount.updated'] as const;
export type LiveEvent = (typeof LIVE_EVENTS)[number];
type Listener = (event: LiveEvent, payload: unknown) => void;
interface LiveValue { status: LiveStatus; connectCount: number; subscribe: (l: Listener) => () => void }
const LiveContext = createContext<LiveValue | null>(null);

export function useLive(): LiveValue {
  const v = useContext(LiveContext);
  if (!v) throw new Error('useLive phai nam trong LiveProvider');
  return v;
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [connectCount, setConnectCount] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!foreground) return;
    const handlers = Object.fromEntries(
      LIVE_EVENTS.map((e) => [e, (payload: unknown) => listeners.current.forEach((l) => l(e, payload))]),
    );
    const live = createLiveSocket({
      url: API_URL,
      getToken: getApiToken,
      onLogout: () => logout(INVALID),
      onStatus: setStatus,
      onConnect: () => setConnectCount((n) => n + 1),
      handlers,
    });
    return () => live.close();
  }, [foreground, logout]);

  const subscribe = useCallback((l: Listener) => {
    listeners.current.add(l);
    return () => {
      listeners.current.delete(l);
    };
  }, []);

  return <LiveContext.Provider value={{ status, connectCount, subscribe }}>{children}</LiveContext.Provider>;
}

export function useReloadOnConnect(load: () => void): void {
  const { connectCount } = useLive();
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    loadRef.current();
  }, [connectCount]);
}
```

`mobile/lib/house.tsx`:

```tsx
// Nha dang chon (dung chung cho ba tab) va du lieu song cua nha: thiet bi, so do moi nhat.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { ApiError } from './errors';
import { useLive, useReloadOnConnect } from './live';
import { applyDeviceState, mergeLatest, replayDeviceStates, type LatestMap } from './merge';
import type { Device, DeviceState, House, LatestReading, ReadingsNew } from './types';

interface HouseValue { houses: House[] | null; houseId: number | null; setHouseId: (id: number) => void; error: unknown; reload: () => void }
const HouseContext = createContext<HouseValue | null>(null);

export function useHouse(): HouseValue {
  const v = useContext(HouseContext);
  if (!v) throw new Error('useHouse phai nam trong HouseProvider');
  return v;
}

export function HouseProvider({ children }: { children: ReactNode }) {
  const [houses, setHouses] = useState<House[] | null>(null);
  const [houseId, setHouseId] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(() => {
    api<House[]>('/api/houses')
      .then((list) => {
        const active = list.filter((h) => h.isActive);
        setHouses(active);
        setHouseId((cur) => (cur && active.some((h) => h.houseId === cur) ? cur : active[0]?.houseId ?? null));
        setError(null);
      })
      .catch(setError);
  }, []);
  useEffect(reload, [reload]);

  return <HouseContext.Provider value={{ houses, houseId, setHouseId, error, reload }}>{children}</HouseContext.Provider>;
}

// Thiet bi: giu device.state den trong luc REST dang tai, REST xong thi ap lai theo thu tu (spec web 2.4).
export function useLiveDevices(houseId: number | null) {
  const { subscribe } = useLive();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const loading = useRef(false);
  const held = useRef<DeviceState[]>([]);

  useEffect(() => subscribe((event, payload) => {
    if (event !== 'device.state') return;
    const ev = payload as DeviceState;
    if (ev.houseId !== houseId) return;
    if (loading.current) held.current.push(ev);
    else setDevices((d) => (d ? applyDeviceState(d, ev) : d));
  }), [subscribe, houseId]);

  const load = useCallback(async () => {
    if (houseId === null) return;
    loading.current = true;
    held.current = [];
    try {
      const rest = await api<Device[]>(`/api/houses/${houseId}/devices`);
      setDevices(replayDeviceStates(rest, held.current));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      loading.current = false;
      held.current = [];
    }
  }, [houseId]);
  useReloadOnConnect(load);

  return { devices, setDevices, error, reload: load };
}

export function useLiveLatest(houseId: number | null) {
  const { subscribe } = useLive();
  const [latest, setLatest] = useState<LatestMap>({});
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    setLatest({});
  }, [houseId]);
  useEffect(() => subscribe((event, payload) => {
    if (event !== 'readings.new') return;
    const ev = payload as ReadingsNew;
    if (ev.houseId === houseId) setLatest((m) => mergeLatest(m, ev.readings));
  }), [subscribe, houseId]);

  const load = useCallback(async () => {
    if (houseId === null) return;
    try {
      const rest = await api<LatestReading[]>(`/api/houses/${houseId}/latest-readings`);
      setLatest((m) => mergeLatest(m, rest));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    }
  }, [houseId]);
  useReloadOnConnect(load);
  return { latest, error, reload: load };
}
```

`mobile/lib/config.ts` (huy hiệu `OFFLINE` mục cắt — chỉ là hàm `showOffline`, làm luôn; cắt thì cho trả `false`):

```ts
// Huy hieu OFFLINE: chi SENSOR cho toi khi heartbeat (duoi ranh gioi cat) da lam (spec mobile 2.2).
export const HEARTBEAT_ENABLED = false;

export const METRIC_LABELS: Record<string, string> = { TEMP: 'Nhiệt độ', HUMID: 'Độ ẩm', CO2: 'CO₂', LIGHT: 'Ánh sáng' };
export const DEVICE_LABELS: Record<string, string> = {
  SENSOR: 'Cảm biến', FAN: 'Quạt', MIST: 'Phun sương', HEATER: 'Sưởi', SPEAKER: 'Loa', CAMERA: 'Camera',
};
export const ACTUATORS = ['FAN', 'MIST', 'HEATER', 'SPEAKER'];

export function showOffline(deviceType: string, status: string): boolean {
  return status !== 'ONLINE' && (deviceType === 'SENSOR' || HEARTBEAT_ENABLED);
}
```

- [ ] **Step 3: Viết `components/ui.tsx`, `components/AlertBanner.tsx`**

`mobile/components/ui.tsx`:

```tsx
// Thanh phan dung chung (React Native): loi theo ma (khong hien message tho), trong, dang tai, nut.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError, GENERIC_MESSAGE, messageFor } from '@/lib/errors';

export const colors = { bg: '#fafaf9', card: '#ffffff', text: '#1c1917', muted: '#78716c', primary: '#047857', danger: '#b91c1c', warnBg: '#fef3c7', badBg: '#fee2e2', border: '#e7e5e4' };

export function errorText(e: unknown): string {
  return e instanceof ApiError ? messageFor(e.code) : GENERIC_MESSAGE;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const retry = error instanceof ApiError && (error.code === 'RETRY_LATER' || error.code === 'NETWORK') && onRetry;
  return (
    <View style={s.error} accessibilityRole="alert">
      <Text style={{ color: colors.danger, flex: 1 }}>{errorText(error)}</Text>
      {retry ? <Button title="Thử lại" kind="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text style={s.empty}>{children}</Text>;
}

export function Loading() {
  return <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />;
}

export function Button({ title, onPress, kind = 'primary', disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  const bg = kind === 'primary' ? colors.primary : kind === 'danger' ? colors.danger : 'transparent';
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }, kind === 'ghost' && s.btnGhost]}>
      <Text style={{ color: kind === 'ghost' ? colors.text : '#fff', fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}><Text style={s.cardTitle}>{title}</Text>{right}</View>
      {children}
    </View>
  );
}

export function Badge({ text, bg }: { text: string; bg: string }) {
  return <Text style={[s.badge, { backgroundColor: bg }]}>{text}</Text>;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, padding: 10, borderRadius: 8, backgroundColor: colors.badBg },
  empty: { textAlign: 'center', color: colors.muted, marginVertical: 24 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.card, margin: 12, marginBottom: 0, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  badge: { color: '#fff', fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, backgroundColor: '#fff', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  muted: { color: colors.muted, fontSize: 12 },
});
```

`mobile/components/AlertBanner.tsx`:

```tsx
// Banner trong app khi co alert.created (spec mobile 2.4): o lop goc nen hien tren moi man hinh; rung ngan;
// cham -> mo chi tiet. Chi co tac dung khi app dang mo (socket dong khi app vao nen). Khong phai thong bao day.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLive } from '@/lib/live';
import type { Alert, AlertCreated } from '@/lib/types';

const SHOW_MS = 6000;

export function AlertBanner() {
  const { subscribe } = useLive();
  const insets = useSafeAreaInsets();
  const [alert, setAlert] = useState<Alert | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const off = subscribe((event, payload) => {
      if (event !== 'alert.created') return;
      setAlert((payload as AlertCreated).alert);
      Vibration.vibrate(300);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAlert(null), SHOW_MS);
    });
    return () => {
      off();
      clearTimeout(timer.current);
    };
  }, [subscribe]);

  if (!alert) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        setAlert(null);
        router.push(`/alerts/${alert.alertId}`);
      }}
      style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, zIndex: 100, backgroundColor: '#b91c1c', borderRadius: 12, padding: 14, elevation: 6 }}
    >
      <Text style={{ color: '#fff', fontWeight: '700' }}>Cảnh báo mới</Text>
      <Text style={{ color: '#fff' }} numberOfLines={2}>{alert.message}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Viết lớp gốc, đăng nhập, khung tab, Tổng quan**

`mobile/app/_layout.tsx`:

```tsx
// Lop goc: giu man hinh cho cho toi khi doc xong token (khong nhay man Dang nhap), chon nhom man hinh theo phien,
// mot socket cho ca app, banner canh bao tren moi man hinh (spec mobile 2.1, 2.3, 2.4).
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertBanner } from '@/components/AlertBanner';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LiveProvider } from '@/lib/live';

void SplashScreen.preventAutoHideAsync();

function WithLive({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return <>{children}</>;
  return (
    <LiveProvider>
      {children}
      <AlertBanner />
    </LiveProvider>
  );
}

function RootStack() {
  const { ready, session } = useAuth();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <WithLive>
      <Stack screenOptions={{ headerTitleAlign: 'center' }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="alerts/[alertId]" options={{ title: 'Chi tiết cảnh báo' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </WithLive>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1 }}>
          <RootStack />
        </View>
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
```

`mobile/app/login.tsx`:

```tsx
// Dang nhap (spec mobile 2.1). Sai mat khau va tai khoan bi khoa cung mot cau.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { Button, colors, errorText, s } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import type { LoginResponse } from '@/lib/types';

export default function Login() {
  const { login, notice } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(await api<LoginResponse>('/api/auth/login', 'POST', { username, password }));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Sai tên đăng nhập hoặc mật khẩu' : errorText(e));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[s.screen, { justifyContent: 'center', padding: 24 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 16, color: colors.text }}>SwiftletCare</Text>
      {notice ? <Text style={{ color: '#b45309', marginBottom: 12 }}>{notice}</Text> : null}
      <View style={{ gap: 12 }}>
        <TextInput style={s.input} placeholder="Tên đăng nhập" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
        <TextInput style={s.input} placeholder="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        {error ? <Text style={{ color: colors.danger }} accessibilityRole="alert">{error}</Text> : null}
        <Button title={busy ? 'Đang đăng nhập…' : 'Đăng nhập'} onPress={submit} disabled={busy || !username || !password} />
      </View>
    </KeyboardAvoidingView>
  );
}
```

`mobile/app/(tabs)/_layout.tsx`:

```tsx
// Ba tab; thanh trang thai ket noi; nut dang xuat; nha dang chon dung chung.
import { Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { HouseProvider } from '@/lib/house';
import { useLive } from '@/lib/live';

function ConnectionBar() {
  const { status } = useLive();
  if (status === 'connected') return null;
  return (
    <View style={{ backgroundColor: '#fef3c7', paddingVertical: 4 }}>
      <Text style={{ textAlign: 'center', color: '#78350f', fontSize: 12 }}>
        {status === 'connecting' ? 'Đang kết nối máy chủ…' : 'Mất kết nối máy chủ, đang kết nối lại…'}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { logout } = useAuth();
  const logoutButton = () => (
    <Pressable onPress={() => logout()} style={{ paddingHorizontal: 12 }} accessibilityRole="button">
      <Text style={{ color: '#047857' }}>Đăng xuất</Text>
    </Pressable>
  );
  return (
    <HouseProvider>
      <ConnectionBar />
      <Tabs screenOptions={{ headerRight: logoutButton, tabBarActiveTintColor: '#047857' }}>
        <Tabs.Screen name="index" options={{ title: 'Tổng quan' }} />
        <Tabs.Screen name="alerts" options={{ title: 'Cảnh báo' }} />
        <Tabs.Screen name="devices" options={{ title: 'Thiết bị' }} />
      </Tabs>
    </HouseProvider>
  );
}
```

`mobile/app/(tabs)/index.tsx`:

```tsx
// Tong quan: chon nha; moi khu vuc mot the (4 chi so moi nhat, to mau ngoai nguong, trang thai FAN/MIST/HEATER); keo xuong tai lai.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Badge, Button, Card, colors, Empty, ErrorBox, Loading, s } from '@/components/ui';
import { api } from '@/lib/api';
import { DEVICE_LABELS, METRIC_LABELS, showOffline } from '@/lib/config';
import { useHouse, useLiveDevices, useLiveLatest } from '@/lib/house';
import { latestKey } from '@/lib/merge';
import { formatVn } from '@/lib/time';
import type { Device, Metric, Threshold, Zone } from '@/lib/types';

const METRICS: Metric[] = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];

const outOfRange = (v: number | null | undefined, t?: Threshold) =>
  v != null && !!t && ((t.minValue !== null && v < t.minValue) || (t.maxValue !== null && v > t.maxValue));

const stateText = (d: Device) =>
  d.isOn === null ? '—' : `${d.isOn ? 'Bật' : 'Tắt'}${d.deviceType === 'FAN' && d.isOn ? ` ${d.level ?? 0}%` : ''} · ${d.mode === 'MANUAL' ? 'Tay' : 'Tự động'}`;

export default function Overview() {
  const { houses, houseId, setHouseId, error: houseError, reload: reloadHouses } = useHouse();
  const { devices, reload: reloadDevices } = useLiveDevices(houseId);
  const { latest, error, reload: reloadLatest } = useLiveLatest(houseId);
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [thresholds, setThresholds] = useState<Record<number, Threshold[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadZones = useCallback(async () => {
    if (houseId === null) return;
    const z = await api<Zone[]>(`/api/houses/${houseId}/zones`);
    setZones(z);
    const all = await Promise.all(z.map((zone) => api<Threshold[]>(`/api/zones/${zone.zoneId}/thresholds`)));
    setThresholds(Object.fromEntries(z.map((zone, i) => [zone.zoneId, all[i]])));
  }, [houseId]);
  useEffect(() => {
    setZones(null);
    loadZones().catch(() => setZones([]));
  }, [loadZones]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([loadZones(), reloadDevices(), reloadLatest()]);
    setRefreshing(false);
  };

  if (houseError) return <ErrorBox error={houseError} onRetry={reloadHouses} />;
  if (!houses) return <Loading />;
  if (houses.length === 0) return <Empty>Chưa có nhà nào.</Empty>;

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      {houses.length > 1 ? (
        <View style={[s.row, { padding: 12 }]}>
          {houses.map((h) => (
            <Button key={h.houseId} title={h.name} kind={h.houseId === houseId ? 'primary' : 'ghost'} onPress={() => setHouseId(h.houseId)} />
          ))}
        </View>
      ) : null}
      <ErrorBox error={error} onRetry={refresh} />
      {zones === null ? <Loading /> : zones.length === 0 ? <Empty>Nhà chưa có khu vực nào.</Empty> : zones.map((zone) => {
        const zoneDevices = (devices ?? []).filter((d) => d.zoneId === zone.zoneId && d.isActive);
        const sensor = zoneDevices.find((d) => d.deviceType === 'SENSOR');
        const hasReading = !!sensor && METRICS.some((m) => latest[latestKey(sensor.deviceId, m)]);
        return (
          <Card key={zone.zoneId} title={zone.name} right={sensor && showOffline(sensor.deviceType, sensor.status) ? <Badge text="OFFLINE" bg="#44403c" /> : null}>
            {hasReading && sensor ? (
              <View style={[s.row, { marginBottom: 8 }]}>
                {METRICS.map((m) => {
                  const r = latest[latestKey(sensor.deviceId, m)];
                  const bad = outOfRange(r?.value, thresholds[zone.zoneId]?.find((t) => t.metricCode === m));
                  return (
                    <View key={m} style={{ width: '47%', padding: 8, borderRadius: 8, backgroundColor: bad ? colors.badBg : '#f5f5f4' }}>
                      <Text style={s.muted}>{METRIC_LABELS[m]}</Text>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: bad ? colors.danger : colors.text }}>{r?.value ?? '—'} <Text style={s.muted}>{r?.unit ?? ''}</Text></Text>
                      {r ? <Text style={s.muted}>{formatVn(r.at)}</Text> : null}
                    </View>
                  );
                })}
              </View>
            ) : <Empty>Chưa có số đo</Empty>}
            {zoneDevices.filter((d) => ['FAN', 'MIST', 'HEATER'].includes(d.deviceType)).map((d) => (
              <View key={d.deviceId} style={[s.row, { justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderColor: colors.border }]}>
                <Text>{DEVICE_LABELS[d.deviceType]}</Text>
                <Text>{stateText(d)}</Text>
              </View>
            ))}
          </Card>
        );
      })}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
```

Tạo luôn `app/(tabs)/alerts.tsx`, `app/(tabs)/devices.tsx`, `app/alerts/[alertId].tsx` bằng code ở Task 5 Step 1–2 và Task 6 Step 1.

- [ ] **Step 5: Kiểm kiểu và test**

Run: `npm run typecheck; npm test`
Expected: `tsc` không lỗi; PASS 45 test. (`npx expo export --platform android --output-dir $env:TEMP\sc-export` cũng phải đóng gói được — kiểm Metro không cần điện thoại; xóa thư mục đó sau.)

- [ ] **Step 6: Kiểm tay trên Expo Go (checklist 3.1 bước 1–3, 10, 12 ý 1; S4)**

Backend + simulator chạy (simulator **trước** backend). `npx expo start -c`, mở bằng Expo Go:
1. Lần đầu → màn Đăng nhập; sai mật khẩu → "Sai tên đăng nhập hoặc mật khẩu"; `owner1` → Tổng quan, chỉ thấy nhà mình.
2. Vuốt tắt app, mở lại → vào thẳng Tổng quan, **không nháy** màn Đăng nhập.
3. Số đo đổi mỗi 10–15 giây (socket kết nối được → ghi **S4**).
4. Tắt backend → thanh "Mất kết nối máy chủ, đang kết nối lại…"; bật lại → tự kết nối, số đo cập nhật.
5. Sửa `.env` sang IP sai, `npx expo start -c`, kéo xuống tải lại → "Không kết nối được máy chủ." + "Thử lại" (Review Focus 1); trả IP đúng.

Dùng `mobile-mcp` nếu S2 đạt (`mobile_list_elements_on_screen` để đọc chữ, `mobile_take_screenshot` khi cần nhìn màu).

- [ ] **Step 7: Commit**

```powershell
git add mobile/lib mobile/components mobile/app mobile/spikes/RESULTS.md
git status   # app/index.tsx da xoa (deleted)
git commit -m "feat(mobile): phiên trong secure-store đọc trước màn hình đầu, socket đóng mở theo AppState, đăng nhập, tổng quan số đo trực tiếp, banner cảnh báo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git add mobile/app` ghi nhận cả việc xóa `app/index.tsx`.)

---

### Task 5: Cảnh báo — danh sách, chi tiết, ACK/RESOLVED, ảnh (Bắt buộc 2)

**Files:**
- Create (đã tạo ở Task 4 bằng code dưới đây; task này kiểm hành vi): `mobile/app/(tabs)/alerts.tsx`, `mobile/app/alerts/[alertId].tsx`

**Interfaces:**
- Consumes: `api`, `qs`, `snapshotSource` (Task 4); `useHouse` (Task 4); `useLive`, `useReloadOnConnect` (Task 4); `mergeAlert` (Task 2); `formatVn` (Task 2).
- Produces: tab Cảnh báo (mặc định `status=NEW,ACK`, nút "Tất cả", cuộn tới cuối tải trang `before`); màn `/alerts/[alertId]`.

- [ ] **Step 1: `mobile/app/(tabs)/alerts.tsx`**

```tsx
// Danh sach canh bao: mac dinh dang mo (NEW,ACK), nut xem tat ca, phan trang before khi cuon (spec mobile 2.2).
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Badge, Button, colors, Empty, ErrorBox, Loading, s } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { useHouse } from '@/lib/house';
import { useLive, useReloadOnConnect } from '@/lib/live';
import { mergeAlert } from '@/lib/merge';
import { formatVn } from '@/lib/time';
import type { Alert, AlertCreated, AlertUpdated, Page } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = { NEW: 'Mới', ACK: 'Đã xem', RESOLVED: 'Đã xử lý' };
const STATUS_BG: Record<string, string> = { NEW: '#b91c1c', ACK: '#b45309', RESOLVED: '#57534e' };

export default function Alerts() {
  const { houseId } = useHouse();
  const { subscribe } = useLive();
  const [openOnly, setOpenOnly] = useState(true);
  const [list, setList] = useState<Alert[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (before: number | null) => {
    if (houseId === null) return;
    try {
      const page = await api<Page<Alert>>(`/api/alerts${qs({ houseId, status: openOnly ? 'NEW,ACK' : null, limit: 30, before })}`);
      setList((cur) => (before && cur ? [...cur, ...page.items] : page.items));
      setNextBefore(page.nextBefore);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [houseId, openOnly]);
  useReloadOnConnect(() => void load(null));
  useEffect(() => {
    setList(null);
    void load(null);
  }, [load]);

  useEffect(() => subscribe((event, payload) => {
    if (event === 'alert.created') {
      const a = (payload as AlertCreated).alert;
      if (a.houseId === houseId) setList((l) => (l ? mergeAlert(l, a) : l));
    } else if (event === 'alert.updated') {
      const u = payload as AlertUpdated;
      if (u.houseId === houseId) setList((l) => (l ? mergeAlert(l, u) : l));
    }
  }), [subscribe, houseId]);

  const shown = (list ?? []).filter((a) => !openOnly || a.status !== 'RESOLVED');
  return (
    <View style={s.screen}>
      <View style={[s.row, { padding: 12 }]}>
        <Button title="Đang mở" kind={openOnly ? 'primary' : 'ghost'} onPress={() => setOpenOnly(true)} />
        <Button title="Tất cả" kind={openOnly ? 'ghost' : 'primary'} onPress={() => setOpenOnly(false)} />
      </View>
      <ErrorBox error={error} onRetry={() => load(null)} />
      {list === null && !error ? <Loading /> : (
        <FlatList
          data={shown}
          keyExtractor={(a) => String(a.alertId)}
          ListEmptyComponent={error ? undefined : <Empty>Không có cảnh báo</Empty>}
          onEndReached={() => nextBefore && load(nextBefore)}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/alerts/${item.alertId}`)}
              style={{ backgroundColor: colors.card, marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
              <View style={[s.row, { marginBottom: 4 }]}>
                <Badge text={STATUS_LABEL[item.status]} bg={STATUS_BG[item.status]} />
                <Text style={s.muted}>{formatVn(item.createdAt)}</Text>
              </View>
              <Text numberOfLines={2}>{item.message}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 2: `mobile/app/alerts/[alertId].tsx`**

```tsx
// Chi tiet canh bao: thong tin + history; ACK, RESOLVED kem ghi chu; anh qua Image co header (spec mobile 2.2).
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, ErrorBox, Loading, s } from '@/components/ui';
import { api, snapshotSource } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { formatVn } from '@/lib/time';
import type { AlertDetail } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = { NEW: 'Mới', ACK: 'Đã xem', RESOLVED: 'Đã xử lý' };

function Snapshot({ alertId }: { alertId: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Text style={s.muted}>Không có ảnh</Text>;
  return (
    <Image source={snapshotSource(alertId)} onError={() => setFailed(true)} resizeMode="contain"
      style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: '#e7e5e4' }} accessibilityLabel={`Ảnh cảnh báo ${alertId}`} />
  );
}

export default function AlertDetailScreen() {
  const { alertId } = useLocalSearchParams<{ alertId: string }>();
  const id = Number(alertId);
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await api<AlertDetail>(`/api/alerts/${id}`));
    } catch (e) {
      setError(e);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function change(status: 'ACK' | 'RESOLVED') {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api(`/api/alerts/${id}`, 'PATCH', { status, note: note || undefined });
      setNote('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ALERT_INVALID_TRANSITION') setInfo('Cảnh báo đã đổi trạng thái. Đã tải lại.');
      else setError(e);
    }
    await load();
    setBusy(false);
  }

  if (!detail) return error ? <ErrorBox error={error} onRetry={load} /> : <Loading />;
  return (
    <ScrollView style={s.screen}>
      <Card title={`#${detail.alertId} — ${STATUS_LABEL[detail.status]}`}>
        <Text style={{ marginBottom: 6 }}>{detail.message}</Text>
        <Text style={s.muted}>{formatVn(detail.createdAt)} · {detail.alertType} · {detail.severity}
          {detail.detectedClass ? ` · ${detail.detectedClass} (${detail.confidence})` : ''}</Text>
        {detail.hasSnapshot ? <View style={{ marginTop: 10 }}><Snapshot alertId={detail.alertId} /></View> : null}
        <ErrorBox error={error} />
        {info ? <Text style={{ color: '#b45309', marginTop: 8 }}>{info}</Text> : null}
        {detail.status !== 'RESOLVED' ? (
          <View style={{ gap: 8, marginTop: 12 }}>
            <TextInput style={s.input} placeholder="Ghi chú (không bắt buộc)" maxLength={500} value={note} onChangeText={setNote} />
            <View style={s.row}>
              {detail.status === 'NEW' ? <Button title="Đã xem (ACK)" kind="ghost" disabled={busy} onPress={() => change('ACK')} /> : null}
              <Button title="Đã xử lý" disabled={busy} onPress={() => change('RESOLVED')} />
            </View>
          </View>
        ) : null}
      </Card>
      <Card title="Lịch sử">
        {detail.history.map((h) => (
          <Text key={h.historyId} style={{ marginBottom: 4 }}>{formatVn(h.changedAt)}: {h.oldStatus ?? '—'} → {h.newStatus}{h.note ? ` — ${h.note}` : ''}</Text>
        ))}
      </Card>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
```

- [ ] **Step 3: Kiểm tay (checklist 3.1 bước 6–8, 12 ý 2–4)**

Run trước: `npm run typecheck; npm test` → sạch, PASS.
1. ACK rồi RESOLVED một cảnh báo; danh sách "Đang mở" bỏ cảnh báo đó.
2. Cảnh báo thiên địch của seed → "Không có ảnh" (404).
3. Cảnh báo mới khi app đang mở (simulator `--scenario hot`, hoặc ngưỡng chỉnh trên web) → banner đỏ + rung trên **bất kỳ tab nào**; chạm → đúng chi tiết; chạm banner khi đang ở chi tiết cảnh báo khác → mở cảnh báo mới (Review Focus 3).
4. Tắt Wi-Fi điện thoại khi đang ở tab Cảnh báo → thanh mất kết nối, không văng app; bật lại → tải lại.

- [ ] **Step 4: Commit (nếu có chỉnh sau kiểm tay)**

```powershell
git add "mobile/app/(tabs)/alerts.tsx" "mobile/app/alerts/[alertId].tsx"
git commit -m "feat(mobile): cảnh báo đang mở và tất cả, phân trang khi cuộn, chi tiết kèm lịch sử, ACK/RESOLVED, ảnh thiên địch có header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Không có thay đổi so với Task 4 thì bỏ commit, ghi kết quả kiểm tay vào Task 8.

---

### Task 6: Điều khiển tay (Bắt buộc 3)

**Files:**
- Create (đã tạo ở Task 4 bằng code dưới đây; task này kiểm hành vi): `mobile/app/(tabs)/devices.tsx`

**Interfaces:**
- Consumes: `fanBody`, `switchBody`, `AUTO_BODY`, `FAN_STEPS` (Task 3); `useHouse`, `useLiveDevices` (Task 4); `api` (Task 4).
- Produces: tab Thiết bị theo khu vực; cập nhật từ phản hồi `{changed, deviceCode, mode, isOn, level}`.

- [ ] **Step 1: `mobile/app/(tabs)/devices.tsx`**

```tsx
// Dieu khien tay theo khu vuc: bat/tat; Level quat 0/25/50/75/100 (0 = tat); tra ve tu dong.
// Cap nhat tu PHAN HOI, khong doan truoc (spec mobile 2.2).
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Badge, Button, Card, Empty, ErrorBox, Loading, s } from '@/components/ui';
import { api } from '@/lib/api';
import { ACTUATORS, DEVICE_LABELS, showOffline } from '@/lib/config';
import { AUTO_BODY, FAN_STEPS, fanBody, switchBody, type ControlBody } from '@/lib/control';
import { useHouse, useLiveDevices } from '@/lib/house';
import type { ControlResult, Device, Zone } from '@/lib/types';

function DeviceRow({ device, onResult }: { device: Device; onResult: (id: number, r: ControlResult) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function send(body: ControlBody) {
    setBusy(true);
    setError(null);
    try {
      onResult(device.deviceId, await api<ControlResult>(`/api/devices/${device.deviceId}/control`, 'POST', body));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const isFan = device.deviceType === 'FAN';
  const current = device.isOn ? (isFan ? device.level ?? 100 : 100) : 0;
  return (
    <View style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: '#e7e5e4', gap: 8 }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={{ fontWeight: '600' }}>{DEVICE_LABELS[device.deviceType]} — {device.name}</Text>
        {showOffline(device.deviceType, device.status) ? <Badge text="OFFLINE" bg="#44403c" /> : null}
      </View>
      <Text style={s.muted}>
        {device.isOn ? 'Đang bật' : 'Đang tắt'}{isFan && device.isOn ? ` ${device.level ?? 0}%` : ''} · {device.mode === 'MANUAL' ? 'Điều khiển tay' : 'Tự động'}
      </Text>
      <View style={s.row}>
        {isFan
          ? FAN_STEPS.map((lvl) => (
            <Button key={lvl} title={lvl === 0 ? 'Tắt' : `${lvl}%`} kind={device.mode === 'MANUAL' && current === lvl ? 'primary' : 'ghost'} disabled={busy} onPress={() => send(fanBody(lvl))} />
          ))
          : (
            <>
              <Button title="Bật" kind={device.isOn ? 'primary' : 'ghost'} disabled={busy} onPress={() => send(switchBody(true))} />
              <Button title="Tắt" kind={device.isOn ? 'ghost' : 'primary'} disabled={busy} onPress={() => send(switchBody(false))} />
            </>
          )}
        <Button title="Trả về tự động" kind="ghost" disabled={busy || device.mode === 'AUTO'} onPress={() => send(AUTO_BODY)} />
      </View>
      <ErrorBox error={error} />
    </View>
  );
}

export default function Devices() {
  const { houseId } = useHouse();
  const { devices, setDevices, error, reload } = useLiveDevices(houseId);
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    if (houseId !== null) api<Zone[]>(`/api/houses/${houseId}/zones`).then(setZones).catch(() => setZones([]));
  }, [houseId]);

  const onResult = (id: number, r: ControlResult) =>
    setDevices((list) => list && list.map((d) => (d.deviceId === id ? { ...d, mode: r.mode, isOn: r.isOn, level: r.level } : d)));

  if (error && !devices) return <ErrorBox error={error} onRetry={reload} />;
  if (!devices) return <Loading />;
  const actuators = devices.filter((d) => ACTUATORS.includes(d.deviceType) && d.isActive);
  if (actuators.length === 0) return <Empty>Chưa có thiết bị điều khiển được.</Empty>;

  return (
    <ScrollView style={s.screen}>
      {zones.map((z) => {
        const list = actuators.filter((d) => d.zoneId === z.zoneId);
        return list.length ? (
          <Card key={z.zoneId} title={z.name}>
            {list.map((d) => <DeviceRow key={d.deviceId} device={d} onResult={onResult} />)}
          </Card>
        ) : null;
      })}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
```

- [ ] **Step 2: Kiểm tay (checklist 3.1 bước 4–5)**

1. Simulator `--scenario hot` → FAN H1-F2 bật rồi tắt trên tab Thiết bị (cập nhật qua `device.state`).
2. FAN Level 50 → "Đang bật 50% · Điều khiển tay"; Level 0 ("Tắt") → "Đang tắt"; "Trả về tự động" → "Tự động".
3. MIST bật/tắt; trên web (nếu có) thấy cùng trạng thái.

- [ ] **Step 3: Commit (nếu có chỉnh)**

```powershell
git add "mobile/app/(tabs)/devices.tsx"
git commit -m "feat(mobile): điều khiển tay theo khu vực, quạt các bước 0-100 với 0 là tắt, trả về tự động theo phản hồi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 (dưới ranh giới cắt): Huy hiệu OFFLINE cho cơ cấu chấp hành khi đã có heartbeat

**Files:**
- Modify: `mobile/lib/config.ts`

**Interfaces:**
- Consumes: heartbeat của simulator (Task 9), backend (Task 26), ai-vision (`--heartbeat`) **đều đã chạy**.

- [ ] **Step 1: Kiểm điều kiện**

`GET /api/houses/<id>/devices` khi simulator chạy có heartbeat: FAN/MIST/HEATER/SPEAKER có `status: "ONLINE"`. Chưa đúng → **dừng**, giữ `HEARTBEAT_ENABLED = false` (spec 3.4 hạn chế 7).

- [ ] **Step 2: Đổi cờ, kiểm, commit**

Đổi `export const HEARTBEAT_ENABLED = false;` thành `true` trong `mobile/lib/config.ts`. `npm run typecheck` sạch. Tắt simulator 6 phút → tab Thiết bị có `OFFLINE` cho cơ cấu chấp hành.

```powershell
git add mobile/lib/config.ts
git commit -m "feat(mobile): bật huy hiệu OFFLINE cho cơ cấu chấp hành khi heartbeat đã chạy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Kiểm đầu-cuối theo checklist 3.1 (mobile-mcp), đo độ trễ, README đầy đủ

**Files:**
- Create: `mobile/results/e2e.md`
- Modify: `mobile/README.md`, `mobile/spikes/RESULTS.md`

**Interfaces:**
- Consumes: CSDL Dev có dữ liệu mẫu, Mosquitto, simulator (trước backend), backend, `latency-probe` (plan backend Task 24); kết quả S2.

- [ ] **Step 1: Chạy đủ 13 bước của spec 3.1**

Bằng `mobile-mcp` nếu S2 đạt (`mobile_launch_app` mở Expo Go, `mobile_list_elements_on_screen` đọc chữ, `mobile_click_on_screen_at_coordinates`/`mobile_type_keys` thao tác; gom chuỗi thao tác bằng `mobile_batch_commands`). Không đạt thì làm tay cùng checklist. Bước 9: đưa app vào nền 1 phút rồi mở lại → dữ liệu tải lại, không trùng, không mất cảnh báo. Bước 11: `Invoke-RestMethod` với token `admin` gọi `PATCH /api/users/<id owner1>` `{"isActive":false}` → app về Đăng nhập; **mở khóa lại** sau khi kiểm.

- [ ] **Step 2: Đo độ trễ (bước 13)**

Chạy `latency-probe` của backend (plan backend Task 24) publish số đo vượt ngưỡng; với mỗi mẫu ghi thời điểm publish và thời điểm banner hiện (mobile-mcp đọc màn hình lặp, độ phân giải ~1 giây). Ít nhất 10 mẫu; ghi số mẫu, nhỏ nhất, trung vị, lớn nhất; mục tiêu 3–5 giây. Không có mobile-mcp: quay màn hình điện thoại có đồng hồ, ghi rõ "chỉ mang tính tham khảo".

- [ ] **Step 3: Ghi `mobile/results/e2e.md`**

```markdown
# Kiểm đầu-cuối mobile (spec mobile 3.1)

- Ngày: _…_ · Người làm: TV4 · Thiết bị: _…_ (Android _…_ / emulator) · Expo Go: _…_ · Cách kiểm: mobile-mcp / tay

| # | Bước (spec 3.1) | Kết quả | Đạt |
|---|---|---|---|
| 1 | Lần đầu → Đăng nhập; `owner1` thấy nhà mình | | |
| 2 | Mở lại app → thẳng Tổng quan, không nháy | | |
| 3 | Số đo cập nhật trực tiếp | | |
| 4 | `hot` → FAN H1-F2 bật rồi tắt | | |
| 5 | FAN 50, FAN 0 (tắt), trả về tự động | | |
| 6 | ACK rồi RESOLVED | | |
| 7 | Ảnh seed 404 → "Không có ảnh"; ảnh AI hiện | | |
| 8 | Banner + rung trên mọi tab; chạm mở chi tiết | | |
| 9 | Nền 1 phút rồi mở lại → tải lại, không trùng, không mất | | |
| 10 | Tắt backend → đang kết nối lại; bật lại → tự kết nối | | |
| 11 | Khóa `owner1` qua API → về Đăng nhập | | |
| 12 | Ca trống, ca lỗi (4 ý) | | |
| 13 | Độ trễ banner: n = _, min _, trung vị _, max _ (độ phân giải ~1 s) | | |
```

- [ ] **Step 4: Viết đủ `mobile/README.md`**

Các mục (tiếng Việt có dấu): cài đặt; `.env` = IP LAN máy backend, `npx expo start -c` sau khi sửa; kiểm `http://<IP>:3000/api/health` từ trình duyệt điện thoại; tường lửa cổng 3000 (Private); Expo Go cùng Wi-Fi; **tắt tự cập nhật Expo Go** hoặc emulator cố định phiên bản; yêu cầu máy chạy emulator (theo S0); checklist demo 3.3 (4 ý); 7 hạn chế của spec 3.4; sửa file chép thì sửa ở `web/` và chép sang trong cùng PR (`npm test` in cảnh báo khi lệch); `npm test`, `npm run typecheck`.

- [ ] **Step 5: Kiểm tra cuối và commit**

- `npm run typecheck; npm test` → sạch, PASS, dòng đầu `Ban sao khop web/ (8 file)`.
- `git status --short` không có `.env`, `.expo`, `node_modules`.
- `spikes/RESULTS.md` không còn dòng trống.
- Rà nhánh bằng `superpowers:requesting-code-review`; sửa vấn đề nghiêm trọng; mở PR `mobile` → `main`, ít nhất một người duyệt.

```powershell
git add mobile/results/e2e.md mobile/README.md mobile/spikes/RESULTS.md
git commit -m "docs(mobile): kết quả kiểm đầu-cuối 13 bước và độ trễ banner, README đầy đủ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
