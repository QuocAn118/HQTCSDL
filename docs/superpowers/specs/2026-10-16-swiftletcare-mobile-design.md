# SwiftletCare — spec mobile

- **Chủ module:** TV4
- **Trạng thái:** Chờ duyệt (quyết định M1–M5 đã chốt; chờ đọc toàn văn)
- **Đọc trước:** [roadmap](2026-10-12-swiftletcare-roadmap.md) (mục mobile), [integration-contract](2026-10-13-swiftletcare-integration-contract-design.md) Phần 3 (REST, ảnh, checklist mạng) và Phần 4 (Socket.IO, ghép dữ liệu), [web](2026-10-16-swiftletcare-web-design.md) mục 2.3–2.4 (ba file hàm thuần chép sang mobile).

## Phần 1 — Phạm vi, môi trường, cấu trúc

### 1.1 Phạm vi

| Mức | Mục (đánh số theo roadmap mobile) | Màn hình |
|---|---|---|
| Bắt buộc 1 | Đăng nhập; dashboard số đo trực tiếp | Đăng nhập, tab Tổng quan |
| Bắt buộc 2 | Danh sách cảnh báo + ACK; thêm **RESOLVED** và **ảnh thiên địch** (hợp đồng 3.3 đã có, ít công) | Tab Cảnh báo, chi tiết cảnh báo |
| Bắt buộc 3 | Điều khiển tay | Tab Thiết bị |
| Nên có | Expo push notification → **không làm**; thay bằng **banner trong app** (mục 2.4) | |
| Nếu còn thời gian | Biểu đồ, nhập thu hoạch | Chưa làm |

- **Không có thông báo đẩy.** Báo cáo ghi rõ.
- **Không có màn hình quản lý người dùng**, giống web (web 1.1): demo dùng ba tài khoản seed.
- Không có quản lý nhà, khu vực, thiết bị hay ngưỡng; những việc đó làm trên web.

### 1.2 Môi trường và phiên bản

- **Expo SDK 58** (`expo` latest là 58.0.12, tra `npm view` ngày 16/10/2026), Expo Router, TypeScript.
- Phiên bản các gói Expo (`expo-router`, `expo-secure-store`, `expo-splash-screen`, `react-native`, …) **do `npx expo install` chọn cho SDK 58**. Plan ghi lại phiên bản thật đã cài, và `package.json` ghim chính xác. Không tự đoán.
- `socket.io-client` **4.8.3** (khớp server). `vitest` **5.0.5** (giống web).
- Chạy bằng **Expo Go** trên điện thoại thật hoặc Android Emulator. **Không build EAS.**
- Skill hỗ trợ: `expo-router`, `expo-ui`, `expo-data-fetching` (plugin expo); thiết kế theo `frontend-design`, `taste-skill`; kiểm thử bằng `mobile-mcp`.

**Ràng buộc Expo Go:**
- Expo Go trên store thường chỉ chạy SDK mới nhất. SDK 59 ra trước 09/11 mà Expo Go tự cập nhật thì app không mở được.
- Vì vậy điện thoại demo phải **tắt tự cập nhật Expo Go**, hoặc demo trên **Android Emulator cài Expo Go cố định phiên bản** (checklist 3.3).
- **iOS:** Expo Go trên iPhone có ràng buộc riêng (bản trên App Store, không cài được bản cũ). **Chưa kiểm chứng.** Cần hỏi nhóm ai có iPhone; nếu không ai có thì chỉ hỗ trợ Android.

### 1.3 `.env.example` và mạng

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

- Giá trị trên chỉ là ví dụ; mỗi máy điền **IP LAN của máy chạy backend**, không dùng `localhost` (hợp đồng 3.6).
- `EXPO_PUBLIC_API_URL` được gắn vào bundle khi Metro đóng gói. Đổi giá trị thì chạy lại `npx expo start -c`.
- Điện thoại và máy backend **cùng mạng Wi-Fi**; mở cổng 3000 trên Windows Defender Firewall (mạng Private).
- Kiểm tra trước: từ trình duyệt điện thoại mở `http://<IP LAN>:3000/api/health` thấy `{"status":"ok",…}`.
- Mobile không cần CORS: CORS chỉ áp cho trình duyệt.

### 1.4 Cấu trúc

```
mobile/
  package.json  package-lock.json  app.json  .env.example  README.md
  app/
    _layout.tsx               đọc token rồi mới chọn màn hình đầu (mục 2.1)
    login.tsx
    (tabs)/_layout.tsx        ba tab
    (tabs)/index.tsx          Tổng quan: chọn nhà, thẻ khu vực
    (tabs)/alerts.tsx         danh sách cảnh báo
    (tabs)/devices.tsx        điều khiển tay
    alerts/[alertId].tsx      chi tiết, ACK/RESOLVED, ảnh
  lib/
    api.ts       fetch kèm token; định dạng lỗi hợp đồng 3.4; 401 → đăng xuất
    session.ts   token trong expo-secure-store
    socket.ts    vòng đời Socket.IO + AppState (mục 2.3)
    time.ts      CHÉP từ web/lib/time.ts
    merge.ts     CHÉP từ web/lib/merge.ts
    errors.ts    CHÉP từ web/lib/errors.ts
  test/
    time.test.ts  merge.test.ts  errors.test.ts   CHÉP từ web/test
  scripts/check-copies.mjs    so băm ba file và test đã chép với bản web (mục 3.2)
```

### 1.5 Bước 1 của plan: kiểm trước khi viết code

1. **mobile-mcp kết nối được.** Hôm 15/10 nó báo lỗi CONNECT_TIMEOUT. Nếu vẫn không kết nối được thì kiểm tay theo checklist 3.1 và đo độ trễ theo cách dự phòng (mục 3.1).
2. Expo Go bản hiện tại trên điện thoại và trên emulator chạy được SDK 58; ghi lại phiên bản Expo Go.
3. `socket.io-client` 4.8.3 kết nối được từ Expo Go tới backend qua IP LAN.
4. `Intl.DateTimeFormat` với `timeZone: 'Asia/Ho_Chi_Minh'` chạy đúng trên Hermes, vì `time.ts` chép từ web dùng hàm này. Nếu không chạy được thì **sửa `time.ts` ở cả web và mobile** sang cách cộng 7 giờ (VN không có giờ mùa hè), để hai bản sao vẫn giống nhau. TV4 sửa cả hai bên (và spec web 2.3) trong cùng PR.
5. Thông báo cục bộ `expo-notifications` có chạy trong Expo Go SDK 58 không. Chỉ thử sau khi Bắt buộc 1–3 xong (mục 2.4).

## Phần 2 — Màn hình và luồng dữ liệu

### 2.1 Đăng nhập và phiên

- `POST /api/auth/login`. Lưu `accessToken`, `user`, `expiresAt = bây giờ + expiresIn` (8 giờ) bằng **`expo-secure-store`**. Tắt rồi mở lại app vẫn còn đăng nhập cho tới khi hết hạn.
- **Đọc token lúc khởi động, trước khi chọn màn hình đầu.**
  - `app/_layout.tsx` giữ màn hình chờ (`expo-splash-screen`) cho tới khi đọc xong.
  - Có token còn hạn thì vào tab Tổng quan; không thì vào Đăng nhập.
  - Nhờ vậy người dùng đã đăng nhập không thấy màn Đăng nhập nháy lên.
- **Xóa token** khi:
  - đăng xuất;
  - REST trả **401**;
  - socket báo `UNAUTHENTICATED`, hoặc bị server ngắt;
  - token hết hạn (kiểm cả lúc app trở lại từ nền).

  Sau khi xóa thì về màn Đăng nhập.
- Đăng nhập sai và tài khoản bị khóa: chung một câu báo, giống web.

### 2.2 Màn hình

| Màn hình | Hiển thị và thao tác | Endpoint, sự kiện |
|---|---|---|
| Tổng quan | Chọn nhà (nếu có nhiều nhà). Mỗi khu vực một thẻ: 4 chỉ số mới nhất, tô màu khi ra ngoài ngưỡng; trạng thái FAN/MIST/HEATER; huy hiệu `OFFLINE` khi thiết bị mất kết nối. Kéo xuống để tải lại | `latest-readings`, `devices`, `thresholds`; `readings.new`, `device.state` |
| Cảnh báo | Mặc định chỉ cảnh báo đang mở (`status=NEW,ACK`); có nút xem tất cả; phân trang `before` khi cuộn | `GET /api/alerts`; `alert.created`, `alert.updated` |
| Chi tiết cảnh báo | Thông tin và `history`; nút ACK, RESOLVED kèm ghi chú; ảnh khi `hasSnapshot` | `GET/PATCH /api/alerts/:id`, `GET …/snapshot` |
| Thiết bị | Theo khu vực: bật/tắt; Level FAN theo các bước 0/25/50/75/100; "Trả về tự động" | `POST /api/devices/:id/control`; `device.state` |

- **Ảnh:** `<Image source={{ uri, headers: { Authorization: 'Bearer …' } }} />` (hợp đồng 3.3). Lỗi tải ảnh thì hiện "Không có ảnh".
- **Điều khiển tay:** giống web 2.2. Gửi `mode: "MANUAL"` kèm `isOn` (và `level` cho FAN); cập nhật giao diện **từ phản hồi**, không đoán trước.
- **Lỗi:** dùng `errors.ts` chép từ web, cùng cách xử lý như bảng ở web 2.2. Không hiện `message` thô của server.
- **Thời gian:** dùng `time.ts` chép từ web, cùng ba loại ở web 2.3.

### 2.3 Socket và vòng đời app

- Giống web 2.4: `io(EXPO_PUBLIC_API_URL, { auth: { token } })`.
  - Mỗi lần kết nối lại thì đặt token hiện tại vào `socket.auth`.
  - `UNAUTHENTICATED` hoặc bị server ngắt → xóa token, về Đăng nhập.
  - `RETRY_LATER` hoặc lỗi khác → tự `connect()` lại, giãn dần 2 → 30 giây.
- **`AppState`:**
  - App vào nền → **đóng socket**.
  - App trở lại → kiểm hạn token, **kết nối lại, rồi tải lại bằng REST** theo đúng thứ tự ghép của web 2.4: nghe trước, gọi REST, ghép bằng `merge.ts`, và áp lại sự kiện đã giữ cho trạng thái thiết bị.
- Đăng xuất → đóng socket.

### 2.4 Banner cảnh báo trong app

- Khi nhận `alert.created`, hiện **banner trong app** (toast ở đầu màn hình) kèm **rung ngắn** bằng `Vibration` có sẵn trong React Native, không thêm thư viện. Chạm banner thì mở chi tiết cảnh báo.
- Banner **chỉ có tác dụng khi app đang mở**, vì socket đóng khi app vào nền. Đây không phải thông báo đẩy.
- `expo-notifications` (thông báo cục bộ) **chỉ dùng khi Bắt buộc 1–3 đã xong và đã kiểm chứng chạy trong Expo Go SDK 58** (bước 1.5.5). Có dùng thì cũng chỉ khi app đang mở.

## Phần 3 — Test, checklist, hạn chế

### 3.1 Test

**Vitest** (`npm test`):
1. Chạy `scripts/check-copies.mjs` (mục 3.2).
2. Chạy ba file test chép từ web (`time`, `merge`, `errors`) trên ba bản sao của mobile.

Không có test component.

**Kiểm đầu-cuối bằng mobile-mcp theo checklist.** Chạy với CSDL Dev có dữ liệu mẫu, cùng Mosquitto, simulator và backend. Mật khẩu dev ghi trong README database.

1. Mở app lần đầu → Đăng nhập. Đăng nhập `owner1` → tab Tổng quan, chỉ thấy nhà của mình.
2. Tắt rồi mở lại app → vào thẳng Tổng quan, **không nháy màn Đăng nhập**.
3. Số đo cập nhật trực tiếp khi simulator chạy.
4. `--scenario hot` → FAN H1-F2 bật rồi tắt trên tab Thiết bị.
5. Điều khiển tay FAN Level 50, rồi "Trả về tự động".
6. ACK rồi RESOLVED một cảnh báo. Cảnh báo thiên địch của seed hiện ảnh.
7. Có cảnh báo mới khi app đang mở → banner và rung; chạm banner → mở chi tiết.
8. Đưa app vào nền 1 phút rồi mở lại → dữ liệu tải lại, không trùng, không mất cảnh báo.
9. Tắt backend → thanh "đang kết nối lại"; bật lại → tự kết nối.
10. ADMIN khóa `owner1` qua API → app về Đăng nhập.
11. **Đo độ trễ:** dùng `latency-probe` (backend 7.3) publish số đo vượt ngưỡng, ghi thời điểm banner hiện. Mục tiêu 3–5 giây. Ghi số mẫu, giá trị nhỏ nhất, trung vị, lớn nhất.

**Nếu mobile-mcp không kết nối được:** kiểm tay theo cùng checklist. Đo độ trễ bằng **quay màn hình điện thoại** có đồng hồ hiển thị, hoặc ghi thời điểm hiển thị bằng log của app. **Báo cáo ghi rõ số đo này chỉ mang tính tham khảo.**

### 3.2 Chống lệch bản sao (`scripts/check-copies.mjs`)

- So **băm SHA-256** của sáu cặp file: `lib/{time,merge,errors}.ts` và `test/{time,merge,errors}.test.ts` giữa `mobile/` và `web/`. Trước khi băm, đổi `CRLF` thành `LF` để Git trên Windows không gây báo sai.
- Khác nhau → **in cảnh báo** nêu tên file; **không làm fail** `npm test`.
- Chưa có thư mục `web/` (VD mobile làm trước) → in "bỏ qua kiểm bản sao", tiếp tục chạy test.
- Dùng `node:crypto` và `node:fs` có sẵn, không thêm thư viện.
- Sửa một bên thì chép sang bên kia **trong cùng PR**.

### 3.3 Checklist demo (gộp vào checklist backend 7.4)

1. **Tắt tự cập nhật Expo Go** trên điện thoại demo (Play Store → Expo Go → bỏ chọn tự cập nhật), hoặc dùng **Android Emulator có Expo Go cố định phiên bản**.
2. Điện thoại cùng Wi-Fi với máy backend; firewall đã mở cổng 3000; `/api/health` mở được từ điện thoại.
3. `EXPO_PUBLIC_API_URL` đúng IP LAN của hôm demo (IP có thể đổi khi đổi mạng), chạy `npx expo start -c` sau khi sửa.
4. Mở app và để app **ở tiền cảnh** trong lúc demo cảnh báo; app ở nền thì không có banner.

### 3.4 Hạn chế

1. **Không có thông báo đẩy**; banner chỉ hiện khi app đang mở.
2. Phụ thuộc Expo Go: SDK mới có thể làm app không mở được nếu Expo Go tự cập nhật.
3. iOS chưa kiểm chứng (mục 1.2).
4. Ba file hàm thuần chép từ web có thể lệch nhau; `check-copies` chỉ cảnh báo.
5. Không có quản lý nhà, khu vực, thiết bị, ngưỡng, người dùng; không có biểu đồ.
6. Số đo độ trễ chỉ mang tính tham khảo nếu phải đo bằng quay màn hình.

### 3.5 Chưa kiểm chứng

- mobile-mcp kết nối được (bước 1.5.1).
- Expo Go trên iOS; Expo Go không tự cập nhật khi đã tắt.
- `socket.io-client` 4.8.3 trong Expo Go (bước 1.5.3).
- `Intl.DateTimeFormat` có `timeZone` trên Hermes (bước 1.5.4).
- `expo-notifications` trong Expo Go SDK 58 (bước 1.5.5).
