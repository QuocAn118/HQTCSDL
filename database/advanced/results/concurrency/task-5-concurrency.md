# Task 5 – Kiểm thử điều khiển tương tranh (Lost Update)

## 1. Mục tiêu

Mục tiêu của bài kiểm thử là mô phỏng tình huống hai phiên SQL Server cùng cập nhật một thiết bị, từ đó quan sát hiện tượng Lost Update và đánh giá hiệu quả của cơ chế khóa giao dịch.

Bài kiểm thử được thực hiện trên database `SwiftletCare_Perf`, không sử dụng database phát triển `SwiftletCare_Dev`.

## 2. Môi trường kiểm thử

| Thành phần | Giá trị |
|---|---|
| Database | `SwiftletCare_Perf` |
| Thiết bị | `H1-F1-FAN` |
| DeviceId | `7` |
| Session A | AUTO |
| Session B | MANUAL |
| Nhật ký | `dbo.DemoLog` |
| Công cụ chạy hai phiên | `run-two-sessions.ps1` |

Hai stored procedure demo:

- `dbo.sp_SetActuatorNaive`
- `dbo.sp_SetActuatorSafe`

## 3. Kết quả kiểm thử Naive

Lệnh thực hiện:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\tests\run-two-sessions.ps1" -Scenario lost-update-naive
```

Kết quả runner:

```text
===== lost-update-naive =====
Database: SwiftletCare_Perf
Device: H1-F1-FAN
Procedure: dbo.sp_SetActuatorNaive
Original state: AUTO|0|0
Starting Session A (AUTO)...
Starting Session B (MANUAL)...
Process exit codes: Session A=0, Session B=0
Final test state: AUTO|0
PASS: Expected state observed (AUTO|0).
Original actuator state restored.
```

Nhật ký thực tế trong `dbo.DemoLog`:

| Id | Session | Step | Val | At (UTC) |
|---:|---|---|---|---|
| 5 | A | READ | Mode=AUTO; IsOn=0 | 06:51:32.053 |
| 6 | B | READ | Mode=AUTO; IsOn=1 | 06:51:33.087 |
| 7 | B | WRITE | Mode=MANUAL; IsOn=1 | 06:51:33.089 |
| 8 | A | WRITE | Mode=AUTO; IsOn=0 | 06:51:37.055 |

Nhận xét:

Session B đã cập nhật thiết bị sang MANUAL. Tuy nhiên, Session A vẫn ghi lại trạng thái AUTO đã đọc trước đó. Vì vậy, trạng thái MANUAL bị ghi đè.

**Kết quả: PASS – tái hiện được hiện tượng Lost Update.**

## 4. Kết quả kiểm thử Safe

Lệnh thực hiện:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\database\advanced\tests\run-two-sessions.ps1" -Scenario lost-update-safe
```

Kết quả runner:

```text
===== lost-update-safe =====
Database: SwiftletCare_Perf
Device: H1-F1-FAN
Procedure: dbo.sp_SetActuatorSafe
Original state: AUTO|0|0
Starting Session A (AUTO)...
Starting Session B (MANUAL)...
Process exit codes: Session A=0, Session B=0
Final test state: MANUAL|1
PASS: Expected state observed (MANUAL|1).
Original actuator state restored.
```

Nhật ký thực tế trong `dbo.DemoLog`:

| Id | Session | Step | Val | At (UTC) |
|---:|---|---|---|---|
| 9 | A | READ | Mode=AUTO; IsOn=0 | 06:54:39.882 |
| 10 | A | WRITE | Mode=AUTO; IsOn=0 | 06:54:44.956 |
| 11 | B | READ | Mode=AUTO; IsOn=1 | 06:54:44.956 |
| 12 | B | WRITE | Mode=MANUAL; IsOn=1 | 06:54:44.957 |

Nhận xét:

Session A hoàn tất thao tác cập nhật trước khi Session B đọc và ghi trạng thái mới. Kết quả cuối cùng giữ được trạng thái MANUAL.

**Kết quả: PASS – không xuất hiện hiện tượng ghi đè cập nhật MANUAL trong lần chạy này.**

## 5. So sánh hai phương pháp

| Tiêu chí | Naive | Safe |
|---|---|---|
| Có hai phiên độc lập | Có | Có |
| Có nhật ký READ/WRITE | Có | Có |
| Có cơ chế khóa giao dịch phù hợp | Không | Có |
| MANUAL bị AUTO ghi đè | Có | Không |
| Trạng thái cuối lần chạy | AUTO, OFF | MANUAL, ON |
| Kết quả | PASS – tái hiện lỗi | PASS – kiểm soát được lỗi |

## 6. Khôi phục dữ liệu

Runner ghi nhận trạng thái ban đầu của thiết bị là `AUTO|0|0` và thông báo khôi phục trạng thái sau mỗi lần chạy.

Không thay đổi stored procedure sản phẩm `dbo.sp_SetActuator`.

## 7. Kết luận

Qua hai lần chạy thực nghiệm, phương pháp Naive cho thấy một phiên có thể ghi đè cập nhật của phiên khác nếu không kiểm soát thứ tự truy cập dữ liệu.

Phương pháp Safe sử dụng khóa trong giao dịch để tuần tự hóa thao tác đọc và cập nhật. Kết quả thử nghiệm giữ được cập nhật MANUAL của Session B.

Bài kiểm thử minh họa tầm quan trọng của kiểm soát tương tranh trong hệ thống quản lý thiết bị, đặc biệt khi nhiều nguồn điều khiển cùng tác động lên một thiết bị.

## 8. Trạng thái Task 5

| Hạng mục | Kết quả |
|---|---|
| Tạo DemoLog | PASS |
| Stored procedure Naive | PASS |
| Stored procedure Safe | PASS |
| Chạy hai phiên Naive | PASS |
| Chạy hai phiên Safe | PASS |
| Kiểm tra thứ tự READ/WRITE | PASS |
| Khôi phục trạng thái thiết bị | PASS |
| Bổ sung kiểm tra Task 5 vào guards | Đã bổ sung, cần chạy xác nhận |
| Bổ sung README | Đã bổ sung |

