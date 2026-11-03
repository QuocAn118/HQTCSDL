# Rà video ứng viên — 03/11/2026

Chưa có video nào được chọn làm train/val/test. Chưa chạy mô hình lên các
video ứng viên. Không đưa chúng vào `splits.csv`, không sửa cấu hình camera
và không dùng làm số đo chính thức. Đánh giá dưới đây dựa vào mô tả nguồn và
ảnh lấy ở khoảng 10%, 50%, 90% thời lượng, chưa phải xem đầy đủ từng video.

## Nguồn ưu tiên kiểm tra tiếp

[Mariana Swiftlet Count on Guam B-Roll — DVIDS](https://www.dvidshub.net/video/949024/mariana-swiftlet-count-guam-b-roll)

- Cơ quan: Naval Facilities Engineering Systems Command Marianas.
- Tác giả được nguồn ghi: Amy Burrell, U.S. Navy.
- Video ID 949024; VIRIN 240306-N-QV371-9013; thời lượng nguồn ghi 7:28.
- Trang mô tả việc đếm Mariana swiftlet tại Guam. Đây chưa phải xác nhận có
  đoạn quay cố định, liên tục phù hợp đếm qua vạch; cần xem video đầy đủ.
- Trang ghi Public Domain kèm [điều kiện sử dụng DVIDS](https://www.dvidshub.net/about/copyright).
- **Chưa tải:** giao diện tải yêu cầu đăng ký/đăng nhập. Không dùng tài khoản
  của người khác hoặc đường dẫn vòng để vượt yêu cầu đăng nhập.
- Không phải video nhà yến nuôi tại Việt Nam. Nếu dùng phải ghi hạn chế trong
  báo cáo; không suy ra độ chính xác trong nhà yến thực tế.

## Ba bản ứng viên đã tải để xem mẫu

Các file ở `ai-vision/data/video-candidates/`, được gitignore. Bản nguồn tải
nguyên trạng; chưa cắt, augment, gán nhãn hoặc suy luận. Metadata/hash ở
`sources.json`; ảnh xem mẫu ở `preview.jpg` trong cùng thư mục.

| Mã | File trên máy | Nguồn/tác giả | Giấy phép trang nguồn | Thời lượng OpenCV | Nhận xét sơ bộ |
|---|---|---|---|---|---|
| CAND01 | `CAND01.ogv` | [Common swifts, Tomaszow Mazowiecki](https://commons.wikimedia.org/wiki/File:Common_swifts._Hubala_residetials_in_Tomaszow_Mazowiecki,_Lodz_Voivodeship,_Poland,_CC0.ogv), WrS.tm.pl | Public domain theo tuyên bố tác giả | 6,03 s | Chim bay trên trời, nhiều cá thể nhỏ; quá ngắn cho đánh giá đáng tin cậy. Nguồn ghi common swift, không phải swiftlet. Cần kiểm thêm độ ổn định camera. |
| CAND02 | `CAND02.webm` | [Flyingswallow](https://commons.wikimedia.org/wiki/File:Flyingswallow.webm), Zachzr | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 31,70 s | Én bay quay chậm, cận cảnh. Ảnh mẫu cho thấy chủ thể được bám trong khung; chưa phù hợp chọn vạch cố định. Không phải swiftlet. |
| CAND03 | `CAND03.webm` | [Nesting Swallows at Skomer Island, Wales](https://commons.wikimedia.org/wiki/File:Nesting_Swallows_at_Skomer_Island,_Wales.webm), Natural Resources Wales / Cyfoeth Naturiol Cymru | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 80,21 s | Có phần chữ giới thiệu và cảnh tổ/chim non. Cần kiểm các đoạn liên tục có chim bay qua; chưa chọn làm video đếm. Không phải swiftlet. |

Tổng ba file gốc: 11.656.412 byte, khoảng 11,1 MiB. Video không nằm trong Git.

## Quy tắc khi chọn được video

1. Xác nhận nguồn, loài theo mô tả, giấy phép, độ ổn định camera và đoạn quay
   liên tục. Chốt mã Vxx và chỉ một tập cho toàn bộ nguồn.
2. Ghi nguồn vào `SOURCES.md`, ánh xạ vào `splits.csv` trước khi trích ảnh hoặc
   chạy đánh giá. Các đoạn cùng nguồn không được chia qua nhiều tập.
3. Chọn vạch và ngưỡng bằng val. Không điều chỉnh theo test.
4. Nếu dùng chim thay thế, ghi rõ chỉ chứng minh trên video thay thế theo spec
   mục 1.3/1.4. Không gọi én/common swift là swiftlet để hợp thức hóa nhãn.

Tài liệu tham khảo phương pháp, chưa phải video đầu vào đã tải:
[USGS — Videographic monitoring at caves to estimate population size of the
Mariana swiftlet](https://pubs.usgs.gov/publication/70251606).
