# Kiểm chứng trên máy Windows

Các mục chưa ghi kết quả bên dưới vẫn chưa được kiểm chứng; không suy ra rằng
toàn bộ Task 1 đã hoàn thành.

| Mục | Kết quả |
|---|---|
| S1 | Python máy Windows: 3.12.10. |
| S2 | Nạp `best.pt` thật bằng Ultralytics 8.4.178, torch 2.15.0+cpu; supervision 0.30.9. Chưa hoàn thành mọi spike Task 1. |
| S8 | Chưa kiểm tay Ctrl+C khi chạy video thật. |
| S12 | Colab GPU Tesla T4; Python 3.13.16, torch 2.11.0+cu130, Ultralytics 8.4.178, supervision 0.30.9 (output notebook). |
| S14 | Tải thủ công từ Drive, chưa tạo Release. |
| S15 | SHA-256 đúng metadata; nạp được bốn lớp trên CPU. Torch Windows khác Colab, Ultralytics cùng phiên bản. |
| S17 | Chưa có video thật để so sánh read/grab. |
| S20 | 7 test vạch đếm đạt trên supervision 0.30.9. `SV_IN_MEANS = 'out'`: bay lên là out, bay xuống là in; hoán đổi đầu vạch đảo chiều. Track mất rồi xuất hiện bằng ID mới ở phía kia: `(in, out) = (0, 0)`. Lượn lên–xuống–lên: `(1, 2)`, mỗi lần qua vạch được đếm. |

Ảnh fixture trong đường dẫn repo có dấu không mở được bằng `cv2.imread`.
Test dùng `Path.read_bytes()` và `cv2.imdecode()` để đọc đúng cùng ảnh hợp đồng.
