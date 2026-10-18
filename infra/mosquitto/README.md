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
