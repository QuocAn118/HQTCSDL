# Trạng thái task AI Vision — 05/11/2026

| Task | Trạng thái | Bằng chứng / phần còn thiếu |
|---|---|---|
| 1 | Môi trường đang dùng đạt | Python3.12.10, bản ghim, pip check; chưa cài sạch lại, py launcher không có; spikes/RESULTS.md ghi rõ mọi mục chưa kiểm |
| 2–11 | Code và kiểm thử đạt | Hình học vạch, thời gian, config, log/lock, queue, confirmer, snapshot, payload, sender, video/detector; suite330test+6subtest |
| 12 | Runtime và tín hiệu console thật đạt | Offline/live, flush/lock; tín hiệu CTRL_C_EVENT một lầnexit0, hai lầnexit130, khóa xóa; không nhận là bấm bàn phím tay |
| 13 | Train/release đạt; audit nguồn chưa trọn | V3best.pt50epoch, URL/hashfrozen; R05giấy phép gốc chưa xác minh. V4pilot riêng, không thay model |
| 14 | Đã làm | Annotated video và script nhiều camera có code/test; không commit media |
| 15 | Đủ nhóm CSV số đo; còn giới hạn phương pháp | speed, fixedP/R, AP, events, counting, false_alarms(V08), offline_vs_live. ĐếmV03 là fallback/ngắn/agentthamchiếu, chưa TV5đếm lại. Có lượt test bổ sung được công khai, không tune theo test |
| 16 | Tích hợp Dev đã kiểm | Live602,98giây, snapshot chuột thật, heartbeat/countHTTP200, restartowlCOOLDOWN, tổng cuối APIkhớp, khóa xóa; e2e.md |

## Hai sửa lỗi sau review độc lập

1. CSVoffline mất giây lẻ khiến scoring sai gần ranh giới: thêm media_seconds,
   giữ nguyên HTTPUTC/fixture. Test ranh giới red→green; đo lại cùng dữ liệu,
   giữ nguyên điểm toàn clip và lưu dấu vết sửa phép đo.
2. eval_detector.py có thể đè detector.csv cố định bằng P/R chọn F1:
   mặc định ra detector_ultralytics.csv, ép CPU, có test chống ghi đè red→green.
   APthực tế đo bổ sung riêng detector_map.csv; detector.csv không đổi hash.

## Còn cần xác nhận bên ngoài để gọi toàn bộ plan hoàn tất

- Giấy phép gốcR05: đã thử trang gốc/browse/search, vẫn403 hoặc không có bằng
  chứng; người dùng đồng ý giữ chưa xác minh. Không giả địnhCCBYtừ bản saoZIP.
- TV5/người nhóm đếm lại độc lập theo yêu cầu20%: agent đã tự kiểm bản tham
  chiếuV03, không thể ký thay một người độc lập. Không có dữ liệu này để ghi.
- Ctrl+Cconsolethật một/hai lần đã kiểm; không nhận là thao tác bàn phím tay.
  Đã đọc NTPtime.windows.com lệch khoảng+1,14giây sau live, không bật tự đồng bộ
  hoặc nhận là biết offset tại thời điểm live trước đó. Đây là giới hạn bằng chứng.
- Không có PR/người nhóm duyệt: người dùng chủ động yêu cầu pushmain trực tiếp.

Không đặt ngưỡng đạt độ chính xác ngoài spec. Owl/swiftlet testảnh yếu,
V08nhận sai rat ở nền; giữ số đo thấp, không gọi mô hình đã sẵn sàng triển khai.
