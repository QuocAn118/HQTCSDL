# web

Giao diện web SwiftletCare: Next.js 15.5, chỉ chạy phía trình duyệt, gọi backend qua REST và nhận dữ liệu trực tiếp qua Socket.IO.

Spec: `docs/superpowers/specs/2026-10-16-swiftletcare-web-design.md`. Plan: `docs/superpowers/plans/2026-10-16-swiftletcare-web.md`. Kết quả kiểm thử đầu-cuối: `web/results/e2e.md`. Kết quả các bước kiểm chứng: `web/spikes/RESULTS.md`.

## Cài đặt

Cần backend, SQL Server và Mosquitto đang chạy (xem README của từng module). Tài khoản dev: `admin`, `owner1`, `owner2`, mật khẩu ghi trong `database/README.md`.

    cd web
    npm ci
    copy .env.example .env.local     # sửa NEXT_PUBLIC_API_URL nếu backend không ở localhost:3000

`.env.local` không được commit.

## Chạy khi phát triển

    npm run dev                      # http://localhost:3001

## Demo: `npm run build` rồi `npm start`

Demo **không dùng** `next dev` (spec 3.3).

    npm run build
    npm start                        # next start -p 3001

Mỗi tài khoản mở trong **một tab riêng**: `sessionStorage` không chia sẻ giữa các tab, tab mới phải đăng nhập lại.

## Địa chỉ backend và CORS

- `NEXT_PUBLIC_API_URL` được **gắn cứng lúc build**. Đổi IP hoặc cổng backend thì sửa `.env.local` rồi `npm run build` lại.
- `CORS_ORIGINS` của backend phải có địa chỉ web đang mở, nhiều địa chỉ cách nhau dấu phẩy, ví dụ `http://localhost:3001,http://192.168.1.43:3001`. Sửa xong khởi động lại backend.

## Mở bằng IP LAN

1. Lấy IP máy chạy backend và web bằng `ipconfig`.
2. Trong `backend/.env`: thêm `http://<IP LAN>:3001` vào `CORS_ORIGINS`, khởi động lại backend.
3. Trong `web/.env.local`: `NEXT_PUBLIC_API_URL=http://<IP LAN>:3000`, rồi `npm run build; npm start`.
4. Mở `http://<IP LAN>:3001`. Máy khác không vào được thì mở cổng 3001 và 3000 trong Windows Defender Firewall (mạng Private).

Kết quả S3 (`web/spikes/RESULTS.md`): `next start` mở bằng IP không có cảnh báo. `next dev` mở bằng IP thì **chỉ cảnh báo**, không chặn: `Cross origin request detected … allowedDevOrigins`. Muốn hết cảnh báo thì thêm **trên máy mình, không commit** `allowedDevOrigins: ['<IP LAN>']` vào `next.config.ts`. Next.js ghi rằng bản lớn sau sẽ bắt buộc cấu hình này.

## Không có màn hình quản lý người dùng

Tạo, khóa hoặc đổi vai trò tài khoản qua API bằng token `ADMIN`. Ví dụ khóa tài khoản có id 2 trong PowerShell:

    $login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType application/json -Body '{"username":"admin","password":"<mật khẩu>"}'
    $h = @{ Authorization = "Bearer $($login.accessToken)" }
    Invoke-RestMethod -Method Patch -Uri http://localhost:3000/api/users/2 -Headers $h -ContentType application/json -Body '{"isActive":false}'

Mở khóa bằng lệnh cuối với `{"isActive":true}`.

## Trang ẩn `/admin/tools`

Chạy phát hiện bất thường tại một thời điểm do người demo nhập theo **giờ Việt Nam**. Trang không có trên menu. Trang chỉ ẩn ở client, bảo vệ thật nằm ở backend: cần vai trò `ADMIN` và backend bật `DEMO_TOOLS=true`. Khi backend tắt `DEMO_TOOLS`, endpoint trả 404 và trang báo "Công cụ demo đang tắt".

## Hạn chế

Theo spec 3.4:

1. `sessionStorage` mất khi đóng tab, không chia sẻ giữa các tab; đăng xuất không lan sang tab khác.
2. **Không có màn hình quản lý người dùng**: demo chỉ dùng ba tài khoản seed (`admin`, `owner1`, `owner2`); tạo, khóa hoặc đổi vai trò tài khoản qua API. Báo cáo ghi rõ hạn chế này.
3. Không có thông báo đẩy; cảnh báo chỉ hiện khi đang mở web.
4. Trạng thái thiết bị sau khi kết nối lại dựa vào thứ tự sự kiện, không dựa vào mốc thời gian.
5. `NEXT_PUBLIC_API_URL` cố định lúc build.
6. `/admin/tools` chỉ ẩn ở client; bảo vệ thật ở backend.

Thêm:

- **Thu hoạch đã cắt** (`web/spikes/RESULTS.md`): không có trang Thu hoạch và báo cáo tương quan vì Task 25 backend đã cắt.
- **Huy hiệu `OFFLINE`** (`HEARTBEAT_ENABLED = true`): có cho cảm biến (trang Tổng quan) và quạt, phun sương, sưởi, loa (Tổng quan và Thiết bị). Camera không có huy hiệu vì hai trang này không liệt kê camera.
- **Tắt simulator khoảng 5 phút thì cả 26 thiết bị `OFFLINE`** (6 cảm biến, 20 cơ cấu chấp hành). Đo ngày 06/11: cơ cấu chấp hành sau 4 phút 51 giây, cảm biến sau 5 phút 51 giây (`web/results/e2e.md`).
- **`SPEAKER` có `IsOn` từ dữ liệu mẫu:** loa hiện "Bật" ngay từ đầu, kể cả khi đang `OFFLINE`.
- **`OFFLINE` cập nhật theo chu kỳ 30 giây:** hợp đồng không có sự kiện đổi trạng thái thiết bị và heartbeat không phát sự kiện tới web, nên khi tab đang hiện, Tổng quan và Thiết bị tự tải lại REST thiết bị mỗi 30 giây. Huy hiệu xuất hiện trong khoảng 30 giây sau mốc backend đánh dấu. Bật lại simulator: cảm biến hết huy hiệu khi nhận `readings.new`, cơ cấu chấp hành hết sau khi có heartbeat cộng một chu kỳ (đo được 63 đến 65 giây). Tab ẩn không tải lại; quay về tab thì chờ tối đa 30 giây. Lần tải nền lỗi không hiện thông báo, giữ dữ liệu cũ và lần sau tự thử lại.
- **Mất mạng rồi bấm sang tab khác:** trang của Next phải tải từ máy chủ web, nên trình duyệt hiện trang lỗi mạng của nó. Có mạng lại thì tải lại trang, phiên vẫn còn. Đứng yên ở trang đang mở thì chỉ hiện thông báo lỗi và thanh mất kết nối.
- **Thanh mất kết nối hiện chậm khi mạng phía trình duyệt đứt:** đo được khoảng 27 giây, do chờ Socket.IO hết hạn ping. Khi backend tắt thì thanh hiện ngay.
- **Tiêu đề nhà:** mở trang lúc backend lỗi thì tiêu đề giữ "Nhà yến" đến khi tải lại trang, dù nội dung đã tự hồi phục.
- **`next dev` mở khác nguồn:** mở bằng IP LAN thì terminal cảnh báo cross-origin (mục "Mở bằng IP LAN"); demo dùng `next start` nên không gặp.

## Test

    npm test            # Vitest, chỉ hàm thuần
    npm run typecheck

Kiểm thử giao diện chạy theo checklist bằng Playwright MCP, không commit test: `web/results/e2e.md`.
