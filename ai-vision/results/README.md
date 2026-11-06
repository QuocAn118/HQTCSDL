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
Các file nhãn video đã bổ sung ngày 05/11; nhãn đếm là tham chiếu thị giác agent, chưa có TV5 kiểm độc lập.
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
thành 0 hoặc 1. Lượt này chỉ đo P/R cố định. mAP bổ sung ở detector_map.csv; P/R sự kiện video ở events.csv, xem cập nhật 05/11.
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

Tại lượt 04/11, MAE/sai lệch/báo động giả chưa đo được: V01/V02 chỉ là
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

## Hạn chế đã biết

Số liệu lấy từ `*.csv`, đo bằng trọng số v3 đã đóng băng. Các số này không chứng minh mô hình đủ tin cậy để triển khai.

- **Chim yến gần như không được phát hiện trên ảnh test:** Recall 1,54% ở imgsz 640 (TP 110, FN 7.021) và 0,18% ở imgsz 320; Precision 73,33% và 68,42% (`detector.csv`).
- **Cú rất yếu:** Precision 6,35%, Recall 9,52% ở imgsz 640; Precision 4,55%, Recall 7,14% ở imgsz 320 (`detector.csv`).
- **MAE đếm chỉ đo trên 1 đoạn 25,96 giây của V03:** MAE bằng 2 ở mỗi chiều. Chiều in: tham chiếu 2, AI 0. Chiều out: tham chiếu 3, AI 1 (`counting_segments.csv`, `counting_summary.csv`). Nguồn V03 chỉ ghi birds, không xác nhận là chim yến.
- **Chưa có người đếm lại độc lập:** các cột `nguoi_dem_lai_*` đang trống. Cột `tay_*` chứa số tham chiếu do agent duyệt, không phải số người đếm (`counting.csv`).
- **Báo động giả mỗi giờ là ngoại suy từ clip V08 26 giây, không phải quan sát một giờ thật:** lớp rat có 1 lần xác nhận và 355 lần bị cooldown chặn, ngoại suy thành 138,46 lần/giờ khi có cooldown và 49.292,31 lần/giờ khi không tính cooldown; snake và owl bằng 0 (`false_alarms.csv`).
- **`offline_vs_live` chỉ có 1 cửa sổ:** 2026-11-05T10:10:00Z, live 0 in/0 out, offline 0 in/1 out (`offline_vs_live.csv`). Không suy rộng sang video hoặc máy khác.
- **R05 chưa xác minh giấy phép trên trang gốc:** nguồn này nằm trong val của v3 (`../SOURCES.md`).
- **Không có val độc lập cho thiên địch:** val của v3 chỉ có swiftlet, nên ngưỡng rat, snake, owl giữ mặc định, chưa chọn trên val. `v4-pilot-val.csv` (13 ảnh) thuộc bản thử v4, không phải trọng số đóng băng.
- **Không dùng số đếm demo làm bằng chứng đếm đúng:** cả 3 cửa sổ trong `e2e-windows-2026-11-05.csv` đều 0 in/0 out và khớp API. Kết quả này chỉ chứng minh số đếm được gửi và lưu đúng.

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

- Bản trước false_alarms.csv, nay giữ tại false_alarms_fallback.csv: V03, 25,96 giây, 0 lần confirmed
  và 0 lần blocked cả ba lớp. Đây là video đàn chim chưa xác nhận loài, **không
  hoàn tất riêng yêu cầu video chỉ có chim yến mục 6.5**.
- false_alarms_background.csv: V07 nền rừng 10,6106 giây; snake 1 confirmed,
  52 cooldown_blocked, tương ứng 339,28 / 17.982,02 lần mỗi giờ nếu ngoại suy
  theo hai định nghĩa; rat/owl 0. Đây là phép đo bổ sung nền chung.
- Các tỷ lệ/giờ đều tính từ thời lượng ngắn, không phải quan sát một giờ thực tế.
  Đặc biệt 339,28/h không phải tốc độ báo động dài hạn khi giữ cooldown 300 giây:
  phép ngoại suy từ lần xác nhận đầu clip có thể vượt trần dài hạn của cooldown.
  Cột gio_video bị làm tròn ba chữ số; phép chia dùng thời lượng chính xác local.

Tổng hợp máy đọc được: video-evaluation-2026-11-05.json. Đã bổ sung V08 theo mô tả loài của DVIDS ở phần cuối; chưa có TV5 đếm lại. Không ghi hoàn tất các
điều kiện đó chỉ vì đã có CSV.

## Bổ sung sau rà độc lập — 05/11/2026

Đã sửa lỗi đánh giá ở ranh giới giây lẻ: offline predators.csv và crossings.csv
thêm media_seconds chính xác; evaluate.py ưu tiên trường này và vẫn đọc CSV cũ.
HTTP/fixture thời gian UTC đến giây có Z giữ nguyên. Hai test ranh giới7,9s/2,9s
và test writer2,1s tái hiện lỗi trước sửa, đạt sau sửa. Đã chạy lại V03–V07 với
cùng model/config/GT để sửa phép đo, không dùng kết quả chọn tham số. Các số đo
toàn clip không đổi. Raw mới: data/out/eval_precise_20261105/; bản cũ giữ nguyên.
Chi tiết review: reports/2026-11-05-measurement-review.json.

Đã bổ sung AP theo score sweep vào detector_map.csv ở640/320 trên1.905 ảnh test.
Đây là **lượt test bổ sung cho chỉ số thiếu**, lệch quy tắc “test một lần” ở6.1;
không chọn lại model hoặc threshold theo kết quả. detector.csv P/R tại ngưỡng
runtime giữ nguyên byte/hash; không trộn F1-selected PR vào đó. Tham số/hash
trước lượt bổ sung trong map-evaluation-plan-2026-11-05.json; receipt riêng.
Script eval_detector.py giờ mặc định ghi detector_ultralytics.csv và ép CPU,
tránh vô ý đè detector.csv; có test hồi quy tình huống đó.

| Lớp | AP50 640 | AP50–95 640 | AP50 320 | AP50–95 320 |
|---|---:|---:|---:|---:|
| owl | 0,0160 | 0,0048 | 0,0239 | 0,0097 |
| rat | 0,9102 | 0,5740 | 0,9059 | 0,6219 |
| snake | 0,6750 | 0,3708 | 0,6038 | 0,3180 |
| swiftlet | 0,0714 | 0,0225 | 0,0496 | 0,0161 |

Đã có offline_vs_live.csv trên đúng một vòng V03, cùng t0 chính xác
2026-11-05T10:13:18.757654+00:00. Live xử lý299/bỏ350 khung trên649 khung,
tỷ lệ bỏ350/649=53,93%; offline xử lý đủ649. Cửa sổ10:10UTC: live0in/0out,
offline0in/1out, chênh0in/-1out. Không tính vòng lặp thứ hai. Helper chỉ chặn
ở biên replay đầu bằng KeyboardInterrupt, không thay model/phát hiện/đồng hồ;
đây không phải bằng chứng Ctrl+C kép bàn phím. Receipt ở
offline-vs-live-receipt-2026-11-05.json. Chỉ là một video thay thế ngắn,
không suy rộng mức sai số hoặc tỷ lệ bỏ khung sang mọi máy/video.

## False alarms trên nguồn chim yến V08

Đã bổ sung V08 từ video U.S.Navy/DVIDS949024, nguồn xác nhận Mariana swiftlet;
chi tiết giấy phép, phần cắt và disclaimer trong SOURCES.md. Lấy26giây skyview,
không dùng cảnh có người hoặc đoạn cut, duyệt trước suy luận, không dùng model
để chọn đoạn. Lưu hash video/nhãn âm tính/config trong V08-freeze-2026-11-05.json.

false_alarms.csv **hiện chứa V08**, thay fileV03; V03 vẫn ở
false_alarms_fallback.csv, V07 ở false_alarms_background.csv.
V08: rat1 confirmed +355 cooldown_blocked; snake/owl đều0. Ngoại suy tương ứng
138,46/h có cooldown và49.292,31/h raw; **không phải quan sát một giờ**, số raw
là số lần xác nhận/chặn theo định nghĩa spec, không phải356 con chuột hay356
sự kiện vật lý độc lập. Tỷ lệ ngắn hạn vượt12/h không mô tả tốc độ gửi dài hạn
khi giữ cooldown300giây. Điều này cho thấy nhận dạng nhầm nền/cành cây trên mẫu
đã kiểm, không cho phép kết luận hệ thống đáng tin cậy. Loài dựa vào nguồn,
chưa có chuyên gia đối chiếu; một đoạn rất ngắn, không đại diện mọi nhà yến.

Toàn suite sau sửa330 test và6 subtest đạt, một FutureWarning ByteTrack đã biết.
Pip check: không có phụ thuộc hỏng. Rà độc lập theo requesting-code-review đã
xác nhận hai sửa đổi thời gian/đầu ra CLI, không còn lỗi cần chặn trong phạm vi đó.
R05 vẫn chưa xác minh giấy phép gốc; không tự ghi giấy phép thay chủ nguồn.
