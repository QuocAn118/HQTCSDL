# SwiftletCare — spec web

- **Chủ module:** TV4
- **Trạng thái:** Đã duyệt
- **Đọc trước:** [roadmap](2026-10-12-swiftletcare-roadmap.md) (mục web), [integration-contract](2026-10-13-swiftletcare-integration-contract-design.md) Phần 3 (REST, mã lỗi, checklist mạng) và Phần 4 (Socket.IO, ghép dữ liệu), [backend](2026-10-15-swiftletcare-backend-design.md) Phần 5–6.

## Phần 1 — Phạm vi, môi trường, cấu trúc

### 1.1 Phạm vi

| Mức | Mục (đánh số theo roadmap web) | Màn hình |
|---|---|---|
| Bắt buộc 1 | Đăng nhập; dashboard số đo trực tiếp | `/login`, `/houses`, `/houses/[houseId]` |
| Bắt buộc 2 | Điều khiển tay cơ cấu chấp hành | `/houses/[houseId]/devices` |
| Bắt buộc 3 | Danh sách cảnh báo, ACK/RESOLVED, ảnh thiên địch | `/houses/[houseId]/alerts` |
| Bắt buộc 4 | Quản lý nhà, khu vực, thiết bị, ngưỡng | `/houses/[houseId]/settings`, tạo nhà ở `/houses` |
| Bắt buộc 5 | Biểu đồ lịch sử môi trường và đếm chim ra/vào | `/houses/[houseId]/history` |
| Dưới ranh giới cắt 6 | Nhập thu hoạch, báo cáo tương quan | `/houses/[houseId]/harvests` |
| Dưới ranh giới cắt 7 | Hiển thị trạng thái mất kết nối | Huy hiệu `OFFLINE` trên dashboard và trang thiết bị (mục 2.2) |
| Dưới ranh giới cắt (thêm) | Trang ẩn cho demo: chạy phát hiện bất thường | `/admin/tools`, chỉ ADMIN (mục 2.2) |
| Nên có | Xem khung hình có khung bao | Chưa làm |
| Nếu còn thời gian | Xuất Excel/PDF | Chưa làm |

**Ngoài phạm vi: màn hình quản lý người dùng của ADMIN.**
- Hợp đồng 3.3 có endpoint `/api/users` (ADMIN), nhưng **roadmap web không có mục quản lý người dùng** trong Bắt buộc, dưới ranh giới cắt hay Nên có.
- Web không làm màn hình này. Tạo, khóa, đổi vai trò hoặc đặt lại mật khẩu: dùng tài khoản trong dữ liệu mẫu hoặc gọi thẳng API (VD `Invoke-RestMethod` trong PowerShell).
- Muốn thêm thì phải sửa roadmap trước; đó là quyết định của nhóm.

**Ngoài phạm vi: phát video đầu ra có khung bao của ai-vision.**
- Lệnh `offline --annotated-video` của ai-vision (spec ai-vision 4.5) chỉ ghi file video trên máy chạy AI. Web **không phát** video này: không có endpoint nào phục vụ file video, hợp đồng không có.
- Khung bao chỉ hiện trên web qua **ảnh thiên địch** (`hasSnapshot`, ảnh do AI vẽ sẵn khung bao). Muốn trình chiếu video khi demo thì mở file bằng trình phát video trên máy chạy AI.

**Vai trò:**
- OWNER thấy các nhà của mình.
- ADMIN thấy mọi nhà, và thêm trang ẩn `/admin/tools` (dưới ranh giới cắt).
- Không có giao diện nào khác riêng cho ADMIN.

### 1.2 Môi trường và phiên bản

Tra bằng `npm view` ngày 16/10/2026. Mọi phiên bản **ghim chính xác**.

| Gói | Phiên bản | Ghi chú |
|---|---|---|
| `next` | **15.5.28** | Nhánh backport, phát hành 14/10/2026; latest là 16.4.2 (không dùng, lùi một bản lớn giống Nest 11) |
| `react`, `react-dom` | 19.3.1 | Peer của Next 15.5.28: `^19.0.0` |
| `typescript` | 5.9.3 | **Không dùng 7.0.2** (latest): Next 15 với TypeScript 7 chưa kiểm chứng |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 | |
| `recharts` | 3.10.1 | Cần peer `react-is`, ghim **19.3.1** cho khớp `react` |
| `socket.io-client` | 4.8.3 | Khớp server 4.8.3 của backend |
| `vitest` | 5.0.5 | Chỉ cho test hàm thuần (mục 3.1) |

**Ứng dụng chỉ chạy ở trình duyệt:**
- App Router. Các trang là client component (`"use client"`).
- Trình duyệt gọi thẳng backend.
- Không dùng API route, server action, middleware hay proxy của Next.

### 1.3 `.env.example`, cổng, CORS

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

- Web chạy cổng **3001**: `next dev -p 3001`. Khi demo dùng **`next build` rồi `next start -p 3001`**.
- `NEXT_PUBLIC_API_URL` được **gắn cố định lúc chạy `next dev` / lúc `next build`**. Đổi giá trị thì phải chạy lại `next dev`, hoặc build lại trước khi `next start`.
- `CORS_ORIGINS` của backend phải có địa chỉ web (`http://localhost:3001`, hợp đồng 3.6). Danh sách này áp cho cả REST và Socket.IO.
- **Truy cập từ máy khác trong LAN:**
  - `NEXT_PUBLIC_API_URL=http://<IP LAN máy backend>:3000`.
  - `CORS_ORIGINS` của backend thêm `http://<IP LAN máy web>:3001`, rồi khởi động lại backend.
  - Mở cổng 3001 trên Windows Defender Firewall (mạng Private).

### 1.4 Cấu trúc

```
web/
  package.json  package-lock.json  .env.example  README.md  next.config.ts  postcss.config.mjs
  app/
    layout.tsx  globals.css
    login/page.tsx
    houses/page.tsx                     danh sách nhà, tạo nhà
    houses/[houseId]/page.tsx           dashboard
    houses/[houseId]/devices/page.tsx   điều khiển tay, nhật ký điều khiển
    houses/[houseId]/alerts/page.tsx    danh sách, chi tiết, ACK/RESOLVED, ảnh
    houses/[houseId]/history/page.tsx   biểu đồ môi trường, đếm chim
    houses/[houseId]/settings/page.tsx  nhà, khu vực, thiết bị, ngưỡng
    houses/[houseId]/harvests/page.tsx  dưới ranh giới cắt
    admin/tools/page.tsx                dưới ranh giới cắt, không có liên kết trên menu
  lib/
    api.ts      fetch kèm token; đọc định dạng lỗi hợp đồng 3.4; 401 → đăng xuất
    session.ts  token trong sessionStorage
    socket.ts   vòng đời Socket.IO (mục 2.4)
    time.ts     hàm thuần: đọc, so sánh, hiển thị thời gian (mục 2.3)
    merge.ts    hàm thuần: ghép REST với sự kiện (mục 2.4)
    errors.ts   mã lỗi → câu tiếng Việt
  test/*.test.ts
```

- Giao diện bằng **tiếng Việt**.
- Khi thiết kế màn hình: phác bằng `stitch`, làm theo `frontend-design` và `taste-skill`. Kiểm thử bằng `playwright` (CLAUDE.md).

### 1.5 Bước 1 của plan: kiểm trước khi viết code

1. Nhánh Next 15.5 **còn được vá bảo mật tới khi nào**. Nếu hết hạn trước 09/11/2026, báo lại để chọn lại.
2. Recharts 3.10.1 vẽ được với React 19.3.1 và Tailwind 4.3.3; `next build` không cảnh báo peer. Có cảnh báo thì thử React 19.2.9 rồi báo lại.
3. Mở web bằng IP LAN (`http://<IP>:3001`). `next dev` có thể cảnh báo hoặc chặn truy cập khác nguồn; nếu vậy ghi cách xử lý vào README web. Thử cả `next start`.
4. Socket.IO 4.8.3 khi middleware server từ chối: client có tự kết nối lại không (mục 2.4).
5. Vitest 5.0.5 chạy được file test `.ts` với TypeScript 5.9.3; không được thì ghi cách cấu hình vào plan.

## Phần 2 — Màn hình và luồng dữ liệu

### 2.1 Đăng nhập và phiên

- `POST /api/auth/login`. Lưu `accessToken`, `user`, và `expiresAt = bây giờ + expiresIn` (28800 giây = 8 giờ) vào **`sessionStorage`**.
- **Chỉ đọc `sessionStorage` trong `useEffect`.** Nếu đọc lúc render thì kết quả phía server khác phía trình duyệt, gây lỗi hydration. Trước khi đọc xong thì hiện trạng thái đang tải; không có token thì chuyển về `/login`.
- **Hết phiên:**
  - Hẹn giờ tới `expiresAt` thì đăng xuất, báo "phiên đã hết hạn".
  - Mọi phản hồi REST **401** thì đăng xuất, về `/login`. Lỗi 401 xảy ra khi token hết hạn, tài khoản bị khóa hoặc token sai.
- **Đăng xuất:** xóa `sessionStorage`, **đóng socket**, về `/login`.
- Đăng nhập sai và tài khoản bị khóa cùng trả một lỗi 401; web hiện chung một câu "Sai tên đăng nhập hoặc mật khẩu".
- **Hạn chế:** `sessionStorage` mất khi đóng tab và **không chia sẻ giữa các tab**; mở tab mới phải đăng nhập lại. **Đăng xuất ở một tab không lan sang tab khác**: tab kia vẫn dùng token của nó cho tới khi hết hạn hoặc gặp 401.

### 2.2 Màn hình

| Trang | Hiển thị và thao tác | Endpoint |
|---|---|---|
| `/houses` | Danh sách nhà. Chỉ có một nhà thì vào thẳng dashboard. Tạo nhà | `GET/POST /api/houses` |
| Dashboard | Thẻ cho từng khu vực: TEMP, HUMID, CO2, LIGHT mới nhất, tô màu khi ra ngoài ngưỡng; trạng thái FAN/MIST/HEATER/SPEAKER; số cảnh báo đang mở. Cập nhật trực tiếp | `latest-readings`, `devices`, `thresholds`, `alerts?status=NEW,ACK`; sự kiện `readings.new`, `device.state`, `alert.*` |
| Thiết bị | Bật/tắt; thanh Level cho FAN (0–100); chuyển `MANUAL`/`AUTO`; nhật ký điều khiển phân trang | `POST /api/devices/:id/control`, `GET …/control-logs?before=` |
| Cảnh báo | Lọc theo trạng thái và loại; phân trang `before`; chi tiết kèm `history`; ACK/RESOLVED kèm ghi chú; ảnh khi `hasSnapshot` | `GET /api/alerts`, `GET/PATCH /api/alerts/:id`, `GET …/snapshot` |
| Lịch sử | Biểu đồ số đo: chọn khu vực, chỉ số, khoảng thời gian, `bucketMinutes`. Thống kê theo ngày. Biểu đồ đếm chim ra/vào theo ngày | `readings`, `daily-stats`, `bird-flow`; sự kiện `birdcount.updated` |
| Huy hiệu `OFFLINE` (cắt, mục 7) | **Chỉ hiện cho SENSOR**, theo `status` của thiết bị. Cơ cấu chấp hành và camera **mặc định OFFLINE trong dữ liệu mẫu** và chỉ cập nhật khi có heartbeat, nên **chỉ hiện huy hiệu cho chúng khi mục heartbeat (dưới ranh giới cắt của simulator, backend, ai-vision) đã làm**; chưa làm thì **ẩn trạng thái online** của chúng | `devices` (trường `status`) |
| Cài đặt | Sửa nhà; thêm/sửa khu vực; thêm thiết bị, đổi tên, ngừng dùng; sửa ngưỡng Min/Max/Target | `PATCH houses`, `POST/PATCH zones`, `POST/PATCH devices`, `PUT thresholds/:metricCode`, `GET /api/metrics` |
| Thu hoạch (cắt) | Nhập thu hoạch theo `harvestDate`; bảng báo cáo tương quan | `harvests`, `reports/env-vs-yield` |
| `/admin/tools` (cắt) | Ô nhập `nowUtc` (mặc định: bây giờ), nút "Chạy phát hiện bất thường", hiện `newAlerts` | `POST /api/admin/anomalies/detect` |

**Trang `/admin/tools`:**
- Không có liên kết trên menu. OWNER mở thì hiện "Không tìm thấy trang".
- **Việc ẩn chỉ nằm ở phía client** (đọc `user.role` trong phiên), không phải biện pháp bảo vệ. **Bảo vệ thật nằm ở backend**: endpoint yêu cầu ADMIN (OWNER nhận 403) và chỉ bật khi `DEMO_TOOLS=true`.
- Backend chỉ bật endpoint khi `DEMO_TOOLS=true`; ngược lại trả 404, web hiện "Công cụ demo đang tắt".
- Endpoint này **chưa có trong hợp đồng** (việc 2 của PR hợp đồng, backend 7.6). Chỉ làm sau khi PR đó merge.
- **Nếu web chưa kịp làm trang này:** dùng script PowerShell trong `backend/scripts/` gọi endpoint cho demo. Script thuộc module backend, nên TV4 báo TV2.

**Điều khiển tay:**
- Thao tác gửi `mode: "MANUAL"` kèm `isOn` (và `level` cho FAN).
- **FAN (giống mobile):** Level 0 → gửi `isOn: false` (không gửi `level`); Level khác 0 → gửi `isOn: true` kèm `level`. Không có trạng thái "bật, Level 0".
- Nút "Trả về tự động" gửi `{mode: "AUTO"}`; hợp đồng cho phép bỏ `isOn`.
- Cập nhật giao diện **từ phản hồi** `{changed, deviceCode, mode, isOn, level}`, không đoán trước.

**Lỗi thường gặp:**

| Mã | Web làm gì |
|---|---|
| 409 `ALERT_INVALID_TRANSITION` | Báo "cảnh báo đã đổi trạng thái", tải lại cảnh báo |
| 409 `DEVICE_NOT_CONTROLLABLE` | Báo thiết bị đã ngừng dùng |
| 400 `CONSTRAINT_VIOLATION` | Báo ngưỡng không hợp lệ (VD Min ≥ Max) |
| 409 `DUPLICATE` | Báo trùng tên hoặc trùng mã |
| 400 `VALIDATION_ERROR` | Hiện `details` cạnh trường sai |
| 404 `NOT_FOUND` | Trang "Không tìm thấy". OWNER gõ URL nhà người khác cũng nhận 404, không biết nhà đó có tồn tại |
| 503 `RETRY_LATER` | Báo "hệ thống bận" kèm nút "Thử lại". Không tự gửi lại thao tác ghi |
| Mất mạng | Thanh báo "không kết nối được máy chủ" |

`errors.ts` đổi `code` sang câu tiếng Việt. **Không hiện `message` thô** của server.

### 2.3 Thời gian

Có **ba loại** giá trị, mỗi loại một cách xử lý:

| Loại | Ví dụ | Cách xử lý |
|---|---|---|
| Mốc ISO (UTC) | `…T10:40:00.000Z` (Prisma), `…T10:40:00Z` (cột JSON của SP) | Đọc bằng `new Date(s)`. **So sánh bằng `getTime()`, không so chuỗi**, vì hai dạng so chuỗi sẽ sai. Hiển thị: **cộng 7 giờ** rồi lấy các trường bằng `getUTC*()`, **định dạng thủ công `dd/MM/yyyy HH:mm`**. **Không dùng `Intl`**, để bản chép sang mobile không phụ thuộc engine Hermes (mobile 2.2) |
| Ngày nghiệp vụ VN | `DayVn`, `harvestDate`, `fromVnDate`, `toVnDate` dạng `YYYY-MM-DD` | **Luôn giữ là chuỗi, không bao giờ đổi qua `Date`**; đổi qua `Date` sẽ lệch ngày theo múi giờ máy |
| Giờ người dùng nhập | Khoảng thời gian của biểu đồ, `nowUtc` ở `/admin/tools` | Người dùng nhập theo giờ VN qua `<input type="datetime-local">`, giá trị dạng `YYYY-MM-DDTHH:mm`. **Không đưa chuỗi này vào `new Date`**, vì trình duyệt hiểu nó theo múi giờ máy. Tách số bằng biểu thức chính quy, rồi `Date.UTC(năm, tháng − 1, ngày, giờ − 7, phút)` (VN không có giờ mùa hè), gửi dạng ISO có `Z` |

- "Hôm nay theo giờ VN" (giá trị mặc định cho ô ngày) **cộng 7 giờ** vào thời điểm hiện tại rồi lấy `getUTCFullYear/Month/Date`, ra `YYYY-MM-DD`.
- Không dùng múi giờ của máy chạy trình duyệt ở bất kỳ đâu.

### 2.4 Dữ liệu trực tiếp (Socket.IO)

**Vòng đời socket** (`lib/socket.ts`):
- Mở sau khi đăng nhập: `io(NEXT_PUBLIC_API_URL, { auth: { token } })`.
- **Mỗi lần kết nối lại**, đặt `socket.auth.token` = token hiện tại trong `sessionStorage`.
- **Đăng xuất thì đóng socket** (`disconnect()`).

| Tình huống | Web làm gì |
|---|---|
| `connect_error`, `data.code = UNAUTHENTICATED` | Đăng xuất, về `/login` |
| `connect_error`, `data.code = RETRY_LATER` hoặc lỗi khác | **Tự gọi `socket.connect()`, giãn dần 2 → 4 → 8 → 16 → 30 giây**, sau đó giữ 30 giây |
| `disconnect` do server ngắt (`io server disconnect`: khóa tài khoản, đổi vai trò, token hết hạn) | Coi như UNAUTHENTICATED: đăng xuất, về `/login` |
| Mất kết nối mạng (`transport close`, …) | Socket.IO tự kết nối lại; hiện thanh "đang kết nối lại" |

Khi middleware server từ chối, Socket.IO 4 được cho là **không tự kết nối lại**, nên với `RETRY_LATER` web phải tự thử lại. Điều này **chưa kiểm chứng**; bước 1.5.4 của plan sẽ thử.

**Ghép dữ liệu khi kết nối** (hợp đồng 4.1). Mỗi lần `connect`, kể cả lần đầu:
1. **Nghe sự kiện trước.**
2. Gọi REST lấy dữ liệu của trang đang mở: số đo mới nhất, thiết bị, cảnh báo đang mở.
3. Ghép bằng các hàm thuần trong `lib/merge.ts`:

| Dữ liệu | Quy tắc |
|---|---|
| Số đo mới nhất | Theo (`deviceId`, `metric`): **bỏ số đo có `at` cũ hơn hoặc bằng** cái đang có |
| Số đo trên biểu đồ | Chỉ nối khi khoảng đang xem chứa thời điểm hiện tại; **khử trùng theo (`deviceId`, `metric`, `at`)** |
| Cảnh báo | **Gộp theo `alertId`.** `alert.created` thêm mới. Trạng thái chỉ tiến NEW → ACK → RESOLVED: dữ liệu mang trạng thái lùi thì bỏ |
| Trạng thái thiết bị | REST `devices` **không có mốc thời gian trạng thái** (bảng Devices không có cột này), nên không so được `at`. Cách làm: giữ các `device.state` đến **trong lúc REST đang tải**; REST xong thì áp kết quả REST, rồi **áp lại các sự kiện đã giữ theo thứ tự đến**; sau đó áp sự kiện trực tiếp. Sự kiện trên một socket đến đúng thứ tự, nên sự kiện cuối luôn là trạng thái mới nhất. **Việc áp lại phải idempotent**: mỗi sự kiện ghi đè toàn bộ trạng thái (`mode`, `isOn`, `level`), không cộng dồn hay đảo trạng thái, nên áp một trạng thái REST đã có sẵn không gây hại |
| Đếm chim | `birdcount.updated` → tải lại `bird-flow`, gom các sự kiện trong 2 giây thành một lần tải |

**Ảnh thiên địch** (hợp đồng 3.3):
- `fetch` `GET /api/alerts/:id/snapshot` kèm `Authorization`, nhận `blob`, tạo `URL.createObjectURL`, gán cho `<img>`.
- **`URL.revokeObjectURL`** khi component unmount hoặc khi chuyển sang ảnh khác.
- 404 thì hiện "Không có ảnh".

## Phần 3 — Test, checklist, hạn chế

### 3.1 Test đơn vị (Vitest, chỉ hàm thuần)

| File | Khẳng định |
|---|---|
| `time.test.ts` | Hai dạng `…00.000Z` và `…00Z` của cùng mốc cho cùng `getTime()`; hiển thị `dd/MM/yyyy HH:mm` đúng giờ VN (`2026-10-12T10:40:00Z` → `12/10/2026 17:40`); **qua nửa đêm** (`2026-10-12T18:30:00Z` → `13/10/2026 01:30`); **đầu tháng** (`2026-10-31T17:00:00Z` → `01/11/2026 00:00`); **cuối năm** (`2026-12-31T17:00:00Z` → `01/01/2027 00:00`); chuỗi `YYYY-MM-DD` giữ nguyên; giờ VN nhập vào → ISO UTC có `Z` (`2026-11-01T03:00` → `2026-10-31T20:00:00Z`; `2027-01-01T05:00` → `2026-12-31T22:00:00Z`); "hôm nay VN" lúc `2026-12-31T18:00:00Z` là `2027-01-01` |
| `merge.test.ts` | Số đo cũ hơn hoặc bằng bị bỏ; biểu đồ khử trùng; cảnh báo RESOLVED không bị NEW/ACK ghi đè; `alert.created` trùng `alertId` không nhân đôi; trạng thái thiết bị: REST rồi áp lại sự kiện đã giữ thì ra trạng thái của sự kiện cuối; áp lại cùng một sự kiện hai lần, hoặc áp sự kiện trùng với trạng thái REST, cho kết quả không đổi (idempotent) |
| `errors.test.ts` | Mỗi mã lỗi ở 2.2 ra đúng câu; mã lạ ra câu chung |
| `socket.test.ts` | Dãy giãn cách 2, 4, 8, 16, 30, 30; phân loại `connect_error` và `disconnect` đúng hành động ở 2.4 |

### 3.2 Kiểm thử đầu-cuối bằng Playwright MCP (theo checklist, không commit test)

Chạy với CSDL Dev vừa nạp dữ liệu mẫu, cùng Mosquitto, simulator và backend (**bật simulator trước backend**, backend 7.4). Mật khẩu dev ghi trong README database.

1. Đăng nhập sai → câu báo chung. Đăng nhập `owner1` → thấy nhà của mình.
2. `owner2` gõ URL nhà H1 → trang "Không tìm thấy".
3. Dashboard: số đo cập nhật **mỗi 10–15 giây** khi simulator chạy (simulator gửi mỗi 10 giây); ngoài ngưỡng thì đổi màu.
4. Simulator `--scenario hot` → FAN H1-F2 bật rồi tắt trên dashboard.
5. Điều khiển tay FAN Level 50 → trạng thái theo phản hồi; nhật ký có dòng mới; "Trả về tự động" chạy được.
6. ACK rồi RESOLVED một cảnh báo; thử ACK lại → báo cảnh báo đã đổi trạng thái.
7. Cảnh báo thiên địch của seed: file ảnh không có trong `backend/storage` nên snapshot trả **404 → "Không có ảnh"**. Với cảnh báo do AI gửi thật thì ảnh hiện được; chuyển trang thì không còn object URL (xem tab Memory hoặc console).
8. Sửa ngưỡng Min ≥ Max → báo lỗi ngưỡng.
9. Tắt backend → thanh "đang kết nối lại"; bật lại → dữ liệu tải lại, không trùng số đo, không mất cảnh báo.
10. ADMIN khóa `owner1` qua API khi `owner1` đang mở web → web về `/login`.
11. Mở web bằng IP LAN từ máy khác (sau khi sửa `CORS_ORIGINS`).
12. **Ca trống, ca lỗi:** khu vực chưa có số đo → "Chưa có số đo"; danh sách cảnh báo rỗng → "Không có cảnh báo"; biểu đồ khoảng thời gian không có dữ liệu → "Không có dữ liệu"; tắt mạng khi đang ở trang Cảnh báo → thanh báo mất kết nối, không trắng trang; ảnh 404 → "Không có ảnh".
13. `owner1` mở `/admin/tools` → "Không tìm thấy trang"; gọi thẳng endpoint bằng token `owner1` → backend trả 403.
14. Đăng xuất ở tab A, tab B vẫn dùng được (hạn chế 1, đúng thiết kế).
15. `next build` + `next start -p 3001` chạy được toàn bộ các bước trên.

### 3.3 Checklist demo (gộp vào checklist backend 7.4)

1. Demo chạy bằng `next build` + `next start -p 3001`, không dùng `next dev`.
2. Đổi IP hoặc cổng thì build lại web và sửa `CORS_ORIGINS` của backend.
3. Mở web trong một tab cho mỗi tài khoản (`sessionStorage` không chia sẻ giữa các tab).

### 3.4 Hạn chế

1. `sessionStorage` mất khi đóng tab, không chia sẻ giữa các tab; đăng xuất không lan sang tab khác.
2. **Không có màn hình quản lý người dùng** (mục 1.1): demo chỉ dùng ba tài khoản seed (`admin`, `owner1`, `owner2`); tạo, khóa hoặc đổi vai trò tài khoản qua API. **Báo cáo ghi rõ hạn chế này.**
3. Không có thông báo đẩy; cảnh báo chỉ hiện khi đang mở web.
4. Trạng thái thiết bị sau khi kết nối lại dựa vào thứ tự sự kiện (mục 2.4), không dựa vào mốc thời gian.
5. `NEXT_PUBLIC_API_URL` cố định lúc build.
6. `/admin/tools` chỉ ẩn ở client; bảo vệ thật ở backend.
7. Huy hiệu `OFFLINE` chỉ cho SENSOR nếu chưa làm heartbeat.

### 3.5 Phụ thuộc vào module khác

- Trang `/admin/tools` cần endpoint `POST /api/admin/anomalies/detect` (PR hợp đồng, backend 7.6, việc 2). Phương án dự phòng là script PowerShell trong `backend/scripts/`, do TV2 làm.
- Backend phải có địa chỉ web trong `CORS_ORIGINS` (backend Phần 2).
- Socket.IO: mã lỗi `data.code` khi bắt tay và việc ngắt kết nối khi đổi vai trò nằm trong PR hợp đồng (việc 5).

### 3.6 Chưa kiểm chứng

- Thời hạn vá của nhánh Next 15.5 (bước 1.5.1).
- Recharts 3.10.1 với React 19.3.1 và Tailwind 4.3.3 (bước 1.5.2).
- Cảnh báo hoặc chặn khác nguồn của `next dev` khi mở bằng IP LAN (bước 1.5.3).
- Socket.IO 4.8.3 không tự kết nối lại sau khi middleware từ chối (bước 1.5.4).
- Vitest 5.0.5 với TypeScript 5.9.3 (bước 1.5.5).
