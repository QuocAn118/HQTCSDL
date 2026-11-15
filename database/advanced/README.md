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