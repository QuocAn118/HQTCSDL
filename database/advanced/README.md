# Database Advanced

Thư mục này chứa các công cụ và kịch bản kiểm thử nâng cao cho SQL Server thuộc dự án SwiftletCare.

## 1. Cấu trúc thư mục

```text
database/advanced/
├── lib.ps1
├── README.md
├── results/
│   └── checks.md
├── security/
│   ├── create-logins.ps1
│   └── create-logins.sql
└── tests/
    ├── guards.ps1
    └── fixtures/
        └── needs-perf.ps1
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
powershell -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\tests\guards.ps1"
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
powershell -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\security\create-logins.ps1"
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
$sid1 = (sqlcmd -S localhost,1433 -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CONVERT(VARCHAR(100), SUSER_SID(N'app_backend'), 1)").Trim()

powershell -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\security\create-logins.ps1"

$sid2 = (sqlcmd -S localhost,1433 -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CONVERT(VARCHAR(100), SUSER_SID(N'app_backend'), 1)").Trim()

if ($sid1 -eq $sid2) {
    Write-Host "PASS: SID duoc giu nguyen"
}
else {
    Write-Host "FAIL: SID da thay doi"
}
```

Nếu hai SID giống nhau, login được giữ nguyên danh tính sau khi chạy lại script.

## 5. Lưu ý khi phục hồi database

Khi phục hồi database từ file backup trên máy khác, SID của database user có thể không khớp với SID của SQL Login trên máy hiện tại.

Trường hợp này có thể tạo ra orphaned user.

Cần kiểm tra và xử lý orphaned user trước khi cấp quyền và sử dụng login. Nội dung xử lý chi tiết được thực hiện trong task bảo mật tiếp theo.

## 6. Kết quả kiểm thử Task 2

| Hạng mục | Kết quả |
|---|---|
| Tạo thư viện `lib.ps1` | PASS |
| Kiểm tra 6 trường hợp guard | PASS |
| Tạo fixture `needs-perf.ps1` | PASS |
| Tạo file SQL tạo login | PASS |
| Kiểm tra cấu hình mật khẩu | PASS |
| Tạo/cập nhật `app_backend` và `app_report` | PASS |
| Kiểm tra SID sau khi chạy lại script | PASS |

Các kết quả trên ghi nhận những bước đã thực hiện trong Task 2. Các bước phân quyền và kiểm thử truy cập sẽ được thực hiện ở task tiếp theo.