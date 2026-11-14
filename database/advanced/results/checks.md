# Kết quả kiểm chứng A1–A9 và dữ kiện nền

**Dự án:** SwiftletCare  
**Cơ sở dữ liệu kiểm tra:** `SwiftletCare_Dev`  
**Ngày kiểm tra:** 14/11/2026  
**Tài liệu đối chiếu:**
- Implementation Plan: `2026-10-17-swiftletcare-database-advanced.md`
- Design Spec: `2026-10-17-swiftletcare-database-advanced-design.md`

## 1. Bảng kết quả kiểm chứng

| # | Kiểm gì | Lệnh | Kết quả | Ngày | Ảnh hưởng |
|---|---|---|---|---|---|
| A1 – Tĩnh | Quét SQL động trong `database/sql/` | `Get-ChildItem ".\database\sql" -Recurse -File \| Select-String -Pattern 'sp_executesql','EXEC\s*\(','EXECUTE\s*\('` | **PASS** – Không phát hiện các mẫu đã tìm kiếm. Phần kiểm tra SQL động thực tế được thực hiện ở Task 3. | 14/11/2026 | Tiếp tục kiểm tra quyền ở Task 3. |
| A2 | `sqlcmd` đọc biến môi trường làm biến kịch bản | `$env:SwxProbe = 'abc'` rồi chạy `sqlcmd -S localhost,1433 -E -C -b -Q 'PRINT N''probe=$(SwxProbe)'''` | **PASS** – Kết quả `probe=abc`. | 14/11/2026 | Có thể truyền biến môi trường cho `sqlcmd`; lưu ý không để lộ mật khẩu. |
| A3 | Tài khoản Windows hiện tại có quyền `sysadmin` | `sqlcmd -S localhost,1433 -E -C -b -h -1 -Q "SET NOCOUNT ON; SELECT IS_SRVROLEMEMBER('sysadmin')"` | **PASS** – Kết quả `1`. | 14/11/2026 | Có thể thực hiện các thao tác quản trị cần quyền sysadmin bằng tài khoản Windows hiện tại. |
| A4 | Xóa procedure cache | `sqlcmd -S localhost,1433 -E -C -d SwiftletCare_Dev -b -Q "ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE; PRINT 'A4 ok'"` | **PASS** – Kết quả `A4 ok`. | 14/11/2026 | Có thể sử dụng lệnh này trong các bước đo hiệu năng. |
| A5 | Kiểm tra unique index/constraint của `SensorReadings` | Truy vấn `sys.indexes` trên `dbo.SensorReadings`. | **PASS** – Có unique constraint `SensorReadings_DeviceId_MetricCode_RecordedAt_key`, với `is_unique_constraint = 1`. | 14/11/2026 | Task 11 cần chuyển constraint thành unique index nếu muốn bổ sung `INCLUDE(Value)`. Không được ghi cứng tên index theo giả định. |
| A6 | Kiểm tra cách hiểu thời gian `STOPAT` | Theo kế hoạch, kiểm tra tại Task 8. | **DEFERRED** – Chưa kiểm tra. | — | Ghi nhận và kiểm tra trong Task 8, cập nhật `backup.md`. |
| A7 | Kiểm tra thời gian sinh dữ liệu và giới hạn dung lượng | Theo kế hoạch, kiểm tra tại Task 9. | **DEFERRED** – Chưa kiểm tra. | — | Đo lô đầu tiên và ngoại suy thời gian/dung lượng trong Task 9. |
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

### 2.3. Trạng thái đối chiếu với Design Spec 2.3

Design Spec dự kiến cấp quyền ghi trực tiếp trên 6 bảng:

`Users`, `Houses`, `Zones`, `Devices`, `Thresholds`, `Harvests`.

Các bảng đọc bổ sung dự kiến:

`Metrics`, `Alerts`, `ControlLogs`, `BirdCounts`, `SensorReadings`.

Backend cũng có 9 Stored Procedures và 4 view như liệt kê ở trên.

**Trạng thái: PARTIAL – Đã thu thập và phân loại kết quả quét, nhưng chưa chốt hoàn toàn ma trận quyền thực tế so với Design Spec 2.3.**

Cần tiếp tục đối chiếu các lời gọi Stored Procedure và bảng `Harvests` trước khi kết luận có hay không có quyền lệch spec. Nếu phát hiện khác biệt, ghi rõ trong mục này và cập nhật ma trận quyền được sử dụng ở Task 3.

## 3. Dữ kiện môi trường

| Nội dung | Kết quả |
|---|---|
| SQL Server instance | `MSSQL$SQLEXPRESS` |
| SQL Server service account | `NT Service\MSSQL$SQLEXPRESS` |
| SQL Server Management Studio | Đã cài SQL Server Management Studio 22; xác nhận qua danh sách ứng dụng Start Menu |
| Phiên bản SQL Server | SQL Server 2025 RTM Express, phiên bản `17.0.1000.7` |
| Địa chỉ kết nối | `localhost,1433` |
| Database kiểm tra | `SwiftletCare_Dev` |
| D5 – Ngày TV2 xác nhận nhận | Chưa xác nhận |
| D5 – Hạn TV2 hứa hoàn thành | Chưa xác nhận |

## 4. Các mục cần tiếp tục

- [x] A1 – Kiểm tra tĩnh.
- [x] A2 – Kiểm tra biến môi trường của sqlcmd.
- [x] A3 – Kiểm tra quyền sysadmin.
- [x] A4 – Kiểm tra CLEAR PROCEDURE_CACHE.
- [x] A5 – Kiểm tra unique constraint/index.
- [x] A8 – Kiểm tra tạo Partition Function.
- [x] Xác nhận SQL Server service account.
- [x] Xác nhận có SSMS 22.
- [ ] Hoàn tất đối chiếu quyền Backend với Design Spec 2.3.
- [ ] Xác nhận A9 với TV2.
- [ ] A6 – Kiểm tra ở Task 8.
- [ ] A7 – Kiểm tra ở Task 9.
- [ ] A8 SWITCH – Kiểm tra ở Task 13.

**Nguyên tắc ghi nhận:** Chỉ đánh dấu PASS khi đã thực hiện kiểm tra và có kết quả xác nhận. Các mục chưa thực hiện được ghi PENDING hoặc DEFERRED, không tự động xem là đạt.