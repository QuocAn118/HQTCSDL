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

## Đo tốc độ CPU bổ sung — 05/11/2026

V3 best.pt đã đóng băng, Intel Core i7-12700H, RAM 15,64 GiB, chạy CPU.
Dùng V02.ogv chỉ làm benchmark, không coi là test đếm hoặc test âm tính.
Mô hình: 5 khung warmup + 300 khung đo. Toàn luồng offline xử lý toàn video
485 khung, gồm detector/tracker/đếm/log, không có HTTP backend; không ép real-time.

| imgsz | FPS mô hình | FPS toàn luồng | ms/khung toàn luồng |
|---|---:|---:|---:|
| 640 | 15,39 | 15,00 | 66,7 |
| 320 | 49,65 | 46,35 | 21,6 |

Đầu ra: speed.csv. Đây là một lượt benchmark trên máy hiện tại, không phải
ước lượng độ chính xác. 640 thấp hơn FPS video (~29,97); live có thể bỏ khung.
Không tự đổi cấu hình runtime xuống 320, vì recall ảnh test ở 320 thấp hơn.

## Đo video Pexels bổ sung — 05/11/2026

Phần ghi chưa có nhãn/CSV ngày 04/11 ở trên là lịch sử. Đã nhận V03–V07,
đối chiếu URL và giấy phép Pexels trong SOURCES.md. Giữ v3 best.pt và tham số
đã khóa: imgsz 640, swiftlet 0,40, predator 0,50, 3 khung/2 giây, cooldown 300 giây.
Không sửa ngưỡng theo kết quả. results/video-freeze-2026-11-05.json ghi hash
video, nhãn sự kiện và cấu hình trước suy luận. counting-freeze-2026-11-05.json
ghi riêng nhãn tham chiếu V03 trước khi chạy V03. Video/ảnh/log gốc không vào Git.

### Sự kiện thiên địch

Agent xem ảnh mẫu khoảng 4 FPS toàn thời lượng V04/V05/V06, ghi mỗi clip một
đoạn liên tục từ đầu tới cuối vào events_gt.csv, rồi mới chạy offline từng clip.
Nhãn không dựa trên dự đoán AI; không tuyên bố có TV5 hoặc chuyên gia duyệt.
Các clip chỉ dài 20,64 / 5,04 / 14,25 giây, mỗi lớp một clip: số đo mẫu nhỏ,
không chứng minh khả năng tổng quát ngoài thực tế. Kết quả events.csv:

| Lớp | Sự kiện đúng / phát ra | Đoạn phát hiện / GT | Precision | Recall |
|---|---:|---:|---:|---:|
| rat | 1/1 | 1/1 | 1,00 | 1,00 |
| snake | 1/2 | 1/1 | 0,50 | 1,00 |
| owl | 1/1 | 1/1 | 1,00 | 1,00 |

Đây là P/R theo sự kiện, không phải P/R theo khung trong detector.csv.

### Đếm trên video thay thế V03

Trang nguồn chỉ mô tả birds, không xác nhận swiftlet. Chỉ dùng phương án
đàn chim quay cố định theo mục 1.3; không gán nhãn loài swiftlet cho nguồn.
Vạch giữ nguyên (0,10;0,55) → (0,90;0,55), bay xuống=in, bay lên=out.
Agent duyệt 66 ảnh cách 0,4 giây, sau đó duyệt chi tiết cách 0,2 giây tại
7,8–14,2 giây; dùng tâm thân, không tính cánh vừa chạm vạch. MIN_BOX_PX=8
trên ảnh gốc cho lượt tham chiếu này; các chim được đếm đều lớn hơn ngưỡng.
Không đổi nhãn train cũ. Chi tiết nhãn trước suy luận nằm ở
reports/2026-11-05-counting-reference.json. Chưa có TV5 đếm lại độc lập;
đây là nhãn tham chiếu của agent cần người đối chiếu, không coi là ground truth
người đếm đã được xác minh. Video chỉ 25,96 giây, một đoạn, ngắn hơn đề xuất
khoảng một phút; không coi nhiều vòng phát lặp là nhiều mẫu độc lập.

| Chiều | Tham chiếu agent | AI | MAE trên 1 đoạn | Sai số tương đối | Sai lệch có dấu |
|---|---:|---:|---:|---:|---:|
| in | 2 | 0 | 2 | 100% | -100% |
| out | 3 | 1 | 2 | 66,67% | -66,67% |

counting.csv/counting_summary.csv giữ tên cột tay_* của công cụ; ở lượt này
chúng chứa số tham chiếu thị giác agent, không phải xác nhận TV3/TV5 đã đếm tay.
Kết quả thấp được giữ nguyên. Không thay trọng số/ngưỡng để cải thiện trên test.

### Báo động giả

- false_alarms.csv và false_alarms_fallback.csv: V03, 25,96 giây, 0 lần confirmed
  và 0 lần blocked cả ba lớp. Đây là video đàn chim chưa xác nhận loài, **không
  hoàn tất riêng yêu cầu video chỉ có chim yến mục 6.5**.
- false_alarms_background.csv: V07 nền rừng 10,6106 giây; snake 1 confirmed,
  52 cooldown_blocked, tương ứng 339,28 / 17.982,02 lần mỗi giờ nếu ngoại suy
  theo hai định nghĩa; rat/owl 0. Đây là phép đo bổ sung nền chung.
- Các tỷ lệ/giờ đều tính từ thời lượng ngắn, không phải quan sát một giờ thực tế.
  Đặc biệt 339,28/h không phải tốc độ báo động dài hạn khi giữ cooldown 300 giây:
  phép ngoại suy từ lần xác nhận đầu clip có thể vượt trần dài hạn của cooldown.
  Cột gio_video bị làm tròn ba chữ số; phép chia dùng thời lượng chính xác local.

Tổng hợp máy đọc được: video-evaluation-2026-11-05.json. Chưa có video swiftlet
được xác nhận để kết luận mục 6.5; chưa có TV5 đếm lại. Không ghi hoàn tất các
điều kiện đó chỉ vì đã có CSV.
