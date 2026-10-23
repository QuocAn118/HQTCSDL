# AI Vision

Dataset hiện dùng: **data/working/split_v1/**, cập nhật 22/10/2026. Có 4.040 ảnh và 4.040 file nhãn YOLO detection, kích thước ảnh 512×512.

| Lớp (class ID) | Train | Val | Test | Tổng |
|---|---:|---:|---:|---:|
| owl (0) | 418 | 52 | 52 | 522 |
| rat (1) | 964 | 120 | 120 | 1.204 |
| snake (2) | 631 | 79 | 79 | 789 |
| swiftlet (3) | 1.221 | 152 | 152 | 1.525 |
| Tổng | 3.234 | 403 | 403 | 4.040 |

Train/val/test xấp xỉ 80/10/10, seed 20261022. Các khung cùng video nhận diện qua tên file, biến thể cùng tên gốc và chuỗi ảnh swiftlet được giữ chung một tập. Không có nhóm đã nhận diện hoặc hash ảnh trùng giữa các tập. Chưa quét toàn bộ ảnh gần giống; gom nhóm theo tên không phát hiện chắc chắn video đã đổi tên. Nhãn đã được rà sàng lọc, chưa duyệt đầy đủ từng đối tượng. Đây là bản để train thử, chưa phải đánh giá trên nguồn độc lập.

## Các file cần dùng

- `data/working/split_v1/data.yaml`: cấu hình dataset để train. Đường dẫn `path` hiện dành cho máy này; sửa khi chuyển máy hoặc đưa lên Colab. Chỉ augment train.
- `splits.csv`: danh mục tập, nhóm và nguồn của từng ảnh.
- `data/working/split_v1/split_manifest.csv`: danh mục đầy đủ, kèm đường dẫn nhãn và SHA-256.
- `data/working/split_v1/class_counts.csv`, `split_summary.json`: thống kê và kiểm tra sau chia.
- [SOURCES.md](SOURCES.md): nguồn dữ liệu, giấy phép và metadata bản xuất.
- `scripts/split_dataset.ps1`: tạo lại bộ chia từ `sourced_v1`; từ chối ghi đè `split_v1` đã tồn tại.

## Dữ liệu được giữ

- `data/raw/`: dữ liệu gốc và các ZIP nguồn, dùng đối chiếu và khôi phục.
- `data/working/sourced_v1/`: 4.040 ảnh sạch trước chia, đầu vào của script chia tập. Các thư mục train/valid/test bên trong là vị trí cũ, không dùng trực tiếp để đánh giá.
- `data/working/split_v1/`: bản đã chia để train.

Đã loại 10 ảnh không đạt điều kiện đối chiếu nguồn, 122 ảnh nhãn rỗng, 12 ảnh lỗi nhãn, 7 ảnh nghi vấn/minh họa và 98 bản trùng hoàn toàn. Trùng được kiểm bằng SHA-256 file và pixel RGB. Các CSV `excluded.csv`, `removed_*.csv` trong sourced_v1 giữ danh sách và lý do; `dataset_summary.json` tóm tắt bản sạch. Đã chuyển ba dòng polygon thành bbox bao ngoài trước khi làm sạch; dữ liệu raw giữ nguyên.

Các báo cáo rà soát, bảng ảnh xem nhãn, bản merged_v1 và script xử lý trung gian đã được bỏ để tránh nhầm với trạng thái hiện tại.
