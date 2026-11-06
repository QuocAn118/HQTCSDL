# Kết quả bước kiểm chứng simulator

Chạy lại ngày 06/11/2026 trên Windows 10, Node v25.8.0, Mosquitto 2.x, `mqtt` 5.16.1.

| Mã | Mục (spec) | Cách kiểm | Kết quả | Ngày |
|---|---|---|---|---|
| S1 | `node --env-file` khi thiếu file; bản Node (1.2) | Chạy `node --env-file=.env src/main.mjs` khi chưa có `.env`, rồi `npm start` | **Đạt.** Node báo `node: .env: not found`. `npm start` nay dừng trước với câu `Chua co simulator/.env, chep tu .env.example` | 06/11 |
| S2 | `mqtt` 5.16.1 cài được, ghim chính xác (1.2) | `npm ci`, `test/repo.test.mjs` | **Đạt.** | 06/11 |
| S3 | 26 kết nối cùng tài khoản `simulator` (3.5) | `node --env-file=.env spikes/connections.mjs` trên Mosquitto thật | **Đạt.** `ket noi duoc 26/26` | 06/11 |
| S4 | Cách A của `--drop` (2.6, 3.5) | `node --env-file=.env spikes/drop-a.mjs` trên Mosquitto thật | **Cách A không đạt, giữ cách B.** Nhận `1` trong lúc ngắt, sau khi kết nối lại vẫn chỉ `1`: `CACH A KHONG DAT` | 06/11 |
| S5 | ACL xung đột với `contract-test`/`latency-probe` (3.4) | Broker tạm cổng 1884 với ACL của plan hợp đồng Task 7, tài khoản `simulator`, publish QoS 1 vào `H1-F1-SENSOR/readings`, tài khoản `backend` nhận | **Xung đột có thật.** Client `H1-F1-SENSOR`: nhận được. `contract-test`, `latency-probe`: không nhận được. Khớp quyết định "máy dev/test không bật ACL" (hợp đồng Phần 2). Repo chưa có file `infra/mosquitto/acl`, nên chưa kiểm ACL trên máy demo | 06/11 |
| S6 | Ctrl+C qua `npm start` trên Windows (1.6) | `cmd /c npm start` trong console riêng, gửi Ctrl+C bằng `GenerateConsoleCtrlEvent`, không bấm phím thật | **Đạt phần dừng.** Trong 5 giây, tiến trình simulator và npm đều thoát. `cmd.exe` gốc còn sống, khớp câu hỏi `Terminate batch job (Y/N)?`, nhưng console ẩn nên không đọc được câu chữ. Chưa kiểm bằng bàn phím | 06/11 |
| S7 | τ = 3 phút, chu kỳ ≈ 7 phút (`hot`), ≈ 6 phút (`dry`) (3.5) | `result/e2e.md`, thời điểm lấy từ `ControlLogs` | **Đạt.** `hot`: 7 phút 11 giây và 6 phút 51 giây. `dry`: 6 phút 31 giây và 6 phút 30 giây | 06/11 |
