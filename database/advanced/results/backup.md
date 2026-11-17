# Task 8 – Point-in-Time Recovery (PITR)

## 1. Mục tiêu

Thực hành backup và khôi phục SQL Server bằng ba loại backup:

- FULL backup.
- DIFFERENTIAL backup.
- TRANSACTION LOG backup.

Sử dụng tùy chọn `STOPAT` để khôi phục database về một thời điểm xác định trước khi xảy ra sự cố.

## 2. Môi trường kiểm thử

| Thành phần | Giá trị |
|---|---|
| SQL Server | SQL Server 2025 Express |
| Source database | `SwiftletCare_Bk_Dev` |
| Target database | `SwiftletCare_Restore` |
| Zone kiểm thử | H1-F1 |
| ZoneId | 2 |
| Backup directory | `C:\SwiftletBackup` |

Source và target được tách riêng để tránh ảnh hưởng đến database phát triển chính.

**Lưu ý:** Không thao tác trên `SwiftletCare_Dev`.

## 3. Quy trình thực hiện

Script thực hiện quy trình PITR theo thứ tự:

1. Kiểm tra source, target và dữ liệu Thresholds ban đầu.
2. Sao lưu dữ liệu Thresholds ban đầu để phục vụ kiểm tra an toàn.
3. Chuyển source sang recovery model FULL.
4. Tạo FULL backup.
5. Thêm nhóm readings thứ nhất, sau đó tạo DIFFERENTIAL backup.
6. Thêm nhóm readings thứ hai.
7. Ghi nhận thời điểm PITR.
8. Mô phỏng sự cố bằng cách xóa Thresholds tại zone H1-F1.
9. Tạo TRANSACTION LOG backup.
10. Chạy `RESTORE VERIFYONLY` cho cả ba backup.
11. Restore FULL, DIFFERENTIAL và LOG với `STOPAT`.
12. Kiểm tra dữ liệu sau khôi phục.

**Lưu ý:** RECOVERY FULL chỉ có hiệu lực sau bản full đầu tiên.

## 4. Backup files

| Loại backup | File | Kết quả |
|---|---|---|
| FULL | `Bk_full.bak` | VERIFYONLY thành công |
| DIFFERENTIAL | `Bk_diff.bak` | VERIFYONLY thành công |
| LOG | `Bk_log1.trn` | VERIFYONLY thành công |

Cả ba backup đều được kiểm tra bằng `RESTORE VERIFYONLY` và SQL Server xác nhận backup hợp lệ.

Không sử dụng `WITH COMPRESSION` vì môi trường kiểm thử sử dụng SQL Server Express.

## 5. Thời điểm khôi phục

| Mốc thời gian | Giá trị |
|---|---|
| Thời điểm ghi nhận PITR (UTC) | `2026-11-17 10:08:01.810` |
| STOPAT (UTC) | `2026-11-17 10:08:02.810` |
| STOPAT (Local) | `2026-11-17 17:08:02.810` |

Thời điểm STOPAT được đặt sau thời điểm ghi nhận PITR một giây để bảo đảm bao gồm các giao dịch readings đã được ghi trước khi mô phỏng sự cố.

## 6. Kết quả kiểm thử

### 6.1. Kết quả dữ liệu sau khôi phục

| Hạng mục | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---:|---:|---|
| Thresholds trong source sau sự cố | 0 | 0 | PASS |
| Thresholds trong target sau PITR | 4 | 4 | PASS |
| Readings nhóm 1 | 10 | 10 | PASS |
| Readings nhóm 2 | 10 | 10 | PASS |
| Tổng readings trong target | 20 | 20 | PASS |

### 6.2. Kết quả kiểm tra backup

| Hạng mục | Kết quả thực tế | Trạng thái |
|---|---|---|
| RESTORE VERIFYONLY FULL | Backup hợp lệ | PASS |
| RESTORE VERIFYONLY DIFFERENTIAL | Backup hợp lệ | PASS |
| RESTORE VERIFYONLY LOG | Backup hợp lệ | PASS |
| Restore FULL | Thành công | PASS |
| Restore DIFFERENTIAL | Thành công | PASS |
| Restore LOG với STOPAT | Thành công | PASS |
| Kiểm tra dữ liệu PITR | `PITR CHECK PASS` | PASS |

### 6.3. ReadingId của dữ liệu kiểm thử

| Nhóm | ReadingId bắt đầu | ReadingId kết thúc | Số lượng |
|---|---:|---:|---:|
| Group 1 | 54165 | 54174 | 10 |
| Group 2 | 54175 | 54184 | 10 |

Các nhóm readings được kiểm tra theo khoảng ReadingId của lần chạy hiện tại, tránh nhầm lẫn với dữ liệu từ các lần kiểm thử trước.

## 7. Kết quả thực thi

Các thông báo xác nhận cuối cùng từ script:

```text
RESTORE PITR PASS
Target : SwiftletCare_Restore
STOPAT : 2026-11-17T17:08:02.810

[VERIFY] Kiem tra ket qua PITR...
DatabaseName ThresholdCount ReadingCount
------------ -------------- ------------
RESTORE                   4           20
SOURCE                    0           20

PITR CHECK PASS

PITR DEMO PASS
Full : C:\SwiftletBackup\Bk_full.bak
Diff : C:\SwiftletBackup\Bk_diff.bak
Log  : C:\SwiftletBackup\Bk_log1.trn
STOPAT local: 2026-11-17T17:08:02.810
```

### Thời gian thực thi backup và restore

| Thao tác | Thời gian |
|---|---:|
| FULL backup | 0.189 giây |
| DIFFERENTIAL backup | 0.027 giây |
| LOG backup | 0.006 giây |
| Restore FULL | 0.426 giây |
| Restore DIFFERENTIAL | 0.398 giây |
| Restore LOG | 0.006 giây |

## 8. Kết luận

Task 8 hoàn thành với kết quả PASS.

Quy trình đã thực hiện thành công FULL, DIFFERENTIAL và TRANSACTION LOG backup, kiểm tra tính hợp lệ của các backup bằng `RESTORE VERIFYONLY`, sau đó khôi phục database bằng `STOPAT`.

Kết quả cho thấy:

- Source database đã bị xóa 4 dòng Thresholds trong quá trình mô phỏng sự cố.
- Target database khôi phục lại được đầy đủ 4 dòng Thresholds.
- Cả hai nhóm readings được tạo trước sự cố đều được khôi phục, tổng cộng 20 readings.
- Các bước restore và kiểm tra dữ liệu đều trả về trạng