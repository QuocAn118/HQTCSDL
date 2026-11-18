# Database Advanced

Thư mục này chứa các công cụ, thư viện dùng chung và kịch bản kiểm thử nâng cao cho SQL Server thuộc dự án SwiftletCare.

## 1. Cấu trúc thư mục

```text
database/advanced/
├── lib.ps1
├── README.md
├── results/
│   ├── checks.md
│   └── security.md
├── security/
│   ├── create-logins.ps1
│   ├── create-logins.sql
│   ├── login-smoke.sql
│   ├── run-security-test.ps1
│   └── security.test.sql
└── tests/
    ├── guards.ps1
    └── fixtures/
        └── needs-perf.ps1
```

Các script SQL phân quyền được lưu tại:

```text
database/sql/04-security/01-roles-users.sql
```

## 2. Thư viện dùng chung

File `lib.ps1` cung cấp các hàm hỗ trợ:

- `Assert-DbSuffix`: Kiểm tra tên database có đúng hậu tố yêu cầu hay không.
- `Invoke-SqlWin`: Thực thi SQL bằng Windows Authentication.
- `Invoke-SqlAs`: Thực thi SQL bằng SQL Login và mật khẩu tương ứng.

Thư viện đồng thời sử dụng lại các hàm từ `database/scripts/lib.ps1`, bao gồm `Read-DotEnv`, `Invoke-Sql` và `Get-SqlScalar`.

## 3. Kiểm tra hậu tố database

Các script thao tác trên database có hậu tố riêng phải gọi `Assert-DbSuffix` trước khi đọc `.env` hoặc thực hiện SQL.

Quy ước kết quả:

| Exit code | Ý nghĩa |
|---|---|
| 0 | Tên database hợp lệ |
| 2 | Database không có hậu tố được yêu cầu |
| 3 | Database chứa ký tự không hợp lệ |

Chạy bộ kiểm thử:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\tests\guards.ps1"
```

Các trường hợp được kiểm tra:

- Database có hậu tố `_Perf`.
- Database có hậu tố `_perf` (không phân biệt chữ hoa, chữ thường).
- Database có hậu tố gần giống nhưng không chính xác.
- Database không có hậu tố.
- Database có thêm phần ký tự phía sau hậu tố.
- Database chứa ký tự không hợp lệ hoặc có nguy cơ chèn SQL.

Kết quả kiểm thử:

```text
guards: PASS
```

## 4. Tạo SQL Login

### 4.1. Điều kiện thực hiện

Cần chạy PowerShell bằng tài khoản Windows có quyền `sysadmin` trên SQL Server.

Hai login được tạo:

| Login | Mục đích |
|---|---|
| `app_backend` | Tài khoản dành cho ứng dụng backend |
| `app_report` | Tài khoản dành cho các tác vụ báo cáo |

### 4.2. Cấu hình mật khẩu

Thêm hai biến sau vào file `database/.env`:

```env
APP_BACKEND_PASSWORD=<mat_khau_backend>
APP_REPORT_PASSWORD=<mat_khau_report>
```

Thay giá trị mẫu bằng mật khẩu riêng, đáp ứng chính sách mật khẩu của SQL Server.

Lưu ý:

- Hai mật khẩu này độc lập với `DB_PASSWORD`.
- Không sử dụng mật khẩu mẫu trong môi trường thực tế.
- Không commit file `.env` lên Git.
- Không đưa mật khẩu trực tiếp vào source code.
- Mật khẩu không được chứa dấu nháy đơn (`'`) theo quy định của script.

### 4.3. Thực thi

Chạy lệnh:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\security\create-logins.ps1"
```

Kết quả thành công:

```text
Da tao/cap nhat login app_backend va app_report.
```

### 4.4. Cơ chế tạo và cập nhật login

Script `create-logins.ps1` thực hiện các bước:

1. Đọc cấu hình từ `database/.env`.
2. Kiểm tra hai biến mật khẩu `APP_BACKEND_PASSWORD` và `APP_REPORT_PASSWORD`.
3. Từ chối nếu thiếu mật khẩu, mật khẩu rỗng hoặc chứa dấu nháy đơn.
4. Đưa mật khẩu vào biến môi trường để truyền cho SQLCMD.
5. Thực thi file `create-logins.sql` trên database `master`.
6. Xóa các biến môi trường chứa mật khẩu trong khối `finally`.

File `create-logins.sql` sử dụng cơ chế:

- Nếu login chưa tồn tại: thực hiện `CREATE LOGIN`.
- Nếu login đã tồn tại: thực hiện `ALTER LOGIN`.

Không sử dụng `DROP LOGIN` để tạo lại tài khoản. Điều này giúp giữ nguyên SID của login khi cập nhật mật khẩu.

### 4.5. Kiểm tra SID

Có thể xác nhận SID của login trước và sau khi chạy lại script:

```powershell
$sid1 = (sqlcmd -S tcp:127.0.0.1,1433 -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CONVERT(VARCHAR(100), SUSER_SID(N'app_backend'), 1)").Trim()

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\security\create-logins.ps1"

$sid2 = (sqlcmd -S tcp:127.0.0.1,1433 -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CONVERT(VARCHAR(100), SUSER_SID(N'app_backend'), 1)").Trim()

if ($sid1 -eq $sid2) {
    Write-Host "PASS: SID duoc giu nguyen"
}
else {
    Write-Host "FAIL: SID da thay doi"
}
```

Nếu hai SID giống nhau, login được giữ nguyên danh tính sau khi chạy lại script.

## 5. Role, database user và phân quyền

Task 3 triển khai hai role riêng để phân tách quyền truy cập giữa Backend và Reporting.

### 5.1. Role và thành viên

| Role | Database user | SQL Login | Mục đích |
|---|---|---|---|
| `role_backend` | `app_backend` | `app_backend` | Phục vụ ứng dụng Backend |
| `role_report` | `app_report` | `app_report` | Phục vụ truy vấn báo cáo |

Script phân quyền:

```text
database/sql/04-security/01-roles-users.sql
```

Script tạo role nếu chưa tồn tại, tạo database user tương ứng với login và thêm user vào role.

### 5.2. Ma trận quyền

| Đối tượng | `role_backend` | `role_report` |
|---|---|---|
| Stored Procedures được chỉ định | EXECUTE | Không cấp |
| `vw_LatestReadings` | SELECT | SELECT |
| `vw_OpenAlerts` | SELECT | SELECT |
| `vw_DailyEnvStats` | SELECT | SELECT |
| `vw_DailyBirdFlow` | SELECT | SELECT |
| `Users` | SELECT, INSERT, UPDATE | Không cấp |
| `Houses` | SELECT, INSERT, UPDATE | Không cấp |
| `Zones` | SELECT, INSERT, UPDATE | Không cấp |
| `Devices` | SELECT, INSERT, UPDATE | Không cấp |
| `Thresholds` | SELECT, INSERT, UPDATE | Không cấp |
| `Harvests` | SELECT, INSERT | Không cấp |
| `Metrics` | SELECT | Không cấp |
| `Alerts` | SELECT | Không cấp |
| `ControlLogs` | SELECT | Không cấp |
| `BirdCounts` | SELECT | Không cấp |
| `SensorReadings` | SELECT | Không cấp |

Backend được cấp EXECUTE trên 9 Stored Procedures:

1. `sp_IngestReadings`
2. `sp_SetActuator`
3. `sp_UpdateAlertStatus`
4. `sp_GetReadingHistory`
5. `sp_RecordBirdCount`
6. `sp_CreatePredatorAlert`
7. `sp_DetectAnomalies`
8. `sp_RecordHeartbeat`
9. `sp_Report_EnvStabilityVsYield`

Nguyên tắc phân quyền:

- Không cấp DELETE cho hai role.
- Không cấp quyền CREATE TABLE hoặc DROP TABLE.
- Không cấp ALTER hoặc CONTROL trên schema.
- Không cấp quyền truy cập toàn schema.
- Chỉ cấp quyền trên các object cần thiết.

### 5.3. Chạy triển khai quyền

Có thể chạy riêng file phân quyền bằng Windows Authentication:

```powershell
sqlcmd -S tcp:127.0.0.1,1433 -E -C -b -d SwiftletCare_Dev -i ".\database\sql\04-security\01-roles-users.sql"
```

Quy trình deploy database cũng đã bổ sung thư mục `04-security`, vì vậy các quyền được áp dụng trong quá trình triển khai database.

## 6. Kiểm tra user mồ côi

### 6.1. Nguyên nhân

Khi phục hồi database từ file backup trên máy khác, SID của database user có thể không khớp với SID của SQL Login trên máy hiện tại.

Trường hợp này có thể tạo ra orphaned user.

### 6.2. Truy vấn kiểm tra

```sql
SELECT dp.name
FROM sys.database_principals dp
LEFT JOIN sys.server_principals sp
    ON sp.sid = dp.sid
WHERE dp.name IN (N'app_backend', N'app_report')
  AND sp.sid IS NULL;
```

Nếu truy vấn không trả về dòng nào thì không phát hiện orphan user trong hai tài khoản đang kiểm tra.

### 6.3. Cách xử lý

Nếu login chưa tồn tại, chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\security\create-logins.ps1"
```

Nếu login đã tồn tại nhưng database user bị orphan, có thể ánh xạ lại:

```sql
ALTER USER app_backend WITH LOGIN = app_backend;
ALTER USER app_report WITH LOGIN = app_report;
```

Chỉ thực hiện lệnh `ALTER USER` cho user thực sự bị orphan.

Nếu đang tạo mới database kiểm thử `_Test` hoặc `_Dev`, có thể sử dụng quy trình deploy có `-Reset` khi đã xác nhận có thể xóa dữ liệu của database đó.

## 7. Kiểm thử phân quyền

### 7.1. Chạy tự động

Script:

```text
database/advanced/security/run-security-test.ps1
```

Chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\security\run-security-test.ps1"
```

Mặc định script sử dụng `SwiftletCare_Test`.

Có thể chỉ định database khác nếu đáp ứng điều kiện hậu tố `_Test`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\security\run-security-test.ps1" -Database "SwiftletCare_Test"
```

Script thực hiện:

1. Kiểm tra hậu tố database.
2. Deploy database với `-Reset`.
3. Kiểm tra SQL Login tồn tại và database user không bị orphan.
4. Chạy bộ kiểm thử `security.test.sql`.
5. Chạy `login-smoke.sql` bằng `app_backend`.
6. Chạy `login-smoke.sql` bằng `app_report`.
7. Kiểm tra `app_backend` không thể DROP TABLE `dbo.SensorReadings`.

Kết quả hoàn thành:

```text
security: PASS
```

### 7.2. Các trường hợp CA1–CA8

| Mã | Nội dung kiểm thử |
|---|---|
| CA1 | Backend ingest reading và tạo cảnh báo theo ngưỡng |
| CA2 | Kiểm tra trigger tạo cảnh báo khi thiết bị OFFLINE |
| CA3 | Backend và report đọc được `vw_OpenAlerts` |
| CA4 | Backend đọc được `Users`, report bị từ chối |
| CA5 | Report bị từ chối EXECUTE `sp_GetReadingHistory` |
| CA6 | Backend và report bị từ chối DELETE |
| CA7 | Backend và report bị từ chối DROP TABLE |
| CA8 | Backend và report bị từ chối CREATE TABLE |

Kết quả kiểm thử thực tế trên `SwiftletCare_Test`: **8/8 PASS**.

### 7.3. Smoke test

File `login-smoke.sql`:

```sql
SET NOCOUNT ON;

SELECT TOP 1 1 AS SmokeTest
FROM dbo.vw_OpenAlerts;
```

Hai login `app_backend` và `app_report` đều thực hiện truy vấn thành công trên `SwiftletCare`.

## 8. Demo phân quyền

### 8.1. Backend được phép đọc view

Ví dụ truy vấn bằng `app_backend`:

```sql
SELECT TOP 1 *
FROM dbo.vw_OpenAlerts;
```

Kết quả mong đợi: truy vấn thành công.

### 8.2. Report bị giới hạn quyền truy cập bảng Users

Ví dụ truy vấn bằng `app_report`:

```sql
SELECT TOP 1 UserId
FROM dbo.Users;
```

Kết quả mong đợi: SQL Server từ chối do login không được cấp quyền SELECT trên bảng `Users`.

### 8.3. Backend không được phép DROP TABLE

Ví dụ truy vấn bằng `app_backend`:

```sql
DROP TABLE dbo.SensorReadings;
```

Kết quả kiểm thử thực tế: SQL Server trả lỗi 3701, SQLCMD trả exit code 1 và bảng vẫn tồn tại sau phép thử.

Lưu ý: lỗi 3701 có thể xuất hiện khi object không tồn tại hoặc login không có quyền. Vì vậy cần xác nhận bảng tồn tại trước và sau khi thực hiện phép thử để sử dụng làm bằng chứng từ chối quyền.

## 9. Kết quả kiểm thử Task 2 và Task 3

### Task 2

| Hạng mục | Kết quả |
|---|---|
| Tạo thư viện `lib.ps1` | PASS |
| Kiểm tra 6 trường hợp guard | PASS |
| Tạo fixture `needs-perf.ps1` | PASS |
| Tạo file SQL tạo login | PASS |
| Kiểm tra cấu hình mật khẩu | PASS |
| Tạo/cập nhật `app_backend` và `app_report` | PASS |
| Kiểm tra SID sau khi chạy lại script | PASS |

### Task 3

| Hạng mục | Kết quả |
|---|---|
| Tạo role `role_backend`, `role_report` | PASS |
| Ánh xạ database user với login | PASS |
| Kiểm tra orphan user | PASS – 0 dòng |
| Kiểm thử CA1–CA8 | PASS – 8/8 |
| Smoke test `app_backend` | PASS |
| Smoke test `app_report` | PASS |
| Kiểm tra 39 dòng quyền trên `SwiftletCare` | PASS |
| Deploy `SwiftletCare_Test` | PASS |
| Deploy `SwiftletCare_Dev` hai lần | PASS |
| Deploy `SwiftletCare` | PASS |
| Kiểm tra từ chối DROP TABLE trên `SwiftletCare` | PASS |

Chi tiết kết quả được lưu tại:

```text
database/advanced/results/security.md
database/advanced/results/checks.md
```

## 10. Lưu ý bảo mật

- Không commit `database/.env`.
- Không đưa mật khẩu SQL Login vào source code hoặc báo cáo.
- Không sử dụng `-Reset` trên database chứa dữ liệu cần giữ.
- Không cấp quyền rộng hơn nhu cầu thực tế của ứng dụng.
- Kiểm tra lại role, user và quyền sau khi phục hồi database từ backup.
## 11. Kiểm thử điều khiển tương tranh

Task 5 sử dụng hai phiên SQL Server để mô phỏng tình huống Lost Update khi hai phiên cùng điều khiển một thiết bị.

### 11.1. Mục tiêu

Thiết bị được sử dụng trong bài kiểm thử:

| Thuộc tính | Giá trị |
|---|---|
| DeviceCode | `H1-F1-FAN` |
| DeviceId | `7` |
| Database kiểm thử | `SwiftletCare_Perf` |
| Session A | AUTO |
| Session B | MANUAL |

Tình huống cần chứng minh: Session A đọc trạng thái thiết bị trước, Session B cập nhật sang MANUAL, sau đó Session A ghi trạng thái AUTO cũ lên thiết bị. Nếu không có cơ chế bảo vệ phù hợp, cập nhật MANUAL của Session B sẽ bị ghi đè.

### 11.2. Các thành phần

| Thành phần | Chức năng |
|---|---|
| `concurrency/demo-procs.sql` | Tạo bảng DemoLog và hai stored procedure minh họa |
| `dbo.sp_SetActuatorNaive` | Mô phỏng cập nhật không khóa phù hợp |
| `dbo.sp_SetActuatorSafe` | Sử dụng khóa giao dịch để tuần tự hóa cập nhật |
| `dbo.DemoLog` | Ghi lại thứ tự READ và WRITE của từng phiên |
| `tests/run-two-sessions.ps1` | Khởi chạy hai phiên SQL độc lập |

Các thủ tục demo chỉ phục vụ kiểm thử trên `SwiftletCare_Perf`; không thay thế hoặc chỉnh sửa stored procedure điều khiển thiết bị trong ứng dụng.

### 11.3. Chạy kiểm thử

Chạy tại thư mục gốc repository.

Kiểm thử tình huống không an toàn:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\tests\run-two-sessions.ps1" -Scenario lost-update-naive
```

Kiểm thử tình huống có khóa an toàn:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\tests\run-two-sessions.ps1" -Scenario lost-update-safe
```

Runner lưu trạng thái ban đầu của thiết bị và khôi phục trạng thái sau khi hoàn thành kiểm thử.

### 11.4. Kiểm tra nhật ký hai phiên

```sql
SELECT TOP 20
    Id,
    Scenario,
    Sess,
    Step,
    Val,
    At
FROM dbo.DemoLog
WHERE Scenario IN (
    'lost-update-naive',
    'lost-update-safe'
)
ORDER BY Id;
```

Cột `Sess` xác định phiên A hoặc B. Cột `Step` thể hiện thao tác READ hoặc WRITE. Cột `Val` ghi lại trạng thái Mode và IsOn tại thời điểm thao tác.

### 11.5. Kết quả thực nghiệm

**Trường hợp Naive**

Nhật ký ghi nhận thứ tự:

| Thứ tự | Phiên | Thao tác | Trạng thái |
|---|---|---|---|
| 1 | A | READ | AUTO, IsOn=0 |
| 2 | B | READ | AUTO, IsOn=1 |
| 3 | B | WRITE | MANUAL, IsOn=1 |
| 4 | A | WRITE | AUTO, IsOn=0 |

Session B đã ghi MANUAL thành công, nhưng Session A tiếp tục ghi AUTO sau đó. Đây là hiện tượng Lost Update.

Trạng thái cuối của lần chạy kiểm thử là `AUTO|0`.

**Trường hợp Safe**

Nhật ký ghi nhận thứ tự:

| Thứ tự | Phiên | Thao tác | Trạng thái |
|---|---|---|---|
| 1 | A | READ | AUTO, IsOn=0 |
| 2 | A | WRITE | AUTO, IsOn=0 |
| 3 | B | READ | AUTO, IsOn=1 |
| 4 | B | WRITE | MANUAL, IsOn=1 |

Session B chỉ đọc và cập nhật sau khi Session A hoàn tất thao tác. Kết quả cuối là `MANUAL|1`, do đó cập nhật MANUAL không bị ghi đè.

### 11.6. Kết luận

Thử nghiệm cho thấy cách cập nhật không có cơ chế khóa phù hợp có thể dẫn đến Lost Update khi hai phiên cùng thao tác trên một thiết bị.

Khi sử dụng cơ chế khóa trong giao dịch, các thao tác được tuần tự hóa và trạng thái cập nhật sau cùng được giữ lại theo thứ tự thực thi.

Kết quả này minh họa vai trò của kiểm soát tương tranh trong hệ thống quản lý thiết bị. Stored procedure sản phẩm `dbo.sp_SetActuator` được giữ nguyên trong quá trình thực hiện bài demo.

## Task 6 – Kiểm thử Deadlock

Task này sử dụng bảng demo độc lập `dbo.DeadlockDemoRows` trong `SwiftletCare_Perf`, không thay đổi dữ liệu thiết bị của hệ thống.

Chạy ba kịch bản từ thư mục gốc repository:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\tests\run-deadlock.ps1" -Scenario deadlock

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\tests\run-deadlock.ps1" -Scenario deadlock-fixed

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\tests\run-deadlock.ps1" -Scenario deadlock-retry
```

- `deadlock`: hai session cập nhật hai dòng theo thứ tự ngược nhau; kỳ vọng một session bị chọn làm deadlock victim với lỗi 1205.
- `deadlock-fixed`: hai session cập nhật theo cùng thứ tự khóa 1 rồi 2.
- `deadlock-retry`: stored procedure rollback và thử lại khi bắt được lỗi 1205.

Bằng chứng và kết quả thực tế được ghi trong `results/deadlock/task-6-deadlock.md`.


## 12. Point-in-Time Recovery (PITR)

Task 8 thực hành backup và restore database bằng FULL, DIFFERENTIAL và TRANSACTION LOG backup.

### 12.1. Yêu cầu

- SQL Server Express đang hoạt động.
- Source database: `SwiftletCare_Bk_Dev`.
- Target database: `SwiftletCare_Restore`.
- Thư mục backup: `C:\SwiftletBackup`.
- SQL Server service account có quyền Modify trên thư mục backup.

Cấp quyền nếu chưa có:

```powershell
icacls C:\SwiftletBackup /grant 'NT Service\MSSQL$SQLEXPRESS:(OI)(CI)M'
```

### 12.2. Chạy demo

Từ thư mục gốc repository:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\database\advanced\backup\pitr-demo.ps1
```

Không sử dụng `-ResetSourceAfter` nếu muốn giữ source ở trạng thái sau mô phỏng sự cố để đối chiếu với target.

### 12.3. Restore thủ công

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\database\advanced\backup\restore-pitr.ps1 `
  -Target SwiftletCare_Restore `
  -Full C:\SwiftletBackup\Bk_full.bak `
  -Diff C:\SwiftletBackup\Bk_diff.bak `
  -Log C:\SwiftletBackup\Bk_log1.trn `
  -StopAtLocal "yyyy-MM-ddTHH:mm:ss.fff"
```

`StopAtLocal` sử dụng thời gian local của máy SQL Server và bắt buộc có đủ mili giây theo định dạng `yyyy-MM-ddTHH:mm:ss.fff`.

### 12.4. Kết quả kiểm thử

Kết quả thực tế ngày 17/11/2026:

| Hạng mục | Kết quả |
|---|---|
| FULL backup | PASS |
| DIFFERENTIAL backup | PASS |
| TRANSACTION LOG backup | PASS |
| RESTORE VERIFYONLY | PASS – cả 3 backup |
| Restore FULL, DIFFERENTIAL, LOG | PASS |
| Source Thresholds sau sự cố | 0 |
| Target Thresholds sau PITR | 4 |
| Target readings sau PITR | 20 |
| Tổng readings được khôi phục | 20/20 |

Thời điểm STOPAT local: `2026-11-17T17:08:02.810`.

Bằng chứng chi tiết được lưu tại:

```text
database/advanced/results/backup.md
```

### 12.5. Lưu ý

- Chỉ sử dụng source có hậu tố `_Bk_Dev`.
- Target phải có hậu tố `_Restore`.
- Không chạy demo nếu source chưa có đủ 4 Thresholds tại zone H1-F1.
- Không dùng `WITH COMPRESSION` trên SQL Server Express.
- Không commit các file `.bak` và `.trn`.
- Không thao tác trên `SwiftletCare_Dev`.

## 13. Task 10 – Đo hiệu năng trước và sau INCLUDE

Task 10 đánh giá ảnh hưởng của Nonclustered Index có cột INCLUDE đối với các truy vấn đọc và ghi dữ liệu cảm biến trên database `SwiftletCare_Perf`.

### 13.1. Mục tiêu

So sánh hiệu năng trước và sau khi tạo index:

```sql
CREATE NONCLUSTERED INDEX IX_SensorReadings_Device_Metric_Time_Include
ON dbo.SensorReadings (DeviceId, MetricCode, RecordedAt)
INCLUDE (Value);
```

Index sử dụng ba cột khóa `DeviceId`, `MetricCode`, `RecordedAt` và cột INCLUDE `Value`.

Mục tiêu:
- Giảm logical reads của Q1 và Q2.
- Kiểm tra Key Lookup trong execution plan.
- Đánh giá ảnh hưởng đến truy vấn tổng hợp Q3.
- Đánh giá chi phí phát sinh khi ingest dữ liệu bằng Q4.

### 13.2. Các truy vấn kiểm thử

| Truy vấn | Nội dung |
|---|---|
| Q1 | Đọc TEMP của H1-F1-SENSOR trong khoảng 24 giờ |
| Q2 | Đọc TEMP của H1-F1-SENSOR trong khoảng 30 ngày |
| Q3 | Truy vấn `dbo.vw_LatestReadings` |
| Q4 | Gọi `sp_IngestReadings` với 1.000 readings trong transaction và ROLLBACK |

Các file truy vấn:

```text
database/advanced/perf/queries/Q1.sql
database/advanced/perf/queries/Q2.sql
database/advanced/perf/queries/Q3.sql
database/advanced/perf/queries/Q4.sql
```

### 13.3. Cách chạy đo hiệu năng

Chạy từ thư mục gốc repository.

Đo trước khi thêm INCLUDE:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\database\advanced\perf\measure.ps1 `
    -Phase truoc -Cold -Runs 5
```

Sau khi tạo index INCLUDE, đo lại:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\database\advanced\perf\measure.ps1 `
    -Phase sau -Cold -Runs 5
```

Tham số:
- `-Phase`: xác định pha `truoc` hoặc `sau`.
- `-Database`: database kiểm thử, mặc định `SwiftletCare_Perf`.
- `-Cold`: yêu cầu đo cold cache nếu thỏa điều kiện kiểm tra.
- `-Runs`: số lần chạy hot sau một lần warm-up bị loại bỏ.

Mỗi truy vấn được chạy một lần cold (nếu cold guard PASS), một lần warm-up không tính kết quả và 5 lần hot.

Kết quả được ghi nối tiếp vào:

```text
database/advanced/results/perf/timing.csv
```

Execution plan được lưu riêng cho từng truy vấn và từng pha:

```text
Q1-truoc.sqlplan ... Q4-truoc.sqlplan
Q1-sau.sqlplan   ... Q4-sau.sqlplan
```

### 13.4. Kết quả đo thực tế

Database kiểm thử có 5.030.784 dòng trong `SensorReadings`.

Bảng dưới đây sử dụng median của 5 lần chạy hot:

| Truy vấn | Logical reads trước | Logical reads sau | Elapsed trước | Elapsed sau |
|---|---:|---:|---:|---:|
| Q1 | 277 | 13 | 5 ms | 2 ms |
| Q2 | 8.090 | 159 | 136 ms | 82 ms |
| Q3 | 111 | 111 | 7 ms | 3 ms |
| Q4 | 20.769 | 23.007 | 0 ms | 0 ms |

Mức thay đổi logical reads:

| Truy vấn | Mức thay đổi |
|---|---:|
| Q1 | Giảm 95,31% |
| Q2 | Giảm 98,03% |
| Q3 | Không thay đổi |
| Q4 | Tăng 10,78% |

### 13.5. Phân tích execution plan

Q1 và Q2 là hai truy vấn được hưởng lợi rõ rệt từ index INCLUDE.

Execution plan sau khi tạo index cho thấy SQL Server sử dụng:

`IX_SensorReadings_Device_Metric_Time_Include`

Các cột `RecordedAt` và `Value` được lấy trực tiếp từ index. Trong phần execution plan tương ứng với truy vấn `SensorReadings`, không còn Key Lookup.

Điều này giúp giảm số trang dữ liệu phải đọc:
- Q1 giảm từ 277 xuống 13 logical reads.
- Q2 giảm từ 8.090 xuống 159 logical reads.

Lưu ý: execution plan của file Q1 và Q2 còn có statement tra cứu `DeviceId` từ bảng `Devices`. Khi kiểm tra Key Lookup, cần phân biệt statement này với statement truy vấn `SensorReadings`.

### 13.6. Đánh giá tác động

**Truy vấn đọc**

Q1 và Q2 giảm đáng kể logical reads sau khi bổ sung INCLUDE. Đây là kết quả phù hợp với mục tiêu tạo covering index, hạn chế việc phải truy cập thêm index hoặc bảng để lấy cột `Value`.

**Truy vấn tổng hợp**

Q3 giữ nguyên logical reads. Chưa có bằng chứng cho thấy index mới làm giảm lượng dữ liệu phải đọc của view `vw_LatestReadings`.

**Truy vấn ghi**

Q4 tăng logical reads từ 20.769 lên 23.007. Điều này phản ánh thêm chi phí duy trì index khi ingest dữ liệu.

Elapsed time của Q4 hiển thị 0 ms ở cả hai pha do thời gian thực thi nhỏ hơn độ phân giải mili giây của phép đo. Không sử dụng giá trị này để kết luận hai pha có chi phí ghi giống nhau.

### 13.7. Điều kiện đo cold cache

Cold cache chỉ được bật khi kiểm tra quyền `sysadmin` và điều kiện session thành công.

Trong môi trường kiểm thử, SQL Server CEIP sử dụng session dịch vụ `NT SERVICE\SQLTELEMETRY$SQLEXPRESS`. Session dịch vụ này được loại khỏi điều kiện kiểm tra session người dùng để không phải dừng dịch vụ hệ thống.

Do đó, kết quả cold cache được ghi nhận trong điều kiện kiểm thử thực tế của máy, không nên diễn giải là môi trường hoàn toàn không có bất kỳ session dịch vụ nào.

### 13.8. Kết luận

Index INCLUDE cải thiện rõ rệt hiệu năng đọc dữ liệu cảm biến của Q1 và Q2, đồng thời loại bỏ Key Lookup trong execution plan tương ứng.

Tuy nhiên, Q4 cho thấy logical reads tăng sau khi thêm index. Đây là sự đánh đổi giữa hiệu năng đọc và chi phí duy trì index khi ghi dữ liệu.

Kết quả cho thấy INCLUDE phù hợp với các truy vấn đọc thường xuyên cần lấy `Value`, nhưng cần cân nhắc tần suất ghi dữ liệu và chi phí bảo trì index.

Bằng chứng thực nghiệm được lưu tại:

```text
database/advanced/perf/queries/
database/advanced/results/perf/timing.csv
database/advanced/results/perf/Q1-truoc.sqlplan
database/advanced/results/perf/Q2-truoc.sqlplan
database/advanced/results/perf/Q3-truoc.sqlplan
database/advanced/results/perf/Q4-truoc.sqlplan
database/advanced/results/perf/Q1-sau.sqlplan
database/advanced/results/perf/Q2-sau.sqlplan
database/advanced/results/perf/Q3-sau.sqlplan
database/advanced/results/perf/Q4-sau.sqlplan
```

## 14. Task 12 – Lịch sao lưu tự động bằng Task Scheduler

Task 12 xây dựng hai script để thực hiện và lập lịch sao lưu SQL Server bằng Windows Authentication.

### 14.1. Các thành phần

| File | Chức năng |
|---|---|
| `backup/backup.ps1` | Thực hiện FULL hoặc LOG backup |
| `backup/schedule.ps1` | Cài đặt hoặc gỡ lịch Task Scheduler |

### 14.2. Thực hiện backup thủ công

FULL backup:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\database\advanced\backup\backup.ps1 `
    -Database SwiftletCare_Bk_Dev -Type Full
```

LOG backup:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\database\advanced\backup\backup.ps1 `
    -Database SwiftletCare_Bk_Dev -Type Log
```

Có thể chỉ định thư mục lưu backup bằng tham số `-Dir`. Mặc định là `C:\SwiftletBackup`.

### 14.3. Cơ chế backup và kiểm tra

Script sử dụng `sqlcmd -E`, tức Windows Authentication, không truyền SQL password.

Tên file được tạo theo định dạng:

```text
<Database>_<FULL|LOG>_<yyyyMMdd_HHmmss>.<bak|trn>
```

Quy trình thực hiện:

1. Kiểm tra database đang ONLINE.
2. Với LOG backup, kiểm tra Recovery Model phải là FULL và đã có FULL backup.
3. Thực hiện backup với tùy chọn `CHECKSUM`.
4. Chạy `RESTORE VERIFYONLY ... WITH CHECKSUM`.
5. Ghi kết quả PASS hoặc FAIL vào `backup.log`.

Nếu yêu cầu LOG backup không hợp lệ, script trả về exit code `3`.

### 14.4. Cài đặt lịch

Cài đặt lịch cho `SwiftletCare`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\database\advanced\backup\schedule.ps1 `
    -Action Install -Database SwiftletCare
```

Hai lịch được tạo:

| Task | Lịch chạy |
|---|---|
| `SwiftletCare-Full` | Hằng ngày lúc 02:00 |
| `SwiftletCare-Log` | Mỗi 15 phút |

Task chạy bằng tài khoản Windows cài đặt lịch, không cấu hình SQL password hoặc mật khẩu tài khoản Windows trong script.

Kiểm tra trạng thái:

```powershell
schtasks.exe /Query /TN SwiftletCare-Full /V /FO LIST
schtasks.exe /Query /TN SwiftletCare-Log /V /FO LIST
```

### 14.5. Gỡ lịch

Sau khi hoàn thành kiểm thử:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\database\advanced\backup\schedule.ps1 `
    -Action Remove -Database SwiftletCare
```

Lệnh này chỉ xóa hai Scheduled Tasks, không xóa các file backup.

### 14.6. Lưu ý vận hành

- Máy tính phải đang bật và tài khoản Windows cài đặt lịch phải đăng nhập.
- Cấu hình kiểm thử hiện tại không cho task khởi chạy khi dùng pin và sẽ dừng nếu chuyển sang dùng pin.
- `StartWhenAvailable` đang tắt, do đó không bật cơ chế tự chạy bù khi bỏ lỡ thời điểm chạy.
- Cần bảo đảm SQL Server service account có quyền ghi vào thư mục backup.
- Cần sao lưu hoặc luân chuyển `backup.log` định kỳ để tránh file log tăng kích thước liên tục.
- Cần duy trì chuỗi FULL và LOG backup phù hợp để có thể phục hồi database.

Kết quả kiểm thử Task 12 được ghi tại:

```text
database/advanced/results/backup.md
```

## 15. Thuyết trình và trình diễn

### 15.1. Mục tiêu

Trình bày các kết quả kiểm thử nâng cao của SwiftletCare, tập trung vào bảo mật, điều khiển tương tranh, phục hồi dữ liệu và tối ưu truy vấn.

### 15.2. Kịch bản demo trực tiếp

**Demo 1 – Phân quyền và bảo mật**

```powershell
.\database\advanced\security\run-security-test.ps1
```

Trình bày:
- Kiểm tra quyền của các tài khoản ứng dụng.
- Chứng minh tài khoản không đủ quyền không thể DROP TABLE.
- Kiểm tra quyền đọc, ghi và thực thi procedure.
- Smoke test cho `app_backend` và `app_report`.

**Demo 2 – Lost Update và Isolation Level**

```powershell
.\database\advanced\tests\run-two-sessions.ps1 -Scenario lost-update-naive
.\database\advanced\tests\run-two-sessions.ps1 -Scenario lost-update-safe
.\database\advanced\tests\run-two-sessions.ps1 -Scenario isolation-rc
.\database\advanced\tests\run-two-sessions.ps1 -Scenario isolation-rr
.\database\advanced\tests\run-two-sessions.ps1 -Scenario isolation-snapshot
```

Giải thích sự khác nhau giữa Lost Update không an toàn và cách xử lý an toàn; so sánh hành vi đọc dữ liệu của READ COMMITTED, REPEATABLE READ và SNAPSHOT.

**Demo 3 – Deadlock**

```powershell
.\database\advanced\tests\run-deadlock.ps1
```

Trình bày tình huống deadlock, cách xử lý và cơ chế retry.

**Demo 4 – Point-in-Time Recovery**

```powershell
.\database\advanced\backup\pitr-demo.ps1
```

Trình bày chuỗi FULL, DIFFERENTIAL, LOG backup; mô phỏng xóa dữ liệu; phục hồi bằng `STOPAT` sang database đích.

Lưu ý: script PITR ghi đè database `SwiftletCare_Restore`. Chỉ chạy demo khi database đích được phép sử dụng lại.

### 15.3. Số liệu tối ưu truy vấn

| Query | Logical reads trước | Logical reads sau | Thay đổi |
|---|---:|---:|---:|
| Q1 | 277 | 13 | Giảm 95.31% |
| Q2 | 8090 | 158 | Giảm 98.05% |
| Q3 | 111 | 111 | Không đổi |
| Q4 | 20769 | 22679.5 | Tăng 9.20% |

Kết luận: INCLUDE giúp giảm đáng kể logical reads cho Q1 và Q2. Q4 cho thấy cần cân nhắc chi phí ghi và bảo trì index khi tối ưu truy vấn.

### 15.4. Phạm vi chưa hoàn thành

**Task 13 – Partitioning chưa được thực hiện do không đủ thời gian triển khai và kiểm thử.** Nhóm không có kết quả thực nghiệm về Partitioning để trình bày và không tính đây là hạng mục đã hoàn thành.

### 15.5. Thứ tự trình bày đề xuất

1. Giới thiệu mục tiêu Database Advanced.
2. Trình diễn phân quyền và bảo mật.
3. So sánh Lost Update và các mức Isolation.
4. Trình diễn Deadlock.
5. Trình diễn Point-in-Time Recovery.
6. Trình bày số liệu tối ưu INCLUDE.
7. Nêu giới hạn phạm vi: Task 13 chưa thực hiện do không đủ thời gian.
8. Tổng kết kết quả và bài học.
