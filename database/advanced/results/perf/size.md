@'
# Task 9 – Generate Sensor Readings

## 1. Mục tiêu

Sinh gần 5 triệu dòng dữ liệu SensorReadings trên database `SwiftletCare_Perf`, phục vụ kiểm thử hiệu năng.

## 2. Cấu hình sinh dữ liệu

| Tham số | Giá trị |
|---|---:|
| AnchorDateVn | 2026-10-12 |
| Days | 180 |
| StepSeconds | 75 |
| SlotsPerDay | 1.152 |
| Số sensor | 6 |
| Số metric | 4 |
| Số chuỗi dữ liệu | 24 |
| Số dòng dự kiến | 4.976.640 |

Khoảng thời gian UTC:
- Bắt đầu: `2026-04-07 00:00:00`
- Kết thúc độc quyền: `2026-10-04 00:00:00`

## 3. Kết quả sinh dữ liệu

| Chỉ tiêu | Kết quả |
|---|---:|
| Rows before | 54.144 |
| New rows | 4.976.640 |
| Rows after | 5.030.784 |
| Processed days | 180 |
| Skipped days | 0 |
| Total elapsed | 466.337 ms |

## 4. Kiểm thử chạy lại (Idempotency)

Chạy lại script lần thứ hai với cùng cấu hình.

| Chỉ tiêu | Kết quả |
|---|---:|
| Rows before | 5.030.784 |
| New rows | 0 |
| Skipped days | 180 |
| Processed days | 180 |
| Rows after | 5.030.784 |
| Total elapsed | 1.307 ms |

Kết quả: PASS. Script bỏ qua cả 180 ngày đã có dữ liệu, không chèn thêm dòng và không làm thay đổi tổng số readings.

## 5. Dung lượng bảng SensorReadings

Kết quả từ `sp_spaceused`:

| Thành phần | Dung lượng |
|---|---:|
| Rows | 5.030.784 |
| Reserved | 819.288 KB |
| Data | 388.400 KB |
| Index size | 430.608 KB |
| Unused | 280 KB |

## 6. Dung lượng database

| File | Loại | Dung lượng |
|---|---|---:|
| SwiftletCare_Perf | ROWS | 840 MB |
| SwiftletCare_Perf_log | LOG | 520 MB |
| **Tổng** | | **1.360 MB** |

Dung lượng database trước khi sinh dữ liệu chưa được ghi nhận, do đó không thể tính chính xác mức tăng dung lượng so với ban đầu.

## 7. Dung lượng từng chỉ mục

| Index | Used MB | Rows |
|---|---:|---:|
| SensorReadings_DeviceId_MetricCode_RecordedAt_key | 215.273437 | 5.030.784 |
| SensorReadings_pkey | 203.281250 | 5.030.784 |
| SensorReadings_RecordedAt_idx | 381.257812 | 5.030.784 |

## 8. Kiểm tra phân bố và giới hạn giá trị

| Metric | Số dòng | Min | Max |
|---|---:|---:|---:|
| CO2 | 1.244.160 | 611,01 | 789,00 |
| HUMID | 1.244.160 | 78,60 | 85,40 |
| LIGHT | 1.244.160 | 1,30 | 4,70 |
| TEMP | 1.244.160 | 26,20 | 29,80 |

Các giá trị nằm trong giới hạn cấu hình đã kiểm tra.

## 9. Khoảng thời gian dữ liệu thực tế

| Chỉ tiêu | Kết quả |
|---|---|
| FirstReadingUTC | 2026-04-07 00:00:00 |
| LastReadingUTC | 2026-10-03 23:58:45 |
| ReadingCount | 4.976.640 |

## 10. Kết luận

Task 9 hoàn thành các mục tiêu sinh dữ liệu và kiểm tra dung lượng:

- Sinh thành công 4.976.640 dòng dữ liệu mới.
- Tổng dữ liệu đạt 5.030.784 dòng.
- Dữ liệu trải đều trên 180 ngày, gồm 6 sensor và 4 metric.
- Thời gian sinh dữ liệu: 466.337 ms (khoảng 7 phút 46 giây).
- Lần chạy thứ hai không phát sinh dữ liệu mới, bỏ qua 180/180 ngày.
- Đã đo dung lượng bảng, database và cả 3 index.
- Dung lượng database hiện tại là 1.360 MB.

**Trạng thái Task 9: PASS.**

Ghi chú: Dung lượng database trước khi sinh dữ liệu chưa được ghi nhận. Báo cáo sử dụng số liệu dung lượng thực tế sau khi sinh dữ liệu, không suy đoán mức tăng dung lượng trước/sau.