# SwiftletCare: Hệ thống tự động hóa điều khiển môi trường và giám sát sức khỏe nhà yến đa phương thức

**Tên tiếng Anh:** SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming.

## 3.2. Nội dung đề xuất chính (bao gồm kết quả và sản phẩm)

### a) Bối cảnh

Nuôi yến thương mại mang lại lợi nhuận cao nhưng cực kỳ nhạy cảm với vi khí hậu (nhiệt độ, độ ẩm, luồng không khí, cường độ ánh sáng) và âm thanh bên trong nhà yến. Hiện nay, hầu hết người nuôi yến dựa vào việc kiểm tra thủ công hoặc các thiết bị cảm biến giá rẻ, rời rạc, đòi hỏi phải can thiệp trực tiếp thường xuyên. Việc duy trì độ ẩm không phù hợp (<75%) hoặc nhiệt độ quá cao (>31°C) dẫn đến tổ yến xuống cấp, chim bỏ nhà hoặc tỷ lệ chết ở chim non cao.

Hơn nữa, việc theo dõi liên tục biến động quần thể chim yến (chênh lệch hằng ngày giữa số chim bay ra và bay về nhà), cũng như phát hiện sớm dịch bệnh, sự xâm nhập của thiên địch (chuột, rắn, cú) hoặc sự cố thiết bị phát âm thanh, gần như không thể thực hiện được nếu thiếu hệ thống giám sát tự động liên tục. Do đó, rất cần một hệ sinh thái IoT chi phí thấp, tích hợp thị giác máy tính và hệ quản trị cơ sở dữ liệu để tự động hóa việc điều chỉnh môi trường, theo dõi biến động quần thể yến, giảm chi phí vận hành và bảo vệ sản lượng yến.

### b) Giải pháp đề xuất

Chúng tôi đề xuất **SwiftletCare**, một hệ thống IoT gồm trình mô phỏng thiết bị biên và cảm biến, cơ cấu chấp hành ảo, mô-đun thị giác máy tính nhận diện chim yến và thiên địch trên video, cơ sở dữ liệu **SQL Server** và một nền tảng web/di động tập trung.

Trọng tâm nghiên cứu là **bộ máy điều khiển vi khí hậu tự động, đếm chim yến và phát hiện thiên địch bằng AI**:

1. **Điều khiển vi khí hậu:** Hệ thống liên tục nhận dữ liệu cảm biến mô phỏng (nhiệt độ, độ ẩm, CO2, ánh sáng) và dùng thuật toán điều khiển vòng kín (PID/dựa trên luật) để tự động kích hoạt phun sương, quạt thông gió và thiết bị sưởi (ảo).
2. **Đếm chim yến ra/vào bằng AI:** Huấn luyện (fine-tune) mô hình phát hiện đối tượng YOLOv8 nano kết hợp ByteTrack để theo dõi và đếm chim yến bay ra (buổi sáng) và bay về (buổi tối) trên video, từ đó cung cấp thông tin dựa trên dữ liệu về sự phát triển hoặc bỏ nhà của đàn yến.
3. **Phát hiện thiên địch và bất thường:** Cùng một mô hình YOLOv8 nano được huấn luyện thêm các lớp chuột, rắn, cú để phát hiện thiên địch xâm nhập trên video và tạo cảnh báo kèm ảnh chụp. Hệ thống đồng thời phân tích dữ liệu để phát hiện các bất thường khác (vượt ngưỡng, giảm đàn đột ngột, thiết bị mất kết nối) và cảnh báo tức thời cho chủ nhà yến.

### c) Yêu cầu chức năng

**1. Chủ nhà yến / Quản trị viên**

- **Quản lý thiết bị và khu vực:** Đăng ký, cấu hình và giám sát nhiều nhà yến, các thiết bị (ảo) và các tầng/khu vực.
- **Điều khiển tự động và ghi đè thủ công:** Thiết lập ngưỡng môi trường (nhiệt độ, độ ẩm, ánh sáng) để điều khiển tự động, kèm chế độ ghi đè thủ công qua giao diện Web/Mobile.
- **Theo dõi chim yến ra/vào:** Xem thống kê số lượng chim ra/vào theo thời gian thực và theo lịch sử, xem các khung hình đã xử lý (có khung bao đối tượng).
- **Giám sát thời gian thực và cảnh báo:** Xem bảng điều khiển dữ liệu trực tiếp và nhận thông báo (push/email/Zalo) về vượt ngưỡng, sự cố thiết bị, thiên địch xâm nhập hoặc đàn giảm đột ngột.
- **Phân tích và theo dõi sản lượng:** Xem xu hướng môi trường theo lịch sử, nhật ký phát triển tổ yến, phân tích di chuyển của đàn và báo cáo tương quan giữa độ ổn định môi trường với năng suất thu hoạch.

**2. Hệ thống (dịch vụ nền)**

- **Mô phỏng dữ liệu:** Trình mô phỏng sinh dữ liệu cảm biến và sự kiện bất thường theo kịch bản cấu hình được, gửi qua MQTT.
- **Thu nhận dữ liệu:** Thu thập, kiểm tra tính hợp lệ và lưu trữ dữ liệu tần suất cao truyền qua MQTT/HTTP vào SQL Server.
- **Vòng lặp điều khiển tự động:** Thực thi logic ngưỡng và PID, gửi lệnh đến các thiết bị chấp hành ảo và ghi lại lịch sử điều khiển.
- **Xử lý thị giác máy tính:**
    - Đếm chim yến: chạy YOLOv8 + ByteTrack trên video, đếm lượt ra/vào theo đường ranh giới (line crossing) ở cửa nhà yến, lưu kết quả vào SQL Server.
    - Phát hiện thiên địch: chạy YOLOv8 phát hiện chuột, rắn, cú; khi độ tin cậy vượt ngưỡng thì tạo cảnh báo kèm ảnh chụp có khung bao đối tượng.
- **Phát hiện bất thường và gửi cảnh báo:** Quét dữ liệu theo quy tắc, tạo cảnh báo và lưu lịch sử xử lý.

### d) Yêu cầu phi chức năng

- **Độ tin cậy:** Hệ thống vẫn thực thi các luật điều khiển cục bộ khi mất kết nối tạm thời; dữ liệu không bị mất nhờ cơ chế hàng đợi/thử lại.
- **Hiệu năng:** Dữ liệu cảm biến được cập nhật trên bảng điều khiển trong vòng 2 giây bằng WebSocket/MQTT; cảnh báo đến thiết bị di động trong vòng 3–5 giây; các truy vấn thống kê lịch sử phản hồi nhanh nhờ chỉ mục và phân vùng hợp lý trong SQL Server.
- **Toàn vẹn và bảo mật dữ liệu:** Thiết kế CSDL chuẩn hóa, có khóa ngoại, ràng buộc, giao dịch (transaction), phân quyền người dùng và sao lưu/phục hồi.
- **Tiết kiệm chi phí và băng thông:** Không cần phần cứng, chạy bằng phần mềm mã nguồn mở hoặc bản miễn phí (SQL Server Express/Developer, Mosquitto, Google Colab); chỉ lưu số liệu đếm tổng hợp và ảnh chụp cảnh báo thay vì lưu toàn bộ video.

### e) Lý thuyết và thực hành

Đề tài áp dụng kiến trúc IoT, mô phỏng dữ liệu cảm biến, giao thức MQTT, hệ thống điều khiển vòng kín, thiết kế và tối ưu cơ sở dữ liệu quan hệ, thị giác máy tính và học sâu (phát hiện đối tượng, theo dõi đa đối tượng).

| Lớp | Công nghệ |
| --- | --- |
| Mô phỏng | Node.js hoặc Python (script giả lập thiết bị) |
| AI / Thị giác máy tính | OpenCV, YOLOv8 nano (fine-tune trên Google Colab, 4 lớp: swiftlet, rat, snake, owl), ByteTrack, Roboflow/CVAT (gán nhãn) |
| Cơ sở dữ liệu | **Microsoft SQL Server** (T-SQL, chỉ mục, view, stored procedure, trigger, transaction, phân vùng bảng theo thời gian) |
| Backend | NodeJS / NestJS (kết nối SQL Server qua TypeORM/Prisma/mssql), **MQTT Broker Mosquitto** |
| Frontend | React.js / Next.js, TailwindCSS |
| Mobile | React Native (sử dụng **Expo**) |

### f) Sản phẩm (kết quả dự kiến)

- Một **trình mô phỏng thiết bị IoT** (cảm biến, cơ cấu chấp hành) sinh dữ liệu theo kịch bản và gửi qua Mosquitto.
- Một **mô hình AI đã huấn luyện** (YOLOv8 nano fine-tune, 4 lớp: chim yến, chuột, rắn, cú) kết hợp ByteTrack để đếm chim yến ra/vào và phát hiện thiên địch trên video, kèm báo cáo đánh giá độ chính xác (Precision/Recall).
- Một **cơ sở dữ liệu SQL Server** được thiết kế hoàn chỉnh (ERD, script tạo bảng, dữ liệu mẫu, stored procedure/view phục vụ báo cáo).
- Một **ứng dụng Web và Di động (Expo)** đầy đủ chức năng để giám sát môi trường, xem phân tích số lượng chim yến, nhận cảnh báo và quản lý điều khiển.
- Một **Backend** xử lý dữ liệu chuỗi thời gian theo thời gian thực, nhật ký đếm chim, cảnh báo và lưu ảnh chụp cảnh báo.

### g) Các nhiệm vụ đề xuất

1. **Nhiệm vụ 1:** Phân tích yêu cầu, thiết kế CSDL SQL Server (ERD, chuẩn hóa, chỉ mục, ràng buộc) và viết script tạo bảng, dữ liệu mẫu.
2. **Nhiệm vụ 2:** Xây dựng trình mô phỏng thiết bị (cảm biến, cơ cấu chấp hành, sự kiện bất thường) và gửi dữ liệu qua MQTT (Mosquitto).
3. **Nhiệm vụ 3:** Thu thập video chim yến; trích xuất và gán nhãn khung hình (dùng auto-label rồi duyệt lại); thu thập thêm ảnh và dataset cho cả 4 lớp (chim yến, chuột, rắn, cú) từ nhiều nguồn (Roboflow Universe, Kaggle, YouTube, ảnh tự chụp), thống nhất tên lớp và ghi lại nguồn từng bộ dữ liệu; huấn luyện YOLOv8 nano trên Google Colab; tích hợp ByteTrack, viết logic đếm ra/vào và ghi kết quả, cảnh báo thiên địch vào SQL Server.
4. **Nhiệm vụ 4:** Xây dựng Backend API (NodeJS/NestJS), subscribe MQTT, ghi dữ liệu vào SQL Server, cài đặt vòng điều khiển tự động, cảnh báo và kênh WebSocket.
5. **Nhiệm vụ 5:** Xây dựng Web Dashboard (React.js/Next.js) và Ứng dụng di động (React Native + Expo) cho giám sát, phân tích và nhận cảnh báo.
6. **Nhiệm vụ 6:** Chạy thử nghiệm với các kịch bản mô phỏng, đánh giá độ chính xác mô hình (Precision/Recall), hiệu năng truy vấn SQL Server và độ trễ phản hồi, kiểm thử và viết báo cáo.

## 4. Các ý kiến khác

Do hạn chế về phần cứng và theo hướng dẫn của giảng viên, dữ liệu cảm biến được mô phỏng bằng phần mềm, phần đếm chim yến và phát hiện thiên địch được thực hiện trên video thu thập sẵn thay cho camera thực tế. Dữ liệu huấn luyện thiên địch lấy từ nguồn công khai, nên độ chính xác ngoài thực tế có thể thấp hơn số liệu Precision/Recall đo được.
