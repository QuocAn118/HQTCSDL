### Task 7 – Isolation Levels

| Isolation Level | Session A | Session B | Kết quả kiểm thử | Status |
|---|---|---|---|---|
| READ COMMITTED | Đọc lần 1 = 28.00, lần 2 = 29.00 | Cập nhật TargetValue thành 29.00 | B hoàn tất trước A (DemoLog ID 14 < 16) | PASS |
| REPEATABLE READ | Đọc lần 1 = 28.00, lần 2 = 28.00 | Cập nhật TargetValue thành 29.00 sau khi A hoàn tất | A hoàn tất trước B (DemoLog ID 19 < 20) | PASS |
| SNAPSHOT | Đọc lần 1 = 28.00, lần 2 = 28.00; UPDATE bị lỗi 3960 | Cập nhật TargetValue thành 29.00 | B hoàn tất trước A (DemoLog ID 21 < 25) | PASS |

Cả ba kịch bản đều được kiểm thử trên database `SwiftletCare_Perf`.
Sau mỗi lần chạy, giá trị H1-F1 TEMP được khôi phục về 28.00.