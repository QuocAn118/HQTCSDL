# Task 5 – Lost Update

## 1. Mục tiêu
Mô phỏng hiện tượng Lost Update khi hai transaction đồng thời cập nhật cùng một actuator, sau đó đối chiếu với phương pháp sử dụng UPDLOCK.

## 2. Môi trường kiểm thử
- Database: SwiftletCare_Perf
- DeviceId: 3
- DeviceCode: H1-F0-FAN
- Giá trị Level ban đầu: 0
- Số session đồng thời: 2
- Mỗi session tăng Level thêm 10.

## 3. Kết quả NAIVE

Hai session cùng đọc Level = 0 và đều ghi Level = 10.

| Session | ReadLevel | WrittenLevel |
|---|---:|---:|
| Session 1 | 0 | 10 |
| Session 2 | 0 | 10 |

Level cuối cùng trong database: **10**

Kết luận: PASS – tái hiện được Lost Update. Một lần cập nhật đã bị ghi đè.

## 4. Kết quả SAFE

Procedure sử dụng UPDLOCK và transaction để tuần tự hóa việc cập nhật.

| Session | ReadLevel | WrittenLevel |
|---|---:|---:|
| Session 1 | 0 | 10 |
| Session 2 | 10 | 20 |

Level cuối cùng trong database: **20**

Kết luận: PASS – không xảy ra Lost Update. Session thứ hai đọc được giá trị đã cập nhật bởi session thứ nhất.

## 5. So sánh

| Tiêu chí | NAIVE | SAFE |
|---|---:|---:|
| Giá trị cuối | 10 | 20 |
| Mất cập nhật | Có | Không |
| Cơ chế khóa | Không sử dụng UPDLOCK | UPDLOCK, ROWLOCK |
| Kết quả | Lost Update | An toàn |

## 6. Kết luận

Thử nghiệm trên SwiftletCare_Perf chứng minh rằng hai transaction cùng đọc một giá trị trước khi ghi có thể gây ra Lost Update.

Việc sử dụng UPDLOCK trong transaction giúp session sau chờ session trước hoàn tất, sau đó đọc giá trị mới nhất và thực hiện cập nhật chính xác.

Stored procedure gốc dbo.sp_SetActuator không bị chỉnh sửa. Các procedure thử nghiệm được tạo riêng trong database SwiftletCare_Perf.
