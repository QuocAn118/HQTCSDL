# Nguồn dữ liệu

Dữ liệu hiện dùng lấy từ 9 bộ trên Roboflow Universe, sau đó gộp thành một project gồm 4 lớp: `swiftlet`, `rat`, `snake`, `owl`.

Project đã gộp: Swiftlet and Predators Detection, nằm trong workspace nhóm trên Roboflow.

Ngày 24/10/2026 nhận thêm R06–R09 (bảng bên dưới), kiểm trùng và chuẩn hóa nhãn để tạo `split_v3`. Năm nguồn đầu giữ nguyên phân chia; các ảnh được giữ từ bốn nguồn mới nằm trong test.

## Các bộ dữ liệu sử dụng

| Mã | Nguồn | Link | Lớp sử dụng | Giấy phép | Chia sẻ lại | Ngày tải | Công cụ | Tập |
|---|---|---|---|---|---|---|---|---|
| R01 | iOnest | [Swiftlet](https://universe.roboflow.com/ionest/swiftlet) | swiftlet | Public Domain | Có | 18/10/2026 | Roboflow | train |
| R02 | Rats | [Rat detection](https://universe.roboflow.com/rats-2lftk/rat-detection-xbnjq) | rat | Public Domain | Có | 18/10/2026 | Roboflow | train |
| R03 | Snake Demo | [Snake Detection](https://universe.roboflow.com/snake-demo/snake-detection-lbjeu) | snake | CC BY 4.0 | Có, cần ghi công | 18/10/2026 | Roboflow | train |
| R04 | Owl | [Owl](https://universe.roboflow.com/owl-kb7jn/owl-ljwf6) | owl | CC BY 4.0 | Có, cần ghi công | 18/10/2026 | Roboflow | train |
| R05 | alfatihmm | [Swiftlet](https://universe.roboflow.com/alfatihmm/swiftlet-giggc) | swiftlet | Cần kiểm tra | Cần kiểm tra | 18/10/2026 | Roboflow | val |

## Ghi chú

- Giấy phép được đối chiếu trên trang nguồn ngày 21/10/2026. Riêng R03 đối chiếu tại [phiên bản 5](https://universe.roboflow.com/snake-demo/snake-detection-lbjeu/dataset/5), chưa ghi lại phiên bản thực tế đã lấy. R05 chưa kiểm tra được giấy phép.
- Nhãn gốc có tên khác nhau: R01 có `swiftlet`, `walet`; R02 dùng `Rat`; R04 có `owl` và `owl - v2 2025-01-11 1:14am`. Bản đang dùng đã thống nhất class ID: 0 owl, 1 rat, 2 snake, 3 swiftlet.
- Ngày tải do người phụ trách xác nhận: R01–R05 ngày 18/10/2026, R06–R09 ngày 24/10/2026. Chưa xác nhận phiên bản Universe gốc. Số ảnh bản ZIP nằm ở bảng dưới; số ảnh sau làm sạch và chia tập nằm trong README.md.
- Ngày 24/10/2026 đã sửa chia theo nguồn: mỗi dataset R01–R05 nằm nguyên trong đúng một tập. `splits.csv` có một dòng `nguon,tap` mỗi nguồn và là đầu vào của script. Bản chia theo tên ảnh ngày 22/10 không đáp ứng spec, chỉ giữ đối chiếu.
- Ở bản cũ `split_v2`, R02/R03/R04 chỉ có nguồn train. Bản `split_v3` bổ sung R06 (owl), R07 mới (rat), R08 (snake), R09 (swiftlet) vào test sau khi loại ảnh trùng/lỗi. R01–R04 vẫn train, R05 vẫn val. Còn thiếu val độc lập cho thiên địch; xem [README.md](README.md).
- Các nguồn trên là bộ ảnh. Video dùng để đếm chim và đánh giá cảnh báo sẽ ghi bổ sung riêng.

## Các bản nguồn đã nhận

Đã nhận 5 ZIP trong `data/raw/sources/`. Metadata bên trong ghi đây là các project sao chép ở workspace của nhóm, đều export version 1 ngày 21/10/2026. Version này không phải phiên bản của project Universe gốc.

| Nguồn | Project trong bản export | Số ảnh | Nhãn gốc trong YAML |
|---|---|---:|---|
| R01 | swiftlet-4vokp | 591 | walet |
| R02 | rat-detection-xbnjq-frnqr | 1.222 | Rat |
| R03 | snake-detection-lbjeu-epcqn | 880 | 10 nhãn loài rắn |
| R04 | owl-ljwf6-o5ofk | 546 | owl |
| R05 | swiftlet-giggc-malq3 | 1.056 | swiftlet |

YAML trong ZIP R05 ghi CC BY 4.0; đây là giấy phép của bản sao trong workspace, chưa thay thế việc xác minh trang gốc. README các ZIP ghi không preprocessing hoặc augmentation ở lần export này; chưa kết luận về dữ liệu trước khi import.

Phần mềm huấn luyện: Ultralytics (AGPL-3.0).

R01 và R05 cùng nhóm `swiftlet`; R02 là `rat`, R03 là `snake`, R04 là `owl`. Mã nguồn gốc được giữ trong danh mục chia tập để truy xuất.

## Nguồn bổ sung R06–R09 (nhận ngày 24/10/2026)

URL do người phụ trách cung cấp; đã đối chiếu metadata trong ZIP ở `data/raw/sources/<mã>/`. Ngày tải R06–R09 được người phụ trách xác nhận là 24/10/2026; phiên bản Universe gốc chưa được xác nhận.

| Mã | Nguồn/đường dẫn cung cấp | Lớp đích | Ảnh trong ZIP | Ảnh giữ | Giấy phép | Ngày tải | Tập |
|---|---|---|---:|---:|---|---|---|
| R06 | owl-dataset-model v1, bản sao trong workspace nhóm trên Roboflow | owl | 45 | 42 | CC BY 4.0 — người phụ trách xác nhận, khớp ZIP | 24/10/2026 | test |
| R07 | [Rat — Kwok Martin](https://universe.roboflow.com/kwok-martin-ip6on/rat-fsvlk) | rat | 225 | 212 | ZIP ghi CC BY 4.0 | 24/10/2026 | test |
| R08 | [Snake — snake](https://universe.roboflow.com/snake-h3qp4/snake-4lxhl) | snake | 1.447 | 1.403 | Trang Universe và ZIP ghi CC BY 4.0 | 24/10/2026 | test |
| R09 | [Swiftlet Segmentation — test](https://universe.roboflow.com/test-avhhz/swiftlet-segmentation) | swiftlet | 248 | 248 | CC BY 4.0 — người phụ trách xác nhận, khớp ZIP | 24/10/2026 | test |

Ngày 24/10/2026, người phụ trách xác nhận các nguồn bổ sung dùng giấy phép CC BY 4.0, cho phép chia sẻ lại kèm ghi công. Giấy phép R06/R09 đã được người phụ trách xác nhận; R08 đã đối chiếu trang Universe và ZIP. Bản R07 thay thế ghi CC BY 4.0 trong ZIP.

| Mã | Project bản sao trong ZIP | Version export | Nhãn gốc |
|---|---|---|---|
| R06 | owl-dataset-model-yedkr | 1 | great-horn-owl, grey-owl, snowy-owl |
| R07 | rat-fsvlk-anqjf | 1 | 1, 2 |
| R08 | snake-4lxhl-qf8y2 | 1 | bandotan_puspa, kobra_jawa, kobra_sumatera, sanca_kembang, ular_cecak, ular_gadung, ular_tambang, ular_tanah, viper_hijau, weling |
| R09 | swiftlet-segmentation-85uph | 1 | chim yen |

R07 hiện dùng bộ `rat-fsvlk` do người phụ trách cung cấp thay cho bộ Ashveer `rat-detection-j9gzi` (443 ảnh). ZIP mới có 225 ảnh, đã chuyển từ thư mục tạm `R10` sang `data/raw/sources/R07/`; không dùng mã R10 riêng. Bộ cũ có ảnh vẽ sẵn khung/điểm dự đoán và ảnh không phù hợp, được tách khỏi nguồn đang dùng sang `data/raw/rejected/R07-ashveer/`. Các kết quả kiểm tra R07 trong `source_audit_v1` thuộc bộ cũ, không áp dụng cho bản thay thế; bản mới được kiểm trong `source_audit_R07_v2`. Đã xem mẫu cả hai nhãn `1`/`2` của bộ mới (class ID gốc 0/1): các mẫu đều là chuột; cả hai được quy về class ID 1 (`rat`).

- README trong cả bốn ZIP ghi export ngày 24/10/2026 và không augmentation tại lần export này; chưa kết luận về dữ liệu trước khi import.
- Đã đối chiếu với toàn bộ 4.295 ảnh trong ZIP R01–R05, bao gồm ảnh không còn trong bản sạch. Kiểm SHA-256 file/pixel RGB và ảnh thu nhỏ 16×16 (tương quan ≥ 0,97 và MAE RGB ≤ 8), có xét lật ngang. Đã xem các cặp nghi trùng và loại 3 ảnh R06 trùng R04, 13 ảnh R07 mới trùng R02. Bộ R07 cũ đã loại toàn bộ. Không phát hiện trùng R08/R09 theo các phép kiểm này.
- R08 loại 44 ảnh có bbox vượt biên; giữ 1.403 ảnh có nhãn hợp lệ. R09 chuyển 7.131 polygon trên 248 ảnh thành bbox bao ngoài. Không ghi đè ảnh/nhãn trong ZIP gốc.
- Chuẩn hóa class ID: owl=0, rat=1, snake=2, swiftlet=3. `splits.csv` có R06–R09 → test; mọi ảnh được giữ của cùng nguồn chỉ nằm trong một tập. `sourced_v1` và `split_v2` được giữ để đối chiếu.
- Các CSV kiểm trùng/lỗi nằm trong `data/working/source_audit_v1/` và `source_audit_R07_v2/`; các bảng ảnh đối chiếu và mẫu xem nhãn cùng thư mục. Tóm tắt số lượng và SHA-256 ZIP được lưu trong [báo cáo kiểm tra nguồn](reports/2026-10-24-source-audit.json). Các phép kiểm gần giống không bảo đảm phát hiện hết crop/cảnh video chung hoặc chứng minh nguồn gốc độc lập tuyệt đối. Mới rà mẫu nhãn, chưa duyệt toàn bộ từng đối tượng; cần hoàn tất rà nhãn trước khi đóng băng bộ test đo chính thức.
- Đã có nguồn train/test riêng cho rat/snake/owl. Vẫn thiếu val độc lập cho ba lớp này; không dùng test để chọn ngưỡng. Các bộ ảnh mới không thay thế video test để đo đếm chim hoặc cảnh báo theo sự kiện.
- Hạn chế: R05 chưa xác minh giấy phép trên trang gốc, chỉ dùng ở tập val; nhóm chấp nhận đây là hạn chế.
- Hạn chế: R06 là bản sao trong workspace nhóm, chưa có link Universe gốc.

## Đối chiếu điều kiện hai nguồn cho mỗi lớp thiên địch

Đã hoàn tất phần bổ sung nguồn và tạo tập test theo nguồn trong `data/working/split_v3/`:

| Lớp | Nguồn train | Nguồn test | Ảnh test sau xử lý |
|---|---|---|---:|
| rat | R02 | R07 — rat-fsvlk thay thế | 212 |
| snake | R03 | R08 | 1.403 |
| owl | R04 | R06 | 42 |

Mỗi lớp đã có hai mã nguồn, mỗi nguồn chỉ thuộc một tập; các ảnh gần trùng đã phát hiện với nguồn cũ được loại khỏi test. Việc rà toàn bộ nhãn, xác minh thêm cảnh/nguồn gốc nếu có nghi vấn và bổ sung val thiên địch vẫn cần hoàn tất trước khi tinh chỉnh hoặc đo chính thức. Chưa chạy mô hình để đo trên test.

