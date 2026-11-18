# Task 14 – Tổng hợp kết quả và chuẩn bị thuyết trình

## 1. Mục tiêu

Hoàn thiện tài liệu kết quả kiểm thử của Database Advanced, rà soát thông tin nhạy cảm và chuẩn bị nội dung trình bày.

## 2. Kiểm tra an toàn tài liệu

- Đã quét thư mục `database/advanced/results/` để tìm hostname, username và các chuỗi có khả năng chứa thông tin nhạy cảm.
- Đã thay hostname máy trong báo cáo Deadlock bằng `<may>`.
- Đã kiểm tra các file dữ liệu nhạy cảm như `.bak`, `.trn`, `.mdf`, `.ldf` và `.env` trong danh sách Git theo phần mở rộng.
- Các file Markdown được kiểm tra đã được chuẩn hóa UTF-8 không BOM.

Kết quả: PASS theo các lần kiểm tra đã thực hiện.

## 3. Kiểm thử bảo mật

Chạy `database/advanced/security/run-security-test.ps1`.

Kết quả:
- Orphan login check: PASS.
- Kiểm tra quyền đọc và ghi theo vai trò: PASS.
- Kiểm tra quyền thực thi procedure: PASS.
- Các thao tác DELETE, DROP TABLE và CREATE TABLE trái quyền bị từ chối: PASS.
- Smoke test `app_backend` và `app_report`: PASS.
- Security runner kết thúc với exit code 0.

## 4. Kiểm thử điều khiển tương tranh

Chạy `database/advanced/tests/run-two-sessions.ps1`.

| Scenario | Kết quả quan sát | Trạng thái |
|---|---|---|
| lost-update-naive | Trạng thái cuối AUTO, IsOn = 0 | PASS |
| lost-update-safe | Trạng thái cuối MANUAL, IsOn = 1 | PASS |
| isolation-rc | v1 = 28.00, v2 = 29.00 | PASS |
| isolation-rr | v1 = 28.00, v2 = 28.00 | PASS |
| isolation-snapshot | v1 = 28.00, v2 = 28.00, lỗi cập nhật 3960 | PASS |

Cả 5 scenario đều có exit code 0.

Sau kiểm thử:
- Trạng thái actuator được khôi phục về trạng thái ban đầu.
- `Thresholds.TargetValue` được khôi phục về 28.00.

Lưu ý: phiên bản mã nguồn hiện tại có 5 scenario trong runner, không phải 8 scenario như checklist ban đầu.

## 5. Kiểm thử Deadlock

Theo kết quả kiểm thử Task 6 đã thực hiện:
- Scenario deadlock: PASS.
- Scenario xử lý deadlock: PASS.
- Scenario retry: PASS.

## 6. Kiểm thử Point-in-Time Recovery

Chạy `database/advanced/backup/pitr-demo.ps1`.

Kết quả:
- FULL backup: PASS.
- DIFFERENTIAL backup: PASS.
- LOG backup: PASS.
- RESTORE VERIFYONLY cho cả 3 backup: PASS.
- Restore FULL, DIFFERENTIAL và LOG với `STOPAT`: PASS.
- `PITR CHECK PASS`.
- `PITR DEMO PASS`.

Mốc phục hồi theo giờ địa phương: `2026-11-18 10:05:17.180`.

| Database | Thresholds sau demo | Readings |
|---|---:|---:|
| SwiftletCare_Restore | 4 | 20 |
| SwiftletCare_Bk_Dev | 20 | 20 |

Source đã được rollback, giữ lại 20 Thresholds sau khi demo kết thúc.

Trong quá trình chuẩn bị, ZoneId 2 của source bị thiếu 4 Thresholds. Đã bổ sung theo cấu hình tương ứng của ZoneId 1 và xác nhận dữ liệu nguồn được khôi phục sau demo.

## 7. Kết quả tối ưu truy vấn INCLUDE

Số logical reads median ghi nhận trong Task 10 và Task 11:

| Query | Trước | Sau | Thay đổi |
|---|---:|---:|---:|
| Q1 | 277 | 13 | Giảm 95.31% |
| Q2 | 8090 | 158 | Giảm 98.05% |
| Q3 | 111 | 111 | Không đổi |
| Q4 | 20769 | 22679.5 | Tăng 9.20% |

Nhận xét:
- INCLUDE cải thiện đáng kể logical reads của Q1 và Q2.
- Q3 không có thay đổi về logical reads.
- Q4 có logical reads tăng, cần cân nhắc chi phí khi ghi và bảo trì index.
- Kết quả được ghi nhận từ các lần đo trên database thử nghiệm `SwiftletCare_Perf`.

## 8. Task 13 – Partitioning

**Trạng thái: Chưa thực hiện.**

Do không đủ thời gian triển khai và kiểm thử, nhóm chưa hoàn thành Task 13 – Partitioning. Vì vậy, không có kết quả thực nghiệm về Partitioning để đưa vào báo cáo và không tính hạng mục này là đã hoàn thành.

## 9. Tổng kết Task 14

Các nội dung bảo mật, concurrency, deadlock, PITR và tối ưu truy vấn đã có kết quả kiểm thử hoặc số liệu từ các task tương ứng.

Task 14 tập trung rà soát, tổng hợp bằng chứng và chuẩn bị kịch bản thuyết trình. Task 13 được ghi nhận riêng là chưa thực hiện do giới hạn thời gian.