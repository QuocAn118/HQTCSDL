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