# Chuẩn bị lượt train cải thiện v4 — 04/11/2026

**Đã chuẩn bị dữ liệu và notebook, chưa train v4.** Không đổi best.pt,
weights.json, cấu hình runtime hoặc kết quả test của bản v3 đã đóng băng.

Cập nhật duyệt nhãn: agent đã xem riêng từng ảnh val ở kích thước nguồn,
chỉnh 13 bbox để bao đủ phần con vật nhìn thấy và giảm nền dư; kiểm lại 5 nền
V01. Trạng thái `agent_reviewed_for_pilot`, không phải duyệt độc lập của TV5.
File trước/sau, kích thước ảnh, lý do và hash nhãn nằm trong
`2026-11-04-v4-label-review.json`. Bộ ZIP mới có hậu tố **v4_reviewed**.

## Kết quả rà dữ liệu

Script `scripts/review_labels.py` chỉ đọc train/val của split_v3: **4.040 ảnh**,
không mở ảnh test, không chỉnh nhãn. Không thấy lỗi số học, class ID hoặc bbox
vượt ảnh. Điều này không chứng minh nhãn đúng về nội dung hoặc đầy đủ.

| Lớp train | Số bbox | Cạnh ngắn trung vị trên ảnh gốc | Bbox dưới 8 px |
|---|---:|---:|---:|
| owl | 605 | 280 px | 0 |
| rat | 1.772 | 213,5 px | 0 |
| snake | 789 | 236 px | 0 |
| swiftlet | 2.411 | 7 px | 1.389 |

Ảnh train swiftlet đều 512x512. Tăng imgsz chỉ phóng to biểu diễn trên lưới
mô hình, **không khôi phục chi tiết đã mất**. Tắt mosaic trong lượt thử để
tránh làm chim nhỏ thêm; chưa chứng minh đây là cấu hình tối ưu.

Đã xem thủ công 12 mẫu cố định/lớp (seed 42), tổng **48 ảnh**. Không thấy đảo
hàng loạt ID bốn lớp. Có hai ảnh minh họa và một ảnh macro chỉ thấy vảy rắn,
không thể xác định hình con vật đáng tin cậy. Ba ảnh này chỉ cách ly trong v4,
giữ nguyên v3; danh sách ở `2026-11-04-train-review-decisions.csv`.
Chưa duyệt nội dung đầy đủ cả 4.040 ảnh. Có ảnh chuột mang chữ quảng cáo và
phần lớn ảnh chim cùng một góc quay; đây là hạn chế đa dạng dữ liệu.

## Bộ pilot mới

- **Train 3.106 ảnh** = 3.104 cũ - 3 cách ly + 5 ảnh nền V01.
- V01 lấy tại giây 10/30/60/90/110, đã xem từng ảnh. Nguồn ghi house martin,
  không phải swiftlet; không thấy rat/snake/owl. Nhãn YOLO rỗng chỉ phù hợp
  định nghĩa bốn lớp này. Không dùng nếu đổi swiftlet thành lớp mọi loài chim.
- Nền chiếm **5/3106 = 0,161%**, không nhân bản để nâng tỷ lệ giả tạo.
- **Val 13 ảnh mới**: owl 4, rat 4, snake 3, swiftlet 2. Có ảnh và metadata giấy
  phép từ Wikimedia Commons. Agent gán bbox ban đầu bằng quan sát, không dùng
  mô hình v3 dự đoán để làm nhãn. Đã agent duyệt vòng hai; không có người
  thứ hai xác nhận độc lập hoặc chứng nhận chuyên gia về loài.
- Mã nguồn mới **R11** cho toàn collection val, tránh dùng lại mã R10 từng có
  trong tên nguồn chuột cũ. `splits_v4.csv` giữ toàn R11 ở val, V01 ở train.
- Loại khỏi val một ảnh crop trùng cùng bức swiftlet, một ảnh chim chồng lấp,
  một ảnh rắn che khuất khó xác định khung. Quyết định và box chuẩn hóa nằm
  trong `2026-11-04-v4-val-attribution.json`.
- Quét difference hash 64-bit giữa ảnh val mới và **3.104 ảnh train cũ**, gắn
  cờ khi khoảng cách <=6: không có cặp nghi trùng. Không chứng minh tuyệt đối
  không chung ảnh gốc/crop; không đọc ảnh test để làm phép kiểm này.
- R05 không đưa vào bộ mới vì giấy phép nguồn chưa xác minh. Không chuyển
  R06–R09 từ test sang val. ZIP không chứa test.

Val rất nhỏ, owl chủ yếu barn owl, snake chủ yếu corn snake và ảnh chim mới
khác góc quay train. **Chưa đủ để chọn ngưỡng/mô hình ổn định hoặc kết luận
độ chính xác.** Đây là bộ pilot phục vụ train thử, không phải dataset đã duyệt
hoàn chỉnh. V01 từ v4 là train, không dùng làm đánh giá độc lập sau train.

## File để chạy

- Dataset cục bộ đã duyệt: `data/working/train_val_v4_reviewed/`.
- ZIP mới: `data/colab/swiftletcare_train_val_v4_reviewed.zip`, khoảng 122,4 MiB.
- ZIP `v4_pilot` cũ được giữ để đối chiếu, không dùng với notebook hiện tại.
- SHA-256 và metadata: `2026-11-04-v4-pilot.json`.
- Notebook: `train/train-v4-pilot.ipynb`, output trống.
- Tham số dự kiến: `train/train-v4-settings.json` — YOLOv8n pretrained, tối đa
  50 epoch, imgsz 1280, batch 4, mosaic 0, seed 42, patience 15.

Tải ZIP lên `MyDrive/SwiftletCare/`, chọn kernel Colab T4 rồi chạy notebook.
Kết quả lưu ở run v4 riêng trong Drive. Cell cuối ghi **số epoch thật đã chạy**,
hash best.pt và `weights-v4-pilot.json`, không tự thay metadata/trọng số v3.
Không có lệnh đo test trong notebook.

Sau lượt train cần lấy best.pt, results.csv và weights-v4-pilot.json về để
kiểm tra. Trước khi nâng thành bản chính thức, bổ sung/duyệt val đại diện hơn,
đóng băng cấu hình mới và đánh giá lại theo spec. Không lấy V01 đã vào train
để chứng minh cải thiện. Giữ nguyên kết quả v3 để đối chiếu, ghi rõ test v3 đã
được xem nên cần nguồn test mới nếu muốn kết luận độc lập cho vòng cải thiện.

## Tái tạo phần chuẩn bị

Từ `ai-vision/`; dùng thư mục output mới nếu đã tồn tại:

```powershell
.venv/Scripts/python scripts/review_labels.py --dataset data/working/split_v3 --out data/working/review_fresh
.venv/Scripts/python scripts/prepare_retrain.py --base data/working/split_v3 --decisions reports/2026-11-04-train-review-decisions.csv --negatives data/working/v4_inputs/V01 --validation data/raw/val_candidates_v4 --out data/working/train_val_v4_fresh --splits splits_v4.csv
```

Các nguồn mới cần metadata và nhãn đã chuẩn bị ở máy này. Script không tự tải,
không tự thay nhãn bằng dự đoán và từ chối overwrite, thiếu lớp val, lệch hash,
trùng train/val, sai mapping nguồn hoặc nền vượt 10%. Dữ liệu/ZIP/ảnh minh họa
ở thư mục gitignore; chỉ báo cáo, nguồn/nhãn dạng JSON và code vào Git.
