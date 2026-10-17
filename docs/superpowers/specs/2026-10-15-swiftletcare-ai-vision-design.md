# SwiftletCare — ai-vision: đếm chim yến và phát hiện thiên địch trên video

- **Ngày:** 2026-10-15
- **Trạng thái:** Đã duyệt
- **Chủ module:** TV3
- **Nguồn:** [Roadmap](2026-10-12-swiftletcare-roadmap.md) · [database-core](2026-10-12-swiftletcare-database-core-design.md) · [integration-contract](2026-10-13-swiftletcare-integration-contract-design.md) mục 2.4

## Phần 1 — Phạm vi, mức ưu tiên, hạn chế đã biết (đã duyệt)

### 1.1 Mục tiêu

Một chương trình Python xử lý video của từng camera, làm hai việc:

- Đếm chim yến bay **ra** và **vào** qua một vạch, theo cửa sổ 5 phút.
- Phát hiện thiên địch (`rat`, `snake`, `owl`), gửi kèm ảnh có vẽ khung bao.

Kết quả gửi cho backend qua HTTP theo integration-contract mục 2.4. AI không ghi thẳng SQL Server.

### 1.2 Mức ưu tiên

Bắt buộc theo roadmap, làm từ trên xuống. Roadmap không đặt ranh giới cắt riêng cho ai-vision.

| Mức | Mục |
|---|---|
| Bắt buộc 1 | Bộ dữ liệu 4 lớp (`swiftlet`, `rat`, `snake`, `owl`) có ghi nguồn và giấy phép; train YOLOv8n trên Colab |
| Bắt buộc 2 | ByteTrack + đếm ra/vào qua vạch, chỉ lớp `swiftlet` |
| Bắt buộc 3 | Phát hiện thiên địch, mỗi sự kiện gửi một ảnh có khung bao |
| Bắt buộc 4 | Gửi kết quả cho backend theo hợp đồng (bird-counts, predator-detections) |
| Bắt buộc 5 | Số đo cho báo cáo: Precision/Recall thiên địch, sai số đếm (MAE, sai số tương đối, sai lệch có dấu, tổng số đếm), số báo động giả mỗi giờ, tốc độ trên CPU |
| Nên có | Heartbeat 30 giây (hợp đồng mục 11); script `.ps1` chạy nhiều camera một lúc; video đầu ra có vẽ khung bao để web phát (roadmap) |
| Nếu còn thời gian | Xử lý luồng camera trực tiếp. Bản này chỉ phát lại file video như đang quay trực tiếp |
| Ngoài phạm vi | Train trên máy nhóm; GPU; ONNX (chỉ làm khi đo thấy PyTorch CPU không đủ nhanh); lưu trạng thái cửa sổ đếm qua các lần khởi động lại |

**Không có ngưỡng đạt/không đạt** cho Precision/Recall hay sai số đếm. Báo cáo ghi **số đo thật**, cao hay thấp, kèm giải thích (dữ liệu công khai, góc quay, số ảnh mỗi lớp, …). Kết quả thấp nhưng đo đúng cách và giải thích được **không bị coi là không đạt yêu cầu**.

### 1.3 Phân công và mốc thời gian

- **TV3:** dữ liệu, train, chương trình AI, **cung cấp số đo và các file CSV đầu ra** (Phần 6).
- **TV5:** cùng gán nhãn tuần 1; **gom số đo vào báo cáo** (roadmap, mốc NV6).

| Ngày | Việc |
|---|---|
| **16/10 (thứ Sáu), muộn nhất** | TV3 tìm xong video (cố gắng xong ngay 15/10). Có **dưới 2 video quay đúng góc** chim bay ra/vào thì **chuyển phương án dự phòng ngay**: đếm trên video đàn chim quay bằng camera cố định |
| **18/10 (Chủ nhật), M1** | Chỉ kiểm tra gán nhãn: đã gán **≥ 60%** dữ liệu |
| Tuần 2 (19–25/10) | Train trên Colab |
| **01/11, M3** | Đếm chim và phát hiện thiên địch chạy từ đầu đến cuối qua backend. **Đóng băng trọng số và cấu hình** để đo trên tập test (mục 6.1) |
| **04/11** | TV3 giao số đo + CSV (`ai-vision/results/`); TV5 đưa vào báo cáo (xong 07/11) |

### 1.4 Hạn chế đã biết

Spec ghi nguyên văn, báo cáo nhắc lại:

1. **Không có video tự quay.** Mọi video lấy từ nguồn công khai có giấy phép, không có video nhà yến thật. Kết quả thực tế có thể thấp hơn số đo.
2. Nếu dùng phương án dự phòng, báo cáo ghi rõ khả năng đếm **chỉ được chứng minh trên video thay thế**.
3. **Cửa sổ 5 phút đầu và cuối** mỗi lần chạy có số đếm nhỏ hơn thực tế vì chỉ phủ một phần cửa sổ (nhỏ, không sai).
4. AI khởi động lại giữa cửa sổ thì mất phần đếm trước lúc khởi động lại của cửa sổ đó (≤ 1 cửa sổ). Hạn chế đã chấp nhận ở database-core Mục 6: SP lấy giá trị lớn hơn.
5. Mỗi lần video phát lặp, ByteTrack được khởi tạo lại; chim đang ở giữa vạch đúng lúc đó có thể bị bỏ sót.
6. Cửa sổ đếm rơi vào đoạn video thiên địch có số đếm gần 0. Độ chính xác đếm chỉ đo trên video chim yến.
7. **Precision/Recall thiên địch** đo trên dữ liệu công khai; ngoài thực tế có thể thấp hơn.
8. Ultralytics dùng giấy phép **AGPL-3.0**: ghi trong `SOURCES.md` và đưa vào báo cáo.
9. **Demo AI chạy trước 20:00 giờ VN** để số đếm thấp của AI không sinh cảnh báo `POPULATION_DROP` giả (`sp_DetectAnomalies`, `@CutoffHourVn = 20`). Vì vậy kịch bản sụt đàn của H2 trong dữ liệu mẫu **không demo được ban ngày**; cách bật kiểm tra sụt đàn khi demo do spec backend quyết định.
10. **Nhãn `swiftlet` dựa trên mô tả của nguồn**, không do chuyên gia xác nhận. Chim yến dễ nhầm với én và dơi, nên có thể có ảnh gán sai lớp.
11. Lớp nào chỉ có **một nguồn** thì không có tập test độc lập (mục 2.4); báo cáo ghi rõ lớp đó.
12. Tiến trình AI treo hoặc CPU quá tải có thể làm **một số cửa sổ không có dòng nào** trong CSDL.
13. Heartbeat dùng chung luồng gửi nên **có thể trễ nhịp khi hàng đợi tắc** (backend chậm, đang thử lại). Chấp nhận được vì ngưỡng mất kết nối là 5 phút (`@OfflineMinutes = 5`).

### 1.5 Việc cần báo module khác

1. **Plan integration-contract** (phần Architecture) ghi "simulator/AI dùng `fixtures.mjs` để kiểm payload tự tạo". AI viết bằng Python nên không import được. Cách AI dùng fixture nằm ở Phần 7. Câu trong plan cần **TV2 sửa qua một PR hợp đồng nhỏ**; ai-vision không tự sửa.
2. **Chỗ giữ chỗ trong fixture AI.** Test Python chỉ kiểm **kiểu**, không thay giá trị, nên không trái quy tắc "chỉ `fixtures.mjs`" của CLAUDE.md:
   - `{{now}}` và `{{now±N(s|m|h)}}` (VD `{{now-1m}}` trong `predator-detection.cooldown.json`), `{{window}}`, `{{any:iso}}` → chuỗi UTC có `Z`. `{{window}}` kiểm thêm tròn mốc 5 phút.
   - `{{any:id}}` → số nguyên dương; `{{any:string}}` → chuỗi không rỗng.
   - `{{window+1m}}`, `{{window:noZ}}`, `{{now:+07:00}}` chỉ có trong fixture invalid thuộc nhóm "AI tự tránh" (Phần 7), không kiểm kiểu.
   - `{{serviceKey}}` nằm trong header, không kiểm kiểu. Khóa `after` (fixture nối chuỗi) bỏ qua.
   - Mọi chỗ giữ chỗ khác → test fail.
   - Danh sách đối chiếu với plan integration-contract ngày 15/10/2026 (danh sách `EXPECTED.ai` và nội dung từng fixture AI).
3. **database-core (TV1)** cần giữ nguyên hai mã camera `H1-F0-CAMERA` và `H2-F0-CAMERA` trong dữ liệu mẫu. AI giữ danh sách mã này cố định trong code (mục 3.4); đổi mã camera là đổi hợp đồng, phải đi qua PR hợp đồng.

**Chưa kiểm chứng:** số video đúng góc tìm được (TV3 ghi số thật vào spec); giới hạn số ảnh của gói Roboflow miễn phí; CPU có kịp thời gian thực không (Phần 6 đo).

## Phần 2 — Dữ liệu và huấn luyện (đã duyệt)

### 2.1 Lớp

| Lớp | Dùng cho | Khớp hợp đồng |
|---|---|---|
| `swiftlet` | Đếm qua vạch | Chỉ dùng trong AI, không gửi tên lớp đi |
| `rat`, `snake`, `owl` | Sự kiện thiên địch | Trùng đúng giá trị `class` của `POST /api/ai/predator-detections` |

Tên lớp trên Roboflow viết **đúng chữ thường như trên**, để AI gửi thẳng sang backend, không cần bảng đổi tên.

### 2.2 Nguồn dữ liệu, giấy phép và `SOURCES.md`

- Chỉ dùng video và ảnh **công khai, có giấy phép cho phép dùng**. Dataset Roboflow Universe dùng được nếu giấy phép cho phép.
- **Gói Roboflow miễn phí để project công khai**, nên tải video/ảnh lên Roboflow cũng là **phát tán lại**. Chỉ tải lên Roboflow nguồn có giấy phép **cho phép chia sẻ lại** (ví dụ CC BY, CC0). Nguồn không cho chia sẻ lại thì **không dùng**, hoặc gán nhãn bằng một công cụ chạy trên máy (TV3 chọn, ghi tên và phiên bản vào `SOURCES.md`), không tải lên đâu cả.
- `ai-vision/SOURCES.md` có **một dòng mỗi nguồn**, các cột: mã nguồn (VD `V01`, `R01`), người đăng, URL, giấy phép, **cho phép chia sẻ lại (có/không)**, ngày tải, lớp có trong nguồn, tập (train/val/test), công cụ gán nhãn (Roboflow/trên máy). Một dòng riêng ghi Ultralytics: AGPL-3.0.
- URL và giấy phép do TV3 điền khi tìm được nguồn. Spec không ghi trước nguồn nào.
- **Không đưa vào git:** video gốc, ảnh, bộ dữ liệu đã export (dung lượng lớn, giấy phép có thể không cho phát tán). Git chỉ có `SOURCES.md` và file chia tập (mục 2.4).

### 2.3 Quy tắc gán nhãn (TV3 và TV5)

1. Khung bao ôm sát cả con vật, kể cả cánh đang dang.
2. Con vật bị che hoặc khuất mép ảnh vẫn gán nếu người nhìn nhận ra được.
3. **Không gán con có khung bao nhỏ hơn `MIN_BOX_PX` điểm ảnh** (cạnh ngắn, tính trên ảnh gốc), hoặc quá mờ để nhận ra. TV3 chốt giá trị `MIN_BOX_PX` khi đã xem dữ liệu thật và ghi vào spec này. **Đếm tay để đo sai số đếm (Phần 6) theo đúng quy tắc này**: chim nhỏ hơn ngưỡng thì không đếm.
4. Ảnh không có con vật nào giữ lại làm **ảnh nền** để giảm báo động giả. Tỷ lệ ảnh nền **tối đa mặc định 10%** số ảnh train; TV3 chốt lại khi đã đếm số ảnh, ghi **tỷ lệ thực tế đã dùng** vào `weights.json` (mục 2.6).
5. Cắt khung hình từ video **thưa**, không lấy các khung gần giống nhau liền nhau. Khoảng cách TV3 chọn theo từng video, ghi vào `SOURCES.md`.

### 2.4 Chia tập theo nguồn

- Tên ảnh **bắt đầu bằng mã nguồn**, VD `V01_000123.jpg`.
- **Một nguồn** là một video, hoặc **toàn bộ một dataset Roboflow Universe** (không biết khung nào cùng video gốc, nên cả dataset nằm chung một tập).
- Mỗi nguồn nằm trong **đúng một** tập train, val hoặc test. Khung hình cùng nguồn không bao giờ ở hai tập.
- **Mỗi lớp cần ít nhất hai nguồn** để có chỗ chia. Lớp chỉ có một nguồn: nguồn đó vào train, báo cáo ghi rõ lớp đó **không có tập test độc lập** (hạn chế 11).
- File chia tập `ai-vision/splits.csv` (mã nguồn → tập) nằm trong git. Một **script chia theo mã nguồn** đọc file này sau khi export, không dùng chế độ chia ngẫu nhiên của Roboflow.
- **Không bật augmentation của Roboflow.** Ultralytics tự augment khi train; tránh ảnh augment lọt sang val/test.
- Tập test có hai loại, đều **không dùng để train**: video thiên địch (đo Precision/Recall) và video chỉ có chim yến (đo báo động giả mỗi giờ).

### 2.5 Train trên Colab

- Bắt đầu từ trọng số YOLOv8n có sẵn của Ultralytics.
- Trên Colab dùng **torch có sẵn**; cài `ultralytics` và `supervision` **đúng bản ghim** trong `requirements.txt`.
- Mỗi lần train in và lưu phiên bản Ultralytics, torch trên Colab.
- Kích thước ảnh, số epoch, seed do TV3 chọn khi train; spec không cố định.

### 2.6 Trọng số và metadata

- `best.pt` **không vào git**; tải lên **GitHub Release** của repo nhóm. Repo không ở GitHub thì dùng kho lưu trữ khác có link tải.
- Mỗi lần export kèm `ai-vision/weights.json` (commit vào git): URL tải, SHA-256 của `best.pt`, phiên bản dataset Roboflow, số epoch, kích thước ảnh, seed, tỷ lệ ảnh nền thực tế, phiên bản Ultralytics và torch trên Colab.
- Script tải (Python, chạy bằng `.\.venv\Scripts\python`):
  - Tải `best.pt` theo URL trong `weights.json`, **so SHA-256**; lệch thì xóa file vừa tải và báo lỗi.
  - Nạp thử trọng số bằng Ultralytics trên máy nhóm. Bản Ultralytics trên Colab khác máy nhóm thì ghi chênh lệch vào spec.

**Chưa kiểm chứng:**
- Giới hạn gói Roboflow miễn phí (số ảnh, số project) và việc project miễn phí luôn công khai: TV3 tra và ghi vào spec.
- Tên định dạng export "YOLOv8" trên Roboflow và cấu trúc thư mục sau giải nén; script chia tập viết theo bản export thật.
- Colab có sẵn Ultralytics không; bản torch trên Colab; GPU miễn phí và thời lượng phiên.
- Có đủ nguồn **cho phép chia sẻ lại** cho từng lớp không, nhất là `swiftlet` đúng góc và `owl`; mỗi lớp có đủ hai nguồn không.
- Giấy phép từng dataset Roboflow Universe.
- Mức 10% ảnh nền là mức khởi đầu theo khuyến nghị của Ultralytics (nhớ lại, chưa tra lại tài liệu).
- Nhóm có quyền tạo Release trên repo GitHub không.
- Trọng số train trên Colab có nạp được trên máy nhóm không.
- Tên tham số seed, epoch, kích thước ảnh của Ultralytics: lấy từ bản cài thật.

## Phần 3 — Môi trường, cấu trúc thư mục, cấu hình, lệnh chạy (đã duyệt)

### 3.1 Môi trường

Python **3.12** trên Windows, môi trường ảo `ai-vision\.venv` (không vào git). Mọi lệnh gọi thẳng `.\.venv\Scripts\python`, không dùng `Activate.ps1`. Chạy trong `ai-vision\`:

```
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -c "import ultralytics, supervision"
```

- `requirements.txt` ghim chính xác (`==`) các gói cấp trên cùng: `torch`, `torchvision`, `ultralytics`, `supervision`, `requests`, `PyYAML`, `pytest`. Số phiên bản lấy từ lần cài thật ở bước 1 của plan.
- `torch`, `torchvision` lấy từ PyPI: trang cài đặt PyTorch (kiểm tra 15/10/2026, bản ổn định 2.14.1) cho Windows + Pip + CPU ghi lệnh `pip3 install torch torchvision`, không có index-url, nên bản PyPI trên Windows là bản CPU. Trang ghi PyTorch trên Windows hỗ trợ Python 3.10–3.14.
- Notebook Colab chỉ cài `ultralytics==…` và `supervision==…`, dùng torch có sẵn. Một test kiểm tra hai bản ghim trong notebook trùng `requirements.txt`.
- Không làm file khóa phụ thuộc đầy đủ (`pip freeze`); gói phụ thuộc gián tiếp có thể khác giữa các máy. Máy nào cho kết quả khác thì mới thêm.
- Không dùng được 3.12 thì chuyển 3.11 và ghi lý do vào spec.

### 3.2 Cấu trúc thư mục

```
ai-vision/
  README.md            cài đặt, lệnh chạy, cách đổi chiều vạch, dặn git status trước khi commit
  SOURCES.md           nguồn + giấy phép (Phần 2)
  splits.csv           mã nguồn -> train/val/test
  weights.json         URL, SHA-256, metadata trọng số
  requirements.txt
  .env.example
  cameras/
    H1-F0-CAMERA.yaml
    H2-F0-CAMERA.yaml
  swiftletcare_ai/     mã nguồn (chia file trong plan)
  scripts/             tải trọng số, chia tập, start-cameras.ps1 (Nên có, chỉ ASCII)
  train/train.ipynb
  tests/
  data/                KHÔNG vào git: video, dataset, best.pt, CSV đầu ra, file khóa
```

- `.gitignore` gốc của repo thêm: `ai-vision/.venv/`, `ai-vision/data/`, `*.pt`, `ai-vision/.env`.
- README dặn **chạy `git status` trước mỗi lần commit**, xem kỹ không có video, ảnh, trọng số hay `.env` trong thay đổi.

### 3.3 `.env.example`

```
BACKEND_URL=http://localhost:3000
AI_SERVICE_KEY=
SNAPSHOT_MAX_BYTES=2097152
```

- `SNAPSHOT_MAX_BYTES`: kích thước ảnh tối đa AI gửi, **phải bằng giá trị của backend** (hợp đồng: mặc định 2 MB). Thiếu thì dùng mặc định.

- Cổng 3000 là mặc định của backend theo integration-contract mục 3.6 (biến `PORT`). Demo nhiều máy thì đổi `localhost` thành IP LAN của máy chạy backend.
- `AI_SERVICE_KEY` để trống trong file mẫu; giá trị thật lấy từ người chạy backend, chỉ ghi vào `.env`. **Không bao giờ in khóa ra log**, kể cả khi lỗi 401.
- Thiếu `BACKEND_URL` hoặc `AI_SERVICE_KEY` thì dừng ngay khi khởi động. Lệnh `offline` không gửi gì nên không cần hai biến này.

### 3.4 Cấu hình camera `cameras/<mã camera>.yaml`

```yaml
camera: H1-F0-CAMERA
playlist:                     # đường dẫn tính từ ai-vision/
  - data/videos/V01.mp4
  - data/videos/R02.mp4
# Vạch đếm nằm ngang, tọa độ chuẩn hóa [0,1] theo khung hình.
# Ra = chim bay từ dưới lên, qua vạch, sang phía TRÊN khung hình.
# Vào = chim bay từ trên xuống, sang phía DƯỚI khung hình.
# Muốn đảo chiều: hoán đổi start và end, không có cờ đảo chiều.
line:
  start: [0.10, 0.55]
  end:   [0.90, 0.55]
swiftlet:
  confidence: 0.40
predator:
  confidence: 0.50           # >= 0.5 vì SP bỏ qua dưới 0.5 (LOW_CONFIDENCE)
  confirm_frames: 3          # số khung ĐÃ XỬ LÝ
  confirm_seconds: 2
  cooldown_seconds: 300      # khớp @CooldownMinutes = 5 của SP
process_fps: null            # null = theo fps của video; số nhỏ hơn = giới hạn số khung xử lý mỗi giây
```

- Số trong ví dụ (0.40, tọa độ vạch) chỉ minh họa; TV3 chốt theo từng video.
- Quy ước: với `start` bên trái, `end` bên phải như ví dụ, **ra = lên trên**. Test tổng hợp (Phần 7) xác nhận chiều thật của code khớp đúng câu này; chiều chỉ được đổi bằng cách hoán đổi `start`/`end`.

**Kiểm tra khi khởi động.** Đọc bằng `yaml.safe_load`. Gặp lỗi đầu tiên thì dừng, báo **tên file, tên trường, giá trị sai, giá trị hợp lệ**.

| Trường | Điều kiện |
|---|---|
| `camera` | Có trong danh sách camera trong code và trùng tên file |
| `playlist` | Không rỗng; mọi file tồn tại |
| `line.start`, `line.end` | Mỗi tọa độ trong [0, 1]; hai điểm không trùng |
| `swiftlet.confidence` | Trong (0, 1] |
| `predator.confidence` | Trong [0.5, 1]; dưới 0.5 báo lỗi vì backend sẽ bỏ qua sự kiện |
| `confirm_frames`, `confirm_seconds`, `cooldown_seconds` | Số dương; `confirm_frames` kiểm tra thêm theo fps đo được (dưới đây) |
| `process_fps` | `null` hoặc số dương |
| Trường lạ hoặc thiếu trường | Báo lỗi; không âm thầm dùng giá trị mặc định |

**Đo fps khi khởi động (lệnh `live`).**
1. Nạp mô hình, chạy nhận dạng trên **30 khung đầu** của video đầu tiên trong playlist; bỏ **5 khung đầu** (lần chạy đầu chậm do khởi động), lấy thời gian trung bình 25 khung còn lại → `fps_máy`.
2. `fps_xử_lý = min(fps_máy, fps của video, process_fps nếu có)`.
3. Điều kiện: `confirm_frames <= fps_xử_lý × confirm_seconds`. Không thỏa thì **dừng**, báo `fps_xử_lý` đo được và cách sửa: giảm `confirm_frames`, tăng `confirm_seconds`, hoặc giảm kích thước ảnh suy luận. Dừng thay vì cảnh báo vì nếu chạy tiếp, sự kiện thiên địch **không bao giờ được xác nhận** mà không ai biết.
4. Các khung dùng để đo không tính vào đếm; đo xong mới đặt mốc t0 và phát playlist từ đầu.
5. Trong lúc chạy, mỗi phút ghi log fps xử lý thực tế và tỷ lệ khung bị bỏ; fps tụt dưới mức điều kiện ở bước 3 thì ghi **một dòng cảnh báo** mỗi phút (không dừng, vì đã qua kiểm tra lúc khởi động).

Lệnh `offline` không đo fps (không chạy theo thời gian thật, không bỏ khung) nhưng vẫn kiểm tra điều kiện bước 3 với `fps_xử_lý = min(fps của video, process_fps)`.

**Khi CPU chậm hơn tốc độ phát (mặc định của `live`).** Tự **bỏ khung để theo kịp thời gian thật**: trước mỗi lần xử lý, nhảy tới khung ứng với thời điểm hiện tại (`now − t0`), bỏ qua các khung ở giữa. Nhờ vậy `at = t0 + vị trí trong video` luôn sát giờ thật như hợp đồng yêu cầu. Bỏ khung làm ByteTrack khó bám chim bay nhanh; ảnh hưởng này đo bằng so sánh offline với live (Phần 6).

**Danh sách camera trong code:** cố định `H1-F0-CAMERA`, `H2-F0-CAMERA`. Không đọc file SQL (seed sinh mã bằng công thức). Một test đối chiếu danh sách này với chính fixture hợp đồng `contracts/fixtures/ai/`: mọi mã camera trong fixture phải có trong danh sách, và mỗi mã trong danh sách phải xuất hiện ít nhất một lần. Backend vẫn trả 404 `CAMERA_NOT_FOUND` lúc chạy thì dừng (Phần 5). Lưu ý cho database-core: mục 1.5.

**supervision:** tên lớp và tham số (vạch đếm, ByteTrack) lấy từ bản cài thật ở bước 1 của plan, spec không ghi trước. Ánh xạ chiều của supervision sang `in`/`out` của hợp đồng chỉ viết **ở một chỗ trong code**, khóa bằng test tổng hợp.

### 3.5 Lệnh chạy

Mỗi camera **một tiến trình**; **không bao giờ chạy hai tiến trình cho cùng một camera**.

```
.\.venv\Scripts\python -m swiftletcare_ai live    --camera H1-F0-CAMERA
.\.venv\Scripts\python -m swiftletcare_ai offline --camera H1-F0-CAMERA --out data\out\H1
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python scripts\download_weights.py
```

- **`live`:** phát lại playlist theo thời gian thật, gửi kết quả cho backend (Phần 4, 5). Ctrl+C: gửi tổng hiện tại của cửa sổ đang mở rồi thoát.
- **`offline`:** xử lý playlist một lượt, nhanh hết mức, không gửi backend. Ghi `counts.csv` (`camera, windowStart, in, out`, trùng trường gửi đi), `predators.csv` (`camera, class, confidence, at`, trùng `metadata`) và `crossings.csv` (`at, chieu, track_id`, mỗi lần qua vạch một dòng, dùng cho mục 6.6).
- **`scripts\start-cameras.ps1`** (Nên có): mỗi camera một cửa sổ.

**File khóa chống chạy trùng:** `live` tạo `data\run\<mã camera>.lock` khi khởi động (chỉ tạo nếu chưa có) và xóa khi thoát bình thường hoặc Ctrl+C. File đã tồn tại thì **dừng**, báo thời điểm file được tạo và hướng dẫn: kiểm tra không còn cửa sổ nào đang chạy camera này, rồi xóa tay file đó. Không tự dò tiến trình còn sống. Máy tắt đột ngột thì file còn lại, người chạy xóa tay theo hướng dẫn.

**Chưa kiểm chứng:**
- `py -3.12` cần Python Launcher; bộ cài python.org thường có, máy nhóm chưa kiểm tra.
- torch CPU, Ultralytics, supervision có cài được trên Python 3.12 Windows không; số phiên bản cụ thể.
- Tên lớp, tham số và quy ước chiều của supervision.
- Số 30/5 khung khi đo fps là đề xuất, chưa thử; tốc độ nhảy khung của OpenCV trên video thật chưa đo.
- Mức `swiftlet.confidence` hợp lý: chưa đo.

## Phần 4 — Luồng xử lý (đã duyệt)

### 4.1 Phát video

**Lệnh `live`:**
1. Kiểm tra cấu hình, tạo file khóa, nạp mô hình, đo fps (mục 3.4).
2. Ghi lại giờ bắt đầu phát, phát playlist từ video đầu.
3. **Vị trí trong video chỉ dùng để phát đúng tốc độ** (và bỏ khung khi CPU chậm, mục 3.4).
4. **`at` của mỗi khung = giờ UTC của máy tại lúc xử lý khung đó**, không tính từ thời lượng hay fps của video. Nhờ vậy `at` không phụ thuộc OpenCV đọc đúng thời lượng/fps, và luôn khớp giờ thật như hợp đồng yêu cầu.
5. Hết một video thì sang video tiếp; hết playlist thì quay lại video đầu. **Mỗi lần đổi video (kể cả quay lại đầu) khởi tạo lại ByteTrack**, vì cảnh khác nhau, id track cũ vô nghĩa (hạn chế 5).

**Lệnh `offline`:** cùng luồng nhưng phát playlist **một lượt**, không bỏ khung, không gửi gì. `at = t0 + vị trí trong video` (t0 truyền qua tham số, mặc định là giờ chạy), để CSV offline so sánh được với số gửi đi của live theo từng cửa sổ.

### 4.2 Đếm qua vạch

- Mỗi khung chỉ đưa phát hiện **lớp `swiftlet`** có độ tin cậy ≥ `swiftlet.confidence` vào ByteTrack. Thiên địch không đi qua tracker.
- Một track qua vạch được tính 1 lần theo chiều đi qua. **Chiều nào là `out`, chiều nào là `in` lấy từ cấu hình camera** (thứ tự `start`/`end`, mục 3.4); code không ghi cứng hướng. Chim bay ra rồi quay vào tính 1 `out` + 1 `in`.
- Điểm dùng để xét qua vạch (VD tâm khung bao) lấy theo tham số supervision ở bản cài thật.
- Track mất rồi xuất hiện lại với id mới có thể làm đếm thừa hoặc thiếu; test tổng hợp (Phần 7) khóa hành vi thật của code, spec ghi đúng hành vi đó.

### 4.3 Cửa sổ đếm 5 phút

- `windowStart` = `at` làm tròn **xuống** mốc 5 phút UTC, dạng `YYYY-MM-DDTHH:mm:00Z`. AI không bao giờ tạo lỗi 50014 hay chuỗi thiếu `Z`.
- Mỗi cửa sổ giữ hai số cộng dồn `in`, `out`, chỉ tăng.
- **Gửi tổng hiện tại mỗi 60 giây giờ thật, kể cả `0/0`**: web thấy AI đang chạy, cửa sổ không có chim vẫn có dòng.
  - Hệ quả cần biết: nếu AI đã chạy vào một ngày trước đó, ngày đó trở thành **"ngày có dữ liệu" với tổng thấp** trong `sp_DetectAnomalies` (so với trung bình 7 ngày trước, bỏ qua nếu < 3 ngày có dữ liệu). Ngày đó kéo trung bình 7 ngày xuống, làm **khó phát hiện sụt đàn thật**.
- `at` bước sang cửa sổ mới → gửi **tổng cuối** cửa sổ cũ, cửa sổ mới bắt đầu từ 0.
- Ctrl+C: gửi tổng cuối cửa sổ đang mở, xóa file khóa, thoát (thời gian chờ tối đa ở Phần 5).
- Gửi trùng hay gửi lại an toàn: SP lấy giá trị lớn hơn ở từng cột.
- Mỗi lần gửi là **một mảng** các cửa sổ cần gửi (thường 1, có thể 2 khi vừa chuyển cửa sổ hoặc có lô chờ thử lại), không bao giờ quá 500 phần tử.

### 4.4 Sự kiện thiên địch

**Phát hiện:** mỗi khung đã xử lý, với mỗi lớp `rat`/`snake`/`owl`, lấy phát hiện có độ tin cậy cao nhất mà ≥ `predator.confidence`.

**Xác nhận, riêng từng lớp:**
- Giữ các khung có phát hiện của lớp đó trong **`confirm_seconds` gần nhất, tính theo `at`**.
- Đủ `confirm_frames` khung → **xác nhận một sự kiện**, gửi ngay.
- Ảnh gửi đi là **khung có độ tin cậy cao nhất trong các khung đủ để xác nhận**, không phải khung tốt nhất của cả lần thiên địch xuất hiện. Đánh đổi có chủ ý: cảnh báo đến nhanh, ảnh có thể chưa đẹp nhất.
- Chỉ giữ bản sao khung tốt nhất, không giữ cả danh sách ảnh, để bộ nhớ không tăng.

**Sự kiện gửi đi:** `camera`; `class`; `confidence` của khung tốt nhất (làm tròn 2 chữ số); `at` của khung tốt nhất (UTC có `Z`); `image` là JPEG của khung đó.

**Ảnh chụp:**
- **Khung gốc**, vẽ khung bao và nhãn (lớp, độ tin cậy) của mọi phát hiện thiên địch trong khung, mã hóa JPEG chất lượng 90.
- Lớn hơn `SNAPSHOT_MAX_BYTES` (mục 3.3) thì thu nhỏ còn 75% và mã hóa lại, lặp tới khi đủ nhỏ.
- Backend vẫn trả 413 thì xử lý ở Phần 5.

**Cooldown phía AI, riêng từng (camera, lớp):**
- Sau khi xác nhận, lớp đó bị chặn `cooldown_seconds`, **tính theo `at`**.
- Cooldown bắt đầu **ngay lúc xác nhận**, không phụ thuộc gửi thành công hay thất bại. Lần gửi thất bại thì **gửi lại chính sự kiện đó** (cùng `at`, `confidence`, ảnh) theo quy tắc thử lại ở Phần 5, **không tạo sự kiện mới**.
- Mỗi lần **xác nhận** bị cooldown chặn ghi **đúng một dòng log**: lớp, camera, số giây còn lại. Không ghi theo từng khung.
- Hai loài cùng lúc là **hai sự kiện**, hai cooldown riêng.
- Cooldown của AI **không thay thế** cooldown của SP: AI khởi động lại thì cooldown của AI mất, SP chặn bằng `COOLDOWN` (test ở Phần 7).

**Lệnh `offline`:** cùng logic, ghi sự kiện vào `predators.csv`, lưu ảnh vào `data\out\…\snapshots\`, không gửi.

### 4.5 Video đầu ra có khung bao (Nên có)

`offline` có cờ `--annotated-video` ghi thêm video có vẽ khung bao và vạch đếm để web phát. Định dạng và cách web lấy file chốt cùng spec web.

### 4.6 Quy tắc buổi demo

1. **Demo AI chạy trước 20:00 giờ VN** (hạn chế 9).
2. **Nạp dữ liệu mẫu với `@AnchorDateVn` = hôm qua** (database-core mục 4.2), để hôm nay chỉ có số đếm của AI. Nếu demo ban ngày **cùng ngày neo**, cửa sổ của AI trùng cửa sổ dữ liệu mẫu; SP lấy giá trị lớn hơn nên **số đếm của AI bị che** bởi số mẫu.
3. **Tập dượt (01/11, 05/11) dùng `SwiftletCare_Dev`**, không chạy AI trên CSDL demo: ngày tập dượt có AI gửi `0/0` sẽ thành "ngày có dữ liệu" tổng thấp (mục 4.3).
4. **CSDL demo `SwiftletCare` chỉ triển khai MỘT lần, vào ngày trước buổi demo thật**, ngày neo = hôm qua của buổi demo, **không dùng `-Reset`** (`deploy.ps1 -Reset` vốn chỉ chạy với `_Dev`/`_Test`).
5. **Buổi tập cuối (08/11) làm trên một CSDL vừa triển khai mới** (theo đúng các bước sẽ làm cho `SwiftletCare`) để kiểm tra quy trình triển khai.
6. **Cờ `--heartbeat`:** chỉ bật khi backend đã làm xong Task 26 (`POST /api/ai/heartbeat`). Không bật thì camera hiện **OFFLINE** trên web (nếu web đã làm huy hiệu OFFLINE cho camera); bật khi backend chưa có route thì AI nhận 404 và dừng (5.3).

**Chưa kiểm chứng:**
- Hành vi thật của vạch đếm supervision: track qua vạch nhiều lần, track mất rồi xuất hiện lại. Test tổng hợp ở bước đầu plan trả lời.
- Đồng hồ máy chạy AI có đúng giờ không (Windows thường tự đồng bộ, máy nhóm chưa kiểm tra). Giờ sai thì `windowStart` và `at` sai theo.
- Chất lượng JPEG 90 và hệ số thu nhỏ 75%: đề xuất, chưa đo dung lượng thật.
- Cách web lấy video đầu ra: chưa có spec web.

## Phần 5 — Giao tiếp với backend (đã duyệt)

### 5.1 Chung

- `requests`, địa chỉ từ `BACKEND_URL`, header `X-Service-Key: <AI_SERVICE_KEY>`. Timeout: kết nối 5 giây, đọc 10 giây.
- **Gửi trong một luồng riêng có hàng đợi.** Luồng xử lý video chỉ đưa việc vào hàng đợi, không bao giờ chờ mạng.
- **Không bao giờ ghi khóa ra log.**

**Log đọc được bằng máy.** Mỗi sự kiện **một dòng JSON** (JSON Lines), ghi ra màn hình và **nối thêm** (không ghi đè) vào `data\logs\<mã camera>.log`. Trường chung: `ts` (UTC có `Z`), `level` (`info`/`warning`/`error`), `camera`, `type`. Trường thêm tùy loại:

| `type` | Trường thêm |
|---|---|
| `predator.confirmed` | `class`, `confidence`, `at` |
| `predator.cooldown_blocked` | `class`, `at`, `remainingSeconds` |
| `predator.sent` | `class`, `at`, `attempt`, `status`, `created`, `alertId`, `skipReason` |
| `predator.dropped` | `class`, `at`, `attempt`, `status`, `code`, `reason` |
| `counts.sent` | `windows` (mảng `windowStart`, `in`, `out`), `attempt`, `status` |
| `counts.dropped` | `windowStart`, `in`, `out`, `status`, `code`, `reason` |
| `heartbeat` | `status` |
| `fps` | `fps`, `droppedFrameRatio` (mỗi phút, mục 3.4) |
| `stop` | `reason`, `exitCode` |

Phần 6 lấy số báo động giả mỗi giờ từ các dòng `predator.confirmed` và `predator.cooldown_blocked`.

### 5.2 Payload

| Endpoint | Gửi | Ghi chú |
|---|---|---|
| `POST /api/ai/bird-counts` | Mảng `[{"camera","windowStart","in","out"}]` | Hàng đợi là **từ điển theo (camera, windowStart)**: tổng mới ghi đè tổng cũ (tổng chỉ tăng). Mỗi lần gửi gồm mọi cửa sổ đang chờ, tối đa 500. Nhận 200 thì xóa các cửa sổ đã gửi, trừ cửa sổ đã có tổng mới hơn trong lúc gửi |
| `POST /api/ai/predator-detections` | multipart: `metadata` (chuỗi JSON `{"camera","class","confidence","at"}`), `image` (JPEG, `image/jpeg`) | Không gửi `snapshot` (backend tự sinh) |
| `POST /api/ai/heartbeat` (Nên có) | `{"device":"<mã camera>","at":"…Z"}` mỗi 30 giây, bắt đầu sau khi đo fps | **Chỉ gửi khi `live` có cờ `--heartbeat` (mặc định tắt)**: endpoint là plan backend Task 26, dưới ranh giới cắt; bật khi backend chưa có route sẽ nhận 404 và AI dừng (5.3). Thất bại chỉ log, **không thử lại** (30 giây sau có lần gửi tiếp) |

### 5.3 Bảng mã trả về

| Mã | Bird-counts | Predator-detections | Heartbeat |
|---|---|---|---|
| **200** | Xóa các cửa sổ đã gửi khỏi hàng đợi; log `counts.sent` | `created: true` → log `predator.sent` kèm `alertId`. `created: false` → log `predator.sent` kèm `skipReason` (`COOLDOWN`/`LOW_CONFIDENCE`), **không thử lại**. `COOLDOWN` sau khi gửi lại sự kiện backend đã nhận là bình thường | `rejected > 0` → log cảnh báo; không làm gì thêm |
| **400** | Log `counts.dropped` **mức `error`** kèm `code`, `details`; **bỏ lô đó**. Gặp mã này nghĩa là **code AI có bug** (test Phần 7 đảm bảo không xảy ra) | Log `predator.dropped` **mức `error`** kèm `code`, `details`; **bỏ sự kiện**, giữ cooldown (gửi lại cũng lỗi y hệt) | Log mức `error`; không làm gì thêm |
| **401** | **Dừng**: báo "sai khóa dịch vụ, kiểm tra `AI_SERVICE_KEY` trong `.env`" | **Dừng**: cùng thông báo | **Dừng**: cùng thông báo |
| **404** `CAMERA_NOT_FOUND` | **Dừng**: báo camera không có trong CSDL, đã ngừng dùng hoặc không phải CAMERA | **Dừng**: cùng thông báo | **Dừng**: cùng thông báo (heartbeat dùng `device` = mã camera) |
| **404** khác (không có `error.code = CAMERA_NOT_FOUND`) | **Dừng**: báo sai đường dẫn, kiểm tra `BACKEND_URL` | **Dừng**: cùng thông báo | **Dừng**: cùng thông báo |
| **413** | Log `counts.dropped`, bỏ lô (lô ≤ 500 nên gần như không xảy ra) | **Thu nhỏ ảnh thêm** (75%) và **gửi lại một lần**; vẫn 413 thì log `predator.dropped` (lỗi ảnh, kèm kích thước), bỏ sự kiện, gợi ý kiểm tra `SNAPSHOT_MAX_BYTES` hai bên | Log; không làm gì thêm (không có ảnh) |
| **415** | Log `counts.dropped` mức `error`, bỏ lô (không có ảnh nên không mong đợi) | Log `predator.dropped` **mức `error`** (lỗi ảnh; AI tự mã hóa JPEG nên gặp mã này là **code AI có bug**), bỏ sự kiện, giữ cooldown | Log mức `error`; không làm gì thêm |
| **5xx**, timeout, mất kết nối | **Thử lại** theo 5.4 | **Thử lại** theo 5.4 | Log; không thử lại |
| Mã khác (403, 409, …) | Log `counts.dropped`, bỏ lô | Log `predator.dropped`, bỏ sự kiện, giữ cooldown | Log; không làm gì thêm |

**Dừng vì 401/404:** log `stop`, xóa file khóa, thoát mã khác 0, không gửi gì thêm (các lần gửi sau cũng lỗi y như vậy).

### 5.4 Thử lại (có giới hạn, không chặn luồng xử lý)

- **Bird-counts:** cửa sổ còn trong hàng đợi được gửi lại cùng lần gửi kế tiếp (mỗi 60 giây). Cửa sổ **đã đóng quá 60 phút** mà chưa gửi được thì bỏ, log `counts.dropped` kèm `in`/`out` để có thể nhập tay.
- **Predator:** gửi lại **chính sự kiện đó** (cùng `at`, `confidence`, ảnh) sau 5, 15, 30, 60, 120 giây (**tối đa 5 lần thử lại**). Hết lần thử thì log `predator.dropped` và **nhả cooldown của (camera, lớp) đó**, để lần phát hiện kế tiếp được báo. Gửi lại an toàn: backend dựng đường dẫn ảnh cố định theo `at`, SP trả `COOLDOWN` nếu lần trước đã ghi.
- Ảnh của sự kiện đang chờ giữ trong bộ nhớ dạng JPEG đã mã hóa (≤ `SNAPSHOT_MAX_BYTES`); cooldown làm số sự kiện chờ cùng lúc rất ít (tối đa 3 lớp).

### 5.5 Khi dừng

| Cách dừng | Hành vi |
|---|---|
| **Ctrl+C lần 1** | Ngừng xử lý video. Đưa tổng cuối cửa sổ đang mở vào hàng đợi. Cố gửi hết hàng đợi trong **tối đa 10 giây**; còn lại thì log là mất, kèm giá trị. Xóa file khóa, thoát mã 0 |
| **Ctrl+C lần 2** (trong lúc đang gửi nốt) | **Thoát ngay**: chỉ xóa file khóa, không gửi gì |
| **401 / 404** | Như 5.3 |
| **Lỗi không lường trước** | Log toàn bộ lỗi, cố gửi hàng đợi trong 10 giây như Ctrl+C lần 1, xóa file khóa, thoát mã khác 0 |
| **Tắt máy / kill tiến trình** | Mất phần chưa gửi (tối đa khoảng 1 phút số đếm và các sự kiện đang chờ). File khóa còn lại, xóa tay (mục 3.5) |

### 5.6 Ghi chú cho plan

- **Không tự đặt header `Content-Type`** cho multipart khi dùng `requests` (truyền `files=`/`data=`, để `requests` tự sinh `boundary`). Test kiểm header gửi đi bắt đầu bằng `multipart/form-data; boundary=`.
- **Test các nhánh dừng (401, 404 `CAMERA_NOT_FOUND`, 404 khác) bằng backend giả**, kiểm mã thoát khác 0 và **file khóa đã bị xóa**.

**Chưa kiểm chứng:**
- **Backend chưa có code.** Tên trường multipart và cách backend đọc chỉ khớp theo hợp đồng; test hình dạng không chứng minh được, phải chờ bước kiểm tra tay đầu-cuối (Phần 7).
- Route sai của NestJS trả 404 với body thế nào: chưa kiểm chứng; nếu khác thì vẫn dừng, chỉ khác thông báo.
- `SNAPSHOT_MAX_BYTES=2097152` giả định "2 MB" của hợp đồng là 2 × 1024 × 1024 byte; phải khớp con số trong `.env.example` của backend khi spec backend chốt.
- Các số timeout 5/10 giây, lịch thử lại 5/15/30/60/120 giây, giữ 60 phút, chờ 10 giây: đề xuất, chưa thử.
- Ctrl+C trên Windows có gây `KeyboardInterrupt` đúng lúc luồng chính đang đọc video/chạy mô hình không: chưa thử với OpenCV và torch.
- Hợp đồng không nói rõ khi nào heartbeat trả `rejected > 0`; AI chỉ log.

## Phần 6 — Đo đạc và đánh giá (đã duyệt)

TV3 đo và giao CSV + số đo; TV5 đưa vào báo cáo. **Không có ngưỡng đạt/không đạt** (mục 1.2).

### 6.1 Quy tắc đo

- **Không chỉnh tham số trên tập test.** Ngưỡng tin cậy, kích thước ảnh suy luận, vị trí vạch đếm, tham số xác nhận đều **chọn trên tập val**.
- **Tập test đo một lần**, sau khi **đóng băng trọng số và cấu hình** (đề xuất **01/11**, mốc M3). Ghi phiên bản `weights.json` và cấu hình đã dùng.
- **Train lại sau khi đã đo thì đo lại tất cả** các mục 6.2–6.7.
- Mọi số đo chạy trên **tập test chia theo nguồn** (mục 2.4).

### 6.2 Tốc độ trên CPU, ở hai độ phân giải

- Đo trên máy nhóm; ghi tên CPU, RAM, phiên bản torch và Ultralytics.
- Hai độ phân giải suy luận: **bằng kích thước ảnh lúc train**, và **một mức giảm** (VD một nửa); TV3 chốt con số.
- Mỗi độ phân giải đo: **fps chỉ mô hình** (trung bình ≥ 300 khung, bỏ 5 khung đầu) và **fps toàn luồng** (cả ByteTrack, đếm, vẽ; đo bằng `offline`).
- **Độ chính xác cũng đo ở cả hai độ phân giải** (mục 6.3).
- **Tiêu chí chuyển ONNX:** ngay cả ở mức giảm, fps xử lý vẫn không thỏa `confirm_frames ≤ fps × confirm_seconds` (mục 3.4).
- Đầu ra: `speed.csv` (`may, imgsz, fps_mo_hinh, fps_toan_luong, ms_moi_khung`).

### 6.3 Độ chính xác của mô hình nhận dạng (theo khung hình)

- Chức năng val của Ultralytics trên tập test: precision, recall, mAP50, mAP50-95 **từng lớp**, ở cả hai độ phân giải.
- Đầu ra: `detector.csv`. Lớp chỉ có một nguồn ghi "không có tập test độc lập" (hạn chế 11).

### 6.4 Precision/Recall thiên địch: **đo cả theo khung lẫn theo sự kiện**

| Cách đo | Định nghĩa | Nguồn số |
|---|---|---|
| **Theo khung** | Precision/Recall của mô hình trên từng ảnh test, IoU 0,5, ngưỡng tin cậy = `predator.confidence` | Mục 6.3, lớp `rat`/`snake`/`owl` |
| **Theo sự kiện** | Chạy `offline` trên video thiên địch của tập test, đúng cấu hình xác nhận (3 khung / 2 giây) và cooldown. **Precision** = số sự kiện rơi vào một đoạn có thiên địch cùng lớp ÷ tổng số sự kiện. **Recall** = số đoạn có thiên địch được báo ≥ 1 lần ÷ tổng số đoạn | `predators.csv` + `events_gt.csv` |

- `events_gt.csv` (`video, class, bat_dau_s, ket_thuc_s`, mỗi dòng một đoạn thiên địch xuất hiện liên tục) do TV3 ghi tay, **ghi xong TRƯỚC khi chạy mô hình trên video đó**, để kết quả mô hình không ảnh hưởng cách ghi.
- Báo cáo ghi rõ **hai cách đo cho hai con số khác nhau** và vì sao: theo khung đánh giá mô hình; theo sự kiện đánh giá điều người dùng nhận được (được lợi từ bước xác nhận nhiều khung, bị cooldown giới hạn).

### 6.5 Số báo động giả mỗi giờ

- Chạy `offline` trên **video chỉ có chim yến** của tập test; lấy số từ log JSON (mục 5.1):
  - **Có cooldown:** chỉ đếm `predator.confirmed` (số lần sẽ thực sự gửi). Bị cooldown chặn trên (tối đa 12 lần/giờ/lớp).
  - **Không bị cooldown chặn:** đếm `predator.confirmed` + `predator.cooldown_blocked`, cho thấy mô hình thực sự nhầm thường xuyên đến đâu.
- Chia cho **tổng số giờ video**, tách theo lớp. Đầu ra: `false_alarms.csv`.

### 6.6 Độ chính xác đếm

- Chọn các **đoạn khoảng 1 phút** trong video chim yến của tập test.
- TV3 **đếm tay** số chim ra và vào qua vạch (xem chậm), theo đúng quy tắc `MIN_BOX_PX` và vạch cấu hình. **TV5 đếm lại khoảng 20% số đoạn** để ước lượng sai số của người đếm.
- Số của AI cho từng đoạn tính từ `crossings.csv` (mục 3.5).
- Thước đo, tính **riêng cho `in` và `out`**:
  - **Tổng số đếm**: Σ tay và Σ AI. **Luôn báo cáo kèm**, vì sai số tương đối bất ổn khi tổng nhỏ.
  - **MAE** = trung bình |AI − tay| trên mỗi đoạn.
  - **Sai số tương đối** = Σ|AI − tay| ÷ Σ tay.
  - **Sai lệch có dấu** = Σ(AI − tay) ÷ Σ tay: dương là AI đếm thừa, âm là đếm thiếu.
- Đầu ra: `counting.csv` (`video, doan, tay_in, tay_out, ai_in, ai_out`, thêm cột người đếm lại nếu có).

### 6.7 So sánh offline với live

- Chạy `live` một lượt playlist (trên `SwiftletCare_Dev`), rồi chạy `offline` với **t0 = lúc bắt đầu của lần live đó** để chung cửa sổ.
- So từng cửa sổ: live lấy `counts.sent` cuối của mỗi cửa sổ trong log, offline lấy `counts.csv`. Báo cáo chênh lệch kèm tỷ lệ khung bị bỏ (log `fps`).
- Đầu ra: `offline_vs_live.csv`.

### 6.8 Giao kết quả

TV3 commit các CSV kết quả (nhỏ, không ảnh/video) vào **`ai-vision/results/`**, kèm `results/README.md` ghi máy đo, ngày đo, phiên bản trọng số (`weights.json`), cấu hình đã dùng. **Hạn giao: 04/11.**

**Chưa kiểm chứng:**
- Số đoạn đếm tay, số giờ video chim yến, số đoạn thiên địch có đủ để con số có ý nghĩa: phụ thuộc lượng video tìm được.
- "≥ 300 khung", "20% đếm lại", "IoU 0,5": đề xuất.
- Tên trường trong kết quả val của Ultralytics: lấy theo bản cài thật.
- Tổng thời lượng video chim yến của tập test dưới 1 giờ thì số báo động giả mỗi giờ là ngoại suy; báo cáo ghi rõ.

## Phần 7 — Kiểm thử (đã duyệt)

Theo CLAUDE.md: mỗi task viết test trước, chạy cho fail, rồi code. Chạy bằng `.\.venv\Scripts\python -m pytest`. Test **không cần `best.pt`**; test cần mô hình tự bỏ qua (kèm lý do) khi chưa tải trọng số. Các khoảng thời gian (60 s, 30 s, lịch thử lại, 10 s) rút ngắn qua tham số trong test.

### 7.1 Bước đầu của plan (trước mọi code khác)

1. Cài môi trường, chạy `import ultralytics, supervision`, ghi phiên bản thật vào `requirements.txt` và spec.
2. **Test tổng hợp vạch đếm** (tự tạo phát hiện có `tracker_id` di chuyển, không cần video hay mô hình):
   - Bay lên qua vạch → `out` theo câu trong YAML ví dụ (mục 3.4).
   - Bay xuống qua vạch → `in`.
   - Hoán đổi `start`/`end` → chiều đảo.
   - Track mất rồi xuất hiện lại với id mới → **ghi lại hành vi thật**.
   - Chim lượn qua lại ngay trên vạch → **ghi lại hành vi thật**.

   Hai trường hợp cuối **khóa** hành vi đó; spec ghi kết quả quan sát được, không ghi trước.

### 7.2 Test logic (không cần mô hình)

| Nhóm | Trường hợp |
|---|---|
| Cấu hình | Mỗi dòng bảng kiểm tra mục 3.4 có test giá trị sai; thông báo có tên file, tên trường |
| Danh sách camera | Đối chiếu hai chiều với fixture hợp đồng (mục 3.4) |
| Bản ghim | Notebook khớp `requirements.txt` |
| Video | **Video không mở được → dừng với thông báo rõ** (tên file, camera). **Khung đọc lỗi giữa chừng → bỏ qua và log**, chạy tiếp |
| Đồng hồ | Với **đồng hồ giả**: `at` của live **không bao giờ vượt giờ máy**; bỏ khung khi xử lý chậm |
| Cửa sổ | Làm tròn xuống ở biên (`:04:59` → `:00`, `:05:00` → `:05`, qua nửa đêm UTC); luôn có `Z`, luôn tròn 5 phút |
| Hàng đợi đếm | Tổng mới ghi đè tổng cũ; **tổng trong hàng đợi không bao giờ giảm**; không xóa cửa sổ đã có tổng mới trong lúc gửi; tối đa 500; bỏ cửa sổ đóng quá 60 phút |
| Xác nhận thiên địch | 3 khung trong 2 s → xác nhận; 3 khung trải 2,1 s → không; hai lớp độc lập; ảnh gửi là khung tin cậy cao nhất trong các khung xác nhận |
| Cooldown | Chặn đúng `cooldown_seconds` theo `at`; mỗi lần xác nhận bị chặn ghi đúng 1 dòng log; nhả cooldown khi hết lần thử lại; giữ cooldown khi bỏ vì 400/415 |
| Điều kiện fps | Không thỏa → dừng, thông báo có fps đo được |
| Ảnh | Đầu vào **`snake.jpg` của hợp đồng**: ảnh xuất ra bắt đầu `FF D8 FF`, ≤ `SNAPSHOT_MAX_BYTES`; giới hạn nhỏ thì vòng thu nhỏ chạy tới khi đủ nhỏ |
| File khóa | Tạo được; đã có thì dừng, báo thời điểm tạo; thoát thì xóa |
| Log | Mỗi dòng là JSON, đủ trường theo `type` (mục 5.1); ghi nối, không ghi đè; 400/415 ở mức `error` |

### 7.3 Test hình dạng theo fixture hợp đồng

- Tìm fixture **từ gốc repo**: đi ngược lên từ thư mục test tới khi gặp `contracts/fixtures/ai`. Không thấy → fail với thông báo "chưa có `contracts/fixtures/ai`, cần merge integration-contract trước".
- Bộ fixture AI theo plan integration-contract (đối chiếu 15/10/2026):
  - Hợp lệ: `bird-counts.json`, `bird-counts.resend-smaller.json`, `predator-detection.json` (+ `snake.jpg`), `predator-detection.cooldown.json`, `predator-detection.low-confidence.json`, `heartbeat.cut.json`.
  - Invalid: `bird-counts.invalid-window-not-aligned.json`, `bird-counts.invalid-negative.json`, `bird-counts.invalid-missing-z.json`, `predator-detection.invalid-class.json`, `predator-detection.invalid-offset.json`, `predator-detection.invalid-not-jpeg.json` (+ `not-jpeg.png`), `ai.invalid-service-key.json`.
- **Fixture hợp lệ:** hàm tạo payload của AI sinh payload tương ứng, so **hình dạng** (đủ khóa, không thừa khóa, đúng kiểu; chỗ giữ chỗ → kiểm kiểu theo mục 1.5; chỗ giữ chỗ lạ → fail). Phản hồi trong fixture dùng làm phản hồi của backend giả.
- **Invalid nhóm "AI tự tránh"** (`invalid-window-not-aligned`, `invalid-negative`, `invalid-missing-z`, `invalid-class`, `invalid-offset`): test khẳng định hàm tạo payload **không thể** sinh dạng đó (từ chối số âm, lớp lạ; hàm cửa sổ và hàm thời điểm luôn trả UTC có `Z`, cửa sổ luôn tròn 5 phút).
- **Invalid nhóm "backend từ chối"** (`ai.invalid-service-key` 401, `predator-detection.invalid-not-jpeg` 415): backend giả trả đúng `status` + `response` của fixture; test kiểm AI xử lý đúng bảng mục 5.3. `not-jpeg.png` chỉ dùng làm ảnh mà backend giả nhận để trả 415; AI không tự kiểm chữ ký JPEG (AI tự mã hóa ảnh).

### 7.4 Test với backend giả

Backend giả là máy chủ HTTP chạy trong test bằng thư viện chuẩn (`http.server`), ghi lại mọi request. **Đọc multipart bằng gói `email` của thư viện chuẩn** (`email.parser.BytesParser` với `email.policy.default`, ghép header `Content-Type` vào trước thân request), **không dùng `cgi`**: module `cgi` đã bị loại khỏi Python 3.13 (PEP 594, trang What's New 3.13 kiểm tra 15/10/2026).

| Trường hợp | Kiểm |
|---|---|
| 200 bình thường | Payload đúng; có `X-Service-Key`; multipart có `Content-Type: multipart/form-data; boundary=…` (mục 5.6); đọc lại được `metadata` (JSON) và `image` (JPEG) |
| 5xx rồi 200 | Gửi lại **chính** sự kiện đó, cùng `at` |
| 5xx mãi | Sau 5 lần thử lại có `predator.dropped`, cooldown được nhả |
| 413 | Thu nhỏ ảnh, gửi lại đúng 1 lần |
| 400, 415 | Log mức `error`, bỏ, giữ cooldown, không thử lại |
| **401, 404 `CAMERA_NOT_FOUND`, 404 khác** | Thoát mã khác 0, **file khóa đã xóa**, không gửi thêm request (mục 5.6) |
| **COOLDOWN sau khởi động lại** | Tiến trình gửi mới (chưa có cooldown AI); backend giả trả `created:false, skipReason:"COOLDOWN"` như SP; AI log `predator.sent`, **không thử lại** |
| Ctrl+C | Tổng cuối được gửi trong thời hạn; Ctrl+C lần 2 thoát ngay, không gửi thêm |
| Heartbeat | Gửi theo chu kỳ; thất bại không thử lại |

### 7.5 Kiểm tra tay đầu-cuối (bước cuối của plan)

Cần backend thật đã có các endpoint AI (tuần 3 theo roadmap), CSDL `SwiftletCare_Dev`, playlist H1 có đoạn thiên địch. Các bước:

1. Chạy backend; chạy `live --camera H1-F0-CAMERA` **ít nhất 10 phút**.
2. Kiểm số đếm trên web hoặc qua API, đúng cửa sổ 5 phút; `LastSeenAt` của camera cập nhật (heartbeat, Nên có).
3. Khi đoạn thiên địch phát: có cảnh báo, xem được ảnh có khung bao. Ghi lại `at` của sự kiện.
4. **Muốn thấy `COOLDOWN` do backend trả:** trong vòng **5 phút** sau sự kiện ở bước 3, Ctrl+C rồi **khởi động lại tiến trình AI** (cooldown phía AI mất), để đoạn thiên địch cùng lớp được xác nhận lại. Log phải có `predator.sent` với `skipReason: "COOLDOWN"` và không có cảnh báo mới trên web. Quá 5 phút thì SP tạo cảnh báo mới, phải làm lại.
5. Ctrl+C: kiểm tổng cuối của cửa sổ đang mở đã vào CSDL; file khóa đã xóa.
6. Ghi kết quả vào `results/e2e.md`.

**Spec ghi rõ:** test hình dạng và backend giả **không chứng minh** AI chạy đúng với backend thật; chỉ bước này chứng minh.

**Chưa kiểm chứng:**
- Hành vi "track mất rồi xuất hiện lại" và "lượn trên vạch": phụ thuộc supervision thật.
- Bộ fixture AI chưa có trong repo (plan hợp đồng chưa thực thi); khi có, tên file và chỗ giữ chỗ thật có thể khác bản đối chiếu.
- Tạo phát hiện giả cho tracker của supervision không cần mô hình: chưa thử.
- Đọc multipart bằng `email.parser` trên bản Python đã ghim: chưa thử.
- Gửi Ctrl+C cho tiến trình con trong test trên Windows có thể khó; không làm được thì test gọi thẳng hàm dừng, còn Ctrl+C thật kiểm ở bước 7.5.
- Ở bước 7.5 bước 4, đoạn thiên địch phải phát lại trong 5 phút sau khi khởi động lại; playlist cần sắp đoạn đó ở đầu hoặc đủ ngắn.
