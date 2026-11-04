# Kết quả kiểm chứng AI Vision

Ngày kiểm môi trường: **03/11/2026**. Mục ghi chưa kiểm vẫn chưa được chứng
minh; không suy ra module đã chạy đầu-cuối trên video thật.

| Mã | Kiểm tra | Kết quả |
|---|---|---|
| S1 | Python Windows | Python 3.12.10, đã lưu localPython trong metadata. Lệnh py không có trên PATH; chưa xác nhận Python Launcher hoặc bản Python 3.13. |
| S2 | Chín thư viện | Ghim bản thực tế trong requirements.txt; import, nhận dạng ảnh thật và `pip check` đạt. Chưa cài lại trên máy sạch; venv hiện có `include-system-site-packages=true`. |
| S3 | LineZone | Có triggering_anchors và minimum_crossing_threshold=1; trigger trả hai mảng bool. Bay lên kích hoạt supervision in, ánh xạ thành out của hợp đồng. |
| S4 | ByteTrack | API update_with_detections/reset vẫn hoạt động ở 0.30.9. Có FutureWarning: deprecated từ 0.28, bỏ từ 0.31. Đã đọc mã nguồn gói và test tracker thật giữ ID, đếm qua vạch, nhận khung rỗng. Giữ ghim 0.30.9. |
| S5 | YOLOv8n CPU | Intel Core i7-12700H, RAM khoảng 16 GB. Khung đen 1280×720, imgsz mặc định 640: 21,76 FPS, 46,0 ms/khung sau 5 warmup/30 lượt. Spike dùng COCO 80 lớp, không phải số đo chính thức mô hình đã train. Có tham số epochs/imgsz/seed/batch/device. |
| S6 | Multipart | requests tự sinh boundary; email.parser đọc được metadata text/plain và image image/jpeg. Spike không gọi mạng. |
| S7 | Đường dẫn có dấu | Video MP4 tổng hợp ở đường dẫn ASCII và có dấu đều mở/đọc được trên máy này. imread không mở ảnh fixture qua đường dẫn repo có dấu, test dùng read_bytes/imdecode. Vẫn giữ playlist ASCII. |
| S8 | Ctrl+C thực tế | 04/11: model/video thật + backend Dev, gửi Windows CTRL_C_EVENT sau 600 giây. Lượt chính 602,55 giây và restart 48,39 giây đều exit 0, tổng cuối gửi 200, khóa đã xóa. Chưa kiểm bàn phím hai lần thật; test giả lập hai lần đạt. |
| S9 | Đồng bộ giờ | w32tm báo dịch vụ chưa chạy, mã 0x80070426. Chưa xác nhận giờ đồng bộ; cần xử lý trước live/backend. Không tự đổi dịch vụ Windows. |
| S10 | Gói Roboflow | Đã tra trang giá 03/11: Free Tier 10 credit/tháng, private mặc định; bảng Core gồm Free Tier ghi 20 project, dataset không giới hạn cứng và dùng credit. Research plan public. Chưa xác nhận gói/hạn mức thực tế workspace nhóm. Xem nguồn bên dưới. |
| S11 | Export dữ liệu | split_v3 là YOLO detection đã chuẩn hóa nhãn; chưa export Roboflow mới để xác nhận giao diện/định dạng. |
| S12 | Colab | Output notebook: Tesla T4, Python 3.13.16, torch 2.11.0+cu130, Ultralytics 8.4.178, supervision 0.30.9. Ban đầu thiếu hai gói cuối; chưa xác nhận giới hạn thời lượng phiên. |
| S13 | Nguồn/giấy phép | Có 9 nguồn, mỗi lớp ít nhất hai nguồn theo SOURCES/splits. R05 còn ghi cần kiểm giấy phép; chưa hoàn tất audit giấy phép. |
| S14 | Kho tải trọng số | 04/11: đã tạo GitHub Release ai-vision-v1-2026-11-04 và upload best.pt (không phải last.pt), tải lại 6508010 byte và SHA-256 khớp. 50 epoch xác nhận từ checkpoint/log notebook. URL/status=frozen trong weights.json. |
| S15 | Nạp trọng số máy nhóm | Hash đúng metadata; best.pt nạp bốn lớp trên CPU. Torch Windows 2.15.0+cpu khác Colab; Ultralytics cùng bản. |
| S16 | Ảnh nền | Train có 0/3104 nhãn rỗng, backgroundRatio=0.0. Đã tra hướng dẫn YOLOv5 của Ultralytics nêu gợi ý 0–10%; chưa chứng minh tỷ lệ tối ưu cho mô hình chim yến này. Xem nguồn bên dưới. |
| S17 | Đọc/bỏ khung thật | V01.webm: 1280×720, 25 FPS, 2933 khung. Spike 300 lượt read và 300 lượt grab: read 0,79 ms/khung, grab 0,52 ms/khung. Chỉ là tốc độ giải mã/bỏ khung, không phải FPS nhận dạng hay số đo chất lượng đếm. |
| S18 | Ngưỡng và MIN_BOX_PX | Đóng băng mặc định swiftlet 0,40/predator 0,50, 3 khung/2 giây, cooldown 300 giây trước đo ảnh test. Chưa tối ưu trên val thiên địch vì val chỉ có swiftlet; MIN_BOX_PX chưa chốt. |
| S19 | Giới hạn ảnh | Backend/AI đang chạy cùng SNAPSHOT_MAX_BYTES=2097152, service key khớp; đã nhận JPEG qua HTTP và tải lại từ API. |
| S20 | Vạch đếm | 7 test đạt; SV_IN_MEANS=out. Mất track trước vạch rồi ID mới phía kia: in=0/out=0. Lượn lên–xuống–lên: in=1/out=2, đếm mỗi lần qua vạch. |
| S21 | Video đúng góc | V01/V02 là video martin/én có chuyển động camera, chưa gán test hoặc có nhãn đếm tay. V01 đã dùng smoke live/backend thật ngày 04/11, có nhận dạng sai tổ/chim thành thiên địch; không coi là đánh giá chất lượng đếm. |
| S22 | 404 backend thật | 04/11: POST /api/ai/khong-co với khóa đúng trả 404 NOT_FOUND, sqlNumber=null/details=null. Sai khóa ở bird-counts trả 401 UNAUTHENTICATED. GET health 200; heartbeat object đúng trả 200 accepted=1/rejected=0. |
| S23 | API metrics | Metric.ap_class_index/class_result tồn tại. Đã đo P/R từng lớp tại ngưỡng cố định, IoU 0,5, 1905 ảnh test ở 640/320 bằng eval_fixed_detector.py; detector.csv có TP/FP/FN. Chưa đo mAP/chỉ số sự kiện video. |

Lượt suite cuối ngày 04/11: **314 test và 6 subtest đạt**, có một FutureWarning
ByteTrack đã nêu ở S4. Test `test_offline_smoke.py` đọc MP4 tổng hợp qua OpenCV,
suy luận bằng best.pt, tạo ByteTrack thật và ghi CSV/log offline. Đây không
phải đánh giá video chim hoặc đầu-cuối với backend thật.

Task 14 đã có xuất annotated.mp4 và script chạy camera. Bổ sung 4 test hồi quy
cho trường hợp hàng đợi đã ack rồi đồng hồ nhảy lùi: mức tổng lớn nhất được
giữ tới hết hạn gửi 60 phút, tránh gửi lại tổng nhỏ hơn. Task 16 đã kiểm đường truyền bằng video chạy thử;
bằng chứng thật ở `results/e2e.md`. Vẫn cần video đúng yêu cầu để kết luận đầy đủ.

## Nguồn đối chiếu ngày 03/11/2026

- [Roboflow Pricing](https://roboflow.com/pricing): hạn mức, credit, private/Public Research. Không suy ra gói của workspace nhóm chỉ từ trang giá.
- [Ultralytics — Tips for Best YOLOv5 Training Results](https://docs.ultralytics.com/yolov5/tutorials/tips-for-best-training-results): gợi ý ảnh nền 0–10%, được dùng làm tham khảo trong spec.
- Không truy cập được trang R05 qua công cụ đọc web; giấy phép R05 vẫn chưa được xác minh, không thay thành giấy phép suy đoán từ dataset khác.

## Phiên bản Windows

`torch==2.15.0`, `torchvision==0.29.2`, `ultralytics==8.4.178`,
`supervision==0.30.9`, `requests==2.32.5`, `PyYAML==6.0.3`, `pytest==9.1.1`,
`opencv-python==5.0.0.93`, `numpy==2.3.4`.

Đây là bản thực tế đang được kiểm thử, thay các giá trị đề xuất chưa cài thử
trong plan ban đầu. Không khẳng định đã thử bản cũ rồi phải lùi. Colab giữ
torch GPU có sẵn, chỉ cài Ultralytics và supervision đúng bản ghim.

Pip 25 trong console Windows có thể lỗi hiển thị đường dẫn có dấu. Chạy
`python -X utf8 -m pip ...` để tránh lỗi logging này.

## API tracker

`LineZone(start, end, triggering_anchors, minimum_crossing_threshold=1)`;
`trigger(detections)` trả `(crossed_in, crossed_out)`.

Chữ ký constructor lấy từ instance thật để tránh wrapper deprecation:
`ByteTrack(track_activation_threshold=0.25, lost_track_buffer=30,
minimum_matching_threshold=0.8, frame_rate=30, minimum_consecutive_frames=1)`.
`Detections.from_ultralytics` và `Detections.empty` tồn tại.

Trước khi nâng supervision lên 0.31 hoặc đổi gói tracker, cần cập nhật spec,
kiểm lại API, ánh xạ chiều và tracker thật. Không tự nâng bản.
