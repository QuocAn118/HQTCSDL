
# SwiftletCare — Database

Package cơ sở dữ liệu SQL Server của hệ thống SwiftletCare.

Tài liệu thiết kế:
[Database Core Design](../docs/superpowers/specs/2026-10-12-swiftletcare-database-core-design.md)

## 1. Cài đặt môi trường

Yêu cầu:

- SQL Server hỗ trợ TCP/IP tại cổng 1433.
- SQL Server Authentication (Mixed Mode).
- Tài khoản `swiftlet_dev` có quyền `dbcreator`.
- Node.js và npm.
- PowerShell.

Các bước cài đặt:

1. Mở Terminal tại thư mục `database`.
2. Chạy `npm install`.
3. Sao chép `.env.example` thành `.env`.
4. Điền `DB_PASSWORD` và mật khẩu trong `DATABASE_URL`.
5. Không đưa file `.env` lên Git.

## 2. Các lệnh sử dụng

| Lệnh | Chức năng |
|---|---|
| `npm run reset:dev` | Tạo lại database phát triển và dữ liệu mẫu |
| `npm run deploy:dev` | Triển khai database mà không xóa dữ liệu |
| `npm test` | Tạo lại database kiểm thử và chạy tất cả test |
| `npm run reset:dev -- -AnchorDateVn 2026-11-01` | Tạo dữ liệu mẫu theo ngày neo khác |

Triển khai database demo:

```powershell
powershell -File scripts/deploy.ps1 -Database SwiftletCare
```

Không sử dụng tùy chọn `-Reset` cho database demo có dữ liệu cần giữ lại.

## 3. Database

- `SwiftletCare_Dev`: môi trường phát triển.
- `SwiftletCare_Test`: môi trường kiểm thử.
- `SwiftletCare`: môi trường demo.

Lưu ý: `npm test` tạo lại `SwiftletCare_Test`, không sử dụng để lưu dữ liệu quan trọng.

## 4. Tài khoản mẫu

| Tài khoản | Vai trò |
|---|---|
| `admin` | ADMIN |
| `owner1` | Chủ nhà H1 |
| `owner2` | Chủ nhà H2 |

Mật khẩu phát triển tạm thời: `SwiftletDev@2026`.

Chỉ sử dụng các tài khoản mẫu trong môi trường phát triển và demo. Không sử dụng mật khẩu mẫu cho hệ thống thật.

## 5. Dữ liệu mẫu

Với ngày neo mặc định `2026-10-12`:

| Bảng | Số bản ghi |
|---|---:|
| SensorReadings | 54.144 |
| BirdCounts | 864 |
| Alerts | 3 |
| AlertHistory | 5 |

Dữ liệu bao gồm các tình huống:

- Nhiệt độ H1-F2 vượt ngưỡng và đã xử lý.
- Độ ẩm H1-F3 dưới ngưỡng và chưa xử lý.
- Camera H1-F0 phát hiện rắn, chủ nhà đã xác nhận.
- Số chim về nhà H2 giảm mạnh để kiểm thử cảnh báo `POPULATION_DROP`.

## 6. Quy ước phát triển

- Các bảng được định nghĩa trong `prisma/schema.prisma`.
- Cột thời gian mới do Prisma sinh sẽ là `DATETIME2(7)` (Prisma không ghi được `@db.DateTime2(0)`); trong cùng migration phải viết tay `ALTER COLUMN ... DATETIME2(0)` (xem `20261027101307_datetime2_precision0`).
- View, Stored Procedure và Trigger nằm trong thư mục `sql/`.
- Các file SQL được triển khai theo thứ tự thư mục và tên file.
- Không ghi trực tiếp vào bảng `Alerts` bằng Prisma trong luồng nghiệp vụ.
- Khi cập nhật `Devices` từ Prisma, sử dụng `$executeRaw` theo quy ước dự án.
- Các bài kiểm thử nằm trong `tests/*.test.sql`.
- Ưu tiên sử dụng transaction và `ROLLBACK` để không làm thay đổi dữ liệu kiểm thử.

## 7. Kiểm thử

Chạy:

```powershell
npm test
```

Kết quả thành công:

```text
Tat ca test dat
```

Các bài kiểm thử bao gồm:

- Ràng buộc dữ liệu.
- View thống kê.
- Ghi nhận dữ liệu cảm biến.
- Điều khiển thiết bị.
- Ghi nhận số lượng chim.
- Phát hiện thiên địch.
- Phát hiện giảm đàn.
- Cập nhật trạng thái cảnh báo.
- Trigger lịch sử cảnh báo.
- Hợp đồng JSON của Stored Procedure.

## 8. Tài liệu tham khảo nội bộ

- `spikes/RESULTS.md`: kết quả kiểm chứng kỹ thuật.
- `../docs/superpowers/plans/2026-10-14-swiftletcare-database-core.md`: kế hoạch triển khai.
- `../docs/superpowers/specs/2026-10-12-swiftletcare-database-core-design.md`: đặc tả thiết kế.
