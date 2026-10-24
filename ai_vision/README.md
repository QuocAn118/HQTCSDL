# AI Vision

Dataset hiện dùng: **data/working/split_v3/**, cập nhật 24/10/2026. Có 5.945 ảnh và 5.945 file nhãn YOLO detection. Các ảnh mới giữ kích thước gốc; Ultralytics resize lúc train/inference. Chia theo nguồn dataset Universe, đúng spec §2.4; ảnh trùng/lỗi đã loại không thuộc bộ chia.

| Lớp (class ID) | Train | Val | Test | Tổng |
|---|---:|---:|---:|---:|
| owl (0) | 522 | 0 | 42 | 564 |
| rat (1) | 1.204 | 0 | 212 | 1.416 |
| snake (2) | 789 | 0 | 1.403 | 2.192 |
| swiftlet (3) | 589 | 936 | 248 | 1.773 |
| Tổng | 3.104 | 936 | 1.905 | 5.945 |

R01–R04 nằm trong train; R05 nằm trong val; các ảnh được giữ từ R06–R09 nằm trong test. Rat, snake, owl hiện mỗi lớp có hai nguồn train/test; swiftlet có ba nguồn train/val/test. R07 là bộ `rat-fsvlk` mới, không dùng bộ Ashveer cũ hoặc mã R10 riêng. Ưu tiên chia theo nguồn thay vì tỷ lệ 80/10/10.

**Val vẫn chỉ có swiftlet.** Không dùng test để chỉnh ngưỡng hay chọn mô hình; cần bổ sung val độc lập cho thiên địch trước khi tinh chỉnh/đánh giá đầy đủ theo spec §6. Nhãn đã chuẩn hóa kỹ thuật và xem mẫu, chưa duyệt đầy đủ từng đối tượng; cần rà nhãn trước khi đóng băng test để đo chính thức. Các phép kiểm gần giống không bảo đảm phát hiện hết crop/cảnh video chung hoặc chứng minh nguồn gốc độc lập tuyệt đối. Bộ ảnh test không thay thế video để đo theo sự kiện hoặc đếm chim.

`split_v1` ngày 22/10 là bản chia theo nhóm tên ảnh, để cùng dataset xuất hiện ở nhiều tập; bản đó không đáp ứng spec và chỉ giữ để đối chiếu. Không dùng làm đánh giá độc lập hoặc trộn với `split_v2`. Nếu đã train trên `split_v1`, cần train lại trên bộ chia mới trước khi đánh giá nguồn độc lập.

`split_v2` giữ 4.040 ảnh cũ, chỉ có train/val. `split_v3` giữ nguyên phân chia các ảnh này và bổ sung 1.905 ảnh test từ bốn nguồn mới sau kiểm tra.

## Các file cần dùng

- `data/working/split_v3/data.yaml`: cấu hình dataset với giới hạn val nói trên. Đường dẫn `path` hiện dành cho máy này; sửa khi chuyển máy hoặc đưa lên Colab. Chỉ augment train.
- `splits.csv`: ánh xạ `nguon,tap`, đúng một dòng mỗi nguồn; đây là đầu vào của script, không phải danh mục ảnh.
- `data/working/split_v3/split_manifest.csv`: danh mục từng ảnh, đường dẫn nhãn, nguồn và SHA-256. `split_group` bằng `source_id`, `grouping_method=source_id`; tên ảnh bắt đầu bằng mã nguồn. Không suy đoán video hay chuỗi ảnh từ tên file nữa.
- `data/working/split_v3/class_counts.csv`, `source_counts.csv`, `split_summary.json`: thống kê và kiểm tra sau chia.
- [SOURCES.md](SOURCES.md): nguồn dữ liệu, giấy phép và metadata bản xuất.
- `scripts/split_dataset.ps1`: tạo bộ chia từ `sourced_v3` và `splits.csv`; từ chối ghi đè đầu ra đã tồn tại, nguồn lạ/trùng, tập sai và lớp chỉ có một nguồn bị đưa ra ngoài train. Kiểm hash ảnh đầu vào, hash ảnh và nhãn sau sao chép; không sửa `image_review.csv` gốc.
- `scripts/prepare_test_sources.py`, `requirements-data.txt`: kiểm ZIP gốc, ghi ảnh trùng/lỗi, chuẩn hóa nhãn và ghép đầu vào. Không cần torch hoặc trọng số mô hình. R06 bỏ 3 ảnh trùng R04; R07 mới bỏ 13 ảnh trùng R02; R08 bỏ 44 ảnh có bbox vượt biên; R09 chuyển 7.131 polygon thành bbox. Bộ R07 cũ không dùng.

Chạy từ gốc repo bằng PowerShell 5.1:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ai_vision/tests/split_dataset.test.ps1
ai_vision/.venv/Scripts/python -m unittest discover -s ai_vision/tests -p test_prepare_test_sources.py -v
powershell -NoProfile -ExecutionPolicy Bypass -File ai_vision/scripts/split_dataset.ps1
# Neu split_v3 da ton tai, chon thu muc moi; khong ghi de:
powershell -NoProfile -ExecutionPolicy Bypass -File ai_vision/scripts/split_dataset.ps1 -Out ai_vision/data/working/split_v4
```

Tạo lại từ các ZIP hiện có và `sourced_v1` (chọn tên thư mục mới nếu đầu ra đã tồn tại):

```powershell
python -m venv ai_vision/.venv
ai_vision/.venv/Scripts/python -m pip install -r ai_vision/requirements-data.txt
ai_vision/.venv/Scripts/python ai_vision/scripts/prepare_test_sources.py --out ai_vision/data/working/audit_fresh
# Xem overlaps.csv va cac cap anh truoc khi chap nhan loai anh trung:
ai_vision/.venv/Scripts/python ai_vision/scripts/prepare_test_sources.py --release-source R06 --audit ai_vision/data/working/audit_fresh --out ai_vision/data/working/reviewed_R06_fresh
ai_vision/.venv/Scripts/python ai_vision/scripts/prepare_test_sources.py --release-source R07 --audit ai_vision/data/working/audit_fresh --out ai_vision/data/working/reviewed_R07_fresh
ai_vision/.venv/Scripts/python ai_vision/scripts/prepare_test_sources.py --base ai_vision/data/working/sourced_v1 --prepared ai_vision/data/working/audit_fresh/prepared ai_vision/data/working/reviewed_R06_fresh ai_vision/data/working/reviewed_R07_fresh --out ai_vision/data/working/sourced_fresh
powershell -NoProfile -ExecutionPolicy Bypass -File ai_vision/scripts/split_dataset.ps1 -Base ai_vision/data/working/sourced_fresh -Out ai_vision/data/working/split_fresh
```

## Dữ liệu được giữ

- `data/raw/`: dữ liệu gốc và các ZIP nguồn, dùng đối chiếu và khôi phục.
- `data/working/sourced_v1/`: 4.040 ảnh sạch trước chia, đầu vào của script chia tập. Các thư mục train/valid/test bên trong là vị trí cũ, không dùng trực tiếp để đánh giá.
- `data/working/split_v1/`: bản cũ không đạt yêu cầu chia theo nguồn, giữ đối chiếu.
- `data/working/split_v2/`: bản cũ chia theo nguồn, chưa có test.
- `data/working/source_audit_v1/`: kiểm R06/R08/R09 và bộ R07 cũ; CSV, JSON, ảnh đối chiếu. `source_audit_R07_v2/` kiểm bộ R07 thay thế.
- `data/working/reviewed_R06_v1/`, `reviewed_R07_v2/`: nguồn đã loại ảnh trùng sau khi xem đối chiếu.
- `data/working/sourced_v2/`: bước ghép trung gian chưa có R07 mới. `sourced_v3/`: đầu vào đầy đủ 9 nguồn.
- `data/working/split_v3/`: bản hiện dùng, có test cho cả bốn lớp.

Đã loại 10 ảnh không đạt điều kiện đối chiếu nguồn, 122 ảnh nhãn rỗng, 12 ảnh lỗi nhãn, 7 ảnh nghi vấn/minh họa và 98 bản trùng hoàn toàn. Trùng được kiểm bằng SHA-256 file và pixel RGB. Các CSV `excluded.csv`, `removed_*.csv` trong sourced_v1 giữ danh sách và lý do; `dataset_summary.json` tóm tắt bản sạch. Đã chuyển ba dòng polygon thành bbox bao ngoài trước khi làm sạch; dữ liệu raw giữ nguyên.

Các báo cáo rà soát, bảng ảnh xem nhãn, bản merged_v1 và script xử lý trung gian đã được bỏ để tránh nhầm với trạng thái hiện tại.
