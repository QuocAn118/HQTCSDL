# Kết quả kiểm chứng A1–A9 và dữ kiện nền

**Dự án:** SwiftletCare  
**Cơ sở dữ liệu kiểm tra:** `SwiftletCare_Dev`  
**Ngày kiểm tra:** 14–15/11/2026  
**Tài liệu đối chiếu:**
- Implementation Plan: `2026-10-17-swiftletcare-database-advanced.md`
- Design Spec: `2026-10-17-swiftletcare-database-advanced-design.md`

## 1. Bảng kết quả kiểm chứng

| # | Kiểm gì | Lệnh | Kết quả | Ngày | Ảnh hưởng |
|---|---|---|---|---|---|
| A1 – Tĩnh | Quét SQL động trong `database/sql/` | `Get-ChildItem ".\database\sql" -Recurse -File \| Select-String -Pattern 'sp_executesql','EXEC\s*\(','EXECUTE\s*\('` | **PASS** – Không phát hiện các mẫu đã tìm kiếm. Phần kiểm tra SQL động thực tế được tiếp tục rà soát trong Task 3. | 14–15/11/2026 | Tiếp tục kiểm tra quyền và SQL trong Task 3. |
| A2 | `sqlcmd` đọc biến môi trường làm biến kịch bản | `$env:SwxProbe = 'abc'` rồi chạy `sqlcmd -S localhost,1433 -E -C -b -Q 'PRINT N''probe=$(SwxProbe)'''` | **PASS** – Kết quả `probe=abc`. | 14/11/2026 | Có thể truyền biến môi trường cho `sqlcmd`; lưu ý không để lộ mật khẩu. |
| A3 | Tài khoản Windows hiện tại có quyền `sysadmin` | `sqlcmd -S localhost,1433 -E -C -b -h -1 -Q "SET NOCOUNT ON; SELECT IS_SRVROLEMEMBER('sysadmin')"` | **PASS** – Kết quả `1`. | 14/11/2026 | Có thể thực hiện các thao tác quản trị cần quyền sysadmin bằng tài khoản Windows hiện tại. |
| A4 | Xóa procedure cache | `sqlcmd -S localhost,1433 -E -C -d SwiftletCare_Dev -b -Q "ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE; PRINT 'A4 ok'` | **PASS** – Kết quả `A4 ok`. | 14/11/2026 | Có thể sử dụng lệnh này trong các bước đo hiệu năng. |
| A5 | Kiểm tra unique index/constraint của `SensorReadings` | Truy vấn `sys.indexes` trên `dbo.SensorReadings`. | **PASS** – Có unique constraint `SensorReadings_DeviceId_MetricCode_RecordedAt_key`, với `is_unique_constraint = 1`. | 14/11/2026 | Task 11 cần chuyển constraint thành unique index nếu muốn bổ sung `INCLUDE(Value)`. Không được ghi cứng tên index theo giả định. |
| A6 | Kiểm tra cách hiểu thời gian `STOPAT` | Theo kế hoạch, kiểm tra tại Task 8. | **DEFERRED** – Chưa kiểm tra. | — | Ghi nhận và kiểm tra trong Task 8, cập nhật `backup.md`. |
| A7 | Kiểm tra thời gian sinh dữ liệu và giới hạn dung lượng | Chạy `generate-readings.sql`, đo thời gian lô đầu tiên, tổng thời gian, dung lượng database và từng index; kiểm tra chạy lại. | **PASS** – Sinh thành công 4.976.640 dòng trong 466.337 ms (7 phút 46 giây); lô đầu tiên hoàn thành trong 824 ms. Tổng dữ liệu đạt 5.030.784 dòng trên 180 ngày. Database hiện tại có dung lượng 1.360 MB, thấp hơn đáng kể so với giới hạn 10 GB. Đã đo dung lượng bảng và cả 3 index. Chạy lại script không phát sinh dòng mới, bỏ qua 180/180 ngày. | 17/11/2026 | Đạt yêu cầu về thời gian sinh dữ liệu, quy mô dữ liệu, giới hạn dung lượng và tính chạy lại an toàn. |
| A8 – Partition Function | Kiểm tra khả năng tạo Partition Function trên SQL Server Express | Tạo và xóa `pf_probe` với kiểu `DATETIME2(0)`. | **PASS** – Người thực hiện xác nhận lệnh chạy thành công (`A8 ok`). | 14/11/2026 | Có thể tiếp tục xem xét Task 13. |
| A8 – SWITCH | Kiểm tra điều kiện `ALTER TABLE ... SWITCH` | Theo kế hoạch, kiểm tra tại Task 13. | **DEFERRED** – Chưa kiểm tra. | — | Không kết luận khả năng SWITCH chỉ từ kết quả tạo Partition Function. |
| A9 | Xác nhận TV2 nhận D5 và thời hạn hoàn thành | Xác nhận thông tin với TV2. | **PENDING** – Chưa có thông tin xác nhận ngày nhận D5 và hạn hoàn thành. | — | Cần xác nhận trước khi thực hiện Task 4. |

## 2. Đối chiếu quyền truy cập Backend

Đã rà soát kết quả tìm kiếm trong `backend/src`, phân biệt mã chạy thực tế với mã generated, file kiểm thử và spike.

### 2.1. Những thao tác đã nhận diện

| Đối tượng | Thao tác nhận diện được |
|---|---|
| `Houses` | Đọc, thêm, cập nhật qua Prisma |
| `Zones` | Đọc, thêm, cập nhật qua Prisma |
| `Devices` | Đọc qua Prisma; thêm và cập nhật bằng SQL trực tiếp |
| `Users` | Đọc, thêm, cập nhật qua Prisma |
| `Thresholds` | Đọc, upsert qua Prisma |
| `Metrics` | Có truy vấn đọc |
| `Alerts` | Có truy vấn đọc |
| `ControlLogs` | Có truy vấn đọc |
| `BirdCounts` | Có truy vấn đọc |
| `SensorReadings` | Có truy vấn đọc qua view và các luồng liên quan |

Ngoài ra, mã Backend có gọi 9 Stored Procedures:

1. `sp_IngestReadings`
2. `sp_SetActuator`
3. `sp_UpdateAlertStatus`
4. `sp_GetReadingHistory`
5. `sp_RecordBirdCount`
6. `sp_CreatePredatorAlert`
7. `sp_DetectAnomalies`
8. `sp_RecordHeartbeat`
9. `sp_Report_EnvStabilityVsYield`

Các view được nhận diện trong mã nguồn gồm `vw_LatestReadings`, `vw_OpenAlerts`, `vw_DailyEnvStats` và `vw_DailyBirdFlow`.

### 2.2. Lưu ý khi đối chiếu

- Không tính `backend/src/generated/prisma/` vì đây là mã Prisma Client được sinh tự động.
- Không tính file `.spec.ts` và `.db-spec.ts` là thao tác của luồng Backend thông thường.
- Các thao tác trong `backend/src/spikes/` là mã thử nghiệm, không được mặc định xem là quyền runtime.
- `DELETE FROM dbo.Devices` trong `spikes/s7-device-insert.ts` thuộc spike S7.
- Các lệnh `.delete()` trên JavaScript Map hoặc registry không phải SQL `DELETE`.

### 2.3. Đối chiếu với Design Spec 2.3

Design Spec dự kiến cấp quyền ghi trực tiếp trên 6 bảng:

`Users`, `Houses`, `Zones`, `Devices`, `Thresholds`, `Harvests`.

Các bảng đọc bổ sung dự kiến:

`Metrics`, `Alerts`, `ControlLogs`, `BirdCounts`, `SensorReadings`.

Backend cũng có 9 Stored Procedures và 4 view như liệt kê ở trên.

**Trạng thái: PARTIAL.** Đã thu thập và phân loại kết quả quét. Task 3 đã triển khai role và quyền thực tế. Tuy nhiên, cần tiếp tục đối chiếu các lời gọi Stored Procedure và quyền trên `Harvests` trước khi kết luận toàn bộ ma trận quyền khớp Design Spec 2.3.

## 3. Kết quả triển khai và kiểm thử phân quyền – Task 3

**Ngày kiểm tra:** 15/11/2026

### 3.1. Thành phần triển khai

| File | Chức năng |
|---|---|
| `database/sql/04-security/01-roles-users.sql` | Tạo role, database user và cấp quyền |
| `database/advanced/security/security.test.sql` | Bộ kiểm thử CA1–CA8 |
| `database/advanced/security/login-smoke.sql` | Kiểm tra login đọc view |
| `database/advanced/security/run-security-test.ps1` | Tự động deploy và chạy kiểm thử |
| `database/advanced/lib.ps1` | Hàm kết nối và thực thi SQLCMD |

### 3.2. Role và quyền được triển khai

| Role | Thành viên | Quyền chính |
|---|---|---|
| `role_backend` | `app_backend` | EXECUTE 9 stored procedures; SELECT các view và bảng cần thiết; INSERT/UPDATE trên các bảng nghiệp vụ được chỉ định |
| `role_report` | `app_report` | SELECT trên 4 view báo cáo |

Nguyên tắc phân quyền:

- Không cấp DELETE cho hai role.
- Không cấp quyền DDL như CREATE TABLE hoặc DROP TABLE.
- Không cấp ALTER hoặc CONTROL trên schema.
- Không cấp quyền truy cập toàn schema.
- Chỉ cấp quyền trên các object cần thiết.

### 3.3. Kết quả kiểm thử CA1–CA8

Bộ kiểm thử được chạy trên `SwiftletCare_Test`.

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

### 3.4. Kiểm tra deploy và database user

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

### 3.5. Smoke test login

Chạy `login-smoke.sql` bằng từng login trên `SwiftletCare`.

| Login | Truy vấn | Kết quả |
|---|---|---|
| `app_backend` | SELECT TOP 1 từ `dbo.vw_OpenAlerts` | PASS |
| `app_report` | SELECT TOP 1 từ `dbo.vw_OpenAlerts` | PASS |

Cả hai login đều thực thi truy vấn thành công.

### 3.6. Kiểm tra từ chối DROP TABLE trên SwiftletCare

Thực hiện phép thử bằng login `app_backend`:

```sql
DROP TABLE dbo.SensorReadings;
```

Kết quả ghi nhận:

- SQL Server trả lỗi 3701: không thể DROP bảng vì object không tồn tại hoặc login không có quyền.
- SQLCMD trả exit code 1.
- Bảng `dbo.SensorReadings` được xác nhận vẫn tồn tại sau phép thử.

**Kết luận:** Thao tác DROP TABLE không thành công và bảng vẫn được giữ nguyên. Kết quả phù hợp với yêu cầu bảo vệ cấu trúc database khỏi login backend.

### 3.7. Kết luận Task 3

- Role và database user được tạo đúng.
- Quyền được cấp theo nguyên tắc tối thiểu.
- Các kiểm thử CA1–CA8 đều PASS.
- Hai login backend và report đều vượt qua smoke test.
- Kiểm tra orphan user không phát hiện user mồ côi.
- Quy trình deploy được kiểm tra trên cả ba database.
- Thao tác DROP TABLE bị từ chối như mong đợi.

**Trạng thái Task 3: PASS.**

## 4. Dữ kiện môi trường

| Nội dung | Kết quả |
|---|---|
| SQL Server instance | `MSSQL$SQLEXPRESS` |
| SQL Server service account | `NT Service\MSSQL$SQLEXPRESS` |
| SQL Server Management Studio | Đã cài SQL Server Management Studio 22; xác nhận qua danh sách ứng dụng Start Menu |
| Phiên bản SQL Server | SQL Server 2025 RTM Express, phiên bản `17.0.1000.7` |
| Địa chỉ kết nối | `tcp:127.0.0.1,1433` |
| Database kiểm tra chính | `SwiftletCare_Dev` |
| Database kiểm thử phân quyền | `SwiftletCare_Test` |
| Database triển khai chính | `SwiftletCare` |
| D5 – Ngày TV2 xác nhận nhận | Chưa xác nhận |
| D5 – Hạn TV2 hứa hoàn thành | Chưa xác nhận |

## 5. Các mục cần tiếp tục

- [x] A1 – Kiểm tra tĩnh.
- [x] A2 – Kiểm tra biến môi trường của sqlcmd.
- [x] A3 – Kiểm tra quyền sysadmin.
- [x] A4 – Kiểm tra CLEAR PROCEDURE_CACHE.
- [x] A5 – Kiểm tra unique constraint/index.
- [x] A8 – Kiểm tra tạo Partition Function.
- [x] Xác nhận SQL Server service account.
- [x] Xác nhận có SSMS 22.
- [x] Task 3 – Triển khai role, database user và kiểm thử phân quyền CA1–CA8.
- [ ] Hoàn tất đối chiếu quyền Backend với Design Spec 2.3.
- [ ] Xác nhận A9 với TV2.
- [ ] A6 – Kiểm tra ở Task 8.
- [ ] A7 – Kiểm tra ở Task 9.
- [ ] A8 SWITCH – Kiểm tra ở Task 13.

**Nguyên tắc ghi nhận:** Chỉ đánh dấu PASS khi đã thực hiện kiểm tra và có kết quả xác nhận. Các mục chưa thực hiện được ghi PENDING hoặc DEFERRED, không tự động xem là đạt.