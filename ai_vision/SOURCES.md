# Nguồn dữ liệu

Dữ liệu lấy từ 5 bộ trên Roboflow Universe, sau đó gộp thành một project gồm 4 lớp: `swiftlet`, `rat`, `snake`, `owl`.

Project đã gộp: [Swiftlet and Predators Detection](https://app.roboflow.com/binhnguyen3244-gmail-com/swiftlet-and-predators-detection/browse).

## Các bộ dữ liệu sử dụng

| Mã | Nguồn | Link | Lớp sử dụng | Giấy phép | Chia sẻ lại | Ngày tải | Công cụ | Tập |
|---|---|---|---|---|---|---|---|---|
| R01 | iOnest | [Swiftlet](https://universe.roboflow.com/ionest/swiftlet) | swiftlet | Public Domain | Có | Chưa ghi | Roboflow | train |
| R02 | Rats | [Rat detection](https://universe.roboflow.com/rats-2lftk/rat-detection-xbnjq) | rat | Public Domain | Có | Chưa ghi | Roboflow | train |
| R03 | Snake Demo | [Snake Detection](https://universe.roboflow.com/snake-demo/snake-detection-lbjeu) | snake | CC BY 4.0 | Có, cần ghi công | Chưa ghi | Roboflow | train |
| R04 | Owl | [Owl](https://universe.roboflow.com/owl-kb7jn/owl-ljwf6) | owl | CC BY 4.0 | Có, cần ghi công | Chưa ghi | Roboflow | train |
| R05 | alfatihmm | [Swiftlet](https://universe.roboflow.com/alfatihmm/swiftlet-giggc) | swiftlet | Cần kiểm tra | Cần kiểm tra | Chưa ghi | Roboflow | val |

## Ghi chú

- Giấy phép được đối chiếu trên trang nguồn ngày 21/10/2026. Riêng R03 đối chiếu tại [phiên bản 5](https://universe.roboflow.com/snake-demo/snake-detection-lbjeu/dataset/5), chưa ghi lại phiên bản thực tế đã lấy. R05 chưa kiểm tra được giấy phép.
- Nhãn gốc có tên khác nhau: R01 có `swiftlet`, `walet`; R02 dùng `Rat`; R04 có `owl` và `owl - v2 2025-01-11 1:14am`. Bản đang dùng đã thống nhất class ID: 0 owl, 1 rat, 2 snake, 3 swiftlet.
- Chưa xác nhận phiên bản Universe gốc và ngày tải. Số ảnh bản ZIP nằm ở bảng dưới; số ảnh sau làm sạch và chia tập nằm trong README.md.
- Ngày 24/10/2026 đã sửa chia theo nguồn: mỗi dataset R01–R05 nằm nguyên trong đúng một tập. `splits.csv` có một dòng `nguon,tap` mỗi nguồn và là đầu vào của script. Bản chia theo tên ảnh ngày 22/10 không đáp ứng spec, chỉ giữ đối chiếu.
- R02/R03/R04 mỗi lớp chỉ có một nguồn: đưa toàn bộ vào train và ghi rõ **không có tập test độc lập**. R01 vào train, R05 vào val để có val swiftlet độc lập nguồn; hiện chưa có nguồn test, chưa đủ val/test cho thiên địch. Cần bổ sung nguồn trước khi đánh giá đầy đủ; xem [README.md](README.md).
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

