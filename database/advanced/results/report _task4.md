# TASK 4 – CHẠY CONTRACT TEST BẰNG TÀI KHOẢN `app_backend`

## 1. Mục tiêu

Kiểm tra khả năng hoạt động của Backend khi kết nối SQL Server bằng tài khoản `app_backend`, thay vì sử dụng tài khoản có quyền cao `swiftlet_dev`.

Mục tiêu là xác minh Backend có thể thực hiện các chức năng cần thiết với quyền truy cập cơ sở dữ liệu đã được phân quyền ở Task 3.

## 2. Phạm vi thực hiện

- Chạy bộ kiểm thử Contract Test của Backend.
- Sử dụng tài khoản `app_backend` cho kết nối cơ sở dữ liệu của Backend runtime.
- Tiếp tục sử dụng tài khoản `swiftlet_dev` cho các thao tác chuẩn bị fixture và khôi phục cơ sở dữ liệu kiểm thử.
- Kiểm tra kết nối SQL Server và MQTT trong quá trình chạy kiểm thử.
- Không thay đổi cấu trúc bảng, stored procedure, view hoặc trigger của hệ thống.

## 3. Chuẩn bị môi trường

Trước khi chạy kiểm thử:

1. Kiểm tra cơ sở dữ liệu `SwiftletCare_Test`.
2. Tạo bản backup `SwiftletCare_Test_seed.bak`.
3. Thực hiện `RESTORE VERIFYONLY` để xác nhận backup hợp lệ.
4. Khởi động dịch vụ Mosquitto.
5. Dừng Backend development đang chạy tại cổng 3000.
6. Cấu hình các biến môi trường trong `backend/.env.test`.

Phân chia tài khoản:

| Thành phần | Tài khoản |
|---|---|
| Backend runtime | `app_backend` |
| SQL fixture và restore | `swiftlet_dev` |
| MQTT | `simulator` |

Các mật khẩu được lưu trong file môi trường và không đưa vào báo cáo.

## 4. Thực hiện kiểm thử

Chạy tại thư mục `backend`:

```powershell
npm run test:contract
```

Bộ kiểm thử khởi chạy Backend trên môi trường test, thực hiện các fixture và kiểm tra những chức năng liên quan đến API, cơ sở dữ liệu, MQTT và Socket.IO.

## 5. Kết quả kiểm thử

<badge>PASS</badge>

| Chỉ tiêu | Kết quả |
|---|---:|
| Tổng số test | 55 |
| Passed | 55 |
| Failed | 0 |
| Cancelled | 0 |
| Skipped | 0 |
| Thời gian thực hiện | 724.37 giây |

Kết quả fixture:

- Đã thực hiện 48/50 fixture.
- Hai fixture `rest/harvests-post.cut` và `rest/report-env-vs-yield.cut` không được chạy do điều kiện cutoff của bộ kiểm thử.

Một số nội dung được kiểm tra thành công:

- Backend kết nối SQL Server bằng tài khoản `app_backend`.
- Backend kết nối MQTT broker.
- Phát hiện thiết bị offline (`DEVICE_OFFLINE`).
- Xử lý lỗi kết nối cơ sở dữ liệu trong khi gửi số đo.
- Kiểm tra các trường hợp cấu hình sai.
- Kiểm tra trường hợp DB_NAME không tồn tại.
- Kiểm tra các endpoint quản trị.
- Kiểm tra sự kiện song song và Socket.IO.
- Kiểm tra dữ liệu trả về và chuỗi sự kiện `ws/readings.new`.

## 6. Kết luận

Task 4 hoàn thành.

Bộ Contract Test chạy thành công với kết quả 55/55 test PASS, không có test thất bại.

Backend có thể khởi động, kết nối SQL Server bằng tài khoản `app_backend` và kết nối MQTT broker. Kết quả này xác nhận cấu hình phân quyền tại Task 3 có thể được sử dụng trong quá trình chạy Backend thực tế theo phạm vi kiểm thử.

**Kết quả: PASS – Hoàn thành Task 4.**

## 7. Git

Commit thay đổi mã nguồn liên quan đến Task 4:

```text
9f8c75b test(backend): run contract suite with app_backend credentials
```

File `backend/.env.test`, backup cơ sở dữ liệu và các thông tin mật khẩu không được đưa vào Git.
