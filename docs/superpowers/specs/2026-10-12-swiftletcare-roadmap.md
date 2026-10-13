# SwiftletCare — Roadmap tổng

- **Ngày:** 2026-10-12
- **Trạng thái:** Đã duyệt
- **Nguồn yêu cầu:** [Project.md](../../../Project.md)

## Bối cảnh

- Đề tài môn Hệ quản trị CSDL. Thầy chấm toàn bộ hệ thống (demo end-to-end), phần SQL Server được chấm sâu hơn.
- Nhóm 5 người (TV1–TV5), 4 tuần: 12/10/2026 → nộp 09/11/2026.
- Môi trường: SQL Server 2025 Express (chỉ Windows authentication), Node 25, Python 3.13; chưa có Docker/Mosquitto.
- Quyết định kỹ thuật chung: bảng do Prisma định nghĩa và migrate; nghiệp vụ dữ liệu bằng SP/trigger/view; SP nhận JSON (`OPENJSON`) thay TVP; mọi thời gian lưu UTC.
- Vai trò người dùng: **ADMIN** (thấy tất cả) và **OWNER** (chỉ thấy nhà của mình).

### Giả định cần nhóm xác nhận

| # | Giả định | Ảnh hưởng nếu sai |
|---|---|---|
| G1 | Mỗi người dành khoảng **3–3,5 ngày công/tuần** → năng lực nhóm ≈ **65 ngày công** | Ít hơn: cắt theo [thứ tự cắt toàn cục](#thứ-tự-cắt-toàn-cục) ngay từ M1 |
| G2 | Hạn nộp **09/11/2026** — cần xác nhận với thầy | Lùi/sớm hơn: dời các mốc M2–M4 tương ứng |

## Phần 1 — Module và phụ thuộc

| # | Module | Nhiệm vụ (Project.md) | Phụ thuộc | Chặn cả nhóm |
|---|---|---|---|---|
| 1 | `database-core` — schema, SP, trigger, view, chỉ mục, dữ liệu mẫu | NV1 | — | **Có** |
| 2 | `integration-contract` — topic/payload MQTT, REST, sự kiện WebSocket, định dạng kết quả AI, mã lỗi | (dùng chung) | — | **Có** |
| 3 | `database-advanced` — phân quyền SQL Server, transaction/đồng thời, sao lưu/phục hồi, tối ưu truy vấn (phân vùng nếu còn thời gian) | NV1 | 1 | — |
| 4 | `simulator` — giả lập cảm biến và cơ cấu chấp hành qua MQTT | NV2 | 2 | — |
| 5 | `ai-vision` — YOLOv8n + ByteTrack, đếm chim ra/vào, phát hiện thiên địch | NV3 | 2 | — |
| 6 | `backend` — NestJS: nhận MQTT, gọi SP, vòng điều khiển, cảnh báo, WebSocket | NV4 | 1, 2 | — |
| 7 | `web` — dashboard Next.js | NV5 | 2 | — |
| 8 | `mobile` — ứng dụng Expo | NV5 | 2 | — |

```
database-core ──┬─► database-advanced
                └─► backend ◄────────── integration-contract ──┬─► simulator
                       ▲                                       ├─► web
                       │ kết quả AI (MQTT hoặc HTTP)           ├─► mobile
                       └──────────── ai-vision ◄───────────────┘
```

- **ai-vision không ghi thẳng SQL Server.** Kết quả đếm chim và phát hiện thiên địch gửi cho backend (MQTT hoặc HTTP, chốt trong `integration-contract`); backend gọi SP.
- **Hai module chặn** (`database-core`, `integration-contract`) phải có spec + plan được duyệt **trong tuần 1 (trước 15/10)**. Trước đó các module khác chỉ làm phần không phụ thuộc (xem tuần 1 ở Phần 3).
- **NV6** (thử nghiệm, đánh giá, báo cáo) không là module riêng mà là **mốc xuyên suốt tuần 3–4** do TV5 phụ trách; mỗi module tự để lại phần đo của mình.

### Quy ước tài liệu

- Spec: `docs/superpowers/specs/YYYY-MM-DD-swiftletcare-<module>-design.md`; plan: `docs/superpowers/plans/YYYY-MM-DD-swiftletcare-<module>.md` (ngày = ngày bắt đầu viết).
- **Spec và plan của mọi module do agent viết hoàn chỉnh** theo quy trình superpowers (brainstorming → spec → writing-plans), trong cùng một luồng làm việc, sau khi hai module chặn được duyệt. Chủ module **đọc, xác nhận hoặc góp ý** rồi mới bắt đầu làm; không tự viết lại từ đầu, không mỗi người chạy một phiên riêng — để mọi spec bám đúng một bản `integration-contract`.
- Thay đổi hợp đồng sau khi duyệt phải sửa `integration-contract` trước, rồi mới sửa module.

## Phần 2 — Phân công và công sức

Đơn vị: ngày công. Kế hoạch dùng **57 / 65** ngày công, chừa **8 ngày đệm (≈12%)**.

| Người | Vai chính | Hỗ trợ | Công |
|---|---|---|---|
| **TV1** — CSDL | `database-core` (8), `database-advanced` (5); cùng duyệt `integration-contract` | TV2 gọi SP từ Prisma; TV5 lấy số đo hiệu năng truy vấn | **13** |
| **TV2** — Backend | `integration-contract` (chủ trì, 2), `backend` (10) | TV4 về API/WebSocket; TV3 về endpoint nhận kết quả AI | **12** |
| **TV3** — AI | `ai-vision` (11) | TV5 lấy số đo Precision/Recall | **11** |
| **TV4** — Frontend | `web` (7), `mobile` (5) | — | **12** |
| **TV5** — Tích hợp | `simulator` (4), **phụ trách mốc NV6** (5): kịch bản demo, gom số đo, báo cáo | TV3 gán nhãn tuần 1; TV4 mobile tuần 3 nếu trễ | **9** |
| | | **Tổng kế hoạch** | **57** |

Công viết spec/plan không tính vào bảng trên (agent viết); chủ module chỉ mất thời gian đọc và góp ý.

## Phần 3 — Mốc từng tuần

| Tuần | Việc chính | Đệm | Mốc kiểm tra |
|---|---|---|---|
| **T1** 12–18/10 | Duyệt roadmap. Agent viết spec + plan `database-core` và `integration-contract`; TV1, TV2 duyệt **trước 15/10**; TV1 bắt đầu migration ngay sau đó. Sau 15/10 agent viết spec + plan `simulator`, `ai-vision`, `backend`, `web`, `mobile`; chủ module đọc, xác nhận trước 18/10. Song song, chỉ làm phần **không phụ thuộc**: TV3 + TV5 thu thập và gán nhãn dữ liệu; TV4 dựng khung web/mobile bằng dữ liệu giả; TV5 dựng khung simulator; TV2 dựng khung NestJS. | 1 | **M1 (18/10):** 2 module chặn đã duyệt; migration chạy được; spec 5 module còn lại đã được chủ module xác nhận; ≥ 60% dữ liệu đã gán nhãn |
| **T2** 19–25/10 | **20/10:** `database-core` xong migration + `sp_IngestReadings` + `sp_SetActuator` → backend và simulator nối vào luồng M2. Sau đó các SP còn lại, test, dữ liệu mẫu. Backend nhận MQTT, auth; simulator publish; train YOLO trên Colab; web nối API thật. Agent viết spec + plan `database-advanced` (TV1 xác nhận trước 22/10). | 2 | **M2 (25/10):** luồng **simulator → MQTT → backend → SP → SQL Server → web** chạy được |
| **T3** 26/10–01/11 | `database-advanced`; backend: điều khiển theo luật, cảnh báo, endpoint AI; AI tích hợp đếm chim + thiên địch qua backend; web đủ chức năng; mobile phần lõi. **NV6:** TV5 viết kịch bản demo, viết các chương CSDL của báo cáo từ spec, **tập demo lần 1 ngày 01/11**. | 2 | **M3 (01/11):** mọi mục Bắt buộc trên ranh giới cắt chạy end-to-end; quyết định giữ/cắt các mục dưới ranh giới |
| **T4** 02–08/11 | Sửa lỗi; mục dưới ranh giới / Nên có nếu còn sức. **NV6:** đo Precision/Recall, độ trễ (≤ 2 s dashboard, 3–5 s cảnh báo), hiệu năng truy vấn trước/sau chỉ mục; **tập demo lần 2 ngày 05/11**; báo cáo xong 07/11; **tập lần cuối 08/11**. | 3 | **M4 (09/11):** nộp |

## Phần 4 — Ưu tiên và ranh giới cắt trong từng module

Mục Bắt buộc xếp theo thứ tự ưu tiên (làm từ trên xuống). Mục dưới **ranh giới cắt** vẫn là Bắt buộc theo kế hoạch nhưng **bị cắt đầu tiên** nếu trễ. Ngoài nhóm Bắt buộc còn mức **Nên có** và **Nếu còn thời gian**.

### Thứ tự cắt toàn cục

Tại M2 hoặc M3, module nào chậm hơn mốc thì cắt theo thứ tự:

1. Mục **Nếu còn thời gian** của module đó.
2. Mục **Nên có** của module đó.
3. **Báo cáo sản lượng** trên toàn hệ thống: bảng Harvests, `sp_Report_EnvStabilityVsYield`, API báo cáo, màn hình nhập thu hoạch và báo cáo tương quan.
4. **Cảnh báo thiết bị mất kết nối** trên toàn hệ thống: `trg_Devices_Status`, phần đánh dấu OFFLINE trong `sp_DetectAnomalies`, kịch bản mất kết nối của simulator.

Mục Bắt buộc trên ranh giới không cắt; người hỗ trợ (Phần 2) chuyển sang giúp module đang chậm.

### database-core (TV1)

Bắt buộc:
1. Migration các bảng lõi (người dùng, nhà, khu vực, thiết bị, chỉ số, ngưỡng, số đo, nhật ký điều khiển, cảnh báo, lịch sử cảnh báo) + chỉ mục `SensorReadings` + chỉ mục unique có lọc `UX_Alerts_OpenThreshold` (lưới an toàn chống mở trùng cảnh báo ngưỡng) — **xong 20/10**
2. `sp_IngestReadings` (thu nhận + mở/đóng cảnh báo ngưỡng) — **xong 20/10**
3. `sp_SetActuator` (điều khiển tự động/thủ công + nhật ký) — **xong 20/10**
4. `trg_Alerts_History`, `sp_UpdateAlertStatus`
5. View `vw_LatestReadings`, `vw_OpenAlerts`, `vw_DailyEnvStats`; `sp_GetReadingHistory`
6. BirdCounts + `sp_RecordBirdCount` + `vw_DailyBirdFlow`
7. `sp_CreatePredatorAlert` (chống báo trùng)
8. Phần giảm đàn của `sp_DetectAnomalies`
9. Dữ liệu mẫu

─── ranh giới cắt ───

10. Harvests + `sp_Report_EnvStabilityVsYield`
11. `trg_Devices_Status` + phần OFFLINE của `sp_DetectAnomalies`

Nên có: NestLogs.

### integration-contract (TV2, TV1 cùng duyệt)

Bắt buộc:
1. Topic và payload MQTT (số đo cảm biến, lệnh cơ cấu chấp hành, trạng thái thiết bị)
2. Định dạng kết quả AI gửi backend (đếm chim theo cửa sổ, phát hiện thiên địch kèm ảnh)
3. REST API (xác thực, CRUD, điều khiển, cảnh báo, lịch sử, đếm chim) và mã lỗi
4. Sự kiện WebSocket (số đo trực tiếp, cảnh báo mới/đổi trạng thái, trạng thái thiết bị)

─── ranh giới cắt ───

5. API báo cáo sản lượng và nhập thu hoạch
6. Sự kiện thiết bị mất kết nối

Nên có: file JSON mẫu cho từng payload (dùng làm fixture test).

### database-advanced (TV1)

Bắt buộc:
1. Phân quyền: login/user/role theo quyền tối thiểu (backend chỉ EXECUTE các SP cần thiết, tài khoản chỉ đọc cho báo cáo)
2. Transaction và đồng thời: kịch bản 2 phiên minh họa lost update, deadlock và cách xử lý (isolation level, `UPDLOCK`)
3. Sao lưu/phục hồi: full + differential + log, khôi phục về thời điểm
4. Tối ưu: so sánh execution plan trước/sau chỉ mục trên vài triệu dòng `SensorReadings`, gồm bài thêm `INCLUDE (Value)` vào `UQ(DeviceId, MetricCode, RecordedAt)` (Key Lookup → biến mất)

Nên có: lịch sao lưu bằng `sqlcmd` + Windows Task Scheduler (Express không có SQL Agent). Nếu còn thời gian: phân vùng `SensorReadings` theo tháng.

### simulator (TV5)

Bắt buộc:
1. Cảm biến theo khu vực publish số đo qua MQTT
2. Kịch bản cấu hình được: bình thường, nóng, khô
3. Nhận lệnh cơ cấu chấp hành và phản ánh lên số đo

─── ranh giới cắt ───

4. Kịch bản mất kết nối

Nên có: nhiễu và quán tính nhiệt. Nếu còn thời gian: giao diện chọn kịch bản.

### ai-vision (TV3)

Bắt buộc:
1. Bộ dữ liệu 4 lớp (swiftlet, rat, snake, owl) có ghi nguồn; train YOLOv8n trên Colab
2. ByteTrack + đếm ra/vào theo vạch trên video mẫu
3. Phát hiện thiên địch kèm ảnh chụp có khung bao
4. Gửi kết quả cho backend theo `integration-contract`
5. Báo cáo Precision/Recall

Nên có: video đầu ra có khung bao để web phát. Nếu còn thời gian: xử lý luồng trực tiếp.

### backend (TV2)

Bắt buộc:
1. Khung NestJS + Prisma + gọi SP; JWT ADMIN/OWNER + kiểm tra quyền sở hữu nhà
2. MQTT → `sp_IngestReadings` → phát WebSocket
3. CRUD nhà, khu vực, thiết bị, ngưỡng
4. Vòng điều khiển **theo luật** → `sp_SetActuator` → publish MQTT; điều khiển tay
5. Cảnh báo: đọc, ACK/RESOLVED, phát WebSocket
6. Endpoint nhận kết quả AI → `sp_RecordBirdCount` / `sp_CreatePredatorAlert`; lưu ảnh chụp
7. Gọi `sp_DetectAnomalies` định kỳ (phần giảm đàn)
8. API lịch sử số đo và đếm chim

─── ranh giới cắt ───

9. API thu hoạch và báo cáo sản lượng
10. Phát sự kiện thiết bị mất kết nối

Nên có: điều khiển PID, gửi email. Nếu còn thời gian: Zalo.

### web (TV4)

Bắt buộc:
1. Đăng nhập; dashboard số đo trực tiếp
2. Điều khiển tay cơ cấu chấp hành
3. Danh sách cảnh báo, ACK/RESOLVED, ảnh thiên địch
4. Quản lý nhà, khu vực, thiết bị, ngưỡng
5. Biểu đồ lịch sử môi trường và đếm chim ra/vào

─── ranh giới cắt ───

6. Màn hình nhập thu hoạch và báo cáo tương quan
7. Hiển thị trạng thái mất kết nối

Nên có: xem khung hình có khung bao. Nếu còn thời gian: xuất Excel/PDF.

### mobile (TV4)

Bắt buộc:
1. Đăng nhập; dashboard số đo trực tiếp
2. Danh sách cảnh báo + ACK
3. Điều khiển tay

Nên có: Expo push notification. Nếu còn thời gian: biểu đồ, nhập thu hoạch.
