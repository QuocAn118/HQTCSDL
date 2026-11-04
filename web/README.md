# web

Spec: `docs/superpowers/specs/2026-10-16-swiftletcare-web-design.md`. Plan: `docs/superpowers/plans/2026-10-16-swiftletcare-web.md`.

    cd web
    npm ci
    copy .env.example .env.local     # sửa NEXT_PUBLIC_API_URL nếu backend không ở localhost:3000
    npm test
    npm run dev                      # http://localhost:3001

Mở từ máy khác trong mạng LAN (`http://<IP LAN>:3001`): `next dev` cảnh báo `Cross origin request detected … allowedDevOrigins`. Muốn hết cảnh báo thì thêm **trên máy mình, không commit** `allowedDevOrigins: ['<IP LAN>']` vào `next.config.ts`. `npm run build; npm start` không cần. Máy khác vẫn không vào được thì mở cổng 3001 trong Windows Defender Firewall (mạng Private). Backend phải có origin đó trong `CORS_ORIGINS`.

Hạn chế đã biết: huy hiệu `OFFLINE` của cảm biến tự tắt ngay khi nhận `readings.new` của thiết bị đó, nhưng cảm biến **im lặng** thì chỉ chuyển sang `OFFLINE` khi trang tải lại REST (vào lại trang hoặc socket kết nối lại) — hợp đồng không có sự kiện đổi trạng thái thiết bị.

Chức năng đã cắt (ghi rõ trong `web/spikes/RESULTS.md`): không có huy hiệu `OFFLINE` cho quạt, phun sương, sưởi, loa, camera vì heartbeat đã cắt (`HEARTBEAT_ENABLED = false`, chỉ cảm biến có huy hiệu); không có trang Thu hoạch và báo cáo tương quan vì Task 25 backend đã cắt.

Trang ẩn `/admin/tools` (không có trên menu) chỉ chạy được khi backend bật `DEMO_TOOLS=true` và đăng nhập `ADMIN`; giờ nhập là giờ Việt Nam. Trang chỉ ẩn ở client, bảo vệ thật nằm ở backend.
