# Kết quả đo AI Vision

Ngày đo: **04/11/2026**. Trọng số **best.pt**, đã chạy **50 epoch**, đã đóng băng
và phát hành tại [GitHub Release](https://github.com/QuocAn118/HQTCSDL/releases/tag/ai-vision-v1-2026-11-04).
SHA-256 `0dbec2d3176e637873a7ea3209c23c97a5a41806cc3b8c250ed55c7b2fee5cc9`.
Máy đo: Intel Core i7-12700H, RAM vật lý 15,64 GiB, Python 3.12.10,
torch 2.15.0+cpu, Ultralytics 8.4.178; suy luận CPU.

`freeze.json` lưu hash cấu hình hai camera, dataset manifest, script đo và
hàm matching trước khi đo test. Ngưỡng swiftlet **0,40**, thiên địch **0,50**;
xác nhận **3 khung/2 giây**, cooldown **300 giây**; imgsz **640 và 320**.
Giữ tham số mặc định, chưa tối ưu trên val thiên địch vì val chỉ có swiftlet.
Không điều chỉnh theo kết quả test. Đổi trọng số/tham số phải tạo phiên bản
đánh giá mới, không ghi đè kết quả để chọn số tốt hơn.

`training_history.csv` trích đủ 50 dòng epoch từ chính checkpoint; log notebook
trước khi xóa output cũng ghi `50 epochs completed in 0.728 hours`.
Các file **nhãn video** CSV hiện chỉ có tiêu đề, chưa có nhãn đếm tay.
Điền `events_gt.csv` trước khi chạy mô hình trên video test. Đếm tay các đoạn
khoảng một phút vào `counting_segments.csv`; TV5 đếm lại khoảng 20% số đoạn.

| File đầu ra | Công cụ |
|---|---|
| `speed.csv` | `scripts/measure_speed.py` — tốc độ CPU ở hai kích thước ảnh |
| `detector.csv` | `scripts/eval_fixed_detector.py` — P/R từng lớp tại đúng ngưỡng đã khóa, IoU ghép 0,5 |
| `events.csv` | `scripts/evaluate.py events` — Precision/Recall theo sự kiện |
| `false_alarms.csv` | `scripts/evaluate.py false-alarms` — báo động giả mỗi giờ |
| `counting.csv`, `counting_summary.csv` | `scripts/evaluate.py counting` — so với đếm tay |
| `offline_vs_live.csv` | `scripts/evaluate.py offline-vs-live` — so từng cửa sổ |

`detector.csv` đánh giá 1.905 ảnh test split_v3 (R06–R09), từng lớp. TP/FP/FN
ghép một-một, cùng lớp, ưu tiên prediction confidence cao rồi chọn GT có IoU
lớn nhất >= 0,5. Khác với P/R tổng kết của Ultralytics có thể chọn điểm F1 tốt
nhất: số này giữ confidence cố định. Cột rỗng khi mẫu số bằng 0, không tự gán
thành 0 hoặc 1. Chưa có mAP từ lượt này và chưa có P/R theo sự kiện video.
Suy luận batch 8, CPU, NMS IoU 0,7, tối đa 300 detection/ảnh.

| Lớp | Precision 640 | Recall 640 | Precision 320 | Recall 320 |
|---|---:|---:|---:|---:|
| owl | 6,35% | 9,52% | 4,55% | 7,14% |
| rat | 89,38% | 85,59% | 87,45% | 85,59% |
| snake | 82,42% | 54,94% | 87,70% | 38,28% |
| swiftlet | 73,33% | 1,54% | 68,42% | 0,18% |

Recall cú và chim rất thấp trên nguồn test độc lập. Kết quả này không chứng
minh mô hình sẵn sàng đếm chim hoặc cảnh báo cú đáng tin cậy. Không hạ ngưỡng
sau khi thấy số đo. Val thiếu thiên địch và khác biệt nguồn/góc quay là hạn
chế thiết kế, chưa phải bằng chứng xác định nguyên nhân riêng cho mọi lỗi.

Chạy lại công cụ chỉ để tái lập đúng snapshot, không dùng để chỉnh tham số:

```powershell
.venv/Scripts/python -X utf8 scripts/eval_fixed_detector.py
```

MAE, sai lệch có dấu và báo động giả/giờ **chưa đo được**: V01/V02 chỉ là
video chạy thử, camera thay đổi, nguồn ghi chim én thay vì swiftlet; chưa có
đoạn test được duyệt và nhãn đếm tay lập trước suy luận. Không suy ra các số
này từ test ảnh và không coi file CSV trống là kết quả 0. Backend Dev đã dựng,
health/heartbeat đã kiểm thành công; Task 16 đã kiểm live/restart/cooldown bằng video chạy thử,
vẫn thiếu video đúng yêu cầu để kết luận đầy đủ; xem `e2e.md`.

Chọn ngưỡng và vị trí vạch trên val, không chỉnh theo test.
Train lại sau khi đo thì đo lại toàn bộ các mục Phần 6 của spec.

Chạy `offline` riêng từng video với cùng `--t0`; đặt tên thư mục kết quả bằng
mã video để các script ghép đúng nguồn. Tổng video dưới một giờ thì số báo
động giả mỗi giờ là ngoại suy và phải ghi rõ trong báo cáo.
