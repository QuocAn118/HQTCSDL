# AI Vision

Spec: [AI Vision](../docs/superpowers/specs/2026-10-15-swiftletcare-ai-vision-design.md).
Plan: [triển khai](../docs/superpowers/plans/2026-10-16-swiftletcare-ai-vision.md).
Chạy `git status` trước mỗi lần commit; không commit video, ảnh, trọng số hoặc `.env`.

## Cài môi trường Windows

Đã kiểm trên Python 3.12.10. Từ thư mục `ai-vision/`, dùng Python 3.12 hoặc
3.13 đã cài để tạo môi trường riêng, rồi cài đúng bản ghim:

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python -X utf8 -m pip install -r requirements.txt
.venv/Scripts/python -m pip check
.venv/Scripts/python -m pytest
```

Nếu Python Launcher (`py`) chưa có, dùng đường dẫn Python 3.12 đã cài để tạo
venv. Không tạo lại hoặc xóa venv đang dùng chỉ để chạy các lệnh mẫu này.
Môi trường hiện tại đã có từ trước và cho phép đọc gói hệ thống; cài mới bằng
lệnh trên sẽ tạo venv riêng. Chưa xác nhận cài lại trên máy sạch.

Giữ `supervision==0.30.9`: ByteTrack vẫn hoạt động nhưng có cảnh báo bị bỏ từ
0.31. Chưa chuyển sang gói tracker khác. Windows Time hiện chưa chạy nên chưa
xác nhận đồng bộ UTC, cần kiểm tra trước kiểm thử live với backend.

## Chạy AI và trạng thái triển khai

Đã triển khai code Task 2–15, gồm phần Nên có của Task 14. Spike đọc/bỏ khung
Task 11 S17 đã đo trên V01.webm. Kiểm tay Ctrl+C với video thật (Task 12 S8),
đo test chính thức (Task 15) và đầu-cuối với backend thật (Task 16) còn chờ
dữ liệu/cấu hình. Task 13 chưa có Release chung;
Các mục Task 1 đã/chưa kiểm được ghi đủ S1–S23 trong
[spikes/RESULTS.md](spikes/RESULTS.md). Notebook sạch để dùng lại là
`train/train.ipynb`; notebook thao tác hiện tại và output giữ ở
`train/colab-setup.ipynb` trên máy bạn.

Chạy các lệnh dưới đây từ `ai-vision/`, sau khi đặt video thật và sửa playlist:

```powershell
.venv/Scripts/python -m swiftletcare_ai offline --camera H1-F0-CAMERA --out data/out/H1
.venv/Scripts/python -m swiftletcare_ai offline --camera H1-F0-CAMERA --playlist data/videos/V01.mp4 --t0 2000-01-01T00:00:00Z --imgsz 640 --out data/out/V01
.venv/Scripts/python -m swiftletcare_ai offline --camera H1-F0-CAMERA --playlist data/videos/V01.mp4 --out data/out/preview --annotated-video
.venv/Scripts/python -m swiftletcare_ai live --camera H1-F0-CAMERA
.venv/Scripts/python -m pytest tests -q
```

`offline` ghi `counts.csv`, `crossings.csv`, `predators.csv`, ảnh JPEG và log;
không gọi backend. `--annotated-video` ghi thêm `annotated.mp4` có vạch vàng,
khung chim xanh và khung thiên địch đỏ. Video đầu ra dùng FPS/kích thước của
video đầu trong playlist; nếu giảm process_fps hoặc trộn video khác FPS thì
thời lượng đầu ra có thể khác nguồn, không dùng đồng hồ video đầu ra để đo sự kiện.
`live` gửi HTTP với khóa trong `.env`. Chỉ bật `--heartbeat`
khi backend đã triển khai route tương ứng; 404 sẽ dừng AI.

Mã thoát: `0` bình thường/Ctrl+C một lần, `1` lỗi bất ngờ, `2` lỗi cấu hình,
khởi động hoặc 401/404, `130` Ctrl+C lần hai. Log live nằm ở
`data/logs/<camera>.log`; khóa chống trùng ở `data/run/<camera>.lock`.
Nếu khóa đã có, kiểm tra không còn tiến trình chạy camera rồi mới xóa tay.

Hướng dẫn số đo: [results/README.md](results/README.md). Chưa chạy đánh giá test
chính thức. Các đường dẫn V01.mp4 trong lệnh là ví dụ cho video đã duyệt; hai
file V01.webm/V02.ogv mới tải vẫn là ứng viên, chưa được gán tập để đánh giá.

Chạy nhiều camera sau khi cấu hình backend và từng camera đã hợp lệ:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-cameras.ps1
powershell -ExecutionPolicy Bypass -File scripts/start-cameras.ps1 -Cameras H1-F0-CAMERA
```

Script mở cửa sổ tương tác riêng cho mỗi camera để dừng bằng Ctrl+C. Tham số
`-Heartbeat` chỉ dùng khi backend có route heartbeat; mặc định không bật.

## Task 4: cấu hình camera và môi trường

Hai mẫu nằm trong `cameras/H1-F0-CAMERA.yaml` và `cameras/H2-F0-CAMERA.yaml`.
Playlist và tọa độ vạch đang là ví dụ; thay bằng video thật và chọn vạch trên
tập val trước khi chạy. Không tạo video giả để vượt kiểm tra cấu hình.
Đường dẫn playlist tính từ `ai-vision/`, dùng tên file/thư mục ASCII.

| Trường | Ý nghĩa/điều kiện |
|---|---|
| `camera` | Một trong hai mã hợp đồng, trùng tên file YAML |
| `playlist` | Danh sách file video tồn tại, không rỗng |
| `line.start`, `line.end` | Hai điểm khác nhau, tọa độ chuẩn hóa trong [0,1] |
| `swiftlet.confidence` | Ngưỡng tin cậy chim, trong (0,1] |
| `predator.confidence` | Ngưỡng thiên địch trong [0.5,1] |
| `predator.confirm_frames` | Số khung đã xử lý để xác nhận, số nguyên dương |
| `predator.confirm_seconds` | Khoảng thời gian chứa các khung xác nhận, số dương |
| `predator.cooldown_seconds` | Khoảng chặn báo lặp theo từng lớp, số dương |
| `process_fps` | null theo video, hoặc số dương giới hạn tốc độ xử lý |

Với đầu vạch bên trái và cuối vạch bên phải: bay lên là out, bay xuống là in.
Đảo chiều bằng cách hoán đổi `start` và `end`, không có cờ flip.

Chép `.env.example` thành `.env` khi cần chạy với backend, điền khóa dịch vụ
do người chạy backend cung cấp. Không commit `.env`. Chế độ offline không
bắt buộc file này. Bộ đọc hỗ trợ UTF-8 BOM; thông báo lỗi và `repr` cấu hình
môi trường không in khóa dịch vụ.

`check_confirm_fps()` kiểm tra điều kiện xác nhận thiên địch. Lệnh live đo FPS
khởi động trên 30 khung đầu, bỏ 5 khung warmup trước khi kiểm điều kiện này.

Hàng đợi giữ mức tổng lớn nhất của từng cửa sổ kể cả sau khi gửi thành công,
đến khi hết hạn gửi (60 phút sau lúc cửa sổ đóng). Nhờ vậy đồng hồ nhảy lùi
không làm payload gửi lại có tổng nhỏ hơn; đây vẫn là trạng thái trong bộ nhớ,
không khôi phục được phần đếm đã mất khi khởi động lại tiến trình.

Khi tập dượt: dùng SwiftletCare_Dev; không reset CSDL demo SwiftletCare.
Theo spec, chạy demo AI trước 20:00 giờ Việt Nam. Thứ tự hệ thống: SQL Server,
Mosquitto, simulator, backend, AI, rồi web/mobile. Video đầu ra và log không
thay thế bằng chứng đầu-cuối với backend thật.

## Task 3: thời gian UTC và cửa sổ 5 phút

`swiftletcare_ai/timeutil.py` cung cấp định dạng UTC có `Z`, đọc thời gian UTC,
làm tròn xuống cửa sổ 5 phút, `SystemClock` và `FakeClock`. Giá trị datetime
thiếu múi giờ bị từ chối; giờ có múi giờ khác được đổi sang UTC trước khi chia
cửa sổ. `FakeClock.jump()` mô phỏng đồng hồ máy nhảy mà không đổi thời gian
đã trôi qua (`monotonic`).

Chạy từ thư mục `ai-vision`:

```powershell
.venv/Scripts/python -m pytest tests/test_timeutil.py -q
.venv/Scripts/python -m pytest tests -q
```

## Trọng số train thử trên Colab

Notebook hiện tại: `train/colab-setup.ipynb`. Metadata của file tải về nằm trong
`weights.json`; đây là trọng số **train thử**, val chỉ có swiftlet. Chưa đóng băng
mô hình để đánh giá chính thức bốn lớp. Không dùng tập test để chọn cấu hình.

Đặt file tải từ Drive vào `ai-vision/data/weights/best.pt`. Từ gốc repo chạy:

```powershell
ai-vision/.venv/Scripts/python ai-vision/scripts/download_weights.py --verify-only
ai-vision/.venv/Scripts/python -m unittest discover -s ai-vision/tests -p test_download_weights.py -v
```

Script kiểm SHA-256 trước khi nạp mô hình và kiểm đủ bốn tên lớp. File sai hash
không được nạp; tải sai hash không ghi đè trọng số đang có. `--verify-only` dùng
được khi chưa có URL công khai. Chế độ tải cần URL HTTPS trong `weights.json`;
hiện URL để `null` vì file được tải thủ công từ Drive, chưa tạo Release.

Môi trường đã nạp thử: Python 3.12.10, torch 2.15.0+cpu, Ultralytics 8.4.178,
supervision 0.30.9. Colab dùng torch 2.11.0+cu130, khác máy Windows.
`requirements.txt` ghim chín thư viện runtime; `requirements-data.txt` chỉ
phục vụ chuẩn bị dữ liệu. Task 13 còn thiếu kho tải trọng số chung và lượt
kiểm chứng mô hình chính thức sau khi bổ sung val cho thiên địch.

Task 13 có thêm `scripts/split_dataset.py` cho export YOLO mới với tên ảnh bắt
đầu bằng mã nguồn. Script đọc `splits.csv`, giữ nguyên thứ tự class ID, từ chối
nguồn trùng/lạ, tên đầu ra trùng, export rỗng và thư mục đầu ra đã có. Thiếu
file nhãn được coi là ảnh nền theo định dạng export; cần duyệt nhãn trước train.
Không chạy script này ghi vào `split_v3` đang dùng. Quy trình dựng lại
`split_v3` vẫn dùng `scripts/split_dataset.ps1` như hướng dẫn dữ liệu bên dưới.

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
powershell -NoProfile -ExecutionPolicy Bypass -File ai-vision/tests/split_dataset.test.ps1
ai-vision/.venv/Scripts/python -m unittest discover -s ai-vision/tests -p test_prepare_test_sources.py -v
powershell -NoProfile -ExecutionPolicy Bypass -File ai-vision/scripts/split_dataset.ps1
# Neu split_v3 da ton tai, chon thu muc moi; khong ghi de:
powershell -NoProfile -ExecutionPolicy Bypass -File ai-vision/scripts/split_dataset.ps1 -Out ai-vision/data/working/split_v4
```

Tạo lại từ các ZIP hiện có và `sourced_v1` (chọn tên thư mục mới nếu đầu ra đã tồn tại):

```powershell
python -m venv ai-vision/.venv
ai-vision/.venv/Scripts/python -m pip install -r ai-vision/requirements-data.txt
ai-vision/.venv/Scripts/python ai-vision/scripts/prepare_test_sources.py --out ai-vision/data/working/audit_fresh
# Xem overlaps.csv va cac cap anh truoc khi chap nhan loai anh trung:
ai-vision/.venv/Scripts/python ai-vision/scripts/prepare_test_sources.py --release-source R06 --audit ai-vision/data/working/audit_fresh --out ai-vision/data/working/reviewed_R06_fresh
ai-vision/.venv/Scripts/python ai-vision/scripts/prepare_test_sources.py --release-source R07 --audit ai-vision/data/working/audit_fresh --out ai-vision/data/working/reviewed_R07_fresh
ai-vision/.venv/Scripts/python ai-vision/scripts/prepare_test_sources.py --base ai-vision/data/working/sourced_v1 --prepared ai-vision/data/working/audit_fresh/prepared ai-vision/data/working/reviewed_R06_fresh ai-vision/data/working/reviewed_R07_fresh --out ai-vision/data/working/sourced_fresh
powershell -NoProfile -ExecutionPolicy Bypass -File ai-vision/scripts/split_dataset.ps1 -Base ai-vision/data/working/sourced_fresh -Out ai-vision/data/working/split_fresh
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
