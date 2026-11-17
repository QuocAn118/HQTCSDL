# Task 10 – Đo hiệu năng trước và sau INCLUDE

## 1. Mục tiêu

Đánh giá ảnh hưởng của Nonclustered Index có cột INCLUDE đến hiệu năng truy vấn dữ liệu cảm biến trên `SwiftletCare_Perf`.

Database kiểm thử có 5.030.784 dòng trong bảng `SensorReadings`.

## 2. Index được bổ sung

```sql
CREATE NONCLUSTERED INDEX IX_SensorReadings_Device_Metric_Time_Include
ON dbo.SensorReadings (DeviceId, MetricCode, RecordedAt)
INCLUDE (Value);
```

Ba cột khóa phục vụ tìm kiếm và sắp xếp. Cột `Value` được đưa vào INCLUDE để truy vấn có thể lấy dữ liệu trực tiếp từ index.

## 3. Phương pháp kiểm thử

- Đo hai pha: `truoc` và `sau`.
- Mỗi truy vấn có một lần đo cold cache khi Cold Guard PASS.
- Mỗi truy vấn chạy một lần warm-up không tính kết quả.
- Thực hiện 5 lần đo hot.
- Thu thập logical reads, physical reads, CPU time và elapsed time.
- Lưu execution plan cho từng truy vấn và từng pha.

Cold Guard PASS ở cả hai pha. Điều kiện kiểm tra session loại trừ session dịch vụ `NT SERVICE\%` để không phải dừng SQL Server CEIP.

## 4. Kết quả đo

Bảng dưới đây sử dụng median của 5 lần chạy hot.

| Truy vấn | Logical reads trước | Logical reads sau | Thay đổi | Elapsed trước | Elapsed sau |
|---|---:|---:|---:|---:|---:|
| Q1 | 277 | 13 | -95,31% | 5 ms | 2 ms |
| Q2 | 8.090 | 159 | -98,03% | 136 ms | 82 ms |
| Q3 | 111 | 111 | 0% | 7 ms | 3 ms |
| Q4 | 20.769 | 23.007 | +10,78% | 0 ms | 0 ms |

## 5. Phân tích

### Q1 – Đọc dữ liệu trong 24 giờ

Logical reads giảm từ 277 xuống 13, tương đương 95,31%.

### Q2 – Đọc dữ liệu trong 30 ngày

Logical reads giảm từ 8.090 xuống 159, tương đương 98,03%.

Execution plan sau INCLUDE sử dụng `IX_SensorReadings_Device_Metric_Time_Include`. Các cột `RecordedAt` và `Value` được lấy trực tiếp từ index, không còn Key Lookup trong statement truy vấn `SensorReadings`.

### Q3 – Truy vấn view mới nhất

Logical reads giữ nguyên ở mức 111. Chưa có bằng chứng cho thấy index mới làm giảm lượng trang dữ liệu phải đọc của truy vấn này.

### Q4 – Ingest dữ liệu

Logical reads tăng từ 20.769 lên 23.007, tương đương 10,78%.

Đây là chi phí bổ sung cần cân nhắc khi ghi dữ liệu vì SQL Server phải duy trì thêm index.

Elapsed time của Q4 hiển thị 0 ms ở cả hai pha do độ phân giải mili giây của phép đo. Không thể dùng chỉ số này để kết luận chi phí ghi không thay đổi.

## 6. Execution plan

Tám execution plan được lưu:

- `Q1-truoc.sqlplan`, `Q2-truoc.sqlplan`, `Q3-truoc.sqlplan`, `Q4-truoc.sqlplan`.
- `Q1-sau.sqlplan`, `Q2-sau.sqlplan`, `Q3-sau.sqlplan`, `Q4-sau.sqlplan`.

Q1 và Q2 sau INCLUDE sử dụng covering index mới cho statement đọc `SensorReadings`, loại bỏ Key Lookup ở statement này.

Lưu ý: mỗi file truy vấn có thể chứa nhiều statement. Khi phân tích Key Lookup cần phân biệt statement tra cứu `DeviceId` từ bảng `Devices` với statement đọc dữ liệu từ `SensorReadings`.

## 7. Kết luận

Index INCLUDE cải thiện đáng kể hiệu năng đọc dữ liệu cảm biến của Q1 và Q2, giảm lần lượt 95,31% và 98,03% logical reads.

Đổi lại, Q4 có logical reads tăng 10,78% do chi phí duy trì index khi ingest dữ liệu.

Vì vậy, INCLUDE phù hợp với các truy vấn đọc thường xuyên cần lấy cột `Value`, nhưng cần cân nhắc tần suất ghi dữ liệu và chi phí bảo trì index.

## 8. File bằng chứng

- `database/advanced/perf/queries/Q1.sql` đến `Q4.sql`.
- `database/advanced/perf/measure.ps1`.
- `database/advanced/results/perf/timing.csv`.
- Tám execution plan trước và sau INCLUDE.
- `database/advanced/tests/guards.ps1`.
- `database/advanced/README.md`.
