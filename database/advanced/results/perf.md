# Task 11 – INCLUDE (Value): đo sau và quyết định

## 1. Mục tiêu

Đánh giá việc chuyển unique constraint trên `dbo.SensorReadings`
thành UNIQUE NONCLUSTERED INDEX có `INCLUDE (Value)`.

Database thử nghiệm: `SwiftletCare_Perf`.

Số dòng `SensorReadings`: 5.030.784.

## 2. Thay đổi index

Index được xác định động từ metadata SQL Server:

`SensorReadings_DeviceId_MetricCode_RecordedAt_key`

Cấu trúc sau thay đổi:

- Key: `DeviceId`, `MetricCode`, `RecordedAt`.
- Included column: `Value`.
- `is_unique = 1`.
- `is_unique_constraint = 0`.

Script `include-value.sql` được chạy hai lần:
- Lần đầu: chuyển đổi thành công.
- Lần thứ hai: thông báo `da co INCLUDE, bo qua`.

Kiểm tra metadata sau khi chạy:

`PASS: Tim thay dung mot UNIQUE INDEX co INCLUDE(Value).`

## 3. So sánh hiệu năng

Sử dụng median của 5 lần chạy nóng cho mỗi truy vấn.

| Truy vấn | Logical reads trước | Logical reads sau | Thay đổi | CPU trước (ms) | CPU sau (ms) | Elapsed trước (ms) | Elapsed sau (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Q1 | 277 | 13 | -95,31% | 15 | 0 | 5 | 2 |
| Q2 | 8.090 | 158 | -98,05% | 94 | 31 | 136 | 131 |
| Q3 | 111 | 2.634 | +2.273,87% | 0 | 125 | 7 | 134 |
| Q4 | 20.769 | 19.767 | -4,82% | 0 | 0 | 0 | 0 |

Ghi chú:
- Giá trị CPU và elapsed là median của 5 lần chạy nóng.
- Q4 có elapsed 0 ms ở cả hai giai đoạn, do đó không đủ độ phân giải để kết luận mức thay đổi thời gian thực thi.
- Q3 có biến động lớn, cần được xem xét riêng ở mục 5.

## 4. Execution plan

### Q2

Trước INCLUDE:
- Physical operator: `Clustered Index Seek`.
- Index: `SensorReadings_RecordedAt_idx`.
- Actual rows: 34.560.
- Logical reads tại operator: 8.086.

Sau INCLUDE:
- Physical operator: `Index Seek`.
- Index: `SensorReadings_DeviceId_MetricCode_RecordedAt_key`.
- Actual rows: 34.560.
- Logical reads tại operator: 154.

Số dòng trả về không đổi, nhưng logical reads tại operator giảm khoảng 98,1%.
Execution plan sau thay đổi sử dụng unique index có `INCLUDE (Value)`.

### Q1

Execution plan sau thay đổi sử dụng
`IX_SensorReadings_Device_Metric_Time_Include` ở lần đo Task 10.
Sau chuyển đổi cấu trúc index ở Task 11, cần đối chiếu tên index trong plan mới:
`SensorReadings_DeviceId_MetricCode_RecordedAt_key`.

Kết quả đo Q1 giảm từ 277 xuống 13 logical reads.

### Q3

Trước và sau thay đổi, execution plan đều sử dụng
`SensorReadings_RecordedAt_idx` với operator `Clustered Index Scan`.

- Trước: 111 logical reads ở median; operator trong plan ghi nhận 72 logical reads.
- Sau: 2.634 logical reads ở median; operator trong plan ghi nhận 2.598 logical reads.
- Actual rows trong plan: 24 ở cả hai lần.

Một lần chạy nóng sau thay đổi trở về 111 logical reads.
Do đó kết quả Q3 không ổn định. Chưa đủ bằng chứng để quy nguyên nhân trực tiếp cho INCLUDE (Value).
Đây là hạn chế cần ghi nhận, không loại bỏ khỏi kết quả đánh giá.

## 5. Đo cold

Cold guard đã PASS và có dữ liệu cold ở cả hai giai đoạn.

| Truy vấn | Cold reads trước | Cold reads sau | Physical reads trước | Physical reads sau | Elapsed trước (ms) | Elapsed sau (ms) |
|---|---:|---:|---:|---:|---:|---:|
| Q1 | 277 | 13 | 4 | 4 | 10 | 9 |
| Q2 | 8.090 | 158 | 5 | 4 | 542 | 139 |
| Q3 | 111 | 2.637 | 7 | 9 | 11 | 155 |
| Q4 | 21.089 | 19.925 | 40 | 127 | 0 | 0 |

Q3 tiếp tục có mức tăng reads ở lần cold sau thay đổi.
Q4 có physical reads tăng, nhưng elapsed vẫn ở mức 0 ms nên không thể kết luận mức chậm theo phần trăm.

## 6. Kích thước index

| Index | Trước (MB) | Sau (MB) |
|---|---:|---:|
| SensorReadings_DeviceId_MetricCode_RecordedAt_key | 215,27 | 171,30 |

Kích thước index giảm khoảng 20,43% theo số liệu đo được.

Sau thay đổi:
- Table reserved: 775.384 KB.
- Table data: 389.320 KB.
- Table index: 385.928 KB.
- Database ROWS file: 1.160 MB.
- Database LOG file: 520 MB.

Lưu ý: so sánh kích thước ở đây chỉ áp dụng cho index cùng tên; không suy rộng thành mức giảm tổng dung lượng database.

## 7. Đánh giá tiêu chí

| Tiêu chí | Kết quả | Đánh giá |
|---|---|---|
| Q2 logical reads giảm ít nhất 50% | Giảm 98,05% | Đạt |
| Q4 slowdown dưới 20% | Elapsed 0 ms ở cả hai phía | Chưa đủ độ phân giải để kết luận |
| Q1 cải thiện | Reads giảm 95,31% | Tốt |
| Q3 không biến động | Reads tăng mạnh, kết quả không ổn định | Cần lưu ý |

## 8. Kiểm tra bổ sung Q3 và Q4 bằng 10 lần chạy

Sau khi lần đo ban đầu cho thấy Q3 tăng logical reads bất thường,
hai truy vấn Q3 và Q4 được chạy lại với 10 lần đo nóng.
Không thay đổi cấu trúc index trong lượt kiểm tra này.

### 8.1. Q3 – Kiểm tra regression

Kết quả 10 lần chạy sau INCLUDE:

| Chỉ số | Kết quả |
|---|---:|
| Số lần chạy | 10 |
| Min logical reads | 111 |
| Max logical reads | 111 |
| Median logical reads | 111 |
| Elapsed thấp nhất | 4 ms |
| Elapsed cao nhất | 12 ms |

Cả 10 lần chạy đều ghi nhận 111 logical reads.
Kết quả này trùng với baseline trước INCLUDE.

Execution plan Q3 trước và sau đều sử dụng
`SensorReadings_RecordedAt_idx` với `Clustered Index Scan`.
Lần đo ban đầu sau INCLUDE từng ghi nhận khoảng 2.634 logical reads,
nhưng kết quả đó không lặp lại trong lần kiểm tra 10 lượt.

Kết luận: chưa có bằng chứng cho thấy INCLUDE (Value) gây regression
ổn định đối với Q3. Kết quả bất thường ban đầu được giữ lại trong báo cáo
để thể hiện đầy đủ quá trình kiểm thử, không loại bỏ dữ liệu bất lợi.

### 8.2. Q4 – Kiểm tra chi phí ingest

Kết quả 10 lần chạy nóng sau INCLUDE:

| Chỉ số | Kết quả |
|---|---:|
| Số lần chạy | 10 |
| Min logical reads | 19.383 |
| Max logical reads | 26.725 |
| Median logical reads | 22.679,5 |
| CPU median | 0 ms |
| Elapsed median | 0 ms |

So với baseline trước INCLUDE:

- Logical reads median trước: 20.769.
- Logical reads median sau kiểm tra lại: 22.679,5.
- Mức tăng: khoảng 9,20%.

Execution plan Q4 trước và sau có cùng các operator được trích xuất:

- Devices: Clustered Index Scan.
- Metrics: Clustered Index Scan.
- Table Spool: Lazy Spool.
- Thresholds: Clustered Index Seek.

Thresholds đều có 1.000 actual rows và 2.000 logical reads.
Không quan sát thấy thay đổi ở các operator đọc dữ liệu được trích xuất.

Giới hạn: Q4 có elapsed 0 ms ở cả hai giai đoạn.
Vì vậy không thể xác nhận chính xác tiêu chí slowdown dưới 20%.
Execution plan được trích xuất cũng chưa thể hiện đầy đủ chi phí ghi
và cập nhật index của SensorReadings.

Kết luận: Q4 có mức tăng logical reads khoảng 9,20% trong lượt kiểm tra
10 lần. Chưa có bằng chứng về regression thời gian thực thi,
nhưng cần theo dõi chi phí ghi khi triển khai thực tế.

## 9. Bằng chứng hỗ trợ quyết định

### 9.1. Q1 và Q2

- Q1 logical reads median giảm từ 277 xuống 13, tương đương 95,31%.
- Q2 logical reads median giảm từ 8.090 xuống 158, tương đương 98,05%.
- Q2 trước INCLUDE sử dụng `SensorReadings_RecordedAt_idx`
  với Clustered Index Seek, ghi nhận 8.086 logical reads tại operator.
- Q2 sau INCLUDE sử dụng
  `SensorReadings_DeviceId_MetricCode_RecordedAt_key`
  với Index Seek, ghi nhận 154 logical reads tại operator.
- Actual rows của Q2 trước và sau đều là 34.560.

Đây là bằng chứng cho thấy index có INCLUDE (Value) giúp Q2
đọc ít trang dữ liệu hơn đáng kể mà không làm thay đổi số dòng kết quả.

### 9.2. Q3 và Q4

- Q3 được đo lại 10 lần và cả 10 lần đều có 111 logical reads.
- Q4 được đo lại 10 lần, median logical reads tăng khoảng 9,20%.
- Các operator đọc dữ liệu được trích xuất từ execution plan Q4
  trước và sau không thay đổi.
- Không dùng kết quả elapsed 0 ms để khẳng định Q4 không bị chậm.

### 9.3. Kích thước index

Index `SensorReadings_DeviceId_MetricCode_RecordedAt_key`:

- Trước: 215,27 MB.
- Sau: 171,30 MB.
- Giảm khoảng 20,43%.

Số liệu này hỗ trợ quyết định về dung lượng index,
nhưng không được xem là bằng chứng duy nhất về hiệu năng.

## 10. Quyết định cuối cùng của TV1

**QUYẾT ĐỊNH: GIỮ INCLUDE (Value).**

Lý do:

1. Q1 giảm 95,31% logical reads và Q2 giảm 98,05% logical reads.
   Đây là mức cải thiện lớn, có ý nghĩa đối với hai truy vấn đọc dữ liệu.
2. Execution plan Q2 chuyển sang Index Seek trên unique index
   `SensorReadings_DeviceId_MetricCode_RecordedAt_key`,
   có `Value` là included column. Số dòng trả về vẫn giữ nguyên 34.560.
3. Q3 được kiểm tra lại bằng 10 lần chạy và ổn định ở 111 logical reads.
   Chưa có bằng chứng về regression ổn định sau thay đổi.
4. Q4 tăng khoảng 9,20% logical reads trong lượt kiểm tra 10 lần,
   nhưng các operator đọc dữ liệu được trích xuất không thay đổi.
5. Kích thước index cùng tên giảm khoảng 20,43%.

Giới hạn và rủi ro được chấp nhận:

- Q3 từng có kết quả bất thường ở lần đo ban đầu; nguyên nhân chưa được xác định.
- Q4 có elapsed 0 ms nên chưa thể xác nhận tiêu chí slowdown dưới 20%.
- Cần theo dõi chi phí ghi và cập nhật index sau khi triển khai.

Với lợi ích rõ rệt ở Q1 và Q2, kết quả kiểm tra lại Q3,
cùng mức tăng logical reads Q4 chưa vượt 10%,
TV1 quyết định giữ INCLUDE (Value).

Quyết định này dựa trên số liệu đo được và có ghi nhận rõ các giới hạn,
không khẳng định rằng mọi truy vấn đều được cải thiện.

## 11. Bằng chứng và tệp liên quan

- `database/advanced/perf/include-value.sql`
- `database/advanced/perf/check-include.sql`
- `database/advanced/perf/measure.ps1`
- `database/advanced/perf/queries/Q1.sql` đến `Q4.sql`
- `database/advanced/results/perf/timing.csv`
- `database/advanced/results/perf/Q1-truoc.sqlplan`
- `database/advanced/results/perf/Q1-sau.sqlplan`
- `database/advanced/results/perf/Q2-truoc.sqlplan`
- `database/advanced/results/perf/Q2-sau.sqlplan`
- `database/advanced/results/perf/Q3-truoc.sqlplan`
- `database/advanced/results/perf/Q3-sau.sqlplan`
- `database/advanced/results/perf/Q4-truoc.sqlplan`
- `database/advanced/results/perf/Q4-sau.sqlplan`
- `database/advanced/results/perf/size.md`
