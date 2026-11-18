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
- Các bước restore và kiểm tra dữ liệu đều trả về trạng thái thành công.

---

# Task 12 – Lịch sao lưu bằng Task Scheduler

## 1. Mục tiêu

Xây dựng quy trình sao lưu tự động cho SQL Server bằng PowerShell và Windows Task Scheduler.

Hai loại backup được triển khai:

- FULL backup hằng ngày lúc 02:00.
- TRANSACTION LOG backup mỗi 15 phút.

Các thao tác sử dụng Windows Authentication, không lưu SQL password trong script.

## 2. Thành phần triển khai

| File | Chức năng |
|---|---|
| `database/advanced/backup/backup.ps1` | Thực hiện FULL hoặc LOG backup |
| `database/advanced/backup/schedule.ps1` | Cài đặt và gỡ Scheduled Tasks |

Thư mục lưu backup:

```text
C:\SwiftletBackup
```

File log:

```text
C:\SwiftletBackup\backup.log
```

## 3. Kiểm thử backup thủ công

### 3.1. FULL backup trên SwiftletCare_Bk_Dev

Lệnh thực hiện:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\database\advanced\backup\backup.ps1 `
    -Database SwiftletCare_Bk_Dev -Type Full
```

Kết quả:

| Hạng mục | Kết quả |
|---|---|
| File backup | `SwiftletCare_Bk_Dev_FULL_20261118_083904.bak` |
| Backup | PASS |
| RESTORE VERIFYONLY | PASS |

### 3.2. LOG backup trên SwiftletCare_Bk_Dev

Lệnh thực hiện:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\database\advanced\backup\backup.ps1 `
    -Database SwiftletCare_Bk_Dev -Type Log
```

Kết quả:

| Hạng mục | Kết quả |
|---|---|
| File backup | `SwiftletCare_Bk_Dev_LOG_20261118_084003.trn` |
| Backup | PASS |
| RESTORE VERIFYONLY | PASS |

### 3.3. Kiểm tra điều kiện Recovery Model

Thử LOG backup trên `SwiftletCare` khi database đang ở SIMPLE.

Kết quả:

```text
LOG backup bi tu choi: SwiftletCare dang o SIMPLE, can FULL.
Exit code: 3
```

Đây là kết quả mong đợi. Script từ chối thực hiện LOG backup khi Recovery Model không phù hợp.

## 4. Cấu hình SwiftletCare

Theo yêu cầu Task 12, Recovery Model của `SwiftletCare` được chuyển từ SIMPLE sang FULL:

```sql
ALTER DATABASE [SwiftletCare] SET RECOVERY FULL;
```

Sau đó thực hiện FULL backup đầu tiên để khởi tạo chuỗi LOG backup:

| Hạng mục | Kết quả |
|---|---|
| Recovery Model | FULL |
| FULL backup | PASS |
| File | `SwiftletCare_FULL_20261118_084643.bak` |
| RESTORE VERIFYONLY | PASS |

**Lưu ý:** Recovery Model của `SwiftletCare` được giữ ở FULL sau khi hoàn thành kiểm thử.

## 5. Cài đặt Task Scheduler

Cài đặt bằng lệnh:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\database\advanced\backup\schedule.ps1 `
    -Action Install -Database SwiftletCare
```

Kết quả tạo hai tác vụ:

| Task | Lịch chạy | Kết quả cài đặt |
|---|---|---|
| `SwiftletCare-Full` | Hằng ngày 02:00 | PASS |
| `SwiftletCare-Log` | Mỗi 15 phút | PASS |

Task chạy dưới tài khoản Windows cài đặt lịch. Không cấu hình `/RU` kèm mật khẩu hoặc `/RP`.

## 6. Kiểm chứng LOG backup tự động

Sau khi cài lịch, máy được cắm nguồn và giữ phiên đăng nhập Windows.

Tại lần kiểm tra lúc 09:03 ngày 18/11/2026, Task Scheduler ghi nhận:

| Thuộc tính | Giá trị |
|---|---|
| Task | `SwiftletCare-Log` |
| Last Run Time | `18/11/2026 09:02:01` |
| Last Result | `0` |
| Next Run Time | `18/11/2026 09:17:00` |
| Repeat | 15 phút |

File backup được tạo tự động:

```text
SwiftletCare_LOG_20261118_090202.trn
```

Kết quả trong `backup.log`:

```text
2026-11-18 09:02:02 | PASS | Database=SwiftletCare | Type=LOG | File=C:\SwiftletBackup\SwiftletCare_LOG_20261118_090202.trn | VERIFYONLY=PASS
```

Đây là bằng chứng xác nhận lịch LOG backup tự động hoạt động, không cần gọi thủ công `schtasks /Run` tại thời điểm 09:02.

## 7. Kết quả kiểm thử tổng hợp

| Hạng mục | Kết quả |
|---|---|
| FULL backup SwiftletCare_Bk_Dev | PASS |
| LOG backup SwiftletCare_Bk_Dev | PASS |
| Từ chối LOG backup khi SIMPLE | PASS – exit code 3 |
| Chuyển SwiftletCare sang FULL | PASS |
| FULL backup đầu tiên của SwiftletCare | PASS |
| Cài lịch FULL 02:00 | PASS |
| Cài lịch LOG mỗi 15 phút | PASS |
| LOG backup tự động lúc 09:02 | PASS |
| RESTORE VERIFYONLY cho các file backup kiểm thử | PASS |
| Gỡ lịch FULL và LOG | PASS |

Lưu ý: lịch FULL đã được cài đặt thành công nhưng chưa chờ đến 02:00 để kiểm chứng một lần chạy tự động thực tế. Vì vậy không kết luận lịch FULL đã được kiểm chứng thực thi định kỳ.

## 8. Gỡ Scheduled Tasks

Sau khi thu thập bằng chứng, thực hiện:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\database\advanced\backup\schedule.ps1 `
    -Action Remove -Database SwiftletCare
```

Kết quả:

```text
Removing task: SwiftletCare-Full
SUCCESS: The scheduled task "SwiftletCare-Full" was successfully deleted.
Removing task: SwiftletCare-Log
SUCCESS: The scheduled task "SwiftletCare-Log" was successfully deleted.
SCHEDULE REMOVE PASS
```

Hai lệnh truy vấn task sau đó trả về thông báo không tìm thấy task, phù hợp với trạng thái đã gỡ thành công.

Các file backup và `backup.log` vẫn được giữ nguyên.

## 9. Lưu ý vận hành

- Task Scheduler hiện sử dụng chế độ `Interactive only`, cần tài khoản Windows cài đặt lịch đăng nhập.
- Cấu hình hiện tại không cho phép chạy khi máy dùng pin.
- `StartWhenAvailable` đang tắt, do đó không tự chạy bù các lần bị bỏ lỡ.
- Máy phải bật tại thời điểm lịch chạy.
- Cần theo dõi dung lượng thư mục `C:\SwiftletBackup`.
- Cần sao lưu hoặc luân chuyển `backup.log` định kỳ.
- Cần duy trì FULL backup và chuỗi LOG backup để hỗ trợ phục hồi dữ liệu.

## 10. Kết luận

Task 12 hoàn thành với kết quả PASS cho quy trình backup thủ công, kiểm tra tính hợp lệ bằng `RESTORE VERIFYONLY`, cài đặt Task Scheduler, kiểm chứng LOG backup tự động và gỡ lịch sau khi demo.

Lịch LOG đã được xác nhận chạy tự động theo chu kỳ 15 phút. Lịch FULL đã được cài đặt nhưng chưa có bằng chứng chạy tự động lúc 02:00.
