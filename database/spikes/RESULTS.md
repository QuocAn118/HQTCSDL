# Kết quả kiểm chứng database-core

## R2 – Prisma migration drift

**Kết quả:** Không xảy ra.

- Chạy `npx prisma migrate dev --create-only --name r2_probe`.
- Migration thử nghiệm được tạo nhưng chỉ chứa `-- This is an empty migration.`
- Đã xóa thư mục migration thử nghiệm.
- Giữ SQL viết tay trong migration `init`.

## R4 – Clustered index

**Kết quả:** Không xảy ra.

- `SensorReadings_pkey` sử dụng `PRIMARY KEY NONCLUSTERED`.
- `SensorReadings_RecordedAt_idx` sử dụng `CREATE CLUSTERED INDEX`.

## R5 – Khóa ngoại ghép

**Kết quả:** Không xảy ra.

- `npx prisma validate` thành công.
- Migration đã tạo khóa ngoại ghép `Alerts(ZoneId, HouseId)` tham chiếu `Zones(ZoneId, HouseId)`.

## Kiểm thử Task 2

- `npm test`: PASS.
- `deploy-guard`: PASS.
- `constraints.test.sql`: PASS.
- Database kiểm thử: `SwiftletCare_Test`.

## R1 – Prisma OUTPUT và SQL Server Trigger

Kết quả kiểm chứng trên SwiftletCare_Dev:

- Prisma create với trigger AFTER UPDATE: OK
- Prisma update với trigger AFTER UPDATE: OK
- $executeRaw UPDATE: OK

Kết luận: Cả ba thao tác đều thành công trong phép thử.
Chưa ghi nhận lỗi SQL Server 334.

Quyết định: Có thể sử dụng Prisma create trong trường hợp
đã kiểm chứng. Các thao tác cập nhật có trigger cần tiếp tục
kiểm tra khi triển khai trigger nghiệp vụ thực tế.



## R3 – Prisma gọi Stored Procedure

- Trạng thái: PASS
- Prisma 7.10.0 với adapter-mssql gọi thành công `dbo.sp_IngestReadings`.
- Stored procedure trả về kết quả gồm Received, Accepted, Duplicates, Rejected, AcceptedJson, NewAlertsJson, ResolvedAlertIdsJson.
- Thử truy vấn hai tập kết quả:
  `SELECT 1 AS a; SELECT 2 AS b;`
- Kết quả thực tế: `[{"a":1}]`.
- Kết luận: Backend cần thiết kế stored procedure trả về một tập kết quả duy nhất.

## R6 – Kiểm chứng DATETIME2 và UTC

- Trạng thái: PASS
- Adapter cấu hình `options.useUTC = true`.
- Giá trị kiểm thử: `2026-10-13T10:00:07Z`.
- Prisma đọc lại: `2026-10-13T10:00:07.000Z`.
- Kết quả: DUNG.
- Kết luận: Backend sử dụng `useUTC: true` để đọc thời gian theo UTC.

## Decimal

- Kiểu trả về thực tế: Decimal2.
- JSON.stringify: `{"v":"28.5"}`.
- Backend cần chuyển Decimal thành number khi API yêu cầu giá trị số.
