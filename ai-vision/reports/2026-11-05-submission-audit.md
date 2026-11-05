# Kiểm tra yêu cầu fix trước nộp — 05/11/2026

| Mục | Trạng thái | Bằng chứng / phần thiếu |
|---|---|---|
| 1. Đóng băng trọng số | Đạt về artifact | weights.json: frozen, best.pt v3, 50 epoch thực tế, URL Release. Tải lại asset và xác minh SHA-256 ngày 05/11; toàn bộ hash freeze.json vẫn khớp. Không có nghĩa chất lượng mô hình đạt. |
| 2. Video và playlist | Đạt phần thống nhất tên; thiếu video đánh giá | H1 dùng V01.webm, H2 dùng V02.ogv, có nguồn trong SOURCES.md; không còn R02.mp4/S01.mp4. Hai video là martin, không phải swiftlet, không phù hợp đếm qua vạch cố định. |
| 3. Task 15 | Chưa hoàn tất | detector.csv có P/R từng lớp trên 1.905 ảnh tại imgsz 640/320. predator.confidence=0.50 và tham số được khóa trong freeze.json trước test. Chưa có counting.csv/counting_summary.csv/false_alarms.csv; counting_segments.csv và events_gt.csv chỉ có tiêu đề. Thiếu video đúng mục tiêu và nhãn trước suy luận; không được ghi số 0 thay kết quả chưa đo. |
| 4. Task 16 | Đã kiểm tích hợp; chưa hoàn tất toàn bộ | e2e.md, e2e_summary.json, e2e_windows.csv: live 602,55 giây với backend/SQL/MQTT thật, 20 heartbeat HTTP 200 và 12 lần gửi đếm HTTP 200; restart/cooldown có bằng chứng. Video smoke V01 và nhận sai thiên địch không chứng minh độ chính xác. Còn video đếm/thiên địch được duyệt, đối chiếu nhãn, xác nhận đồng bộ giờ và thao tác Ctrl+C kép bằng bàn phím. |
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
