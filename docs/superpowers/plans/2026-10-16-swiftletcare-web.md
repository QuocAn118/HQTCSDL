# SwiftletCare web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Người thực thi:** TV4, theo cách Native (`superpowers:executing-plans`) trên máy mình — không dùng subagent-driven. Hàm thuần: viết test trước, chạy cho fail, code cho đạt, commit. Màn hình: spec web 3.1 chỉ test hàm thuần, nên mỗi task giao diện kiểm bằng `npm run build` (kiểm kiểu TypeScript) và các bước Playwright MCP của checklist 3.2 tương ứng. Thiết kế màn hình: phác bằng `stitch`, làm theo `frontend-design` và `taste-skill` (CLAUDE.md) — code trong plan là bản chạy được tối thiểu, TV4 được chỉnh giao diện miễn giữ nguyên luồng dữ liệu.

## Trước khi chạy

```powershell
node -v                               # ^20.19 || ^22.12 || >=24 (máy nhóm: 25)
npm view next@15.5.28 version         # 15.5.28
git status                            # sạch, đang ở nhánh web (git switch -c web nếu chưa có)
```

- Không cần backend cho Task 1–5 (hàm thuần). Task 6 trở đi cần backend dev chạy trên `http://localhost:3000` với `CORS_ORIGINS` có `http://localhost:3001`; chưa có thì xem bảng phụ thuộc.
- Mật khẩu dev của tài khoản seed ghi trong README database; không chép vào file nào của `web/`.
- Lúc viết plan (17/10/2026), toàn bộ code của plan đã được dựng thử **ngoài repo** với đúng các bản ghim: `npx vitest run` 41 test đạt, `next build` đạt (kiểm kiểu, 11 route), không thấy cảnh báo peer khi `npm install`. **Chưa chạy với backend thật** và chưa mở bằng trình duyệt — Task 15 làm việc đó.

## Mốc

| Mốc | Phải xong |
|---|---|
| **18/10 (M1)** | Task 1 (khung + bước kiểm chứng), Task 2–5 (hàm thuần) |
| **25/10 (M2)** | Task 6–7: đăng nhập, dashboard số đo trực tiếp với backend thật (luồng simulator → … → web) |
| **01/11 (M3)** | Task 8–11 (điều khiển tay, cảnh báo + ảnh, lịch sử, cài đặt); Task 15 bước 1–12; quyết định giữ/cắt Task 12–14 |
| Tuần 4 | Task 12–14 nếu còn sức; Task 15 đủ 15 bước; mobile (plan riêng) |

**Goal:** Dựng `web/` — ứng dụng Next.js 15.5 chỉ chạy ở trình duyệt cho chủ nhà yến: đăng nhập, dashboard số đo trực tiếp qua Socket.IO, điều khiển tay, cảnh báo kèm ảnh thiên địch, biểu đồ lịch sử, cài đặt nhà/khu vực/thiết bị/ngưỡng, đúng hợp đồng REST và sự kiện.

**Architecture:** App Router, mọi trang là client component, trình duyệt gọi thẳng backend. Logic dễ sai tách thành hàm thuần có test: `lib/time.ts` (cộng 7 giờ, không `Intl`), `lib/merge.ts` (ghép REST với sự kiện), `lib/errors.ts` (mã lỗi → câu tiếng Việt), `lib/socket.ts` (phân loại lỗi, giãn cách). `lib/auth.tsx` giữ phiên; layout `houses/[houseId]` mở **một** socket cho mỗi nhà (`lib/live.tsx`), các trang con đăng ký nghe và tải lại REST mỗi lần kết nối.

**Tech Stack:** Next.js 15.5.28, React 19.3.1, TypeScript 5.9.3, Tailwind CSS 4.3.3 (`@tailwindcss/postcss`), Recharts 3.10.1 (+ `react-is` 19.3.1), socket.io-client 4.8.3, Vitest 5.0.5; `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@types/node` 24.19.2 (bản mới nhất của nhánh, `npm view` 17/10/2026).

**Spec:** [docs/superpowers/specs/2026-10-16-swiftletcare-web-design.md](../specs/2026-10-16-swiftletcare-web-design.md) · hợp đồng: [integration-contract](../specs/2026-10-13-swiftletcare-integration-contract-design.md) Phần 3–4 · dạng phản hồi: [plan backend](2026-10-16-swiftletcare-backend.md) Task 5 (`pickers.ts`) · checklist demo: [backend](../specs/2026-10-15-swiftletcare-backend-design.md) 7.4

## Global Constraints

- Phiên bản **ghim chính xác** (không `^`, `~`), commit `package-lock.json`: `next` 15.5.28, `react`/`react-dom`/`react-is` 19.3.1, `typescript` 5.9.3 (**không** 7.x), `tailwindcss` + `@tailwindcss/postcss` 4.3.3, `recharts` 3.10.1, `socket.io-client` 4.8.3, `vitest` 5.0.5.
- Chỉ chạy ở trình duyệt: trang là `"use client"`; **không** API route, server action, middleware, proxy của Next.
- Cổng **3001** (`next dev -p 3001`, demo bằng `next build` + `next start -p 3001`). `.env.example` đúng một dòng `NEXT_PUBLIC_API_URL=http://localhost:3000`; giá trị gắn cố định lúc `next dev`/`next build`.
- Phiên trong **`sessionStorage`**, chỉ đọc trong `useEffect`/xử lý sự kiện; JWT hạn 28800 giây; 401 bất kỳ (trừ đăng nhập) → đăng xuất.
- Thời gian: so mốc ISO bằng `getTime()`; hiển thị **cộng 7 giờ** + `getUTC*()`, dạng `dd/MM/yyyy HH:mm`; **không dùng `Intl`**; ngày VN `YYYY-MM-DD` luôn là chuỗi; `datetime-local` tách bằng regex rồi `Date.UTC(năm, tháng − 1, ngày, giờ − 7, phút)`.
- Socket.IO: `io(NEXT_PUBLIC_API_URL, { auth })`, token hiện tại mỗi lần kết nối; `UNAUTHENTICATED` hoặc `io server disconnect` → đăng xuất; lỗi khác → tự `connect()` giãn **2, 4, 8, 16, 30** giây rồi giữ 30; nghe sự kiện **trước**, REST sau, mỗi lần `connect`.
- Không hiện `message` thô của server; câu tiếng Việt theo `code` trong `lib/errors.ts`. 503 `RETRY_LATER` có nút "Thử lại", **không tự gửi lại thao tác ghi**.
- Ảnh thiên địch: `fetch` kèm `Authorization` → `blob` → `URL.createObjectURL`; `revokeObjectURL` khi đổi ảnh/unmount; 404 → "Không có ảnh".
- Giao diện tiếng Việt; chuỗi chú thích trong code viết không dấu.
- **Không tạo hay ghi đè `.gitignore` gốc**; chỉ thêm các dòng `web/…` còn thiếu (Task 1).
- Commit message tiếng Việt, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Sự kiện `device.state` đến đúng lúc REST `devices` đang tải** (vừa kết nối lại, vòng tự động vừa bật quạt) — người dùng mong thấy trạng thái mới nhất, không bị REST cũ ghi đè. Test thêm ở Task 4 (`replayDeviceStates`); luồng giữ sự kiện ở Task 7 (`useLiveDevices`).
2. **Hai dạng chuỗi của cùng một mốc** (`…00.000Z` từ Prisma, `…00Z` từ cột JSON của SP) đến cho cùng số đo — người dùng mong không thấy số đo nhảy lùi hay điểm trùng trên biểu đồ. Test thêm ở Task 4 (`mergeLatest`, `appendLive`).
3. **Token hết hạn khi tab đang mở qua đêm** — người dùng mong về `/login` kèm câu "Phiên đã hết hạn", không kẹt ở màn hình lỗi; socket bị server ngắt cũng về `/login`. Test thêm ở Task 5 (`classifyDisconnect`); hẹn giờ ở Task 6 (`AuthGate`).
4. **Backend trả thân lỗi không phải JSON** (502 từ proxy, trang HTML) — người dùng mong câu lỗi chung, không trắng trang. Test thêm ở Task 3 (`toApiError(502, '<html>')`).
5. **Người dùng nhập giờ qua nửa đêm/sang năm trong ô `datetime-local`** — mong khoảng biểu đồ đúng giờ VN, không lệch theo múi giờ máy. Test thêm ở Task 2 (`vnInputToIso('2027-01-01T05:00')`).

## Cấu trúc file

```
web/
  package.json  package-lock.json  .env.example  README.md  next.config.ts  postcss.config.mjs  tsconfig.json
  app/
    layout.tsx  globals.css  page.tsx (chuyển về /houses)
    login/page.tsx
    houses/layout.tsx                   AuthGate cho mọi trang /houses
    houses/page.tsx                     danh sách nhà, tạo nhà
    houses/[houseId]/layout.tsx         menu, thanh kết nối, LiveProvider (một socket cho cả nhà)
    houses/[houseId]/page.tsx           dashboard
    houses/[houseId]/devices/page.tsx   điều khiển tay, nhật ký
    houses/[houseId]/alerts/page.tsx    danh sách, chi tiết, ACK/RESOLVED, ảnh
    houses/[houseId]/history/page.tsx   biểu đồ môi trường, thống kê ngày, đếm chim
    houses/[houseId]/settings/page.tsx  nhà, khu vực, thiết bị, ngưỡng
    houses/[houseId]/harvests/page.tsx  dưới ranh giới cắt
    admin/tools/page.tsx                dưới ranh giới cắt, không có liên kết trên menu
  components/
    ui.tsx            Banner, Empty, Loading, Card, lớp CSS dùng chung, fieldError
    SnapshotImage.tsx ảnh thiên địch qua blob
  lib/
    types.ts    dạng dữ liệu REST và sự kiện
    time.ts     hàm thuần thời gian (mục 2.3)
    errors.ts   mã lỗi → câu tiếng Việt, ApiError, toApiError
    merge.ts    hàm thuần ghép REST với sự kiện (mục 2.4)
    socket.ts   phân loại lỗi, giãn cách, createLiveSocket
    session.ts  token trong sessionStorage
    api.ts      fetch kèm token, 401 → đăng xuất, fetchBlob, qs
    auth.tsx    AuthGate, useAuth
    live.tsx    LiveProvider, useLive, useReloadOnConnect
    hooks.ts    useLiveDevices, useLiveLatest, useLiveOpenAlerts
    config.ts   HEARTBEAT_ENABLED, nhãn tiếng Việt
  test/*.test.ts
```

So với spec 1.4: thêm `components/`, `lib/types.ts`, `lib/auth.tsx`, `lib/live.tsx`, `lib/hooks.ts`, `lib/config.ts` (tách trách nhiệm cho file nhỏ); `app/houses/layout.tsx`, `app/houses/[houseId]/layout.tsx`, `app/page.tsx`. Không đổi màn hình hay luồng dữ liệu của spec.

## Phụ thuộc vào module khác và cách làm khi chưa có

| Cần | Của | Chưa có thì |
|---|---|---|
| Backend REST (login, houses, zones, devices, latest-readings, thresholds, metrics) | plan backend Task 7–8, 16–17 (M2 25/10) | Task 1–5 không cần. Task 6–11: chạy `npm run build` để kiểm kiểu; kiểm tay chờ backend. **Không** tạo API giả trong Next (trái spec 1.2) |
| Socket.IO + mã lỗi `data.code` (`UNAUTHENTICATED`, `RETRY_LATER`), ngắt khi đổi vai trò | plan backend Task 9 + PR hợp đồng (Task 3 mục 5) | Code theo spec web đã duyệt; Task 1 Step 6 (S4) chờ backend |
| `CORS_ORIGINS` có `http://localhost:3001` | `backend/.env` (TV2) | Báo TV2; trình duyệt chặn mọi gọi API khi thiếu |
| Điều khiển, cảnh báo, ảnh, lịch sử, đếm chim | plan backend Task 14, 17–19 | Trang hiện "Không có dữ liệu"/lỗi chung; kiểm tay khi backend xong |
| `POST /api/admin/anomalies/detect` | PR hợp đồng (plan backend Task 3 mục 2) + backend Task 20 | **Không làm Task 14 trước khi PR merge**; demo dùng script PowerShell của backend (TV2) |
| Harvests, report env-vs-yield | backend Task 25 (dưới ranh giới cắt) | Task 13 chờ; cắt thì bỏ tab "Thu hoạch" khỏi `TABS` |
| Heartbeat (simulator Task 9, backend Task 26, ai-vision) | dưới ranh giới cắt | `HEARTBEAT_ENABLED = false`: huy hiệu OFFLINE chỉ cho SENSOR |
| Dữ liệu mẫu, tài khoản `admin`/`owner1`/`owner2` | database-core | Kiểm tay chờ CSDL Dev |
| Simulator chạy | plan simulator Task 7 | Dashboard hiện số đo của seed, không cập nhật trực tiếp |

## Ngoài phạm vi

- Màn hình quản lý người dùng của ADMIN (spec 1.1; roadmap không có).
- Thông báo đẩy; xem khung hình có khung bao (Nên có); xuất Excel/PDF (Nếu còn thời gian).
- API route, server action, middleware, proxy của Next; render phía server có dữ liệu.
- Test giao diện tự động commit vào repo (spec 3.2: Playwright MCP theo checklist, không commit test).
- Sửa backend, hợp đồng, fixture; gửi lại tự động thao tác ghi.

## Quy ước viết test

- Vitest, file `test/<module>.test.ts`, chỉ hàm thuần trong `lib/` (không DOM, không mạng). Chạy `npm test` (= `vitest run`) trong `web\`.
- Màn hình: `npm run build` phải đạt (Next kiểm kiểu toàn bộ); kiểm hành vi bằng Playwright MCP theo checklist 3.2, ghi kết quả vào `web/results/e2e.md` (Task 15).

---

### Task 1: Khung `web/`, ghim phiên bản, kiểm chứng các mục "chưa kiểm chứng" (spec 1.5)

**Files:**
- Create: `web/package.json`, `web/package-lock.json` (npm sinh), `web/.env.example`, `web/next.config.ts`, `web/postcss.config.mjs`, `web/tsconfig.json`, `web/app/globals.css`, `web/app/layout.tsx`, `web/app/page.tsx`, `web/test/repo.test.ts`, `web/README.md` (khung), `web/spikes/RESULTS.md`
- Modify: `.gitignore` gốc — **chỉ thêm** mục `# web` (Step 3)

**Interfaces:**
- Consumes: không.
- Produces: `npm run dev|build|start|test|typecheck`; alias `@/*` → `web/*`; `spikes/RESULTS.md` (S1–S5).

- [ ] **Step 1: Viết test quy tắc repo (phải fail)**

`web/test/repo.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8'));

describe('quy tac repo web (spec web 1.2, 1.3)', () => {
  it('phien ban ghim chinh xac', () => {
    expect(pkg.dependencies).toEqual({
      next: '15.5.28', react: '19.3.1', 'react-dom': '19.3.1', 'react-is': '19.3.1',
      recharts: '3.10.1', 'socket.io-client': '4.8.3',
    });
    for (const v of Object.values({ ...pkg.dependencies, ...pkg.devDependencies })) expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies.typescript).toBe('5.9.3');
    expect(pkg.devDependencies.tailwindcss).toBe('4.3.3');
    expect(pkg.devDependencies['@tailwindcss/postcss']).toBe('4.3.3');
    expect(pkg.devDependencies.vitest).toBe('5.0.5');
  });

  it('cong 3001, demo bang build + start', () => {
    expect(pkg.scripts.dev).toBe('next dev -p 3001');
    expect(pkg.scripts.start).toBe('next start -p 3001');
  });

  it('.env.example chi co NEXT_PUBLIC_API_URL', () => {
    expect(readFileSync(join(WEB, '.env.example'), 'utf8').trim()).toBe('NEXT_PUBLIC_API_URL=http://localhost:3000');
  });

  it('.gitignore goc co dong web', () => {
    const lines = readFileSync(join(WEB, '..', '.gitignore'), 'utf8').split(/\r?\n/);
    for (const l of ['web/.env', 'web/.env.local', 'web/node_modules/', 'web/.next/', 'web/next-env.d.ts', 'web/*.tsbuildinfo']) {
      expect(lines).toContain(l);
    }
  });
});
```

(Chạy ở Step 2, sau khi đã cài Vitest.)

- [ ] **Step 2: Viết `package.json` và cài**

`web/package.json`:

```json
{
  "name": "swiftletcare-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "15.5.28",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "react-is": "19.3.1",
    "recharts": "3.10.1",
    "socket.io-client": "4.8.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.3",
    "@types/node": "24.19.2",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "tailwindcss": "4.3.3",
    "typescript": "5.9.3",
    "vitest": "5.0.5"
  }
}
```

```powershell
cd web
npm install
npm ls react react-dom react-is
```

Expected: cài không lỗi; ghi mọi dòng `npm warn … peer` (nếu có) vào S2; `npm ls` cho đúng 19.3.1. `package.json` vẫn ghi số chính xác (không `^`).

Run: `npm test -- test/repo.test.ts`
Expected: FAIL ở `.env.example` và `.gitignore goc co dong web` (chưa tạo).

- [ ] **Step 3: `.gitignore` gốc — chỉ thêm dòng thiếu**

```powershell
cd ..
Select-String -Path .gitignore -SimpleMatch -Pattern 'web/'
```

Thêm vào **cuối** file (bằng trình soạn thảo, không ghi đè) những dòng chưa có:

```
# web
web/.env
web/.env.local
web/node_modules/
web/.next/
web/next-env.d.ts
web/*.tsbuildinfo
```

- [ ] **Step 4: Cấu hình Next, Tailwind, TypeScript, trang gốc**

`web/.env.example`:

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

`web/next.config.ts`:

```ts
import type { NextConfig } from 'next';

// Ung dung chi chay o trinh duyet: khong API route, server action, middleware, proxy (spec web 1.2).
const nextConfig: NextConfig = {};

export default nextConfig;
```

`web/postcss.config.mjs`:

```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`web/app/globals.css`:

```css
@import "tailwindcss";

:root {
  color-scheme: light;
}

body {
  @apply bg-stone-50 text-stone-900 antialiased;
}
```

`web/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = { title: 'SwiftletCare', description: 'Giám sát và điều khiển nhà yến' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
```

`web/app/page.tsx` (trang gốc chuyển về `/houses`):

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();
  useEffect(() => router.replace('/houses'), [router]);
  return null;
}
```

`web/README.md` (khung, Task 15 viết đủ):

```markdown
# web

Spec: `docs/superpowers/specs/2026-10-16-swiftletcare-web-design.md`. Plan: `docs/superpowers/plans/2026-10-16-swiftletcare-web.md`.

    cd web
    npm ci
    copy .env.example .env.local     # sửa NEXT_PUBLIC_API_URL nếu backend không ở localhost:3000
    npm test
    npm run dev                      # http://localhost:3001
```

- [ ] **Step 5: Chạy test và build**

Run: `npm test; npm run build`
Expected: PASS 4 test (`repo.test.ts`); `next build` đạt, có các route `/`, `/_not-found`. Ghi S2: có cảnh báo peer/Recharts không (Recharts kiểm lại ở Task 10).

- [ ] **Step 6: Kiểm chứng S1, S3, S4, S5 và ghi `web/spikes/RESULTS.md`**

- **S1 — hạn vá bảo mật nhánh Next 15.5:** `npm view next dist-tags` (ghi các tag `latest`, `backport`…) và trang "Next.js support policy" trên trang chính thức của Next.js (tìm bằng tên trang, ghi URL thật đã mở và ngày). Nếu nhánh 15.x hết vá trước **09/11/2026**: dừng, báo nhóm chọn lại (spec 1.5.1).
- **S3 — mở bằng IP LAN:** `npm run dev`, mở `http://<IP LAN>:3001` từ máy khác (hoặc chính máy bằng IP). Nếu terminal cảnh báo/chặn nguồn khác (cross-origin dev): thêm vào `next.config.ts` `allowedDevOrigins: ['<IP LAN>']` (tên tùy chọn lấy theo thông báo thật của Next) và ghi cách làm vào README. Thử cả `npm run build; npm start`.
- **S4 — Socket.IO 4.8.3 sau khi middleware từ chối:** làm khi backend đã có Socket.IO (plan backend Task 9). Tạm thêm vào `app/page.tsx` một `useEffect` gọi `io('http://localhost:3000', { auth: { token: 'sai' } })` (import `io` từ `socket.io-client`) và `console.log(err.data, socket.active)` trong `connect_error`; mở `/`, quan sát console 60 giây xem có tự thử lại không. Ghi S4 (`active` = false nghĩa là không tự thử lại — `lib/socket.ts` đã xử lý cả hai trường hợp), rồi **xóa đoạn tạm** (không commit).
- **S5 — Vitest 5.0.5 với TypeScript 5.9.3:** Step 5 chạy được file `.ts` không cần cấu hình → ghi "đạt, không cần vitest.config".

`web/spikes/RESULTS.md`:

```markdown
# Kết quả bước kiểm chứng web (spec 1.5)

| Mã | Mục | Cách kiểm | Kết quả | Ngày |
|---|---|---|---|---|
| S1 | Hạn vá bảo mật nhánh Next 15.5 | `npm view next dist-tags` + trang support policy | | |
| S2 | Recharts 3.10.1 + React 19.3.1 + Tailwind 4.3.3, cảnh báo peer | `npm install`, `next build`, Task 10 | | |
| S3 | `next dev`/`next start` mở bằng IP LAN | Step 6 | | |
| S4 | Socket.IO tự kết nối lại sau khi middleware từ chối? | Step 6 (cần backend) | | |
| S5 | Vitest 5.0.5 chạy `.ts` với TypeScript 5.9.3 | Step 5 | | |
```

- [ ] **Step 7: Commit**

```powershell
git status   # khong co web/.env*, node_modules, .next
git add .gitignore web/package.json web/package-lock.json web/.env.example web/next.config.ts web/postcss.config.mjs web/tsconfig.json web/app/globals.css web/app/layout.tsx web/app/page.tsx web/test/repo.test.ts web/README.md web/spikes/RESULTS.md
git commit -m "chore(web): khung Next 15.5 chỉ chạy ở trình duyệt, ghim phiên bản, kết quả bước kiểm chứng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Thời gian — cộng 7 giờ, không `Intl`, giờ nhập theo VN

**Files:**
- Create: `web/lib/time.ts`, `web/test/time.test.ts`

**Interfaces:**
- Consumes: không.
- Produces: `VN_OFFSET_MS`; `toMs(iso: string): number`; `sameInstant(a: string, b: string): boolean`; `formatVn(iso: string): string` (`dd/MM/yyyy HH:mm`); `formatVnTime(ms: number): string` (`dd/MM HH:mm`, trục biểu đồ); `vnInputToIso(local: string): string` (ném lỗi nếu sai dạng); `msToVnInput(ms: number): string`; `todayVn(nowMs?: number): string`.

- [ ] **Step 1: Viết test (phải fail)**

`web/test/time.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatVn, msToVnInput, sameInstant, todayVn, toMs, vnInputToIso } from '../lib/time';

describe('time (spec web 2.3)', () => {
  it('hai dang cua cung mot moc cho cung getTime()', () => {
    expect(sameInstant('2026-10-12T10:40:00.000Z', '2026-10-12T10:40:00Z')).toBe(true);
    expect(toMs('2026-10-12T10:40:00.000Z')).toBe(toMs('2026-10-12T10:40:00Z'));
  });

  it.each([
    ['2026-10-12T10:40:00Z', '12/10/2026 17:40'],
    ['2026-10-12T18:30:00Z', '13/10/2026 01:30'],
    ['2026-10-31T17:00:00Z', '01/11/2026 00:00'],
    ['2026-12-31T17:00:00Z', '01/01/2027 00:00'],
    ['2026-10-12T10:40:00.000Z', '12/10/2026 17:40'],
  ])('formatVn(%s) = %s', (iso, text) => {
    expect(formatVn(iso)).toBe(text);
  });

  it.each([
    ['2026-11-01T03:00', '2026-10-31T20:00:00Z'],
    ['2027-01-01T05:00', '2026-12-31T22:00:00Z'],
    ['2026-10-12T17:40', '2026-10-12T10:40:00Z'],
  ])('gio VN nhap %s -> %s', (local, iso) => {
    expect(vnInputToIso(local)).toBe(iso);
  });

  it('gio nhap sai dang -> loi', () => {
    expect(() => vnInputToIso('2026-10-12 17:40')).toThrow();
  });

  it('msToVnInput nguoc voi vnInputToIso', () => {
    expect(msToVnInput(toMs('2026-10-31T20:00:00Z'))).toBe('2026-11-01T03:00');
  });

  it('hom nay VN luc 2026-12-31T18:00:00Z la 2027-01-01', () => {
    expect(todayVn(toMs('2026-12-31T18:00:00Z'))).toBe('2027-01-01');
    expect(todayVn(toMs('2026-12-31T16:59:59Z'))).toBe('2026-12-31');
  });

  it('ngay nghiep vu YYYY-MM-DD giu nguyen chuoi (khong qua Date)', () => {
    const dayVn = '2026-10-12';
    expect(`${dayVn}`).toBe('2026-10-12');
  });
});
```

Run: `npm test -- test/time.test.ts`
Expected: FAIL `Failed to resolve import "../lib/time"`.

- [ ] **Step 2: Viết `web/lib/time.ts`**

```ts
// Thoi gian (spec web 2.3): moc ISO doc bang Date va so bang getTime(); hien thi = cong 7 gio + getUTC*();
// ngay VN giu la chuoi; gio nguoi dung nhap tach bang regex roi Date.UTC(..., gio - 7, ...). Khong dung Intl.
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function toMs(iso: string): number {
  return new Date(iso).getTime();
}

export function sameInstant(a: string, b: string): boolean {
  return toMs(a) === toMs(b);
}

function shifted(iso: string | number): Date {
  return new Date((typeof iso === 'number' ? iso : toMs(iso)) + VN_OFFSET_MS);
}

export function formatVn(iso: string): string {
  const d = shifted(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatVnTime(ms: number): string {
  const d = shifted(ms);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// "YYYY-MM-DDTHH:mm" theo gio VN (datetime-local) -> ISO UTC co Z. Khong dua chuoi vao new Date.
export function vnInputToIso(local: string): string {
  const m = LOCAL_INPUT.exec(local);
  if (!m) throw new Error(`gio nhap sai dang: ${local}`);
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 7, mi)).toISOString().slice(0, 19) + 'Z';
}

// Moc -> gia tri mac dinh cho datetime-local theo gio VN.
export function msToVnInput(ms: number): string {
  const d = shifted(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// "Hom nay" theo gio VN dang YYYY-MM-DD.
export function todayVn(nowMs: number = Date.now()): string {
  const d = shifted(nowMs);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
```

- [ ] **Step 3: Chạy test**

Run: `npm test -- test/time.test.ts`
Expected: PASS 13 test.

- [ ] **Step 4: Commit**

```powershell
git add web/lib/time.ts web/test/time.test.ts
git commit -m "feat(web): hàm thời gian cộng 7 giờ không dùng Intl, giờ nhập VN sang ISO có Z, hôm nay theo giờ VN

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Mã lỗi → câu tiếng Việt, đọc định dạng lỗi hợp đồng

**Files:**
- Create: `web/lib/errors.ts`, `web/test/errors.test.ts`

**Interfaces:**
- Consumes: không.
- Produces: `MESSAGES: Record<string, string>`, `GENERIC_MESSAGE`, `messageFor(code): string`; `class ApiError(status: number, code: string, details: unknown)` với getter `fields: string[]` (từ `details.fields`); `toApiError(status: number, body: unknown): ApiError` (thân không đúng dạng → `code = 'HTTP_<status>'`).

- [ ] **Step 1: Viết test (phải fail)**

`web/test/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GENERIC_MESSAGE, MESSAGES, messageFor, toApiError } from '../lib/errors';

describe('errors (spec web 2.2)', () => {
  it.each(Object.entries(MESSAGES))('%s -> cau rieng', (code, text) => {
    expect(messageFor(code)).toBe(text);
  });

  it('du cac ma cua bang 2.2', () => {
    for (const code of ['ALERT_INVALID_TRANSITION', 'DEVICE_NOT_CONTROLLABLE', 'CONSTRAINT_VIOLATION', 'DUPLICATE',
      'VALIDATION_ERROR', 'NOT_FOUND', 'RETRY_LATER', 'NETWORK']) expect(MESSAGES[code]).toBeTruthy();
  });

  it('ma la hoac rong -> cau chung', () => {
    expect(messageFor('INTERNAL')).toBe(GENERIC_MESSAGE);
    expect(messageFor(null)).toBe(GENERIC_MESSAGE);
  });

  it('toApiError doc dinh dang hop dong 3.4, khong giu message tho', () => {
    const e = toApiError(400, { error: { code: 'VALIDATION_ERROR', message: 'SQL loi …', sqlNumber: null, details: { fields: ['minValue'] } } });
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.fields).toEqual(['minValue']);
    expect(e.message).toBe('VALIDATION_ERROR');
    expect(toApiError(502, '<html>').code).toBe('HTTP_502');
  });
});
```

Run: `npm test -- test/errors.test.ts`
Expected: FAIL `Failed to resolve import "../lib/errors"`.

- [ ] **Step 2: Viết `web/lib/errors.ts`**

```ts
// Ma loi hop dong -> cau tieng Viet (spec web 2.2). Khong bao gio hien message tho cua server.
export const MESSAGES: Record<string, string> = {
  ALERT_INVALID_TRANSITION: 'Cảnh báo đã đổi trạng thái. Đã tải lại danh sách.',
  DEVICE_NOT_CONTROLLABLE: 'Thiết bị đã ngừng dùng, không điều khiển được.',
  CONSTRAINT_VIOLATION: 'Ngưỡng không hợp lệ (Min phải nhỏ hơn Max).',
  DUPLICATE: 'Trùng tên hoặc trùng mã.',
  VALIDATION_ERROR: 'Dữ liệu nhập chưa đúng, kiểm tra các trường được đánh dấu.',
  NOT_FOUND: 'Không tìm thấy.',
  RETRY_LATER: 'Hệ thống bận, vui lòng thử lại.',
  UNAUTHENTICATED: 'Sai tên đăng nhập hoặc mật khẩu.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NETWORK: 'Không kết nối được máy chủ.',
};
export const GENERIC_MESSAGE = 'Đã có lỗi, vui lòng thử lại.';

export function messageFor(code: string | null | undefined): string {
  return (code && MESSAGES[code]) || GENERIC_MESSAGE;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details: unknown) {
    super(code);
  }

  get fields(): string[] {
    const d = this.details as { fields?: unknown } | null;
    return Array.isArray(d?.fields) ? d.fields.filter((f): f is string => typeof f === 'string') : [];
  }
}

// Doc than loi dang {"error":{code,message,sqlNumber,details}} (hop dong 3.4).
export function toApiError(status: number, body: unknown): ApiError {
  const err = (body as { error?: { code?: unknown; details?: unknown } } | null)?.error;
  const code = typeof err?.code === 'string' ? err.code : `HTTP_${status}`;
  return new ApiError(status, code, err?.details ?? null);
}
```

- [ ] **Step 3: Chạy test**

Run: `npm test -- test/errors.test.ts`
Expected: PASS 13 test.

- [ ] **Step 4: Commit**

```powershell
git add web/lib/errors.ts web/test/errors.test.ts
git commit -m "feat(web): đổi mã lỗi hợp đồng sang câu tiếng Việt, không hiện message thô của server

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Dạng dữ liệu và ghép REST với sự kiện

**Files:**
- Create: `web/lib/types.ts`, `web/lib/merge.ts`, `web/test/merge.test.ts`

**Interfaces:**
- Consumes: `toMs` (Task 2).
- Produces:
  - `types.ts`: kiểu theo hợp đồng 3.3/4.2 và `pickers.ts` của backend — `User`, `LoginResponse`, `House`, `Zone`, `Device`, `MetricInfo`, `Threshold` (khóa `metricCode`), `LatestReading` (khóa `metric`, `at`), `ReadingBucket`, `DailyStat`, `ControlResult`, `ControlLog`, `Alert` (14 khóa), `AlertDetail`, `Page<T>`, `BirdFlow`, `Harvest`; sự kiện `ReadingsNew`, `AlertCreated`, `AlertUpdated`, `DeviceState`, `BirdcountUpdated`.
  - `merge.ts`: `latestKey(deviceId, metric)`, `mergeLatest(map, items)`, `ChartPoint {key, t, value}`, `appendLive(points, events, view, nowMs)`, `mergeAlert(list, incoming)`, `mergeAlerts(list, incoming[])`, `applyDeviceState(devices, ev)`, `replayDeviceStates(restDevices, held)`.

- [ ] **Step 1: Viết `web/lib/types.ts`**

```ts
// Dang du lieu theo hop dong 3.3, 4.2 va bo chon truong cua backend (plan backend Task 5).
export type Role = 'ADMIN' | 'OWNER';
export type Metric = 'TEMP' | 'HUMID' | 'CO2' | 'LIGHT';
export type DeviceType = 'SENSOR' | 'MIST' | 'FAN' | 'HEATER' | 'SPEAKER' | 'CAMERA';
export type AlertStatus = 'NEW' | 'ACK' | 'RESOLVED';
export type AlertType = 'THRESHOLD' | 'PREDATOR' | 'DEVICE_OFFLINE' | 'POPULATION_DROP';

export interface User { userId: number; username: string; fullName: string; email: string | null; phone: string | null; role: Role; isActive: boolean }
export interface LoginResponse { accessToken: string; expiresIn: number; user: User }
export interface House { houseId: number; ownerId: number; name: string; address: string | null; isActive: boolean; createdAt: string }
export interface Zone { zoneId: number; houseId: number; name: string; floorNo: number }
export interface Device {
  deviceId: number; zoneId: number; code: string; name: string; deviceType: DeviceType; status: string;
  lastSeenAt: string | null; mode: 'AUTO' | 'MANUAL' | null; isOn: boolean | null; level: number | null; isActive: boolean;
}
export interface MetricInfo { metricCode: Metric; name: string; unit: string; validMin: number; validMax: number; hysteresis: number }
export interface Threshold { zoneId: number; metricCode: Metric; minValue: number | null; maxValue: number | null; targetValue: number | null; updatedBy: number | null; updatedAt: string | null }
export interface LatestReading {
  houseId: number; zoneId: number; zoneName: string; deviceId: number; deviceCode: string; deviceStatus: string;
  metric: Metric; unit: string; value: number | null; at: string;
}
export interface ReadingBucket { bucketUtc: string; avgValue: number | null; minValue: number | null; maxValue: number | null }
export interface DailyStat { zoneId: number; metric: Metric; dayVn: string; avgValue: number | null; minValue: number | null; maxValue: number | null; samples: number }
export interface ControlResult { changed: boolean; deviceCode: string; mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null }
export interface ControlLog { logId: number; deviceId: number; isOn: boolean; level: number | null; mode: string; source: string; userId: number | null; reason: string | null; createdAt: string }
export interface Alert {
  alertId: number; houseId: number; zoneId: number | null; deviceId: number | null; alertType: AlertType; severity: string;
  metricCode: Metric | null; value: number | null; detectedClass: string | null; confidence: number | null;
  hasSnapshot: boolean; message: string; status: AlertStatus; createdAt: string;
}
export interface AlertHistory { historyId: number; oldStatus: AlertStatus | null; newStatus: AlertStatus; userId: number | null; note: string | null; changedAt: string }
export interface AlertDetail extends Alert { history: AlertHistory[] }
export interface Page<T> { items: T[]; nextBefore: number | null }
export interface BirdFlow { houseId: number; dayVn: string; inTotal: number; outTotal: number; net: number }
export interface Harvest { harvestId: number; zoneId: number; harvestDate: string; nestCount: number; weightGram: number; grade: 'A' | 'B' | 'C' | null; recordedBy: number | null; createdAt: string }

// Su kien Socket.IO (hop dong 4.2)
export interface ReadingEvent { deviceId: number; deviceCode: string; zoneId: number; metric: Metric; value: number; at: string }
export interface ReadingsNew { houseId: number; readings: ReadingEvent[] }
export interface AlertCreated { alert: Alert }
export interface AlertUpdated { alertId: number; houseId: number; status: AlertStatus; resolvedAt: string | null; resolvedBy: number | null }
export interface DeviceState { deviceId: number; deviceCode: string; houseId: number; zoneId: number; mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null; source: string; at: string }
export interface BirdcountUpdated { houseId: number; cameraId: number }
```

- [ ] **Step 2: Viết test (phải fail)**

`web/test/merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { appendLive, applyDeviceState, latestKey, mergeAlert, mergeAlerts, mergeLatest, replayDeviceStates } from '../lib/merge';
import type { Alert, Device, DeviceState, LatestReading } from '../lib/types';

const reading = (value: number, at: string): LatestReading => ({
  houseId: 1, zoneId: 2, zoneName: 'Tang 1', deviceId: 5, deviceCode: 'H1-F1-SENSOR', deviceStatus: 'ONLINE',
  metric: 'TEMP', unit: '°C', value, at,
});
const alert = (alertId: number, status: Alert['status']): Alert => ({
  alertId, houseId: 1, zoneId: 2, deviceId: null, alertType: 'THRESHOLD', severity: 'WARNING', metricCode: 'TEMP', value: 31,
  detectedClass: null, confidence: null, hasSnapshot: false, message: 'm', status, createdAt: '2026-10-12T10:40:00Z',
});
const device: Device = {
  deviceId: 9, zoneId: 2, code: 'H1-F1-FAN', name: 'Quat', deviceType: 'FAN', status: 'ONLINE', lastSeenAt: null,
  mode: 'AUTO', isOn: false, level: 0, isActive: true,
};
const state = (o: Partial<DeviceState>): DeviceState => ({
  deviceId: 9, deviceCode: 'H1-F1-FAN', houseId: 1, zoneId: 2, mode: 'AUTO', isOn: true, level: 100, source: 'AUTO',
  at: '2026-10-12T10:40:00Z', ...o,
});

describe('mergeLatest', () => {
  it('bo so do cu hon hoac bang (ke ca khac dang chuoi), nhan so do moi hon', () => {
    let m = mergeLatest({}, [reading(28, '2026-10-12T10:40:10.000Z')]);
    m = mergeLatest(m, [reading(29, '2026-10-12T10:40:10Z'), reading(27, '2026-10-12T10:40:00Z')]);
    expect(m[latestKey(5, 'TEMP')].value).toBe(28);
    m = mergeLatest(m, [{ deviceId: 5, metric: 'TEMP', value: 30, at: '2026-10-12T10:40:20Z' }]);
    expect(m[latestKey(5, 'TEMP')]).toMatchObject({ value: 30, zoneName: 'Tang 1' });
  });
});

describe('appendLive', () => {
  const view = { zoneId: 2, metric: 'TEMP', fromMs: Date.parse('2026-10-12T10:00:00Z'), toMs: Date.parse('2026-10-12T11:00:00Z') };
  const ev = (at: string, zoneId = 2) => ({ deviceId: 5, deviceCode: 'H1-F1-SENSOR', zoneId, metric: 'TEMP' as const, value: 28, at });
  const now = Date.parse('2026-10-12T10:41:00Z');

  it('khu trung theo (deviceId, metric, at)', () => {
    const p = appendLive([], [ev('2026-10-12T10:40:00Z'), ev('2026-10-12T10:40:00.000Z')], view, now);
    expect(p).toHaveLength(1);
    expect(appendLive(p, [ev('2026-10-12T10:40:00Z')], view, now)).toBe(p);
  });

  it('khoang dang xem khong chua hien tai -> khong noi; khu vuc khac -> bo', () => {
    expect(appendLive([], [ev('2026-10-12T10:40:00Z')], view, Date.parse('2026-10-12T12:00:00Z'))).toEqual([]);
    expect(appendLive([], [ev('2026-10-12T10:40:00Z', 3)], view, now)).toEqual([]);
  });
});

describe('mergeAlert', () => {
  it('RESOLVED khong bi NEW/ACK ghi de', () => {
    const list = [alert(1, 'RESOLVED')];
    expect(mergeAlert(list, alert(1, 'NEW'))[0].status).toBe('RESOLVED');
    expect(mergeAlert(list, { alertId: 1, houseId: 1, status: 'ACK', resolvedAt: null, resolvedBy: null })[0].status).toBe('RESOLVED');
  });

  it('alert.created trung alertId khong nhan doi; moi thi them, sap theo alertId giam', () => {
    let list = mergeAlerts([alert(1, 'NEW')], [alert(1, 'NEW'), alert(3, 'NEW')]);
    expect(list.map((a) => a.alertId)).toEqual([3, 1]);
    list = mergeAlert(list, { alertId: 1, houseId: 1, status: 'ACK', resolvedAt: null, resolvedBy: null });
    expect(list.find((a) => a.alertId === 1)?.status).toBe('ACK');
  });

  it('alert.updated cua canh bao chua co -> bo qua', () => {
    expect(mergeAlert([], { alertId: 7, houseId: 1, status: 'ACK', resolvedAt: null, resolvedBy: null })).toEqual([]);
  });
});

describe('trang thai thiet bi', () => {
  it('REST roi ap lai su kien da giu -> trang thai cua su kien cuoi', () => {
    const r = replayDeviceStates([device], [state({ isOn: true, level: 100 }), state({ mode: 'MANUAL', isOn: true, level: 50 })]);
    expect(r[0]).toMatchObject({ mode: 'MANUAL', isOn: true, level: 50 });
  });

  it('idempotent: ap mot su kien hai lan, hoac trung voi REST, khong doi ket qua', () => {
    const once = applyDeviceState([device], state({}));
    expect(applyDeviceState(once, state({}))).toEqual(once);
    expect(applyDeviceState([device], state({ isOn: false, level: 0 }))).toEqual([device]);
  });
});
```

Run: `npm test -- test/merge.test.ts`
Expected: FAIL `Failed to resolve import "../lib/merge"`.

- [ ] **Step 3: Viết `web/lib/merge.ts`**

```ts
// Ghep du lieu REST voi su kien Socket.IO (spec web 2.4, hop dong 4.1). Ham thuan, khong sua dau vao.
import type { Alert, AlertStatus, AlertUpdated, Device, DeviceState, LatestReading, ReadingEvent } from './types';
import { toMs } from './time';

export type LatestMap = Record<string, LatestReading>;
export const latestKey = (deviceId: number, metric: string) => `${deviceId}:${metric}`;

type ReadingLike = Pick<LatestReading, 'deviceId' | 'metric' | 'value' | 'at'> & Partial<LatestReading>;

// So do moi nhat theo (deviceId, metric): bo so do co at cu hon hoac bang cai dang co.
export function mergeLatest(map: LatestMap, items: ReadingLike[]): LatestMap {
  const next: LatestMap = { ...map };
  for (const r of items) {
    const key = latestKey(r.deviceId, r.metric);
    const cur = next[key];
    if (cur && toMs(r.at) <= toMs(cur.at)) continue;
    next[key] = { ...(cur ?? {}), ...r } as LatestReading;
  }
  return next;
}

export interface ChartPoint { key: string; t: number; value: number }

// Noi so do truc tiep vao bieu do: chi khi khoang dang xem chua thoi diem hien tai; khu trung theo (deviceId, metric, at).
export function appendLive(
  points: ChartPoint[], events: ReadingEvent[],
  view: { zoneId: number; metric: string; fromMs: number; toMs: number }, nowMs: number,
): ChartPoint[] {
  if (!(view.fromMs <= nowMs && nowMs < view.toMs)) return points;
  const seen = new Set(points.map((p) => p.key));
  const added: ChartPoint[] = [];
  for (const e of events) {
    if (e.zoneId !== view.zoneId || e.metric !== view.metric) continue;
    const t = toMs(e.at);
    const key = `${e.deviceId}:${e.metric}:${t}`;
    if (t < view.fromMs || t >= view.toMs || seen.has(key)) continue;
    seen.add(key);
    added.push({ key, t, value: e.value });
  }
  return added.length ? [...points, ...added].sort((a, b) => a.t - b.t) : points;
}

const RANK: Record<AlertStatus, number> = { NEW: 0, ACK: 1, RESOLVED: 2 };

// Canh bao gop theo alertId; trang thai chi tien NEW -> ACK -> RESOLVED. alert.updated cua canh bao chua co thi bo.
export function mergeAlert(list: Alert[], incoming: Alert | AlertUpdated): Alert[] {
  const i = list.findIndex((a) => a.alertId === incoming.alertId);
  if (i < 0) {
    if (!('alertType' in incoming)) return list;
    return [incoming, ...list].sort((a, b) => b.alertId - a.alertId);
  }
  if (RANK[incoming.status] < RANK[list[i].status]) return list;
  const next = list.slice();
  next[i] = { ...list[i], ...incoming } as Alert;
  return next;
}

export function mergeAlerts(list: Alert[], incoming: Array<Alert | AlertUpdated>): Alert[] {
  return incoming.reduce(mergeAlert, list);
}

// device.state ghi de TOAN BO (mode, isOn, level) -> ap lai nhieu lan van cung ket qua (idempotent).
export function applyDeviceState(devices: Device[], ev: Pick<DeviceState, 'deviceId' | 'mode' | 'isOn' | 'level'>): Device[] {
  return devices.map((d) => (d.deviceId === ev.deviceId ? { ...d, mode: ev.mode, isOn: ev.isOn, level: ev.level } : d));
}

// REST devices khong co moc thoi gian trang thai: ap REST roi ap lai cac su kien da giu theo thu tu den.
export function replayDeviceStates(restDevices: Device[], held: DeviceState[]): Device[] {
  return held.reduce(applyDeviceState, restDevices);
}
```

- [ ] **Step 4: Chạy test**

Run: `npm test -- test/merge.test.ts`
Expected: PASS 8 test.

- [ ] **Step 5: Commit**

```powershell
git add web/lib/types.ts web/lib/merge.ts web/test/merge.test.ts
git commit -m "feat(web): ghép số đo theo at, cảnh báo chỉ tiến trạng thái, áp lại trạng thái thiết bị idempotent

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Vòng đời Socket.IO — phân loại lỗi, giãn cách, kết nối

**Files:**
- Create: `web/lib/socket.ts`, `web/test/socket.test.ts`

**Interfaces:**
- Consumes: `socket.io-client` 4.8.3.
- Produces: `BACKOFF_MS`, `backoffDelay(attempt): number`, `classifyConnectError(err): 'logout' | 'retry'`, `classifyDisconnect(reason): 'logout' | 'none' | 'reconnecting'`, `type LiveStatus = 'connecting' | 'connected' | 'reconnecting'`, `createLiveSocket({ url, getToken, onLogout, onStatus, onConnect, handlers }): { close(): void }`.

`auth` truyền dạng **hàm** để mỗi lần kết nối (lại) Socket.IO đọc token hiện tại trong `sessionStorage` — tương đương "đặt `socket.auth.token` mỗi lần kết nối lại" của spec 2.4. `socket.active === false` sau `connect_error` nghĩa là server từ chối và Socket.IO không tự thử lại → tự gọi `connect()` theo `backoffDelay`; còn `true` thì để Socket.IO tự thử (đúng cả hai kết quả có thể của S4).

- [ ] **Step 1: Viết test (phải fail)**

`web/test/socket.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { backoffDelay, classifyConnectError, classifyDisconnect } from '../lib/socket';

describe('socket (spec web 2.4)', () => {
  it('day gian cach 2, 4, 8, 16, 30, 30 giay', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(backoffDelay)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  it('connect_error: UNAUTHENTICATED -> dang xuat; RETRY_LATER va loi khac -> thu lai', () => {
    expect(classifyConnectError({ data: { code: 'UNAUTHENTICATED' } })).toBe('logout');
    expect(classifyConnectError({ data: { code: 'RETRY_LATER' } })).toBe('retry');
    expect(classifyConnectError({})).toBe('retry');
    expect(classifyConnectError(null)).toBe('retry');
  });

  it('disconnect: server ngat -> dang xuat; client tu dong -> khong lam gi; mat mang -> dang ket noi lai', () => {
    expect(classifyDisconnect('io server disconnect')).toBe('logout');
    expect(classifyDisconnect('io client disconnect')).toBe('none');
    expect(classifyDisconnect('transport close')).toBe('reconnecting');
    expect(classifyDisconnect('ping timeout')).toBe('reconnecting');
  });
});
```

Run: `npm test -- test/socket.test.ts`
Expected: FAIL `Failed to resolve import "../lib/socket"`.

- [ ] **Step 2: Viết `web/lib/socket.ts`**

```ts
// Vong doi Socket.IO (spec web 2.4). Ham phan loai la ham thuan de test; createLiveSocket dung socket.io-client.
import { io, type Socket } from 'socket.io-client';

export const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000];

export function backoffDelay(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}

export function classifyConnectError(err: { data?: { code?: string } } | null | undefined): 'logout' | 'retry' {
  return err?.data?.code === 'UNAUTHENTICATED' ? 'logout' : 'retry';
}

// 'io server disconnect' = server chu dong ngat (khoa tai khoan, doi vai tro, token het han) -> dang xuat.
export function classifyDisconnect(reason: string): 'logout' | 'none' | 'reconnecting' {
  if (reason === 'io server disconnect') return 'logout';
  if (reason === 'io client disconnect') return 'none';
  return 'reconnecting';
}

export type LiveStatus = 'connecting' | 'connected' | 'reconnecting';

export interface LiveHandlers {
  [event: string]: (payload: never) => void;
}

export interface LiveOptions {
  url: string;
  getToken: () => string | null;
  onLogout: () => void;
  onStatus: (s: LiveStatus) => void;
  onConnect: () => void;
  handlers: LiveHandlers;
}

export function createLiveSocket(o: LiveOptions): { close: () => void } {
  // auth dang ham: moi lan ket noi (lai) doc token hien tai trong sessionStorage.
  const socket: Socket = io(o.url, { autoConnect: false, auth: (cb) => cb({ token: o.getToken() }) });
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  // Nghe su kien TRUOC khi ket noi (hop dong 4.1).
  for (const [event, fn] of Object.entries(o.handlers)) socket.on(event, fn as (p: unknown) => void);
  socket.on('connect', () => {
    attempt = 0;
    o.onStatus('connected');
    o.onConnect();
  });
  socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
    if (closed) return;
    if (classifyConnectError(err) === 'logout') {
      o.onLogout();
      return;
    }
    o.onStatus('reconnecting');
    // socket.active = false: middleware server tu choi, Socket.IO khong tu thu lai -> tu goi connect() gian dan.
    if (!socket.active) timer = setTimeout(() => socket.connect(), backoffDelay(attempt++));
  });
  socket.on('disconnect', (reason) => {
    const action = classifyDisconnect(reason);
    if (action === 'logout' && !closed) o.onLogout();
    else if (action === 'reconnecting') o.onStatus('reconnecting');
  });
  o.onStatus('connecting');
  socket.connect();

  return {
    close: () => {
      closed = true;
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
```

- [ ] **Step 3: Chạy test**

Run: `npm test`
Expected: PASS 41 test (5 file).

- [ ] **Step 4: Commit**

```powershell
git add web/lib/socket.ts web/test/socket.test.ts
git commit -m "feat(web): vòng đời Socket.IO, UNAUTHENTICATED và server ngắt thì đăng xuất, tự kết nối lại giãn 2-30 giây

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Phiên, gọi API, đăng nhập, danh sách nhà

**Files:**
- Create: `web/lib/session.ts`, `web/lib/api.ts`, `web/lib/auth.tsx`, `web/components/ui.tsx`, `web/app/login/page.tsx`, `web/app/houses/layout.tsx`, `web/app/houses/page.tsx`

**Interfaces:**
- Consumes: `ApiError`, `toApiError`, `messageFor`, `GENERIC_MESSAGE` (Task 3); `LoginResponse`, `User`, `House` (Task 4).
- Produces:
  - `session.ts`: `Session {accessToken, user, expiresAt}`, `sessionFromLogin(res, nowMs?)`, `saveSession`, `loadSession(nowMs?)` (hết hạn → xóa, trả `null`), `clearSession`. Mọi truy cập `sessionStorage` bọc `try/catch`.
  - `api.ts`: `API_URL`, `setOnUnauthorized(fn)`, `api<T>(path, method = 'GET', body?)` (mất mạng → `ApiError(0, 'NETWORK')`; 401 ngoài `/api/auth/login` → gọi hàm đăng xuất), `fetchBlob(path): Promise<Blob | null>`, `qs(params)`.
  - `auth.tsx`: `AuthGate` (đọc phiên trong `useEffect`, hẹn giờ tới `expiresAt`, gắn `setOnUnauthorized`), `useAuth(): { session, logout(reason?) }`; `logout` xóa phiên rồi về `/login?reason=expired|unauthorized`.
  - `components/ui.tsx`: `errorText(e)`, `Banner({error, onRetry?})` (nút "Thử lại" chỉ với `RETRY_LATER`/`NETWORK`), `Empty`, `Loading`, `Card`, `inputCls`, `btnCls`, `btnGhostCls`, `fieldError(error, field)`.

- [ ] **Step 1: Viết `web/lib/session.ts`**

```ts
// Phien dang nhap trong sessionStorage (spec web 2.1). CHI goi trong useEffect hoac trong xu ly su kien.
import type { LoginResponse, User } from './types';

export interface Session { accessToken: string; user: User; expiresAt: number }
const KEY = 'swiftletcare.session';

export function sessionFromLogin(res: LoginResponse, nowMs: number = Date.now()): Session {
  return { accessToken: res.accessToken, user: res.user, expiresAt: nowMs + res.expiresIn * 1000 };
}

export function saveSession(s: Session): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // trinh duyet chan storage: phien chi song trong trang hien tai
  }
}

export function loadSession(nowMs: number = Date.now()): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.accessToken || !(s.expiresAt > nowMs)) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // bo qua
  }
}
```

- [ ] **Step 2: Viết `web/lib/api.ts`**

```ts
// fetch toi backend kem token; doc dinh dang loi hop dong 3.4; 401 -> dang xuat (spec web 2.1, 2.2).
import { ApiError, toApiError } from './errors';
import { loadSession } from './session';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

let onUnauthorized: () => void = () => {};
export function setOnUnauthorized(fn: () => void): void {
  onUnauthorized = fn;
}

async function send(path: string, method: string, body?: unknown): Promise<Response> {
  const token = loadSession()?.accessToken;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK', null);
  }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await send(path, method, body);
  const data = await res.json().catch(() => null);
  if (res.ok) return data as T;
  if (res.status === 401 && path !== '/api/auth/login') onUnauthorized();
  throw toApiError(res.status, data);
}

// Anh thien dich: fetch kem Authorization -> blob (the <img> khong gui duoc header). 404 -> null.
export async function fetchBlob(path: string): Promise<Blob | null> {
  const res = await send(path, 'GET');
  if (res.status === 404) return null;
  if (res.status === 401) onUnauthorized();
  if (!res.ok) throw toApiError(res.status, await res.json().catch(() => null));
  return res.blob();
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? '?' + p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : '';
};
```

- [ ] **Step 3: Viết `web/lib/auth.tsx`**

```tsx
'use client';
// Cong xac thuc cho cac trang can dang nhap (spec web 2.1): doc phien trong useEffect, hen gio het han, 401 -> dang xuat.
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setOnUnauthorized } from './api';
import { clearSession, loadSession, type Session } from './session';

export type LogoutReason = 'expired' | 'unauthorized' | undefined;
interface AuthValue { session: Session; logout: (reason?: LogoutReason) => void }
const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth phai nam trong AuthGate');
  return v;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  const logout = useCallback((reason?: LogoutReason) => {
    clearSession();
    setSession(null);
    router.replace(reason ? `/login?reason=${reason}` : '/login');
  }, [router]);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    setSession(s);
    setOnUnauthorized(() => logout('unauthorized'));
    const timer = setTimeout(() => logout('expired'), s.expiresAt - Date.now());
    return () => {
      clearTimeout(timer);
      setOnUnauthorized(() => {});
    };
  }, [router, logout]);

  if (!session) return <p className="p-8 text-stone-500">Đang tải…</p>;
  return <AuthContext.Provider value={{ session, logout }}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 4: Viết `web/components/ui.tsx`**

```tsx
'use client';
// Thanh phan dung chung: thong bao loi (chi cau tieng Viet theo ma), trang thai trong, dang tai.
import type { ReactNode } from 'react';
import { ApiError, GENERIC_MESSAGE, messageFor } from '@/lib/errors';

export function errorText(e: unknown): string {
  return e instanceof ApiError ? messageFor(e.code) : GENERIC_MESSAGE;
}

export function Banner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const retry = error instanceof ApiError && (error.code === 'RETRY_LATER' || error.code === 'NETWORK') && onRetry;
  return (
    <div role="alert" className="my-3 flex items-center gap-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
      <span>{errorText(error)}</span>
      {retry ? <button className="rounded border border-red-400 px-2 py-0.5" onClick={onRetry}>Thử lại</button> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-stone-500">{children}</p>;
}

export function Loading() {
  return <p className="py-6 text-center text-sm text-stone-500">Đang tải…</p>;
}

export function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export const inputCls = 'rounded border border-stone-300 px-2 py-1 text-sm';
export const btnCls = 'rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-50';
export const btnGhostCls = 'rounded border border-stone-300 px-3 py-1 text-sm disabled:opacity-50';

export function fieldError(error: unknown, field: string): string | null {
  return error instanceof ApiError && error.fields.includes(field) ? 'Giá trị chưa hợp lệ' : null;
}
```

- [ ] **Step 5: Viết trang đăng nhập và danh sách nhà**

`web/app/login/page.tsx`:

```tsx
'use client';
// Dang nhap (spec web 2.1). Sai mat khau va tai khoan bi khoa cung mot cau.
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { btnCls, errorText, inputCls } from '@/components/ui';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { loadSession, saveSession, sessionFromLogin } from '@/lib/session';
import type { LoginResponse } from '@/lib/types';

const REASONS: Record<string, string> = {
  expired: 'Phiên đã hết hạn, vui lòng đăng nhập lại.',
  unauthorized: 'Phiên không còn hợp lệ, vui lòng đăng nhập lại.',
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loadSession()) {
      router.replace('/houses');
      return;
    }
    const reason = new URLSearchParams(window.location.search).get('reason');
    setNotice(reason ? REASONS[reason] ?? null : null);
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<LoginResponse>('/api/auth/login', 'POST', { username, password });
      saveSession(sessionFromLogin(res));
      router.replace('/houses');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Sai tên đăng nhập hoặc mật khẩu' : errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto mt-24 max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold">SwiftletCare — Đăng nhập</h1>
      {notice ? <p className="mb-3 text-sm text-amber-700">{notice}</p> : null}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">Tên đăng nhập
          <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">Mật khẩu
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <button className={btnCls} disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
    </main>
  );
}
```

`web/app/houses/layout.tsx`:

```tsx
'use client';
import type { ReactNode } from 'react';
import { AuthGate } from '@/lib/auth';

export default function HousesLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
```

`web/app/houses/page.tsx`:

```tsx
'use client';
// Danh sach nha; chi co mot nha thi vao thang dashboard; tao nha (spec web 2.2).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Banner, btnCls, btnGhostCls, Card, Empty, fieldError, inputCls, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { House } from '@/lib/types';

export default function HousesPage() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const [houses, setHouses] = useState<House[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState({ name: '', address: '' });
  const [formError, setFormError] = useState<unknown>(null);

  const load = useCallback(async (redirectSingle: boolean) => {
    try {
      const list = await api<House[]>('/api/houses');
      setHouses(list);
      setError(null);
      if (redirectSingle && list.length === 1) router.replace(`/houses/${list[0].houseId}`);
    } catch (e) {
      setError(e);
    }
  }, [router]);

  useEffect(() => {
    void load(true);
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api<House>('/api/houses', 'POST', { name: form.name, address: form.address || null });
      setForm({ name: '', address: '' });
      setFormError(null);
      await load(false);
    } catch (err) {
      setFormError(err);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nhà yến của {session.user.fullName}</h1>
        <button className={btnGhostCls} onClick={() => logout()}>Đăng xuất</button>
      </header>
      <Banner error={error} onRetry={() => load(false)} />
      {houses === null && !error ? <Loading /> : null}
      {houses && houses.length === 0 ? <Empty>Chưa có nhà nào.</Empty> : null}
      <ul className="mb-6 grid gap-3">
        {houses?.map((h) => (
          <li key={h.houseId}>
            <Link href={`/houses/${h.houseId}`} className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-emerald-600">
              <span className="font-medium">{h.name}</span>
              <span className="ml-2 text-sm text-stone-500">{h.address ?? ''}</span>
              {!h.isActive ? <span className="ml-2 text-xs text-stone-500">(ngừng dùng)</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      <Card title="Tạo nhà mới">
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">Tên
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
            <span className="text-xs text-red-700">{fieldError(formError, 'name')}</span>
          </label>
          <label className="flex flex-col text-sm">Địa chỉ
            <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={255} />
          </label>
          <button className={btnCls}>Tạo</button>
        </form>
        <Banner error={formError} />
      </Card>
    </main>
  );
}
```

- [ ] **Step 6: Build và kiểm tay (checklist 3.2 bước 1)**

Run: `npm test; npm run build`
Expected: PASS 41 test; build đạt.

Kiểm tay (backend dev chạy, `copy .env.example .env.local`, `npm run dev`), bằng Playwright MCP: mở `http://localhost:3001/login`; đăng nhập sai → "Sai tên đăng nhập hoặc mật khẩu"; đăng nhập `owner1` (mật khẩu dev ở README database) → `/houses` (một nhà thì vào thẳng dashboard — trang dashboard có từ Task 7, lúc này 404 của Next là bình thường). Trong DevTools → Application → Session Storage có khóa `swiftletcare.session`.

- [ ] **Step 7: Commit**

```powershell
git add web/lib/session.ts web/lib/api.ts web/lib/auth.tsx web/components/ui.tsx web/app/login web/app/houses/layout.tsx web/app/houses/page.tsx
git commit -m "feat(web): phiên trong sessionStorage, gọi API kèm token, 401 và hết hạn thì đăng xuất, đăng nhập, danh sách và tạo nhà

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Socket theo nhà, dữ liệu sống, dashboard (kèm huy hiệu OFFLINE)

**Files:**
- Create: `web/lib/config.ts`, `web/lib/live.tsx`, `web/lib/hooks.ts`, `web/app/houses/[houseId]/layout.tsx`, `web/app/houses/[houseId]/page.tsx`

**Interfaces:**
- Consumes: `createLiveSocket`, `LiveStatus` (Task 5); `useAuth` (Task 6); `api`, `API_URL` (Task 6); `loadSession` (Task 6); `mergeLatest`, `mergeAlert`, `applyDeviceState`, `replayDeviceStates`, `latestKey` (Task 4); `formatVn` (Task 2); `Banner`, `Card`, `Empty`, `Loading` (Task 6).
- Produces:
  - `config.ts`: `HEARTBEAT_ENABLED = false`, `METRIC_LABELS`, `DEVICE_LABELS`, `ACTUATORS`, `showOffline(deviceType, status)`.
  - `live.tsx`: `LIVE_EVENTS`, `LiveProvider`, `useLive(): { status, connectCount, subscribe(listener) => unsubscribe }`, `useReloadOnConnect(load)` (gọi khi mount và mỗi lần `connect`).
  - `hooks.ts`: `useLiveDevices(houseId) -> { devices, setDevices, error, reload }` (giữ `device.state` trong lúc REST tải rồi áp lại), `useLiveLatest(houseId) -> { latest, error }`, `useLiveOpenAlerts(houseId) -> Alert[]`.

Huy hiệu `OFFLINE` (mục cắt 7) chỉ là hàm `showOffline` vài dòng nên làm cùng task này; cắt thì đặt `showOffline` trả `false`.

- [ ] **Step 1: Viết `web/lib/config.ts`**

```ts
// Huy hieu OFFLINE cho co cau chap hanh/camera chi bat khi heartbeat (duoi ranh gioi cat) cua simulator,
// backend, ai-vision da lam xong (spec web 2.2). Chua lam -> chi SENSOR co huy hieu.
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

- [ ] **Step 2: Viết `web/lib/live.tsx`**

```tsx
'use client';
// Mot ket noi Socket.IO cho trang cua mot nha (layout houses/[houseId]); cac trang con dang ky nghe su kien.
// connectCount tang moi lan connect -> trang tai lai REST roi ghep (spec web 2.4).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { API_URL } from './api';
import { useAuth } from './auth';
import { loadSession } from './session';
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
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    const handlers = Object.fromEntries(
      LIVE_EVENTS.map((e) => [e, (payload: unknown) => listeners.current.forEach((l) => l(e, payload))]),
    );
    const live = createLiveSocket({
      url: API_URL,
      getToken: () => loadSession()?.accessToken ?? null,
      onLogout: () => logout('unauthorized'),
      onStatus: setStatus,
      onConnect: () => setConnectCount((n) => n + 1),
      handlers,
    });
    return () => live.close();
  }, [logout]);

  const subscribe = useCallback((l: Listener) => {
    listeners.current.add(l);
    return () => {
      listeners.current.delete(l);
    };
  }, []);

  return <LiveContext.Provider value={{ status, connectCount, subscribe }}>{children}</LiveContext.Provider>;
}

// Goi load() khi mount va moi lan socket (ket noi lai).
export function useReloadOnConnect(load: () => void): void {
  const { connectCount } = useLive();
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    loadRef.current();
  }, [connectCount]);
}
```

- [ ] **Step 3: Viết `web/lib/hooks.ts`**

```ts
'use client';
// Du lieu song cua mot nha: thiet bi (giu device.state trong luc REST tai, roi ap lai), so do moi nhat, canh bao dang mo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { ApiError } from './errors';
import { useLive, useReloadOnConnect } from './live';
import { applyDeviceState, mergeAlert, mergeLatest, replayDeviceStates, type LatestMap } from './merge';
import type { Alert, AlertCreated, AlertUpdated, Device, DeviceState, LatestReading, Page, ReadingsNew } from './types';

export function useLiveDevices(houseId: number) {
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

export function useLiveLatest(houseId: number) {
  const { subscribe } = useLive();
  const [latest, setLatest] = useState<LatestMap>({});
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => subscribe((event, payload) => {
    if (event !== 'readings.new') return;
    const ev = payload as ReadingsNew;
    if (ev.houseId === houseId) setLatest((m) => mergeLatest(m, ev.readings));
  }), [subscribe, houseId]);

  useReloadOnConnect(async () => {
    try {
      const rest = await api<LatestReading[]>(`/api/houses/${houseId}/latest-readings`);
      setLatest((m) => mergeLatest(m, rest));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    }
  });
  return { latest, error };
}

export function useLiveOpenAlerts(houseId: number) {
  const { subscribe } = useLive();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => subscribe((event, payload) => {
    if (event === 'alert.created') {
      const a = (payload as AlertCreated).alert;
      if (a.houseId === houseId) setAlerts((l) => mergeAlert(l, a));
    } else if (event === 'alert.updated') {
      const u = payload as AlertUpdated;
      if (u.houseId === houseId) setAlerts((l) => mergeAlert(l, u));
    }
  }), [subscribe, houseId]);

  useReloadOnConnect(async () => {
    try {
      const page = await api<Page<Alert>>(`/api/alerts?houseId=${houseId}&status=NEW,ACK&limit=200`);
      setAlerts((l) => page.items.reduce(mergeAlert, l));
    } catch {
      // dashboard van hien so do khi khong tai duoc canh bao
    }
  });
  return alerts.filter((a) => a.status !== 'RESOLVED');
}
```

- [ ] **Step 4: Viết layout của nhà và dashboard**

`web/app/houses/[houseId]/layout.tsx`:

```tsx
'use client';
// Khung trang cua mot nha: menu, thanh trang thai ket noi, mot socket chung cho moi trang con.
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { btnGhostCls, Empty } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { LiveProvider, useLive } from '@/lib/live';
import type { House } from '@/lib/types';

const TABS = [
  ['', 'Tổng quan'], ['/devices', 'Thiết bị'], ['/alerts', 'Cảnh báo'], ['/history', 'Lịch sử'],
  ['/settings', 'Cài đặt'], ['/harvests', 'Thu hoạch'],
] as const;

function ConnectionBar() {
  const { status } = useLive();
  if (status === 'connected') return null;
  return (
    <div className="bg-amber-100 px-4 py-1 text-center text-sm text-amber-900">
      {status === 'connecting' ? 'Đang kết nối máy chủ…' : 'Mất kết nối máy chủ, đang kết nối lại…'}
    </div>
  );
}

export default function HouseLayout({ children }: { children: ReactNode }) {
  const { houseId } = useParams<{ houseId: string }>();
  const pathname = usePathname();
  const { logout } = useAuth();
  const [house, setHouse] = useState<House | null>(null);
  const [notFound, setNotFound] = useState(false);
  const base = `/houses/${houseId}`;

  useEffect(() => {
    api<House>(`/api/houses/${houseId}`)
      .then(setHouse)
      .catch((e) => setNotFound(e instanceof ApiError && e.status === 404));
  }, [houseId]);

  if (notFound || !/^\d+$/.test(houseId)) return <main className="p-8"><Empty>Không tìm thấy</Empty></main>;

  return (
    <LiveProvider>
      <ConnectionBar />
      <header className="flex flex-wrap items-center gap-4 border-b border-stone-200 bg-white px-6 py-3">
        <Link href="/houses" className="font-semibold">{house?.name ?? 'Nhà yến'}</Link>
        <nav className="flex flex-wrap gap-1">
          {TABS.map(([path, label]) => {
            const href = base + path;
            const active = pathname === href;
            return (
              <Link key={path} href={href} className={`rounded px-3 py-1 text-sm ${active ? 'bg-emerald-700 text-white' : 'hover:bg-stone-100'}`}>
                {label}
              </Link>
            );
          })}
        </nav>
        <button className={`${btnGhostCls} ml-auto`} onClick={() => logout()}>Đăng xuất</button>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </LiveProvider>
  );
}
```

`web/app/houses/[houseId]/page.tsx`:

```tsx
'use client';
// Dashboard: the moi khu vuc voi so do moi nhat (to mau ngoai nguong), trang thai thiet bi, so canh bao dang mo.
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Banner, Card, Empty, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { DEVICE_LABELS, METRIC_LABELS, showOffline } from '@/lib/config';
import { useLiveDevices, useLiveLatest, useLiveOpenAlerts } from '@/lib/hooks';
import { latestKey } from '@/lib/merge';
import { formatVn } from '@/lib/time';
import type { Device, Metric, Threshold, Zone } from '@/lib/types';

const METRICS: Metric[] = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];

function outOfRange(value: number | null, t: Threshold | undefined): boolean {
  if (value === null || !t) return false;
  return (t.minValue !== null && value < t.minValue) || (t.maxValue !== null && value > t.maxValue);
}

function deviceText(d: Device): string {
  if (d.isOn === null) return '—';
  const lvl = d.deviceType === 'FAN' && d.isOn && d.level !== null ? ` ${d.level}%` : '';
  return `${d.isOn ? 'Bật' : 'Tắt'}${lvl} · ${d.mode === 'MANUAL' ? 'Tay' : 'Tự động'}`;
}

export default function Dashboard() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [thresholds, setThresholds] = useState<Record<number, Threshold[]>>({});
  const [error, setError] = useState<unknown>(null);
  const { devices, error: devError } = useLiveDevices(houseId);
  const { latest, error: latestError } = useLiveLatest(houseId);
  const openAlerts = useLiveOpenAlerts(houseId);

  useEffect(() => {
    (async () => {
      try {
        const z = await api<Zone[]>(`/api/houses/${houseId}/zones`);
        setZones(z);
        const all = await Promise.all(z.map((zone) => api<Threshold[]>(`/api/zones/${zone.zoneId}/thresholds`)));
        setThresholds(Object.fromEntries(z.map((zone, i) => [zone.zoneId, all[i]])));
      } catch (e) {
        setError(e);
      }
    })();
  }, [houseId]);

  if (error) return <Banner error={error} />;
  if (!zones) return <Loading />;
  if (zones.length === 0) return <Empty>Nhà chưa có khu vực nào.</Empty>;

  return (
    <div>
      <Banner error={devError ?? latestError} />
      <p className="mb-4 text-sm">
        Cảnh báo đang mở: <strong className={openAlerts.length ? 'text-red-700' : ''}>{openAlerts.length}</strong>
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {zones.map((zone) => {
          const zoneDevices = (devices ?? []).filter((d) => d.zoneId === zone.zoneId && d.isActive);
          const sensor = zoneDevices.find((d) => d.deviceType === 'SENSOR');
          const zoneAlerts = openAlerts.filter((a) => a.zoneId === zone.zoneId).length;
          return (
            <Card key={zone.zoneId} title={
              <span className="flex items-center gap-2">
                {zone.name}
                {sensor && showOffline(sensor.deviceType, sensor.status) ? <span className="rounded bg-stone-700 px-1.5 text-xs text-white">OFFLINE</span> : null}
                {zoneAlerts ? <span className="rounded bg-red-600 px-1.5 text-xs text-white">{zoneAlerts} cảnh báo</span> : null}
              </span>
            }>
              {sensor ? (
                <dl className="mb-3 grid grid-cols-2 gap-2">
                  {METRICS.map((m) => {
                    const r = latest[latestKey(sensor.deviceId, m)];
                    const bad = outOfRange(r?.value ?? null, thresholds[zone.zoneId]?.find((t) => t.metricCode === m));
                    return (
                      <div key={m} className={`rounded p-2 ${bad ? 'bg-red-100 text-red-800' : 'bg-stone-100'}`}>
                        <dt className="text-xs">{METRIC_LABELS[m]}</dt>
                        <dd className="text-lg font-semibold">{r?.value ?? '—'} <span className="text-xs font-normal">{r?.unit ?? ''}</span></dd>
                        {r ? <dd className="text-xs text-stone-500">{formatVn(r.at)}</dd> : null}
                      </div>
                    );
                  })}
                </dl>
              ) : null}
              {sensor && METRICS.every((m) => !latest[latestKey(sensor.deviceId, m)]) ? <Empty>Chưa có số đo</Empty> : null}
              <ul className="text-sm">
                {zoneDevices.filter((d) => d.deviceType !== 'SENSOR' && d.deviceType !== 'CAMERA').map((d) => (
                  <li key={d.deviceId} className="flex justify-between border-t py-1">
                    <span>{DEVICE_LABELS[d.deviceType]} — {d.name}</span>
                    <span>
                      {deviceText(d)}
                      {showOffline(d.deviceType, d.status) ? <span className="ml-1 rounded bg-stone-700 px-1 text-xs text-white">OFFLINE</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build và kiểm tay (checklist 3.2 bước 1–3, 12 phần dashboard)**

Run: `npm test; npm run build`
Expected: PASS; build đạt.

Kiểm tay (backend + simulator chạy, simulator **bật trước** backend): `owner1` → dashboard H1; số đo đổi **mỗi 10–15 giây**; giá trị ngoài ngưỡng có nền đỏ; `owner2` gõ `/houses/<id H1>` → "Không tìm thấy". Khu vực chưa có số đo → "Chưa có số đo". Tab Network của DevTools có **một** kết nối WebSocket cho trang nhà.

- [ ] **Step 6: Commit**

```powershell
git add web/lib/config.ts web/lib/live.tsx web/lib/hooks.ts "web/app/houses/[houseId]/layout.tsx" "web/app/houses/[houseId]/page.tsx"
git commit -m "feat(web): một socket cho mỗi nhà, tải lại REST mỗi lần kết nối, dashboard số đo trực tiếp và huy hiệu OFFLINE cho cảm biến

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Điều khiển tay và nhật ký điều khiển

**Files:**
- Create: `web/app/houses/[houseId]/devices/page.tsx`

**Interfaces:**
- Consumes: `useLiveDevices` (Task 7), `api` (Task 6), `ACTUATORS`, `DEVICE_LABELS`, `showOffline` (Task 7), `ControlResult`, `ControlLog`, `Page` (Task 4), `formatVn` (Task 2).
- Produces: trang `/houses/[houseId]/devices` — gửi `{mode:'MANUAL', isOn, level?}` hoặc `{mode:'AUTO'}` tới `POST /api/devices/:id/control`, cập nhật **từ phản hồi**; nhật ký `GET …/control-logs?limit=20&before=`.

Thanh Level FAN 0–100 theo spec web 2.2 (bước 10). Level 0 là tắt, giống mobile: nút "Bật" của FAN ở Level 0 gửi `{mode:'MANUAL', isOn:false}` (không gửi `level`); Level khác 0 gửi `isOn: true` kèm `level`.

- [ ] **Step 1: Viết `web/app/houses/[houseId]/devices/page.tsx`**

```tsx
'use client';
// Dieu khien tay: bat/tat, Level FAN 0-100 (0 = tat, giong mobile), MANUAL/AUTO; cap nhat tu PHAN HOI, khong doan truoc; nhat ky phan trang (spec web 2.2).
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Banner, btnCls, btnGhostCls, Card, Empty, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { ACTUATORS, DEVICE_LABELS, showOffline } from '@/lib/config';
import { useLiveDevices } from '@/lib/hooks';
import { formatVn } from '@/lib/time';
import type { ControlLog, ControlResult, Device, Page } from '@/lib/types';

function ControlRow({ device, onResult, onShowLogs }: {
  device: Device; onResult: (id: number, r: ControlResult) => void; onShowLogs: (d: Device) => void;
}) {
  const [level, setLevel] = useState(device.level ?? 100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function send(body: Record<string, unknown>) {
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
  return (
    <li className="border-t py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-56 font-medium">{DEVICE_LABELS[device.deviceType]} — {device.name}</span>
        <span className="text-sm">
          {device.isOn ? 'Đang bật' : 'Đang tắt'}{isFan && device.isOn ? ` ${device.level ?? 0}%` : ''} · {device.mode === 'MANUAL' ? 'Điều khiển tay' : 'Tự động'}
          {showOffline(device.deviceType, device.status) ? <span className="ml-1 rounded bg-stone-700 px-1 text-xs text-white">OFFLINE</span> : null}
        </span>
        <button className={btnCls} disabled={busy} onClick={() => send(isFan && level === 0 ? { mode: 'MANUAL', isOn: false } : { mode: 'MANUAL', isOn: true, ...(isFan ? { level } : {}) })}>Bật</button>
        <button className={btnGhostCls} disabled={busy} onClick={() => send({ mode: 'MANUAL', isOn: false })}>Tắt</button>
        {isFan ? (
          <label className="flex items-center gap-2 text-sm">Level
            <input type="range" min={0} max={100} step={10} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
            <span className="w-10">{level}%</span>
          </label>
        ) : null}
        <button className={btnGhostCls} disabled={busy || device.mode === 'AUTO'} onClick={() => send({ mode: 'AUTO' })}>Trả về tự động</button>
        <button className="text-sm text-emerald-700 underline" onClick={() => onShowLogs(device)}>Nhật ký</button>
      </div>
      <Banner error={error} />
    </li>
  );
}

function Logs({ device }: { device: Device }) {
  const [page, setPage] = useState<{ items: ControlLog[]; nextBefore: number | null } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (before: number | null) => {
    try {
      const q = before ? `&before=${before}` : '';
      const p = await api<Page<ControlLog>>(`/api/devices/${device.deviceId}/control-logs?limit=20${q}`);
      setPage((cur) => ({ items: before && cur ? [...cur.items, ...p.items] : p.items, nextBefore: p.nextBefore }));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [device.deviceId]);
  useEffect(() => {
    setPage(null);
    void load(null);
  }, [load]);

  return (
    <Card title={`Nhật ký điều khiển — ${device.name}`}>
      <Banner error={error} onRetry={() => load(null)} />
      {!page ? <Loading /> : page.items.length === 0 ? <Empty>Chưa có lần điều khiển nào.</Empty> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Thời điểm</th><th>Trạng thái</th><th>Chế độ</th><th>Nguồn</th><th>Lý do</th></tr></thead>
          <tbody>
            {page.items.map((l) => (
              <tr key={l.logId} className="border-t">
                <td>{formatVn(l.createdAt)}</td>
                <td>{l.isOn ? 'Bật' : 'Tắt'}{l.level !== null ? ` ${l.level}%` : ''}</td>
                <td>{l.mode}</td><td>{l.source}</td><td>{l.reason ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {page?.nextBefore ? <button className={`${btnGhostCls} mt-2`} onClick={() => load(page.nextBefore)}>Tải thêm</button> : null}
    </Card>
  );
}

export default function DevicesPage() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const { devices, setDevices, error, reload } = useLiveDevices(houseId);
  const [selected, setSelected] = useState<Device | null>(null);

  const onResult = (id: number, r: ControlResult) =>
    setDevices((list) => list && list.map((d) => (d.deviceId === id ? { ...d, mode: r.mode, isOn: r.isOn, level: r.level } : d)));

  if (error && !devices) return <Banner error={error} onRetry={reload} />;
  if (!devices) return <Loading />;
  const actuators = devices.filter((d) => ACTUATORS.includes(d.deviceType) && d.isActive);

  return (
    <div className="grid gap-4">
      <Card title="Cơ cấu chấp hành">
        {actuators.length === 0 ? <Empty>Chưa có thiết bị điều khiển được.</Empty> : (
          <ul>{actuators.map((d) => <ControlRow key={d.deviceId} device={d} onResult={onResult} onShowLogs={setSelected} />)}</ul>
        )}
      </Card>
      {selected ? <Logs device={selected} /> : null}
    </div>
  );
}
```

- [ ] **Step 2: Build và kiểm tay (checklist 3.2 bước 4–5)**

Run: `npm run build` → đạt.
Kiểm tay: simulator `--scenario hot` → trên trang Thiết bị/dashboard FAN H1-F2 bật rồi tắt. Bật FAN Level 50 → dòng trạng thái hiện "Đang bật 50% · Điều khiển tay" (theo phản hồi); kéo Level về 0 rồi bấm "Bật" → "Đang tắt · Điều khiển tay" (DevTools: body chỉ có `mode`, `isOn: false`); "Nhật ký" có dòng mới; "Trả về tự động" → "Tự động". Thiết bị đã ngừng dùng (đặt ở Cài đặt) gửi lệnh qua API → câu "Thiết bị đã ngừng dùng…".

- [ ] **Step 3: Commit**

```powershell
git add "web/app/houses/[houseId]/devices/page.tsx"
git commit -m "feat(web): điều khiển tay bật/tắt, Level quạt, trả về tự động theo phản hồi, nhật ký điều khiển phân trang

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Cảnh báo — lọc, phân trang, chi tiết, ACK/RESOLVED, ảnh thiên địch

**Files:**
- Create: `web/components/SnapshotImage.tsx`, `web/app/houses/[houseId]/alerts/page.tsx`

**Interfaces:**
- Consumes: `fetchBlob`, `api`, `qs` (Task 6); `useLive`, `useReloadOnConnect` (Task 7); `mergeAlert` (Task 4); `ApiError` (Task 3); `formatVn` (Task 2).
- Produces: `SnapshotImage({ alertId })` (object URL thu hồi khi đổi ảnh/unmount; 404 → "Không có ảnh"); trang `/houses/[houseId]/alerts`.

- [ ] **Step 1: Viết `web/components/SnapshotImage.tsx`**

```tsx
'use client';
// Anh thien dich: fetch kem token -> blob -> object URL; thu hoi khi doi anh hoac unmount (spec web 2.4, hop dong 3.3).
import { useEffect, useState } from 'react';
import { fetchBlob } from '@/lib/api';

export function SnapshotImage({ alertId }: { alertId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'none' | 'error' | 'ok'>('loading');

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setState('loading');
    setUrl(null);
    fetchBlob(`/api/alerts/${alertId}/snapshot`)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setState('none');
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setState('ok');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [alertId]);

  if (state === 'loading') return <p className="text-sm text-stone-500">Đang tải ảnh…</p>;
  if (state === 'none') return <p className="text-sm text-stone-500">Không có ảnh</p>;
  if (state === 'error' || !url) return <p className="text-sm text-red-700">Không tải được ảnh</p>;
  // eslint-disable-next-line @next/next/no-img-element -- object URL, khong qua toi uu anh cua Next
  return <img src={url} alt={`Ảnh cảnh báo ${alertId}`} className="max-h-80 rounded border" />;
}
```

- [ ] **Step 2: Viết `web/app/houses/[houseId]/alerts/page.tsx`**

```tsx
'use client';
// Canh bao: loc trang thai/loai, phan trang before, chi tiet kem history, ACK/RESOLVED kem ghi chu, anh (spec web 2.2).
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SnapshotImage } from '@/components/SnapshotImage';
import { Banner, btnCls, btnGhostCls, Card, Empty, inputCls, Loading } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { useLive, useReloadOnConnect } from '@/lib/live';
import { mergeAlert } from '@/lib/merge';
import { formatVn } from '@/lib/time';
import type { Alert, AlertCreated, AlertDetail, AlertUpdated, Page } from '@/lib/types';

const STATUS_FILTERS = [['NEW,ACK', 'Đang mở'], ['RESOLVED', 'Đã xử lý'], ['', 'Tất cả']] as const;
const TYPES = [['', 'Mọi loại'], ['THRESHOLD', 'Ngưỡng'], ['PREDATOR', 'Thiên địch'], ['DEVICE_OFFLINE', 'Mất kết nối'], ['POPULATION_DROP', 'Sụt đàn']] as const;
const STATUS_LABEL: Record<string, string> = { NEW: 'Mới', ACK: 'Đã xem', RESOLVED: 'Đã xử lý' };

function Detail({ alertId, onChanged }: { alertId: number; onChanged: () => void }) {
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await api<AlertDetail>(`/api/alerts/${alertId}`));
    } catch (e) {
      setError(e);
    }
  }, [alertId]);
  useEffect(() => {
    setDetail(null);
    setError(null);
    setInfo(null);
    void load();
  }, [load]);

  async function change(status: 'ACK' | 'RESOLVED') {
    setError(null);
    setInfo(null);
    try {
      await api(`/api/alerts/${alertId}`, 'PATCH', { status, note: note || undefined });
      setNote('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ALERT_INVALID_TRANSITION') setInfo('Cảnh báo đã đổi trạng thái. Đã tải lại.');
      else setError(e);
    }
    await load();
    onChanged();
  }

  if (!detail) return error ? <Banner error={error} /> : <Loading />;
  return (
    <Card title={`Cảnh báo #${detail.alertId} — ${STATUS_LABEL[detail.status]}`}>
      <p className="mb-2">{detail.message}</p>
      <p className="mb-2 text-sm text-stone-600">{formatVn(detail.createdAt)} · {detail.alertType} · {detail.severity}
        {detail.detectedClass ? ` · ${detail.detectedClass} (${detail.confidence})` : ''}</p>
      {detail.hasSnapshot ? <SnapshotImage alertId={detail.alertId} /> : null}
      <Banner error={error} />
      {info ? <p className="my-2 text-sm text-amber-700">{info}</p> : null}
      {detail.status !== 'RESOLVED' ? (
        <div className="my-3 flex flex-wrap gap-2">
          <input className={`${inputCls} flex-1`} placeholder="Ghi chú (không bắt buộc)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          {detail.status === 'NEW' ? <button className={btnGhostCls} onClick={() => change('ACK')}>Đã xem (ACK)</button> : null}
          <button className={btnCls} onClick={() => change('RESOLVED')}>Đã xử lý</button>
        </div>
      ) : null}
      <h3 className="mt-3 text-sm font-semibold">Lịch sử</h3>
      <ul className="text-sm">
        {detail.history.map((h) => (
          <li key={h.historyId}>{formatVn(h.changedAt)}: {h.oldStatus ?? '—'} → {h.newStatus}{h.note ? ` — ${h.note}` : ''}</li>
        ))}
      </ul>
    </Card>
  );
}

export default function AlertsPage() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const { subscribe } = useLive();
  const [status, setStatus] = useState<string>('NEW,ACK');
  const [type, setType] = useState<string>('');
  const [list, setList] = useState<Alert[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(async (before: number | null) => {
    try {
      const page = await api<Page<Alert>>(`/api/alerts${qs({ houseId, status, type, limit: 50, before })}`);
      setList((cur) => (before && cur ? [...cur, ...page.items] : page.items));
      setNextBefore(page.nextBefore);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [houseId, status, type]);
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

  const allowed = status ? status.split(',') : null;
  const shown = (list ?? []).filter((a) => (!allowed || allowed.includes(a.status)) && (!type || a.alertType === type));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Danh sách cảnh báo">
        <div className="mb-3 flex gap-2">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Banner error={error} onRetry={() => load(null)} />
        {list === null && !error ? <Loading /> : shown.length === 0 && !error ? <Empty>Không có cảnh báo</Empty> : (
          <ul>
            {shown.map((a) => (
              <li key={a.alertId}>
                <button onClick={() => setSelected(a.alertId)} className={`w-full border-t py-2 text-left text-sm ${selected === a.alertId ? 'bg-emerald-50' : ''}`}>
                  <span className="mr-2 rounded bg-stone-200 px-1 text-xs">{STATUS_LABEL[a.status]}</span>
                  {a.message} <span className="text-stone-500">· {formatVn(a.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {nextBefore ? <button className={`${btnGhostCls} mt-2`} onClick={() => load(nextBefore)}>Tải thêm</button> : null}
      </Card>
      {selected ? <Detail alertId={selected} onChanged={() => load(null)} /> : <Empty>Chọn một cảnh báo để xem chi tiết.</Empty>}
    </div>
  );
}
```

- [ ] **Step 3: Build và kiểm tay (checklist 3.2 bước 6–7, 12 phần cảnh báo)**

Run: `npm run build` → đạt.
Kiểm tay: ACK rồi RESOLVED một cảnh báo; mở tab thứ hai ACK lại cảnh báo đó → "Cảnh báo đã đổi trạng thái. Đã tải lại."; cảnh báo thiên địch của seed → "Không có ảnh" (404); lọc "Đã xử lý" rỗng → "Không có cảnh báo"; chuyển sang cảnh báo khác rồi xem DevTools → Memory/Console: không còn object URL cũ (`blob:` cũ mở ra lỗi).

- [ ] **Step 4: Commit**

```powershell
git add web/components/SnapshotImage.tsx "web/app/houses/[houseId]/alerts/page.tsx"
git commit -m "feat(web): cảnh báo lọc và phân trang, chi tiết kèm lịch sử, ACK/RESOLVED, ảnh thiên địch qua blob

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Lịch sử — biểu đồ môi trường, thống kê ngày, đếm chim

**Files:**
- Create: `web/app/houses/[houseId]/history/page.tsx`

**Interfaces:**
- Consumes: Recharts 3.10.1; `api`, `qs` (Task 6); `useLive` (Task 7); `appendLive`, `ChartPoint` (Task 4); `formatVnTime`, `msToVnInput`, `todayVn`, `toMs`, `vnInputToIso` (Task 2).
- Produces: trang `/houses/[houseId]/history` — `readings?metric&from&to&bucketMinutes`, `daily-stats?fromVnDate&toVnDate` (7 ngày, `to` = ngày mai theo giờ VN, khoảng nửa mở), `bird-flow` 14 ngày; `birdcount.updated` gom 2 giây.

- [ ] **Step 1: Viết `web/app/houses/[houseId]/history/page.tsx`**

```tsx
'use client';
// Lich su: bieu do so do theo bucket (+ noi so do truc tiep khi khoang chua hien tai), thong ke theo ngay,
// dem chim ra/vao theo ngay (tai lai khi birdcount.updated, gom trong 2 giay). Spec web 2.2, 2.3, 2.4.
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banner, btnCls, Card, Empty, inputCls, Loading } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { METRIC_LABELS } from '@/lib/config';
import { useLive } from '@/lib/live';
import { appendLive, type ChartPoint } from '@/lib/merge';
import { formatVnTime, msToVnInput, todayVn, toMs, vnInputToIso } from '@/lib/time';
import type { BirdFlow, DailyStat, Metric, ReadingBucket, ReadingsNew, Zone } from '@/lib/types';

const METRICS: Metric[] = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];
const BUCKETS = [5, 15, 60, 1440];
const DAY = 24 * 60 * 60 * 1000;

export default function HistoryPage() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const { subscribe } = useLive();
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>('TEMP');
  const [from, setFrom] = useState(() => msToVnInput(Date.now() - DAY));
  const [to, setTo] = useState(() => msToVnInput(Date.now() + 60 * 60 * 1000));
  const [bucket, setBucket] = useState(15);
  const [points, setPoints] = useState<ChartPoint[] | null>(null);
  const [stats, setStats] = useState<DailyStat[] | null>(null);
  const [flow, setFlow] = useState<BirdFlow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const view = useRef<{ zoneId: number; metric: string; fromMs: number; toMs: number } | null>(null);

  useEffect(() => {
    api<Zone[]>(`/api/houses/${houseId}/zones`).then((z) => {
      setZones(z);
      setZoneId((cur) => cur ?? z[0]?.zoneId ?? null);
    }).catch(setError);
  }, [houseId]);

  const loadChart = useCallback(async () => {
    if (zoneId === null) return;
    setError(null);
    try {
      const fromIso = vnInputToIso(from);
      const toIso = vnInputToIso(to);
      const rows = await api<ReadingBucket[]>(`/api/zones/${zoneId}/readings${qs({ metric, from: fromIso, to: toIso, bucketMinutes: bucket })}`);
      view.current = { zoneId, metric, fromMs: toMs(fromIso), toMs: toMs(toIso) };
      setPoints(rows.filter((r) => r.avgValue !== null).map((r) => ({ key: `b:${toMs(r.bucketUtc)}`, t: toMs(r.bucketUtc), value: r.avgValue as number })));
      const fromVnDate = todayVn(Date.now() - 6 * DAY);
      const toVnDate = todayVn(Date.now() + DAY);
      setStats(await api<DailyStat[]>(`/api/zones/${zoneId}/daily-stats${qs({ fromVnDate, toVnDate })}`));
    } catch (e) {
      setError(e);
    }
  }, [zoneId, metric, from, to, bucket]);

  const loadFlow = useCallback(async () => {
    try {
      setFlow(await api<BirdFlow[]>(`/api/houses/${houseId}/bird-flow${qs({ fromVnDate: todayVn(Date.now() - 13 * DAY), toVnDate: todayVn(Date.now() + DAY) })}`));
    } catch (e) {
      setError(e);
    }
  }, [houseId]);

  useEffect(() => {
    void loadChart();
  }, [loadChart]);
  useEffect(() => {
    void loadFlow();
  }, [loadFlow]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = subscribe((event, payload) => {
      if (event === 'readings.new') {
        const ev = payload as ReadingsNew;
        if (ev.houseId === houseId && view.current) {
          const v = view.current;
          setPoints((p) => (p ? appendLive(p, ev.readings, v, Date.now()) : p));
        }
      } else if (event === 'birdcount.updated' && (payload as { houseId: number }).houseId === houseId) {
        clearTimeout(timer);
        timer = setTimeout(() => void loadFlow(), 2000);
      }
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [subscribe, houseId, loadFlow]);

  return (
    <div className="grid gap-4">
      <Banner error={error} onRetry={loadChart} />
      <Card title="Số đo môi trường">
        <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <select className={inputCls} value={zoneId ?? ''} onChange={(e) => setZoneId(Number(e.target.value))}>
            {zones.map((z) => <option key={z.zoneId} value={z.zoneId}>{z.name}</option>)}
          </select>
          <select className={inputCls} value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            {METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
          </select>
          <label className="flex flex-col">Từ (giờ VN)<input type="datetime-local" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="flex flex-col">Đến (giờ VN)<input type="datetime-local" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <select className={inputCls} value={bucket} onChange={(e) => setBucket(Number(e.target.value))}>
            {BUCKETS.map((b) => <option key={b} value={b}>{b} phút</option>)}
          </select>
          <button className={btnCls} onClick={loadChart}>Xem</button>
        </div>
        {points === null ? <Loading /> : points.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatVnTime} />
                <YAxis domain={['auto', 'auto']} />
                <Tooltip labelFormatter={(t) => formatVnTime(Number(t))} />
                <Line dataKey="value" name={METRIC_LABELS[metric]} stroke="#047857" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card title="Thống kê theo ngày (7 ngày)">
        {stats === null ? <Loading /> : stats.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Ngày</th><th>Chỉ số</th><th>TB</th><th>Thấp nhất</th><th>Cao nhất</th><th>Số mẫu</th></tr></thead>
            <tbody>
              {stats.map((s) => (
                <tr key={`${s.dayVn}-${s.metric}`} className="border-t">
                  <td>{s.dayVn}</td><td>{METRIC_LABELS[s.metric]}</td><td>{s.avgValue}</td><td>{s.minValue}</td><td>{s.maxValue}</td><td>{s.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Chim ra/vào theo ngày (14 ngày)">
        {flow === null ? <Loading /> : flow.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={flow}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayVn" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="inTotal" name="Vào" fill="#047857" />
                <Bar dataKey="outTotal" name="Ra" fill="#b45309" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Build, kiểm Recharts (S2) và kiểm tay (checklist 3.2 bước 12 phần biểu đồ)**

Run: `npm run build` → đạt, không cảnh báo về Recharts/`react-is`. Ghi S2.
Kiểm tay: biểu đồ 24 giờ của H1-F1 TEMP vẽ được, điểm mới nối thêm khi simulator chạy; đổi "Từ/Đến" sang một ngày không có dữ liệu → "Không có dữ liệu". Biểu đồ không vẽ (lỗi console về `react-is`): dùng `superpowers:systematic-debugging`; thử React 19.2.9 theo spec 1.5.2 rồi **báo lại**, không tự đổi phiên bản trong `package.json`.

- [ ] **Step 3: Commit**

```powershell
git add "web/app/houses/[houseId]/history/page.tsx" web/spikes/RESULTS.md
git commit -m "feat(web): biểu đồ lịch sử theo giờ VN có nối số đo trực tiếp, thống kê theo ngày, đếm chim ra/vào

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Cài đặt — nhà, khu vực, thiết bị, ngưỡng

**Files:**
- Create: `web/app/houses/[houseId]/settings/page.tsx`

**Interfaces:**
- Consumes: `api` (Task 6); `Banner`, `fieldError` (Task 6); `DEVICE_LABELS` (Task 7); kiểu Task 4.
- Produces: trang `/houses/[houseId]/settings` — `PATCH /api/houses/:id`, `POST /api/houses/:id/zones`, `PATCH /api/zones/:id`, `POST /api/zones/:id/devices` (`code` khớp `[A-Z0-9-]{3,50}`), `PATCH /api/devices/:id` (`name`, `isActive`), `GET /api/metrics`, `GET|PUT /api/zones/:id/thresholds[/:metricCode]`.

- [ ] **Step 1: Viết `web/app/houses/[houseId]/settings/page.tsx`**

```tsx
'use client';
// Cai dat: sua nha; them/sua khu vuc; them thiet bi, doi ten, ngung dung; sua nguong Min/Max/Target (spec web 2.2).
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Banner, btnCls, btnGhostCls, Card, fieldError, inputCls, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { DEVICE_LABELS } from '@/lib/config';
import type { Device, DeviceType, House, MetricInfo, Threshold, Zone } from '@/lib/types';

const TYPES: DeviceType[] = ['SENSOR', 'FAN', 'MIST', 'HEATER', 'SPEAKER', 'CAMERA'];
const num = (s: string) => (s.trim() === '' ? null : Number(s));
const str = (n: number | null) => (n === null ? '' : String(n));

function Thresholds({ zone, metrics }: { zone: Zone; metrics: MetricInfo[] }) {
  const [rows, setRows] = useState<Record<string, { min: string; max: string; target: string }>>({});
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await api<Threshold[]>(`/api/zones/${zone.zoneId}/thresholds`);
    setRows(Object.fromEntries(metrics.map((m) => {
      const t = list.find((x) => x.metricCode === m.metricCode);
      return [m.metricCode, { min: str(t?.minValue ?? null), max: str(t?.maxValue ?? null), target: str(t?.targetValue ?? null) }];
    })));
  }, [zone.zoneId, metrics]);
  useEffect(() => {
    load().catch(setError);
  }, [load]);

  async function save(code: string) {
    setError(null);
    setSaved(null);
    const r = rows[code];
    try {
      await api(`/api/zones/${zone.zoneId}/thresholds/${code}`, 'PUT', { minValue: num(r.min), maxValue: num(r.max), targetValue: num(r.target) });
      setSaved(code);
    } catch (e) {
      setError(e);
    }
  }

  const set = (code: string, key: 'min' | 'max' | 'target', v: string) => setRows({ ...rows, [code]: { ...rows[code], [key]: v } });
  return (
    <div className="mt-2">
      <table className="text-sm">
        <thead><tr className="text-left"><th>Chỉ số</th><th>Min</th><th>Max</th><th>Mục tiêu</th><th /></tr></thead>
        <tbody>
          {metrics.map((m) => rows[m.metricCode] ? (
            <tr key={m.metricCode}>
              <td className="pr-2">{m.name} ({m.unit})</td>
              {(['min', 'max', 'target'] as const).map((k) => (
                <td key={k}><input className={`${inputCls} w-24`} inputMode="decimal" value={rows[m.metricCode][k]} onChange={(e) => set(m.metricCode, k, e.target.value)} /></td>
              ))}
              <td><button className={btnGhostCls} onClick={() => save(m.metricCode)}>Lưu</button>{saved === m.metricCode ? <span className="ml-1 text-xs text-emerald-700">Đã lưu</span> : null}</td>
            </tr>
          ) : null)}
        </tbody>
      </table>
      <Banner error={error} />
    </div>
  );
}

export default function SettingsPage() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const [house, setHouse] = useState<House | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [metrics, setMetrics] = useState<MetricInfo[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [houseForm, setHouseForm] = useState({ name: '', address: '' });
  const [zoneForm, setZoneForm] = useState({ name: '', floorNo: '1' });
  const [devForm, setDevForm] = useState({ zoneId: '', code: '', name: '', deviceType: 'SENSOR' as DeviceType });
  const [formError, setFormError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      const [h, z, d, m] = await Promise.all([
        api<House>(`/api/houses/${houseId}`), api<Zone[]>(`/api/houses/${houseId}/zones`),
        api<Device[]>(`/api/houses/${houseId}/devices`), api<MetricInfo[]>('/api/metrics'),
      ]);
      setHouse(h);
      setHouseForm({ name: h.name, address: h.address ?? '' });
      setZones(z);
      setDevices(d);
      setMetrics(m);
      setDevForm((f) => ({ ...f, zoneId: f.zoneId || String(z[0]?.zoneId ?? '') }));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [houseId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setFormError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setFormError(e);
    }
  }

  const submit = (fn: () => Promise<unknown>) => (e: FormEvent) => {
    e.preventDefault();
    void run(fn);
  };

  if (error && !house) return <Banner error={error} onRetry={load} />;
  if (!house) return <Loading />;

  return (
    <div className="grid gap-4">
      <Banner error={formError} />
      <Card title="Nhà">
        <form className="flex flex-wrap items-end gap-2" onSubmit={submit(() => api(`/api/houses/${houseId}`, 'PATCH', { name: houseForm.name, address: houseForm.address || null }))}>
          <label className="flex flex-col text-sm">Tên<input className={inputCls} value={houseForm.name} maxLength={100} required onChange={(e) => setHouseForm({ ...houseForm, name: e.target.value })} />
            <span className="text-xs text-red-700">{fieldError(formError, 'name')}</span></label>
          <label className="flex flex-col text-sm">Địa chỉ<input className={inputCls} value={houseForm.address} maxLength={255} onChange={(e) => setHouseForm({ ...houseForm, address: e.target.value })} /></label>
          <button className={btnCls}>Lưu</button>
        </form>
      </Card>

      <Card title="Khu vực và ngưỡng">
        {zones.map((z) => (
          <details key={z.zoneId} className="border-t py-2">
            <summary className="cursor-pointer">{z.name} (tầng {z.floorNo})</summary>
            <button className={`${btnGhostCls} mt-2`} onClick={() => {
              const name = window.prompt('Tên khu vực mới', z.name);
              if (name) void run(() => api(`/api/zones/${z.zoneId}`, 'PATCH', { name }));
            }}>Đổi tên</button>
            <Thresholds zone={z} metrics={metrics} />
          </details>
        ))}
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={submit(() => api(`/api/houses/${houseId}/zones`, 'POST', { name: zoneForm.name, floorNo: Number(zoneForm.floorNo) }))}>
          <label className="flex flex-col text-sm">Tên khu vực<input className={inputCls} value={zoneForm.name} maxLength={50} required onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} /></label>
          <label className="flex flex-col text-sm">Tầng<input className={`${inputCls} w-20`} type="number" min={0} max={255} value={zoneForm.floorNo} onChange={(e) => setZoneForm({ ...zoneForm, floorNo: e.target.value })} /></label>
          <button className={btnCls}>Thêm khu vực</button>
        </form>
      </Card>

      <Card title="Thiết bị">
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Mã</th><th>Tên</th><th>Loại</th><th>Khu vực</th><th /></tr></thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.deviceId} className={`border-t ${d.isActive ? '' : 'text-stone-400'}`}>
                <td>{d.code}</td><td>{d.name}</td><td>{DEVICE_LABELS[d.deviceType]}</td>
                <td>{zones.find((z) => z.zoneId === d.zoneId)?.name}</td>
                <td className="flex gap-1 py-1">
                  <button className={btnGhostCls} onClick={() => {
                    const name = window.prompt('Tên thiết bị mới', d.name);
                    if (name) void run(() => api(`/api/devices/${d.deviceId}`, 'PATCH', { name }));
                  }}>Đổi tên</button>
                  <button className={btnGhostCls} onClick={() => run(() => api(`/api/devices/${d.deviceId}`, 'PATCH', { isActive: !d.isActive }))}>
                    {d.isActive ? 'Ngừng dùng' : 'Dùng lại'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={submit(() => api(`/api/zones/${devForm.zoneId}/devices`, 'POST', { code: devForm.code, name: devForm.name, deviceType: devForm.deviceType }))}>
          <select className={inputCls} value={devForm.zoneId} onChange={(e) => setDevForm({ ...devForm, zoneId: e.target.value })}>
            {zones.map((z) => <option key={z.zoneId} value={z.zoneId}>{z.name}</option>)}
          </select>
          <label className="flex flex-col text-sm">Mã (A-Z, 0-9, -)<input className={inputCls} value={devForm.code} required pattern="[A-Z0-9-]{3,50}" onChange={(e) => setDevForm({ ...devForm, code: e.target.value.toUpperCase() })} />
            <span className="text-xs text-red-700">{fieldError(formError, 'code')}</span></label>
          <label className="flex flex-col text-sm">Tên<input className={inputCls} value={devForm.name} required maxLength={100} onChange={(e) => setDevForm({ ...devForm, name: e.target.value })} /></label>
          <select className={inputCls} value={devForm.deviceType} onChange={(e) => setDevForm({ ...devForm, deviceType: e.target.value as DeviceType })}>
            {TYPES.map((t) => <option key={t} value={t}>{DEVICE_LABELS[t]}</option>)}
          </select>
          <button className={btnCls}>Thêm thiết bị</button>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Build và kiểm tay (checklist 3.2 bước 8)**

Run: `npm run build` → đạt.
Kiểm tay: sửa ngưỡng TEMP Min 31, Max 30 → "Ngưỡng không hợp lệ (Min phải nhỏ hơn Max)"; thêm khu vực trùng tên → "Trùng tên hoặc trùng mã"; ngừng dùng một thiết bị → dòng mờ, nút đổi thành "Dùng lại". Trả ngưỡng về giá trị seed sau khi kiểm (simulator dựa vào ngưỡng seed).

- [ ] **Step 3: Commit**

```powershell
git add "web/app/houses/[houseId]/settings/page.tsx"
git commit -m "feat(web): cài đặt nhà, khu vực, thiết bị (thêm, đổi tên, ngừng dùng) và ngưỡng Min/Max/Target

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12 (dưới ranh giới cắt): Bật huy hiệu OFFLINE cho cơ cấu chấp hành khi đã có heartbeat

**Files:**
- Modify: `web/lib/config.ts`

**Interfaces:**
- Consumes: heartbeat của simulator (plan simulator Task 9), backend (Task 26), ai-vision (`--heartbeat`) **đều đã chạy**.

- [ ] **Step 1: Kiểm điều kiện**

Gọi `GET /api/houses/<id>/devices` khi simulator đang chạy có heartbeat: mọi FAN/MIST/HEATER/SPEAKER có `status: "ONLINE"`. Chưa đúng → **dừng task này**, giữ `HEARTBEAT_ENABLED = false` (spec 3.4 hạn chế 7).

- [ ] **Step 2: Đổi cờ**

Trong `web/lib/config.ts` đổi `export const HEARTBEAT_ENABLED = false;` thành `export const HEARTBEAT_ENABLED = true;`.

- [ ] **Step 3: Build, kiểm tay, commit**

Run: `npm run build` → đạt. Tắt simulator 6 phút → dashboard và trang Thiết bị có `OFFLINE` cho cả cảm biến lẫn cơ cấu chấp hành.

```powershell
git add web/lib/config.ts
git commit -m "feat(web): bật huy hiệu OFFLINE cho cơ cấu chấp hành khi heartbeat đã chạy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13 (dưới ranh giới cắt): Thu hoạch và báo cáo tương quan

**Files:**
- Create: `web/app/houses/[houseId]/harvests/page.tsx`

**Interfaces:**
- Consumes: backend Task 25 (`GET/POST /api/zones/:zoneId/harvests`, `GET /api/houses/:houseId/reports/env-vs-yield`); `todayVn`, `formatVn` (Task 2).
- Produces: trang `/houses/[houseId]/harvests`. `harvestDate` lấy từ `<input type="date">` (chuỗi `YYYY-MM-DD`), **không qua `Date`**; bảng báo cáo hiện mọi cột camelCase của `sp_Report_EnvStabilityVsYield` theo khóa của dòng đầu (spec database-core mục 10 chưa chốt tên cột trả về).

Backend cắt Task 25 thì **không làm task này**: xóa phần tử `['/harvests', 'Thu hoạch']` khỏi `TABS` trong `app/houses/[houseId]/layout.tsx`.

- [ ] **Step 1: Viết `web/app/houses/[houseId]/harvests/page.tsx`**

```tsx
'use client';
// Duoi ranh gioi cat: nhap thu hoach theo harvestDate (chuoi YYYY-MM-DD, khong qua Date), bang bao cao tuong quan.
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Banner, btnCls, Card, Empty, fieldError, inputCls, Loading } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { formatVn, todayVn } from '@/lib/time';
import type { Harvest, Zone } from '@/lib/types';

const YEAR = 365 * 24 * 60 * 60 * 1000;

export default function HarvestsPage() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [harvests, setHarvests] = useState<Harvest[] | null>(null);
  const [report, setReport] = useState<Record<string, unknown>[] | null>(null);
  const [form, setForm] = useState({ harvestDate: '', nestCount: '', weightGram: '', grade: '' });
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setForm((f) => ({ ...f, harvestDate: todayVn() }));
    api<Zone[]>(`/api/houses/${houseId}/zones`).then((z) => {
      setZones(z);
      setZoneId(z[0]?.zoneId ?? null);
    }).catch(setError);
    api<Record<string, unknown>[]>(`/api/houses/${houseId}/reports/env-vs-yield${qs({ fromVnDate: todayVn(Date.now() - YEAR), toVnDate: todayVn(Date.now() + 86400000) })}`)
      .then(setReport).catch(setError);
  }, [houseId]);

  const load = useCallback(async () => {
    if (zoneId === null) return;
    try {
      setHarvests(await api<Harvest[]>(`/api/zones/${zoneId}/harvests`));
    } catch (e) {
      setError(e);
    }
  }, [zoneId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/api/zones/${zoneId}/harvests`, 'POST', {
        harvestDate: form.harvestDate, nestCount: Number(form.nestCount), weightGram: Number(form.weightGram),
        grade: form.grade || null,
      });
      setForm({ ...form, nestCount: '', weightGram: '' });
      await load();
    } catch (err) {
      setError(err);
    }
  }

  const columns = report && report.length ? Object.keys(report[0]) : [];
  return (
    <div className="grid gap-4">
      <Banner error={error} />
      <Card title="Thu hoạch">
        <select className={`${inputCls} mb-3`} value={zoneId ?? ''} onChange={(e) => setZoneId(Number(e.target.value))}>
          {zones.map((z) => <option key={z.zoneId} value={z.zoneId}>{z.name}</option>)}
        </select>
        <form onSubmit={add} className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col">Ngày (giờ VN)<input type="date" className={inputCls} value={form.harvestDate} required onChange={(e) => setForm({ ...form, harvestDate: e.target.value })} />
            <span className="text-xs text-red-700">{fieldError(error, 'harvestDate')}</span></label>
          <label className="flex flex-col">Số tổ<input type="number" min={0} className={`${inputCls} w-24`} value={form.nestCount} required onChange={(e) => setForm({ ...form, nestCount: e.target.value })} /></label>
          <label className="flex flex-col">Khối lượng (g)<input type="number" min={0} step="0.1" className={`${inputCls} w-28`} value={form.weightGram} required onChange={(e) => setForm({ ...form, weightGram: e.target.value })} /></label>
          <select className={inputCls} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
            <option value="">Chưa xếp loại</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
          </select>
          <button className={btnCls}>Thêm</button>
        </form>
        {harvests === null ? <Loading /> : harvests.length === 0 ? <Empty>Chưa có lần thu hoạch nào.</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Ngày</th><th>Số tổ</th><th>Khối lượng (g)</th><th>Loại</th><th>Nhập lúc</th></tr></thead>
            <tbody>{harvests.map((h) => (
              <tr key={h.harvestId} className="border-t"><td>{h.harvestDate}</td><td>{h.nestCount}</td><td>{h.weightGram}</td><td>{h.grade ?? ''}</td><td>{formatVn(h.createdAt)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <Card title="Môi trường ổn định và sản lượng (12 tháng)">
        {report === null ? <Loading /> : report.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead><tr className="text-left">{columns.map((c) => <th key={c} className="pr-3">{c}</th>)}</tr></thead>
              <tbody>{report.map((r, i) => (
                <tr key={i} className="border-t">{columns.map((c) => <td key={c} className="pr-3">{String(r[c] ?? '')}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Build, kiểm tay, commit**

Run: `npm run build` → đạt. Thêm một lần thu hoạch hôm nay cho H1-F1 → dòng mới, cột "Ngày" đúng ngày VN đã chọn.

```powershell
git add "web/app/houses/[houseId]/harvests/page.tsx"
git commit -m "feat(web): nhập thu hoạch theo ngày VN và bảng báo cáo môi trường với sản lượng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14 (dưới ranh giới cắt): Trang ẩn `/admin/tools`

**Files:**
- Create: `web/app/admin/tools/page.tsx`

**Interfaces:**
- Consumes: **PR hợp đồng có `POST /api/admin/anomalies/detect {"nowUtc"} → {"newAlerts":[…]}` đã merge** (plan backend Task 3) và backend Task 20; `AuthGate`, `useAuth` (Task 6); `vnInputToIso`, `msToVnInput`, `formatVn` (Task 2).
- Produces: trang `/admin/tools` (không có liên kết trên menu). OWNER → "Không tìm thấy trang" (chỉ ẩn ở client); 404 từ backend → "Công cụ demo đang tắt".

- [ ] **Step 1: Kiểm PR hợp đồng đã merge**

`Select-String -Path docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md -SimpleMatch -Pattern 'anomalies/detect'` có kết quả. Chưa có → **dừng**, báo TV2 dùng script PowerShell của backend cho demo (spec web 2.2).

- [ ] **Step 2: Viết `web/app/admin/tools/page.tsx`**

```tsx
'use client';
// Duoi ranh gioi cat: trang an cho demo, khong co lien ket tren menu. CHI an o client; bao ve that o backend
// (ADMIN + DEMO_TOOLS=true). Chi lam sau khi PR hop dong co POST /api/admin/anomalies/detect da merge (spec web 2.2).
import { useEffect, useState, type FormEvent } from 'react';
import { Banner, btnCls, Card, Empty, inputCls } from '@/components/ui';
import { api } from '@/lib/api';
import { AuthGate, useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { formatVn, msToVnInput, vnInputToIso } from '@/lib/time';
import type { Alert } from '@/lib/types';

function Tools() {
  const { session } = useAuth();
  const [nowLocal, setNowLocal] = useState('');
  const [result, setResult] = useState<Alert[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [off, setOff] = useState(false);

  useEffect(() => setNowLocal(msToVnInput(Date.now())), []);

  if (session.user.role !== 'ADMIN') return <main className="p-8"><Empty>Không tìm thấy trang</Empty></main>;

  async function run(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOff(false);
    try {
      const r = await api<{ newAlerts: Alert[] }>('/api/admin/anomalies/detect', 'POST', { nowUtc: vnInputToIso(nowLocal) });
      setResult(r.newAlerts);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setOff(true);
      else setError(err);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Card title="Công cụ demo — phát hiện bất thường">
        <form onSubmit={run} className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col">Thời điểm chạy (giờ VN)
            <input type="datetime-local" className={inputCls} value={nowLocal} required onChange={(e) => setNowLocal(e.target.value)} />
          </label>
          <button className={btnCls}>Chạy phát hiện bất thường</button>
        </form>
        {off ? <p className="mt-3 text-sm text-amber-700">Công cụ demo đang tắt</p> : null}
        <Banner error={error} />
        {result ? (
          result.length === 0 ? <Empty>Không có cảnh báo mới.</Empty> : (
            <ul className="mt-3 text-sm">{result.map((a) => <li key={a.alertId}>#{a.alertId} {a.message} · {formatVn(a.createdAt)}</li>)}</ul>
          )
        ) : null}
      </Card>
    </main>
  );
}

export default function AdminToolsPage() {
  return <AuthGate><Tools /></AuthGate>;
}
```

- [ ] **Step 3: Build, kiểm tay (checklist 3.2 bước 13), commit**

Run: `npm run build` → đạt. `owner1` mở `/admin/tools` → "Không tìm thấy trang"; gọi thẳng endpoint bằng token `owner1` → 403. `admin` với backend `DEMO_TOOLS=true` → chạy được, hiện danh sách cảnh báo mới (hoặc "Không có cảnh báo mới."); backend `DEMO_TOOLS=false` → "Công cụ demo đang tắt".

```powershell
git add web/app/admin/tools/page.tsx
git commit -m "feat(web): trang ẩn /admin/tools chạy phát hiện bất thường cho demo (chỉ ẩn ở client, backend chặn ADMIN)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Kiểm thử đầu-cuối bằng Playwright MCP (checklist 3.2), README đầy đủ

**Files:**
- Create: `web/results/e2e.md`
- Modify: `web/README.md`, `web/spikes/RESULTS.md`

**Interfaces:**
- Consumes: CSDL Dev vừa nạp dữ liệu mẫu (ngày neo hôm qua), Mosquitto, simulator (bật trước backend), backend; mật khẩu dev ở README database.

- [ ] **Step 1: Chạy đủ 15 bước của spec 3.2 bằng Playwright MCP**

Chạy bằng `npm run build; npm start` (bước 15 yêu cầu). Mỗi bước: thao tác bằng công cụ `browser_*` của Playwright MCP, chụp `browser_take_screenshot` khi bước có giao diện cần nhìn (lưu ngoài repo), ghi kết quả. Bước 9: tắt backend → thanh "Mất kết nối máy chủ, đang kết nối lại…"; bật lại → dữ liệu tải lại, không trùng số đo. Bước 10: dùng `Invoke-RestMethod` với token `admin` gọi `PATCH /api/users/<id owner1>` `{"isActive":false}` khi `owner1` đang mở web → web về `/login`; **mở khóa lại** sau khi kiểm. Bước 11: sửa `CORS_ORIGINS` của backend, build lại web với `NEXT_PUBLIC_API_URL=http://<IP LAN backend>:3000`.

- [ ] **Step 2: Ghi `web/results/e2e.md`**

```markdown
# Kiểm thử đầu-cuối web (spec web 3.2)

- Ngày: _…_ · Người làm: TV4 · Commit web: _…_ · Commit backend: _…_ · Trình duyệt: _…_

| # | Bước (spec 3.2) | Kết quả | Đạt |
|---|---|---|---|
| 1 | Đăng nhập sai → câu chung; `owner1` thấy nhà mình | | |
| 2 | `owner2` gõ URL nhà H1 → "Không tìm thấy" | | |
| 3 | Dashboard cập nhật mỗi 10–15 giây; ngoài ngưỡng đổi màu | | |
| 4 | `--scenario hot` → FAN H1-F2 bật rồi tắt | | |
| 5 | FAN Level 50 theo phản hồi; Level 0 → tắt (`isOn: false`); nhật ký; trả về tự động | | |
| 6 | ACK, RESOLVED; ACK lại → đã đổi trạng thái | | |
| 7 | Ảnh seed 404 → "Không có ảnh"; ảnh AI hiện; không còn object URL cũ | | |
| 8 | Min ≥ Max → lỗi ngưỡng | | |
| 9 | Tắt/bật backend → kết nối lại, không trùng, không mất cảnh báo | | |
| 10 | Khóa `owner1` qua API → web về `/login` | | |
| 11 | Mở bằng IP LAN từ máy khác | | |
| 12 | Ca trống, ca lỗi (5 ý) | | |
| 13 | `owner1` mở `/admin/tools` → không tìm thấy; API → 403 | | |
| 14 | Đăng xuất tab A, tab B vẫn dùng được | | |
| 15 | `next build` + `next start -p 3001` chạy đủ các bước | | |
```

Bước nào không đạt: `superpowers:systematic-debugging`; lỗi ở backend thì báo TV2, không sửa backend.

- [ ] **Step 3: Viết đủ `web/README.md`**

Các mục (tiếng Việt có dấu): cài đặt (`npm ci`, `.env.local`), chạy dev (cổng 3001), **demo bằng `npm run build` + `npm start`** (spec 3.3), `NEXT_PUBLIC_API_URL` gắn lúc build, `CORS_ORIGINS` của backend, mở bằng IP LAN (kết quả S3, tường lửa cổng 3001 mạng Private), mỗi tài khoản một tab, 7 hạn chế của spec 3.4 (nguyên văn ý), không có màn hình quản lý người dùng (tạo/khóa qua API, ví dụ `Invoke-RestMethod`), `/admin/tools` chỉ ẩn ở client, `npm test`.

- [ ] **Step 4: Kiểm tra cuối và commit**

- `npm test; npm run build` → đạt.
- `git status --short` không có `.env*`, `.next`, `node_modules`.
- `spikes/RESULTS.md` không còn dòng trống.
- Rà nhánh bằng `superpowers:requesting-code-review`; sửa vấn đề nghiêm trọng; mở PR `web` → `main`, ít nhất một người duyệt.

```powershell
git add web/results/e2e.md web/README.md web/spikes/RESULTS.md
git commit -m "docs(web): kết quả kiểm thử đầu-cuối 15 bước bằng Playwright, README đầy đủ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
