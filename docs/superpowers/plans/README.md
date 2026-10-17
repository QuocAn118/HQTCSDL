# Plan triển khai SwiftletCare — thứ tự, người làm, mốc, PR hợp đồng

Mỗi plan làm bằng `superpowers:executing-plans` (cách Native): từng task viết test trước, chạy cho fail, code cho đạt, commit. Mỗi module một nhánh, vào `main` qua PR (ít nhất một người duyệt; PR hợp đồng cần cả TV2 và TV1). Đọc spec của module trước khi mở plan.

## Thứ tự thực thi và người làm

| Thứ tự | Plan | Người làm | Bắt đầu khi | Ghi chú |
|---|---|---|---|---|
| 1 | [database-core](2026-10-14-swiftletcare-database-core.md) | TV1 | Ngay (sau khi duyệt) | Chặn mọi module khác; giao `sp_IngestReadings`, `sp_SetActuator` **trước 20/10** |
| 1 | [integration-contract](2026-10-14-swiftletcare-integration-contract.md) | TV2 (TV1 cùng duyệt) | Song song với database-core | Fixture, `contracts/lib`, Mosquitto; mở **PR hợp đồng số 1** |
| 2 | [backend](2026-10-16-swiftletcare-backend.md) | TV2 | Task 1–5 ngay (không cần CSDL); Task 6+ khi có migration | Task 3 mở **PR hợp đồng số 2**; SP chưa có thì dùng SP giả (Task 6) |
| 2 | [simulator](2026-10-16-swiftletcare-simulator.md) | TV5 | Ngay; Task 2 cần `contracts/lib/seed-refs.mjs` (PR số 1) | Cần Mosquitto (plan hợp đồng Task 2) cho kiểm tay |
| 2 | [ai-vision](2026-10-16-swiftletcare-ai-vision.md) | TV3 (TV5 cùng gán nhãn tuần 1) | Ngay: Task 1–2 trước M1 | Test hình dạng cần fixture AI (PR số 1); kiểm tay cần backend Task 19 (trước 29/10) |
| 3 | [web](2026-10-16-swiftletcare-web.md) | TV4 | Task 1–5 ngay (hàm thuần); Task 6+ khi backend có REST | Làm **trước** mobile vì mobile chép 5 file từ web |
| 4 | [mobile](2026-10-16-swiftletcare-mobile.md) | TV4 (TV5 hỗ trợ tuần 3 nếu trễ) | Task 1 (kiểm gọi HTTP từ Expo Go) ngay; Task 2+ sau web Task 2–5 | Hỏi nhóm ai có iPhone/Android trước Task 1 |
| — | database-advanced | TV1 | Spec + plan **chưa viết** (roadmap: agent viết, TV1 xác nhận trước 22/10) | |

Số "thứ tự" giống nhau là chạy song song. Người hỗ trợ chuyển sang module đang chậm theo roadmap.

## Mốc tuần (roadmap Phần 3)

| Tuần | Mốc | Phải có |
|---|---|---|
| T1 12–18/10 | **M1 (18/10)** | database-core và integration-contract đã duyệt, migration chạy; Task 1 (bước kiểm chứng) của backend, simulator, ai-vision, web, mobile xong; ai-vision Task 2; ≥ 60% dữ liệu gán nhãn |
| T2 19–25/10 | 20/10: SP nhận số đo và điều khiển; **M2 (25/10)** | Luồng simulator → MQTT → backend → SP → SQL Server → web chạy (backend Task 1–17, simulator Task 1–7, web Task 1–7); ai-vision train trên Colab |
| T3 26/10–01/11 | Trước 29/10: backend Task 19 (endpoint AI); **M3 (01/11)**, tập demo lần 1 | Mọi mục Bắt buộc chạy đầu-cuối; ai-vision đóng băng trọng số; quyết định giữ/cắt mục dưới ranh giới cắt |
| T4 02–08/11 | 04/11: ai-vision giao số đo; 05/11 tập lần 2; 07/11 báo cáo; 08/11 tập cuối | Sửa lỗi; mục dưới ranh giới cắt nếu còn sức; đo độ trễ, Precision/Recall |
| | **M4 (09/11)** | Nộp |

## PR hợp đồng cần mở, theo thứ tự (TV2 và TV1 cùng duyệt)

Mỗi PR sửa **spec integration-contract và `contracts/fixtures/` trong cùng PR**; merge xong báo cả nhóm (trường đổi, module ảnh hưởng). Module chỉ sửa theo sau khi PR đã merge.

| # | PR | Nội dung | Mở khi | Module ảnh hưởng |
|---|---|---|---|---|
| 1 | Hợp đồng gốc | Toàn bộ plan integration-contract: `contracts/lib/{fixtures,seed-refs}.mjs`, fixture `mqtt/`, `ai/`, `rest/`, `ws/`, bổ sung spec (B1–B10), Mosquitto | Theo plan hợp đồng | Tất cả |
| 2 | Bổ sung từ backend | plan backend Task 3: (1) sửa câu "simulator/AI dùng `fixtures.mjs`" (AI chỉ đối chiếu kiểu); (2) `POST /api/admin/anomalies/detect`; (3) thân 503 của `/api/health`; (4) `503 RETRY_LATER` khi CSDL chưa sẵn sàng; (5) Socket.IO: đổi vai trò → ngắt, `data.code` ∈ {`UNAUTHENTICATED`, `RETRY_LATER`}; (6) 2.1: **26** kết nối, không phải 28; (7) cách chốt ACL với `contract-test`/`latency-probe`; (8) 4.1: `device.state` không ghép theo `at` (REST `devices` không có mốc trạng thái) mà theo cách của spec web 2.4: giữ sự kiện đến trong lúc REST tải, áp REST rồi áp lại theo thứ tự đến (đã duyệt ở rà chéo 17/10); kèm 4 fixture mới | **Sau khi PR số 1 merge** (cùng sửa spec 4.3) | backend, web, mobile, simulator, ai-vision |

Chỉ có hai PR hợp đồng; không mở PR riêng cho mục (8).

Không mở PR hợp đồng song song khi hai PR cùng sửa một mục của spec hợp đồng.
