# Task 6 – Deadlock

## 1. Mục tiêu

Mô phỏng deadlock giữa hai transaction trên SQL Server, sau đó kiểm thử hai phương pháp xử lý:
- Thống nhất thứ tự lấy khóa.
- Rollback và retry khi SQL Server chọn transaction làm deadlock victim.

## 2. Môi trường kiểm thử

| Thành phần | Giá trị |
|---|---|
| Database | `SwiftletCare_Perf` |
| SQL Server | `152607-DMQUANG\SQLEXPRESS` |
| Bảng demo | `dbo.DeadlockDemoRows` |
| Stored procedure | `dbo.sp_DemoDeadlockRetry` |
| Deadlock error | `1205` |

Các kiểm thử sử dụng bảng demo độc lập, không thay đổi dữ liệu thiết bị trong hệ thống SwiftletCare.

## 3. Kết quả kiểm thử

| Kịch bản | Kết quả thực tế | Trạng thái |
|---|---|---|
| `deadlock` | Session A bị lỗi 1205; Session B commit thành công | PASS |
| `deadlock-fixed` | Cả hai session commit thành công theo thứ tự khóa 1 → 2 | PASS |
| `deadlock-retry` | Session B bị deadlock ở lần 1, rollback và hoàn tất ở lần 2 | PASS |

### 3.1. Kịch bản deadlock

Hai session truy cập hai dòng theo thứ tự ngược nhau:
- Session A khóa dòng 1, sau đó chờ dòng 2.
- Session B khóa dòng 2, sau đó chờ dòng 1.
- SQL Server phát hiện chu trình chờ và chọn Session A làm deadlock victim.

Bằng chứng thực tế:

```text
Session A:
Transaction (Process ID 51) was deadlocked on lock resources
with another process and has been chosen as the deadlock victim.

Session B:
Session B committed.

Exit codes: A=1, B=0
PASS: Deadlock reproduced; one session was the victim.
```

Sau khi kết thúc:
- Row 1: Value = 1
- Row 2: Value = 1

Transaction A bị rollback, transaction B được commit.

### 3.2. Kịch bản deadlock-fixed

Cả hai session cùng cập nhật dòng 1 trước, sau đó cập nhật dòng 2.

Bằng chứng thực tế:

```text
Session A committed using order 1 -> 2.
Session B committed using order 1 -> 2.

Exit codes: A=0, B=0
PASS: Both sessions completed with a consistent lock order.
```

Sau khi kết thúc:
- Row 1: Value = 2
- Row 2: Value = 2

Việc thống nhất thứ tự lấy khóa giúp loại bỏ deadlock trong tình huống kiểm thử.

### 3.3. Kịch bản deadlock-retry

Stored procedure `dbo.sp_DemoDeadlockRetry` thực hiện:
1. Bắt đầu transaction.
2. Cập nhật hai dòng theo thứ tự được truyền vào.
3. Nếu gặp lỗi 1205, rollback transaction.
4. Chờ một giây và thực hiện retry, tối đa ba lần retry.

Bằng chứng thực tế:

```text
Session A:
Transaction completed. Attempts: 1

Session B:
Deadlock victim. Retrying attempt 1...
Transaction completed. Attempts: 2

Exit codes: A=0, B=0
PASS: Both transactions completed using retry handling.
```

Sau khi kết thúc:
- Row 1: Value = 2
- Row 2: Value = 2

Session B đã rollback lần đầu và hoàn tất thành công ở lần thử thứ hai.

## 4. Tổng kết

| Nội dung | Kết quả |
|---|---|
| Tái hiện deadlock | PASS |
| Khắc phục bằng thứ tự khóa | PASS |
| Khắc phục bằng retry | PASS |
| Tổng số kịch bản | 3/3 PASS |

Qua kiểm thử, deadlock xảy ra khi hai transaction giữ các khóa khác nhau và chờ tài nguyên của nhau. Có thể hạn chế tình trạng này bằng cách thống nhất thứ tự truy cập tài nguyên. Trong trường hợp deadlock vẫn xảy ra, ứng dụng có thể rollback và retry transaction khi nhận lỗi 1205.

## 5. Phạm vi an toàn

- Chỉ thực hiện trên `SwiftletCare_Perf`.
- Sử dụng bảng demo `dbo.DeadlockDemoRows`.
- Không thay đổi `SwiftletCare_Dev`.
- Không xóa database hoặc dữ liệu thiết bị thực tế.
