
# SwiftletCare Simulator

Simulator mô phỏng các thiết bị cảm biến và thiết bị điều khiển trong hệ thống nhà yến SwiftletCare.

## Yêu cầu

- Node.js
- Mosquitto MQTT Broker

## Cài đặt

```powershell
cd simulator
npm ci
```

Tạo file cấu hình:

```powershell
Copy-Item .env.example .env
```

Điền thông tin MQTT vào file `.env`.

## Chạy kiểm thử

```powershell
npm test
```

## Chạy simulator

```powershell
npm start
```

## MQTT Topics

- `swiftlet/devices/{code}/readings`
- `swiftlet/devices/{code}/command`
- `swiftlet/devices/{code}/heartbeat`

Không commit file `.env` vì file này chứa thông tin đăng nhập MQTT.
