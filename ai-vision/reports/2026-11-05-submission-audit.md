# Kiểm tra yêu cầu fix trước nộp — 05/11/2026

| Mục | Trạng thái | Bằng chứng / phần thiếu |
|---|---|---|
| 1. Đóng băng trọng số | Đạt về artifact | weights.json: frozen, best.pt v3, 50 epoch thực tế, URL Release. Tải lại asset và xác minh SHA-256 ngày 05/11; toàn bộ hash freeze.json vẫn khớp. Không có nghĩa chất lượng mô hình đạt. |
| 2. Video và playlist | Đã có V03–V07 và profile kiểm riêng; V03 là video thay thế | H1 dùng V01.webm, H2 dùng V02.ogv, có nguồn trong SOURCES.md; không còn R02.mp4/S01.mp4. Hai video là martin, không phải swiftlet, không phù hợp đếm qua vạch cố định. |
| 3. Task 15 | Có CSV video bổ sung, còn giới hạn | detector.csv có P/R ảnh; events.csv có P/R sự kiện. Đã có counting.csv/counting_summary.csv và false_alarms.csv từ V03 thay thế. Nhãn agent chưa TV5 đếm lại; loài V03 chưa xác nhận swiftlet nên chưa hoàn tất điều kiện swiftlet-only. Tham số và nhãn đã lưu hash trước suy luận. |
| 4. Task 16 | Đã kiểm lại với video thiên địch thật | e2e.md và evidence hậu tố2026-11-05: live602,98 giây,20 heartbeat200/12 counts200, ảnh chuột thật, restart owl COOLDOWN, tổng cuối API khớp, khóa xóa. Ctrl+C bằng tín hiệu console; chưa kiểm bàn phím kép hoặc NTP độc lập. Số đếm playlist này chỉ kiểm vận chuyển. |
| 5. Xóa output notebook | Đạt | colab-setup.ipynb và train-v4-pilot.ipynb đều outputs rỗng, execution_count null. |

## Trọng số dùng trong hồ sơ

Bản chính thức hiện vẫn là v3 đã phát hành. V4 ở data/weights/v4-pilot/ đã đối chiếu
hash, cấu hình và CSV đủ 50 epoch nhưng vẫn trial, chưa thay v3. Val v4 chỉ 13 ảnh;
swiftlet Recall=0, snake Precision khoảng 0,307. Không dùng số val làm test hoặc
so trực tiếp với test v3. V01 đã là train của v4 nên không dùng làm test độc lập v4.

## Cần bổ sung trước khi đánh dấu hoàn tất

1. Video swiftlet qua vạch cố định, có quyền sử dụng, và video thiên địch/đoạn âm tính có nhãn sự kiện.
2. Gán split, vạch và nhãn đếm trước suy luận; TV5 đếm lại theo spec. Không đổi ngưỡng sau khi xem test.
3. Chạy Task 15 và lưu MAE/sai số có dấu/false alarms per hour bằng công cụ đã có.
4. Hoàn tất các mục còn thiếu của Task 16, cập nhật e2e.md từ bằng chứng thực tế.

Các báo cáo/lịch sử v4 được gom cùng bản kiểm trước nộp; không đưa file PT/media vào Git.
Kiểm tra git ls-files không thấy checkpoint, ZIP, video hoặc file .env được theo dõi;
đây không phải quét bí mật toàn bộ lịch sử Git. Không ghi lại service key trong báo cáo.

## Tiếp tục thu thập bằng chứng ngày 05/11

Đã chạy lại toàn bộ test: 327 passed, 6 subtests passed, một FutureWarning ByteTrack.
Đã hoàn tất phép đo CPU bằng scripts/measure_speed.py, v3 best.pt, V02.ogv,
imgsz 640/320; video chỉ dùng benchmark, không biến thành test đếm/thiên địch.

Ứng viên thiên địch mới: Michael Pereckas, Snake video.webm (25/12/2019),
https://commons.wikimedia.org/wiki/File:Snake_video.webm — CC BY 2.0,
https://creativecommons.org/licenses/by/2.0/. Trang ghi video 28 giây, 1920x1080.
Chưa tải thành công: API/file gốc trả HTTP 403, lần thử tải có User-Agent trả 429.
Chưa xem video, chưa gán nhãn/split, chưa chạy mô hình; không được dùng làm số đo.
Không nhầm với các video thí nghiệm hóa học cũng có tên snake.

Phương án dự phòng mục 1.3 spec cho phép đàn chim quay cố định. Vẫn cần duyệt
chuyển động camera, lập nhãn trước suy luận và ghi đúng loài/phạm vi thay thế;
không đổi ID loài của runtime chỉ để làm phép đo có kết quả. Đã hỏi bổ sung video
của nhóm qua đường dẫn local trong khi tiếp tục benchmark.

Kết quả benchmark đã lưu results/speed.csv: FPS toàn luồng 15,00 (640), 46,35 (320).

## Cập nhật sau khi người dùng bổ sung V03–V07

Đã xác minh nguồn Pexels và quyền dùng theo trang license. Đã bổ sung events_gt.csv,
events.csv, counting_segments.csv, counting.csv, counting_summary.csv,
false_alarms.csv (V03 thay thế), false_alarms_background.csv (V07 rừng).
Nhãn và tham số được ghi hash trước suy luận. Kết quả/giới hạn ở results/README.md.
Bản đếm do agent duyệt, chưa có TV5 kiểm độc lập; nguồn V03 không xác nhận swiftlet.
Do đó đã có số đo video thay thế nhưng chưa thể đánh dấu hoàn tất nghiêm ngặt
mục 6.5 (swiftlet-only) hoặc kiểm đếm độc lập TV5. Đang kiểm Task 16 thêm bằng
playlist có thiên địch thực, không dùng V01 nữa; chỉ ghi hoàn tất sau khi có receipt.

## Chốt sau lượt live mới

Task16 đã có kiểm tích hợp với thiên địch thật: live602,98 giây, exit0,
20 heartbeat200,12 counts200, ảnh chuột đúng có khung bao/API200; restart48,61 giây,
owl277 giây sau lần tạo trước trả COOLDOWN không retry, không tạo owl mới.
Ba cửa sổ API khớp tổng cuối; khóa xóa. Bằng chứng results/e2e.md và các file
hậu tố2026-11-05. Bộ test mới nhất327 passed,6 subtests passed,1 FutureWarning.
Task15 hiện có CSV sự kiện, đếm tham chiếu agent và báo động giả video thay thế;
vẫn chưa đạt điều kiện nghiêm ngặt swiftlet-only và TV5 đếm lại độc lập.
