# Kết quả đo AI Vision

**Chưa có số đo chính thức trên tập test.** Trọng số hiện tại là bản train thử;
val chỉ có swiftlet. Chưa đóng băng trọng số hoặc cấu hình camera. Không coi
chỉ số val trong `weights.json` là kết quả đánh giá bốn lớp.

Các file CSV hiện chỉ có tiêu đề, chưa có nhãn đếm tay hay dữ liệu giả.
Điền `events_gt.csv` trước khi chạy mô hình trên video test. Đếm tay các đoạn
khoảng một phút vào `counting_segments.csv`; TV5 đếm lại khoảng 20% số đoạn.

| File đầu ra | Công cụ |
|---|---|
| `speed.csv` | `scripts/measure_speed.py` — tốc độ CPU ở hai kích thước ảnh |
| `detector.csv` | `scripts/eval_detector.py` — chỉ chạy trên test sau khi đóng băng |
| `events.csv` | `scripts/evaluate.py events` — Precision/Recall theo sự kiện |
| `false_alarms.csv` | `scripts/evaluate.py false-alarms` — báo động giả mỗi giờ |
| `counting.csv`, `counting_summary.csv` | `scripts/evaluate.py counting` — so với đếm tay |
| `offline_vs_live.csv` | `scripts/evaluate.py offline-vs-live` — so từng cửa sổ |

Trước khi đo chính thức, ghi CPU, RAM, ngày đo, SHA-256 trọng số và commit cấu
hình vào đây. Chọn ngưỡng và vị trí vạch trên val, không chỉnh theo test.
Train lại sau khi đo thì đo lại toàn bộ các mục Phần 6 của spec.

Chạy `offline` riêng từng video với cùng `--t0`; đặt tên thư mục kết quả bằng
mã video để các script ghép đúng nguồn. Tổng video dưới một giờ thì số báo
động giả mỗi giờ là ngoại suy và phải ghi rõ trong báo cáo.
