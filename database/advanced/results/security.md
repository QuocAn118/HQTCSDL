# Task 3 – Role, user và kiểm thử phân quyền

**Ngày kiểm thử:** 15/11/2026  
**Trạng thái:** PASS

## 1. Mục tiêu

- Tạo role riêng cho backend và reporting.
- Ánh xạ SQL Server login vào database user tương ứng.
- Cấp quyền theo nguyên tắc tối thiểu.
- Kiểm tra quyền đọc, ghi, thực thi stored procedure và các thao tác bị từ chối.
- Kiểm tra user mồ côi và khả năng deploy nhiều lần.

## 2. Các thành phần triển khai

| File | Chức năng |
|---|---|
| `database/sql/04-security/01-roles-users.sql` | Tạo role, database user và cấp quyền |
| `database/advanced/security/security.test.sql` | Bộ kiểm thử CA1–CA8 |
| `database/advanced/security/login-smoke.sql` | Kiểm tra login đọc view |
| `database/advanced/security/run-security-test.ps1` | Tự động deploy và chạy kiểm thử |
| `database/advanced/lib.ps1` | Hàm kết nối và thực thi SQLCMD |

## 3. Role và quyền

| Role | Thành viên | Quyền chính |
|---|---|---|
| `role_backend` | `app_backend` | EXECUTE stored procedure được cho phép; SELECT các view và bảng cần thiết; INSERT/UPDATE trên các bảng nghiệp vụ được chỉ định |
| `role_report` | `app_report` | SELECT trên các view báo cáo được chỉ định |

Nguyên tắc phân quyền:

- Không cấp DELETE cho hai role.
- Không cấp quyền DDL như CREATE TABLE hoặc DROP TABLE.
- Không cấp ALTER hoặc CONTROL trên schema.
- Không cấp quyền truy cập toàn schema.
- Chỉ cấp quyền trên các object cần thiết.

## 4. Kết quả kiểm thử CA1–CA8

Bộ kiểm thử được thực hiện trên `SwiftletCare_Test`.

| Mã | Nội dung kiểm thử | Kết quả |
|---|---|---|
| CA1 | Backend ingest reading và tạo cảnh báo theo ngưỡng | PASS |
| CA2 | Kiểm tra trigger tạo cảnh báo khi thiết bị OFFLINE | PASS |
| CA3 | Backend và report đọc được `vw_OpenAlerts` | PASS |
| CA4 | Backend đọc được `Users`, report bị từ chối | PASS |
| CA5 | Report bị từ chối EXECUTE `sp_GetReadingHistory` | PASS |
| CA6 | Backend và report bị từ chối DELETE | PASS |
| CA7 | Backend và report bị từ chối DROP TABLE | PASS |
| CA8 | Backend và report bị từ chối CREATE TABLE | PASS |

**Kết quả: 8/8 kiểm thử PASS.**

## 5. Kiểm tra deploy và database user

| Database | Thao tác | Kết quả |
|---|---|---|
| `SwiftletCare_Test` | Deploy có Reset và chạy security test | PASS |
| `SwiftletCare_Dev` | Deploy lần 1 | PASS |
| `SwiftletCare_Dev` | Deploy lần 2 để kiểm tra chạy lại | PASS |
| `SwiftletCare` | Deploy không Reset | PASS |

Kiểm tra membership trên `SwiftletCare`:

- `app_backend` thuộc `role_backend`.
- `app_report` thuộc `role_report`.
- Truy vấn kiểm tra orphan user trả về 0 dòng.

Kiểm tra quyền trên `SwiftletCare`:

- Đã kiểm tra 39 dòng quyền được cấp cho hai role.
- Các quyền phù hợp với ma trận phân quyền đã triển khai.
- Không phát hiện quyền DELETE, ALTER hoặc CONTROL được cấp trực tiếp trong kết quả kiểm tra.

## 6. Smoke test login

Chạy `login-smoke.sql` bằng từng login trên `SwiftletCare`.

| Login | Truy vấn | Kết quả |
|---|---|---|
| `app_backend` | SELECT TOP 1 từ `dbo.vw_OpenAlerts` | PASS |
| `app_report` | SELECT TOP 1 từ `dbo.vw_OpenAlerts` | PASS |

Cả hai login đều thực thi truy vấn thành công.

## 7. Kiểm tra từ chối DROP TABLE trên SwiftletCare

Thực hiện phép thử bằng login `app_backend`:

```sql
DROP TABLE dbo.SensorReadings;
```

Kết quả ghi nhận:

- SQL Server trả lỗi 3701: không thể DROP bảng vì object không tồn tại hoặc login không có quyền.
- SQLCMD trả exit code 1.
- Bảng `dbo.SensorReadings` được xác nhận vẫn tồn tại sau phép thử.

**Kết luận:** Thao tác DROP TABLE không thành công và bảng vẫn được giữ nguyên. Kết quả phù hợp với yêu cầu bảo vệ cấu trúc database khỏi login backend.

## 8. Kết luận

Task 3 đã hoàn thành các nội dung triển khai và kiểm thử:

- Role và database user được tạo đúng.
- Quyền được cấp theo nguyên tắc tối thiểu.
- Các kiểm thử CA1–CA8 đều PASS.
- Hai login backend và report đều vượt qua smoke test.
- Kiểm tra orphan user không phát hiện user mồ côi.
- Quy trình deploy được kiểm tra trên cả ba database.
- Thao tác DROP TABLE bị từ chối như mong đợi.

**Trạng thái Task 3: PASS.**