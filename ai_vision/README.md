# AI Vision

Dataset hiện dùng: **data/working/split_v2/**, cập nhật 24/10/2026. Có 4.040 ảnh và 4.040 file nhãn YOLO detection, kích thước ảnh 512×512. Chia theo toàn bộ nguồn dataset Universe, đúng spec §2.4.

| Lớp (class ID) | Train | Val | Test | Tổng |
|---|---:|---:|---:|---:|
| owl (0) | 522 | 0 | 0 | 522 |
| rat (1) | 1.204 | 0 | 0 | 1.204 |
| snake (2) | 789 | 0 | 0 | 789 |
| swiftlet (3) | 589 | 936 | 0 | 1.525 |
| Tổng | 3.104 | 936 | 0 | 4.040 |

R01–R04 nằm nguyên trong train; R05 nằm nguyên trong val. Ưu tiên độc lập nguồn thay vì tỷ lệ 80/10/10. Rat, snake và owl mỗi lớp chỉ có một nguồn, nên chỉ nằm ở train và **không có tập test độc lập**. Val chỉ có swiftlet; chưa có test cho cả bốn lớp. Không dùng số đo val để kết luận chất lượng cả bốn lớp, không chọn mô hình chỉ dựa vào val swiftlet rồi coi đó là tối ưu cho thiên địch. Cần bổ sung nguồn độc lập cho val/test thiên địch và test swiftlet trước khi đánh giá đầy đủ theo spec §6. Nhãn đã được rà sàng lọc, chưa duyệt đầy đủ từng đối tượng.

`split_v1` ngày 22/10 là bản chia theo nhóm tên ảnh, để cùng dataset xuất hiện ở nhiều tập; bản đó không đáp ứng spec và chỉ giữ để đối chiếu. Không dùng làm đánh giá độc lập hoặc trộn với `split_v2`. Nếu đã train trên `split_v1`, cần train lại trên bộ chia mới trước khi đánh giá nguồn độc lập.

## Các file cần dùng

- `data/working/split_v2/data.yaml`: cấu hình dataset để train thử với giới hạn val nói trên. Đường dẫn `path` hiện dành cho máy này; sửa khi chuyển máy hoặc đưa lên Colab. Chỉ augment train. Thư mục test trống, chưa chạy đánh giá test.
- `splits.csv`: ánh xạ `nguon,tap`, đúng một dòng mỗi nguồn; đây là đầu vào của script, không phải danh mục ảnh.
- `data/working/split_v2/split_manifest.csv`: danh mục từng ảnh, đường dẫn nhãn, nguồn và SHA-256. `split_group` bằng `source_id`, `grouping_method=source_id`; tên ảnh bắt đầu bằng mã nguồn. Không suy đoán video hay chuỗi ảnh từ tên file nữa.
- `data/working/split_v2/class_counts.csv`, `source_counts.csv`, `split_summary.json`: thống kê và kiểm tra sau chia.
- [SOURCES.md](SOURCES.md): nguồn dữ liệu, giấy phép và metadata bản xuất.
- `scripts/split_dataset.ps1`: tạo bộ chia từ `sourced_v1` và `splits.csv`; từ chối ghi đè đầu ra đã tồn tại, nguồn lạ/trùng, tập sai và lớp chỉ có một nguồn bị đưa ra ngoài train. Kiểm hash ảnh đầu vào, hash ảnh và nhãn sau sao chép; không sửa `image_review.csv` gốc.

Chạy từ gốc repo bằng PowerShell 5.1:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ai_vision/tests/split_dataset.test.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ai_vision/scripts/split_dataset.ps1
# Neu split_v2 da ton tai, chon thu muc moi; khong ghi de:
powershell -NoProfile -ExecutionPolicy Bypass -File ai_vision/scripts/split_dataset.ps1 -Out ai_vision/data/working/split_v3
```

## Dữ liệu được giữ

- `data/raw/`: dữ liệu gốc và các ZIP nguồn, dùng đối chiếu và khôi phục.
- `data/working/sourced_v1/`: 4.040 ảnh sạch trước chia, đầu vào của script chia tập. Các thư mục train/valid/test bên trong là vị trí cũ, không dùng trực tiếp để đánh giá.
- `data/working/split_v1/`: bản cũ không đạt yêu cầu chia theo nguồn, giữ đối chiếu.
- `data/working/split_v2/`: bản hiện dùng, chia theo nguồn.

Đã loại 10 ảnh không đạt điều kiện đối chiếu nguồn, 122 ảnh nhãn rỗng, 12 ảnh lỗi nhãn, 7 ảnh nghi vấn/minh họa và 98 bản trùng hoàn toàn. Trùng được kiểm bằng SHA-256 file và pixel RGB. Các CSV `excluded.csv`, `removed_*.csv` trong sourced_v1 giữ danh sách và lý do; `dataset_summary.json` tóm tắt bản sạch. Đã chuyển ba dòng polygon thành bbox bao ngoài trước khi làm sạch; dữ liệu raw giữ nguyên.

Các báo cáo rà soát, bảng ảnh xem nhãn, bản merged_v1 và script xử lý trung gian đã được bỏ để tránh nhầm với trạng thái hiện tại.
