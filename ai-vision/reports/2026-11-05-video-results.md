# Kết quả video bổ sung — 05/11/2026

Đã dùng v3 best.pt đã đóng băng, không thay bằng v4 pilot. File số đo trong
results/; xem README.md ở đó để biết định nghĩa và hạn chế.

| Phép đo | Kết quả | Phạm vi |
|---|---|---|
| P/R sự kiện rat | 1,00 / 1,00 | V04, 1 đoạn |
| P/R sự kiện snake | 0,50 / 1,00 | V05 và báo nhầm trên V04, tổng 2 sự kiện |
| P/R sự kiện owl | 1,00 / 1,00 | V06, 1 đoạn |
| Đếm in | tham chiếu 2; AI 0; MAE 2; sai lệch có dấu -100% | V03, agent tham chiếu, chưa TV5 kiểm |
| Đếm out | tham chiếu 3; AI 1; MAE 2; sai lệch có dấu -66,67% | V03, agent tham chiếu, chưa TV5 kiểm |
| Báo động giả trên đàn chim | 0 cả ba lớp | 25,96 giây, chưa xác nhận là swiftlet |
| Báo động giả nền rừng | snake 1 confirmed + 52 blocked | 10,6106 giây; tỷ lệ mỗi giờ chỉ ngoại suy |

V03 chỉ được nguồn ghi là birds, không gọi đây là đánh giá chim yến đã xác
nhận. Mục 1.3 spec cho phép video thay thế đàn chim cố định; ghi giới hạn này
trong báo cáo nộp. V07 là nền rừng, không đáp ứng riêng swiftlet-only ở mục 6.5.
Đã tự kiểm lại ảnh chi tiết các đoạn qua vạch; không nhận là người thứ hai
hoặc TV5 đã đếm lại. Không lặp clip để tăng số mẫu đánh giá một cách giả tạo.

Chưa kết luận triển khai đáng tin cậy; không đổi ngưỡng hoặc chọn lại model
sau khi xem kết quả. Số thấp vẫn được báo trung thực theo spec.

Đã kiểm nguồn Pexels theo các URL trong SOURCES.md và https://www.pexels.com/license/.
Giấy phép cho phép dùng/chỉnh sửa; giữ file gốc cục bộ, không chia sẻ lại như
stock hoặc dùng để train/publish dataset. Không commit media hoặc .env.
