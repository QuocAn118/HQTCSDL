# web

Spec: `docs/superpowers/specs/2026-10-16-swiftletcare-web-design.md`. Plan: `docs/superpowers/plans/2026-10-16-swiftletcare-web.md`.

    cd web
    npm ci
    copy .env.example .env.local     # sửa NEXT_PUBLIC_API_URL nếu backend không ở localhost:3000
    npm test
    npm run dev                      # http://localhost:3001

Mở từ máy khác trong mạng LAN (`http://<IP LAN>:3001`): `next dev` cảnh báo `Cross origin request detected … allowedDevOrigins`. Muốn hết cảnh báo thì thêm **trên máy mình, không commit** `allowedDevOrigins: ['<IP LAN>']` vào `next.config.ts`. `npm run build; npm start` không cần. Máy khác vẫn không vào được thì mở cổng 3001 trong Windows Defender Firewall (mạng Private). Backend phải có origin đó trong `CORS_ORIGINS`.
