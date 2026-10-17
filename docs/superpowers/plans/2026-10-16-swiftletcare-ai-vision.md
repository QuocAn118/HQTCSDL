# SwiftletCare ai-vision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Người thực thi:** TV3, theo cách Native (`superpowers:executing-plans`) trên máy mình — không dùng subagent-driven. Mỗi task: viết test trước, chạy cho fail, code cho đạt, commit. Không bỏ bước test. Khi mô hình cho kết quả lạ (đếm sai chiều, không xác nhận được thiên địch) dùng `superpowers:systematic-debugging` trước khi sửa.

## Trước khi chạy

Chạy trong PowerShell ở gốc repo:

```powershell
py -0p                          # liệt kê các bản Python đã cài (cần Python Launcher)
git status                      # sạch, đang ở nhánh ai-vision (git switch -c ai-vision nếu chưa có)
w32tm /query /status            # đồng hồ máy có đồng bộ (spec 4.6 "chưa kiểm chứng")
```

- **Máy viết plan (16/10/2026) chỉ có Python 3.13.9, không có 3.12.** Spec 3.1 chốt 3.12, lùi 3.11 nếu không được. Task 1 Step 1 xử lý: cài 3.12 trước; **không tự dùng 3.13** khi chưa sửa spec (TV3 là chủ spec, sửa thì ghi lý do vào spec 3.1 và báo nhóm).
- Video, ảnh, dataset, `best.pt` đặt trong `ai-vision/data/` (đã gitignore). **Chạy `git status` trước mỗi lần commit**, không có video, ảnh, trọng số, `.env` trong thay đổi.
- Lúc viết plan (17/10/2026), code và test của Task 2–15 đã được chạy thử **ngoài repo** trên Python 3.13 với supervision 0.30.9, OpenCV 5.0.0, NumPy 2.5.4, không có torch/Ultralytics, cùng bộ fixture AI dựng theo plan hợp đồng: 239 test đạt, 1 bỏ qua (mô hình thật). Phần gọi Ultralytics (`Detector`, `measure_speed.py`, `eval_detector.py`, notebook) **chưa chạy thử**.
- Không cần CSDL, Mosquitto hay backend cho Task 1–14. Task 16 (kiểm tay đầu-cuối) cần backend thật đã xong Task 19 của plan backend (mốc trước 29/10).

## Mốc

| Mốc | Phải xong |
|---|---|
| **16/10 (muộn nhất)** | Tìm xong video; dưới 2 video đúng góc thì chuyển phương án dự phòng (spec 1.3) |
| **18/10 (M1)** | Task 1 (bước kiểm chứng), Task 2 (test tổng hợp vạch đếm); gán nhãn ≥ 60% (TV3 + TV5); `SOURCES.md`, `splits.csv` có nguồn đã dùng |
| **Tuần 2 (19–25/10)** | Train trên Colab (Task 13); Task 3–11 |
| **Trước 29/10** | Task 12 (`live`/`offline` chạy được với trọng số thật) |
| **29/10–31/10** | Task 16 (kiểm tay đầu-cuối với backend thật) |
| **01/11 (M3)** | Đóng băng trọng số và cấu hình; bắt đầu đo trên tập test (Task 15) |
| **04/11** | Giao CSV + `results/README.md` cho TV5 |

Hết 25/10 mà chưa có `best.pt` nạp được trên máy nhóm thì TV3 báo nhóm ngay (người hỗ trợ theo roadmap); Task 3–12 vẫn làm được vì test không cần trọng số.

**Goal:** Dựng `ai-vision/` — chương trình Python đếm chim yến ra/vào qua vạch theo cửa sổ 5 phút và phát hiện thiên địch trên video phát lại, gửi kết quả cho backend qua HTTP đúng hợp đồng mục 2.4, kèm script dữ liệu/train và số đo cho báo cáo.

**Architecture:** Gói `swiftletcare_ai/` chia theo trách nhiệm: hàm thuần (thời gian, cấu hình, cửa sổ, xác nhận thiên địch, payload, chỉ số đo) test không cần mô hình; `counting.py` là chỗ **duy nhất** nói chuyện với vạch đếm supervision; `sender.py` là luồng gửi riêng có hàng đợi, là chỗ **duy nhất** gọi HTTP; `app.py` ráp lại thành hai lệnh `live` và `offline`. Phụ thuộc bên ngoài (mô hình, video, đồng hồ, HTTP) đưa vào qua tham số để test thay bằng bản giả.

**Tech Stack:** Python 3.12 (Windows, `ai-vision\.venv`), torch 2.14.1 + torchvision 0.29.1 (CPU, PyPI), ultralytics 8.4.178, supervision 0.30.9, requests 2.34.2, PyYAML 6.0.3, pytest 9.1.1, opencv-python 5.0.0.93, numpy 2.5.4 (hai gói cuối là bản đã dùng khi chạy thử 239 test). Số phiên bản là bản mới nhất trên PyPI ngày 16/10/2026 (`pip index versions`); torch, torchvision, ultralytics **chưa cài thử** — Task 1 chốt.

**Spec:** [docs/superpowers/specs/2026-10-15-swiftletcare-ai-vision-design.md](../specs/2026-10-15-swiftletcare-ai-vision-design.md) · hợp đồng: [integration-contract](../specs/2026-10-13-swiftletcare-integration-contract-design.md) mục 2.4 · fixture AI: [plan hợp đồng](2026-10-14-swiftletcare-integration-contract.md) Task 4 · endpoint: [plan backend](2026-10-16-swiftletcare-backend.md) Task 19 (Task 26 cho heartbeat)

## Global Constraints

- Python 3.12, môi trường ảo `ai-vision\.venv`; mọi lệnh gọi `.\.venv\Scripts\python`, không dùng `Activate.ps1`. Lệnh chạy trong thư mục `ai-vision\`.
- `requirements.txt` ghim `==` đúng chín gói: `torch`, `torchvision`, `ultralytics`, `supervision`, `requests`, `PyYAML`, `pytest`, `opencv-python`, `numpy` (code import thẳng `cv2`, `numpy`). Không `pip freeze`. Notebook Colab chỉ cài `ultralytics==…` và `supervision==…`, trùng `requirements.txt`.
- Lớp: `swiftlet`, `rat`, `snake`, `owl` — chữ thường, gửi thẳng tên lớp thiên địch sang backend.
- Danh sách camera cố định trong code: `H1-F0-CAMERA`, `H2-F0-CAMERA`.
- `.env`: `BACKEND_URL` (mặc định mẫu `http://localhost:3000`), `AI_SERVICE_KEY` (trống trong mẫu), `SNAPSHOT_MAX_BYTES` (mặc định `2097152`). **Không bao giờ in `AI_SERVICE_KEY` ra log hay màn hình**, kể cả khi 401.
- Mốc thời gian gửi đi: UTC, dạng `YYYY-MM-DDTHH:MM:SSZ`. `windowStart` tròn 5 phút, giây `00`. AI không bao giờ gửi chuỗi thiếu `Z`, `+07:00`, số âm, lớp lạ.
- HTTP: header `X-Service-Key`, timeout kết nối 5 giây, đọc 10 giây; multipart để `requests` tự sinh `Content-Type` (không tự đặt). Lô đếm ≤ 500 phần tử.
- Thử lại thiên địch sau **5, 15, 30, 60, 120** giây (tối đa 5 lần), hết thì nhả cooldown. Cửa sổ đếm đóng quá **60 phút** chưa gửi được thì bỏ. Gửi tổng mỗi **60** giây, heartbeat mỗi **30** giây. Ctrl+C gửi nốt tối đa **10** giây.
- Ảnh: JPEG chất lượng **90**; quá `SNAPSHOT_MAX_BYTES` thì thu nhỏ **75%** và mã hóa lại tới khi đủ nhỏ.
- Log: JSON Lines, ghi màn hình và **nối thêm** vào `data\logs\<mã camera>.log`; trường chung `ts`, `level`, `camera`, `type`.
- Không đưa vào git: `ai-vision/.venv/`, `ai-vision/data/`, `*.pt`, `ai-vision/.env`, video, ảnh, dataset. **Không tạo hay ghi đè `.gitignore` gốc** (đã có, đã chứa bốn dòng ai-vision); chỉ thêm dòng còn thiếu.
- File `.ps1` chỉ ký tự ASCII (PowerShell 5.1).
- Chuỗi trong code và log viết **không dấu** (tránh lỗi mã hóa console Windows); tài liệu (README, SOURCES) viết có dấu.
- Commit message tiếng Việt, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Đường dẫn video trong playlist có dấu tiếng Việt hoặc ký tự ngoài ASCII** (thư mục `Tài liệu`, tên file `Yến 01.mp4`) — OpenCV trên Windows thường không mở được đường dẫn như vậy; người dùng mong bị báo ngay lúc khởi động, kèm gợi ý đổi tên, không phải "không mở được video" mơ hồ giữa buổi demo. Test thêm ở Task 4 (`load_camera_config`).
2. **File `.env` hoặc YAML lưu bằng Notepad có BOM** — khóa đầu tiên thành `﻿BACKEND_URL`; người dùng mong chương trình vẫn đọc đúng. Test thêm ở Task 4 (`read_env_file`, `load_camera_config`).
3. **Đồng hồ máy nhảy lùi giữa chừng** (Windows đồng bộ giờ) làm `at` rơi về cửa sổ 5 phút trước — người dùng mong tổng đã gửi của mỗi cửa sổ không bao giờ giảm và không có lỗi. Test thêm ở Task 6 (`WindowCounter` + `CountQueue`).
4. **Video có fps đọc ra 0 hoặc NaN** (metadata hỏng, một số file `.mkv`/`.webm`) — người dùng mong dừng ngay với tên file và camera, không chia cho 0 hay đứng im. Test thêm ở Task 11 (`VideoPlayer`).
5. **Backend trả 200 nhưng thân không phải JSON** (proxy, route lạ) — người dùng mong luồng gửi không chết; ghi log và coi như đã gửi. Test thêm ở Task 10 (`Sender`).

## Cấu trúc file

```
ai-vision/
  README.md  SOURCES.md  splits.csv  weights.json  requirements.txt  .env.example  pytest.ini
  cameras/H1-F0-CAMERA.yaml  cameras/H2-F0-CAMERA.yaml
  swiftletcare_ai/
    __init__.py
    __main__.py        argparse: live | offline
    timeutil.py        utc_iso, window_start, parse_utc, SystemClock, FakeClock
    config.py          CAMERAS, lớp, ConfigError, CameraConfig, load_camera_config, read_env_file, load_env, check_confirm_fps
    logjson.py         JsonLog (JSON Lines, kiểm trường theo type)
    lockfile.py        acquire, release, LockExists
    counting.py        LineCounter — chỗ DUY NHẤT dùng sv.LineZone và ánh xạ chiều
    windows.py         WindowCounter, CountQueue
    predators.py       Box, Confirmed, Blocked, PredatorConfirmer
    snapshot.py        draw_boxes, encode_within, encode_snapshot, shrink_jpeg
    payloads.py        counts_payload, predator_metadata, heartbeat_payload
    sender.py          Sender (luồng gửi, bảng mã trả về, thử lại, heartbeat, drain), Fatal, PendingEvent
    video.py           VideoPlayer (playlist, bỏ khung theo giờ thật, khung lỗi), VideoOpenError, Frame
    detector.py        Detector (Ultralytics), measure_fps
    pipeline.py        Pipeline (tracker + vạch + cửa sổ + thiên địch cho một khung)
    app.py             Deps, Timing, run_live, run_offline
    metrics.py         chỉ số Phần 6 (hàm thuần)
  scripts/
    download_weights.py  split_dataset.py  start-cameras.ps1      (Task 13, 14)
    evaluate.py  measure_speed.py  eval_detector.py              (Task 15)
  spikes/              script kiểm chứng Task 1 + RESULTS.md
  train/train.ipynb
  tests/
    conftest.py  fakes.py  fake_backend.py  shapes.py  test_*.py
  results/             CSV số đo + events_gt.csv + counting_segments.csv + README.md + e2e.md (commit, Task 15–16)
  data/                KHÔNG vào git: videos/, dataset/, weights/best.pt, out/, logs/, run/
```

## Phụ thuộc vào module khác và cách làm khi chưa có

| Cần | Của | Chưa có thì |
|---|---|---|
| `contracts/fixtures/ai/` (13 JSON + `snake.jpg` + `not-jpeg.png`) | plan hợp đồng Task 4 (PR của TV2) | Test hình dạng (Task 9) và test camera (Task 4) **fail có chủ ý** với thông báo "chua co contracts/fixtures/ai" (spec 7.3). Các task khác làm tiếp. **Không** tạo fixture giả trong `contracts/`; ảnh thử cho Task 8 tự sinh trong test khi chưa có `snake.jpg` |
| Endpoint `POST /api/ai/bird-counts`, `/predator-detections` | plan backend Task 19 (mốc trước 29/10) | Mọi test dùng backend giả (`tests/fake_backend.py`); Task 16 chờ backend thật |
| `POST /api/ai/heartbeat` | plan backend Task 26 (**dưới ranh giới cắt**) | Heartbeat **tắt mặc định**, bật bằng cờ `--heartbeat` (Task 14). Bật khi backend chưa có route sẽ nhận 404 → AI dừng theo bảng 5.3 |
| Hai mã camera `H1-F0-CAMERA`, `H2-F0-CAMERA` trong seed | database-core (TV1) | Cố định trong code; đổi mã phải qua PR hợp đồng |
| CSDL `SwiftletCare_Dev` có dữ liệu mẫu | plan database-core | Chỉ cần cho Task 16 |
| Câu "simulator/AI dùng `fixtures.mjs`" trong plan hợp đồng | PR hợp đồng của TV2 (plan backend Task 3 mục 1) | ai-vision không tự sửa; test Python chỉ kiểm kiểu (spec 1.5) |
| Video và ảnh có giấy phép, nhãn | TV3 + TV5 (tuần 1) | Test không cần; Task 13 chờ dữ liệu |
| `best.pt` | Task 13 (Colab) | Test cần mô hình tự `skip` kèm lý do |

## Ngoài phạm vi

- Train trên máy nhóm; GPU; ONNX (chỉ làm khi Task 15 đo thấy không thỏa điều kiện fps ở cả độ phân giải giảm — cần PR riêng).
- Xử lý luồng camera trực tiếp (RTSP); lưu trạng thái cửa sổ đếm qua các lần khởi động lại.
- Ghi thẳng SQL Server; đổi payload, endpoint, mã camera (đi qua PR hợp đồng).
- Cách web lấy video đầu ra (`--annotated-video` chỉ ghi file; spec web chưa dùng).
- Sửa fixture trong `contracts/`, sửa `fixtures.mjs`.
- Tự dò tiến trình còn sống để xóa file khóa.

## Quy ước viết test

- pytest, file `tests/test_<module>.py`, không mạng thật (backend giả chạy trên `127.0.0.1` cổng ngẫu nhiên), không cần `best.pt`.
- Đồng hồ: `FakeClock` (Task 3). Khoảng thời gian (60 s, 30 s, lịch thử lại, 10 s) truyền qua `Timing` (Task 12) hoặc tham số hàm để rút ngắn.
- Chạy: `.\.venv\Scripts\python -m pytest` trong `ai-vision\`. Một file: `.\.venv\Scripts\python -m pytest tests/test_x.py -v`.

---

### Task 1: Môi trường, ghim phiên bản, kiểm chứng mọi mục "chưa kiểm chứng" của spec

**Files:**
- Create: `ai-vision/requirements.txt`, `ai-vision/.env.example`, `ai-vision/pytest.ini`, `ai-vision/swiftletcare_ai/__init__.py`, `ai-vision/tests/test_repo_rules.py`, `ai-vision/spikes/check_supervision.py`, `ai-vision/spikes/check_ultralytics.py`, `ai-vision/spikes/check_multipart.py`, `ai-vision/spikes/check_unicode_path.py`, `ai-vision/spikes/RESULTS.md`, `ai-vision/README.md` (khung, hoàn thiện ở Task 14)
- Modify: `.gitignore` gốc **chỉ khi thiếu dòng** (Step 6)

**Interfaces:**
- Consumes: không.
- Produces: `.venv` cài đủ gói; `spikes/RESULTS.md` ghi chữ ký thật của `sv.LineZone`, `sv.ByteTrack`, `sv.Detections.from_ultralytics`, tên trường kết quả val của Ultralytics — **Task 2, 11, 15 đọc file này trước khi code**; hằng `PINNED` trong `tests/test_repo_rules.py`.

- [ ] **Step 1: Chốt bản Python (S1)**

```powershell
py -0p
py -3.12 --version
```

Expected: có dòng `-V:3.12` và `Python 3.12.x`.

Không có 3.12: tải bộ cài **Windows installer (64-bit)** của bản 3.12 mới nhất từ `https://www.python.org/downloads/windows/`, cài với tùy chọn "py launcher", rồi chạy lại hai lệnh trên. Không cài được 3.12 (máy không cho cài, bộ cài lỗi) thì thử 3.11 bằng cùng cách và **ghi lý do vào spec 3.1** (TV3 là chủ spec) và `RESULTS.md`. **Không dùng 3.13** (bản có sẵn trên máy viết plan) khi chưa sửa spec 3.1 và báo nhóm. Ghi S1 vào `RESULTS.md` (Step 7): bản Python, cách cài.

- [ ] **Step 2: Viết `ai-vision/requirements.txt` và cài (S2)**

```
torch==2.14.1
torchvision==0.29.1
ultralytics==8.4.178
supervision==0.30.9
requests==2.34.2
PyYAML==6.0.3
pytest==9.1.1
opencv-python==5.0.0.93
numpy==2.5.4
```

```powershell
cd ai-vision
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -c "import sys, torch, torchvision, ultralytics, supervision, requests, yaml, pytest, cv2, numpy; print(sys.version); print(torch.__version__, torchvision.__version__, ultralytics.__version__, supervision.__version__, requests.__version__, yaml.__version__, pytest.__version__, cv2.__version__, numpy.__version__, torch.cuda.is_available())"
```

Expected: cài không lỗi; dòng cuối in chín phiên bản trùng `requirements.txt` (`cv2.__version__` là `5.0.0` ứng với `opencv-python==5.0.0.93`) và `False` (CPU). Ultralytics 8.4.178 có nhận `opencv-python` 5 và `numpy` 2.5 không: **chưa kiểm chứng** (lần chạy thử không có Ultralytics); pip báo xung đột thì lùi hai gói này về bản Ultralytics kéo về, ghi S2.

Pip báo xung đột hoặc không có bản cho Python 3.12 Windows: lùi gói gây lỗi về bản mới nhất cài được (`py -3.12 -m pip index versions <gói>`), sửa `requirements.txt`, cài lại. Ghi S2: số phiên bản thật, gói nào phải lùi, vì sao; **cập nhật dòng Tech Stack của plan này và spec 3.1** bằng số thật.

- [ ] **Step 3: Kiểm API supervision (S3, S4) — quyết định cách viết Task 2, 11, 12**

`ai-vision/spikes/check_supervision.py`:

```python
"""Kiem chung API supervision tren ban cai that (spec 3.4, 4.2, 7.1). Chay: .\\.venv\\Scripts\\python -W default spikes\\check_supervision.py"""
import inspect

import numpy as np
import supervision as sv

print('supervision', sv.__version__)
print('LineZone.__init__', inspect.signature(sv.LineZone.__init__))
print('LineZone.trigger', inspect.signature(sv.LineZone.trigger))
print('co ByteTrack', hasattr(sv, 'ByteTrack'))
if hasattr(sv, 'ByteTrack'):
    print('ByteTrack.__init__', inspect.signature(sv.ByteTrack.__init__))
    print('co update_with_detections', hasattr(sv.ByteTrack, 'update_with_detections'))
    print('co reset', hasattr(sv.ByteTrack, 'reset'))
print('Position.CENTER', sv.Position.CENTER)
print('co Detections.from_ultralytics', hasattr(sv.Detections, 'from_ultralytics'))
print('co Detections.empty', hasattr(sv.Detections, 'empty'))

# Chim bay tu duoi len qua vach ngang y = 550 (khung 1000 x 1000)
zone = sv.LineZone(start=sv.Point(100, 550), end=sv.Point(900, 550), triggering_anchors=(sv.Position.CENTER,))
for y in (700, 650, 600, 500, 450, 400):
    d = sv.Detections(
        xyxy=np.array([[490.0, y - 10.0, 510.0, y + 10.0]]),
        confidence=np.array([0.9]),
        class_id=np.array([0]),
        tracker_id=np.array([1]),
    )
    crossed_in, crossed_out = zone.trigger(d)
    print('y', y, 'in', crossed_in.tolist(), 'out', crossed_out.tolist(), 'dem', zone.in_count, zone.out_count)
```

Run: `.\.venv\Scripts\python -W default spikes\check_supervision.py`
Expected: in đủ các dòng; khi `y` đi từ 600 xuống 500 có đúng một `True` ở `in` hoặc `out`.

Ghi S3 vào `RESULTS.md`: chữ ký `LineZone` (có `triggering_anchors`, `minimum_crossing_threshold` không), `trigger` trả gì, chiều nào bật khi bay **lên** (dữ kiện cho Task 2), mọi `DeprecationWarning` in ra. Ghi S4: `ByteTrack` có không, tham số (`frame_rate`/`lost_track_buffer`/…), có `reset` không.

Nếu `sv.ByteTrack` **không còn** hoặc báo sắp bỏ: dừng, dùng `superpowers:systematic-debugging` đọc thông báo; báo nhóm. Code của plan chỉ tạo tracker ở **một chỗ** (`app.make_tracker`, Task 12) nên chỉ hàm đó đổi; không thêm gói mới khi chưa sửa spec 3.1.

- [ ] **Step 4: Kiểm Ultralytics trên CPU (S5)**

`ai-vision/spikes/check_ultralytics.py`:

```python
"""Kiem chung Ultralytics tren CPU: nap YOLOv8n co san, toc do, ten tham so train/val (spec 2.5, 2.6, 6.3)."""
import time

import numpy as np
import ultralytics
from ultralytics import YOLO
from ultralytics.cfg import get_cfg

print('ultralytics', ultralytics.__version__)
model = YOLO('yolov8n.pt')  # tai ve thu muc hien tai; *.pt da gitignore
print('names', model.names)
frame = np.zeros((720, 1280, 3), dtype=np.uint8)
times = []
for i in range(30):
    t = time.perf_counter()
    result = model.predict(frame, verbose=False)[0]
    times.append(time.perf_counter() - t)
avg = sum(times[5:]) / len(times[5:])
print('fps_mo_hinh', round(1 / avg, 2), 'ms', round(avg * 1000, 1))
print('kieu ket qua', type(result).__name__, 'co boxes', hasattr(result, 'boxes'))
cfg = get_cfg()
print('tham so train', {k: getattr(cfg, k) for k in ('epochs', 'imgsz', 'seed', 'batch', 'device')})
```

Run: `.\.venv\Scripts\python spikes\check_ultralytics.py` (cần mạng lần đầu để tải `yolov8n.pt`)
Expected: in `names` (80 lớp COCO), `fps_mo_hinh` > 0, đủ năm tham số.

Ghi S5: tên CPU (`Get-CimInstance Win32_Processor | Select-Object Name`), RAM, fps mô hình ở 1280×720, tên tham số `epochs`/`imgsz`/`seed` (spec 2.6). Xóa `yolov8n.pt` sau khi chạy (không commit; `*.pt` đã gitignore).

- [ ] **Step 5: Kiểm đọc multipart bằng `email.parser` và mở đường dẫn có dấu (S6, S7)**

`ai-vision/spikes/check_multipart.py`:

```python
"""Kiem chung: requests tu sinh boundary; email.parser doc lai duoc (spec 5.6, 7.4)."""
import email.parser
import email.policy
import json

import requests

req = requests.Request(
    'POST', 'http://127.0.0.1/api/ai/predator-detections',
    data={'metadata': json.dumps({'camera': 'H1-F0-CAMERA'})},
    files={'image': ('snapshot.jpg', b'\xff\xd8\xff\xe0abc', 'image/jpeg')},
).prepare()
ct = req.headers['Content-Type']
print('Content-Type', ct)
msg = email.parser.BytesParser(policy=email.policy.default).parsebytes(
    b'Content-Type: ' + ct.encode('ascii') + b'\r\n\r\n' + req.body)
for part in msg.iter_parts():
    name = part.get_param('name', header='content-disposition')
    print(name, part.get_content_type(), repr(part.get_content())[:60])
```

`ai-vision/spikes/check_unicode_path.py`:

```python
"""Kiem chung: OpenCV tren Windows co mo duoc video o duong dan co dau khong (Review Focus 1)."""
import shutil
import tempfile
from pathlib import Path

import cv2
import numpy as np

tmp = Path(tempfile.mkdtemp())
ascii_path = tmp / 'clip.mp4'
w = cv2.VideoWriter(str(ascii_path), cv2.VideoWriter_fourcc(*'mp4v'), 10, (64, 48))
for _ in range(10):
    w.write(np.zeros((48, 64, 3), dtype=np.uint8))
w.release()
vn_dir = tmp / 'Yến thử'
vn_dir.mkdir()
vn_path = vn_dir / 'Yến 01.mp4'
shutil.copy(ascii_path, vn_path)
print('ascii mo duoc', cv2.VideoCapture(str(ascii_path)).isOpened())
print('co dau mo duoc', cv2.VideoCapture(str(vn_path)).isOpened())
shutil.rmtree(tmp)
```

Run:
```powershell
.\.venv\Scripts\python spikes\check_multipart.py
.\.venv\Scripts\python spikes\check_unicode_path.py
```

Expected: `Content-Type multipart/form-data; boundary=…`; hai phần `metadata text/plain '{"camera": …'` và `image image/jpeg b'\xff\xd8\xff…'`; `ascii mo duoc True`. Ghi S6 (đọc được thì Task 10 dùng cách này; không được thì ghi lỗi, dùng `systematic-debugging`). Ghi S7: `co dau mo duoc` True hay False. Task 4 vẫn **từ chối đường dẫn ngoài ASCII** dù kết quả thế nào (máy khác có thể khác); kết quả S7 chỉ để ghi lý do.

- [ ] **Step 6: Kiểm `.gitignore` gốc, chỉ thêm dòng thiếu**

```powershell
cd ..
Select-String -Path .gitignore -SimpleMatch -Pattern 'ai-vision/.env','ai-vision/.venv/','ai-vision/data/','*.pt'
```

Expected: bốn dòng đều có (đã có từ trước). Dòng nào thiếu thì **thêm đúng dòng đó** vào cuối mục `# ai-vision` bằng trình soạn thảo; không tạo file mới, không ghi đè.

- [ ] **Step 7: Kiểm tay các mục còn lại, ghi `ai-vision/spikes/RESULTS.md`**

Tạo `ai-vision/spikes/RESULTS.md` theo khung dưới, điền cột "Kết quả" bằng số/chữ thật, ngày kiểm. Mục nào chưa làm được ghi "chưa kiểm được" + lý do, **không bỏ dòng**.

```markdown
# Kết quả bước kiểm chứng ai-vision

| Mã | Mục (spec) | Cách kiểm | Kết quả | Ngày |
|---|---|---|---|---|
| S1 | Python 3.12 + Python Launcher (3.1, 3.5) | `py -0p`, `py -3.12 --version` | | |
| S2 | Cài được chín gói trên Windows, số phiên bản thật (3.1) | Task 1 Step 2 | | |
| S3 | `sv.LineZone`: tham số, chiều khi bay lên (3.4, 4.2) | `spikes/check_supervision.py` | | |
| S4 | `sv.ByteTrack`, `Detections.from_ultralytics` (3.4) | như trên | | |
| S5 | Ultralytics CPU: fps 1280×720, tên tham số epochs/imgsz/seed (2.6, 3.5) | `spikes/check_ultralytics.py` | | |
| S6 | `email.parser` đọc multipart của `requests` (7.4) | `spikes/check_multipart.py` | | |
| S7 | OpenCV mở đường dẫn có dấu | `spikes/check_unicode_path.py` | | |
| S8 | Ctrl+C khi đang đọc video/chạy mô hình ra `KeyboardInterrupt` (5.6) | Task 12 Step 7 (tay) | | |
| S9 | Đồng hồ máy đồng bộ (4.6) | `w32tm /query /status` | | |
| S10 | Gói Roboflow miễn phí: giới hạn ảnh/project, project luôn công khai (1.5, 2.6) | Trang giá Roboflow | | |
| S11 | Tên định dạng export "YOLOv8" và cấu trúc thư mục sau giải nén (2.6) | Export thử 1 phiên bản nhỏ | | |
| S12 | Colab: có sẵn Ultralytics không, bản torch, GPU miễn phí, thời lượng phiên (2.6) | Ô đầu `train.ipynb` (Task 13) | | |
| S13 | Giấy phép từng nguồn, có cho chia sẻ lại; mỗi lớp ≥ 2 nguồn (2.6) | `SOURCES.md` | | |
| S14 | Quyền tạo GitHub Release trên repo nhóm (2.6) | `gh release list` + hỏi chủ repo | | |
| S15 | Trọng số Colab nạp được trên máy nhóm, chênh lệch bản Ultralytics (2.6) | `scripts\download_weights.py` (Task 13) | | |
| S16 | Mức 10% ảnh nền theo khuyến nghị Ultralytics (2.6) | Tra tài liệu Ultralytics, ghi URL | | |
| S17 | Số 30/5 khung khi đo fps; tốc độ nhảy khung của OpenCV (3.5) | Task 11 Step 6 (tay) | | |
| S18 | Mức `swiftlet.confidence`, `MIN_BOX_PX` (2.3, 3.5) | Chọn trên tập val (Task 15 Step 1) | | |
| S19 | `SNAPSHOT_MAX_BYTES=2097152` khớp backend (5.6) | So `backend/.env.example` (spec backend ghi 2097152) | | |
| S20 | Hành vi vạch đếm: track mất rồi hiện lại, lượn trên vạch (4.2, 7.1) | Task 2 | | |
| S21 | Số video đúng góc tìm được (1.5) | TV3 đếm | | |
| S22 | NestJS trả 404 với body thế nào cho route sai (5.6) | Task 16 Step 2 | | |
| S23 | Tên trường kết quả val Ultralytics (6.3) | Task 15 Step 3 | | |
```

Mục nào làm lệch spec (VD đổi bản Python, gói phải lùi) thì sửa spec ai-vision ở mục tương ứng trong cùng commit và báo nhóm.

- [ ] **Step 8: Viết test quy tắc repo (phải fail)**

`ai-vision/tests/test_repo_rules.py`:

```python
import re
from pathlib import Path

AI = Path(__file__).resolve().parent.parent
ROOT = AI.parent
PINNED = {'torch', 'torchvision', 'ultralytics', 'supervision', 'requests', 'PyYAML', 'pytest', 'opencv-python', 'numpy'}


def read_pins(path: Path) -> dict[str, str]:
    pins = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        name, sep, version = line.partition('==')
        assert sep == '==', f'dong khong ghim ==: {line}'
        pins[name] = version
    return pins


def test_requirements_ghim_dung_chin_goi():
    pins = read_pins(AI / 'requirements.txt')
    assert set(pins) == PINNED
    for name, version in pins.items():
        assert re.fullmatch(r'\d+(\.\d+)+', version), f'{name}=={version}'


def test_env_example_khong_chua_khoa():
    lines = [l for l in (AI / '.env.example').read_text(encoding='utf-8').splitlines() if l.strip()]
    pairs = dict(l.split('=', 1) for l in lines)
    assert list(pairs) == ['BACKEND_URL', 'AI_SERVICE_KEY', 'SNAPSHOT_MAX_BYTES']
    assert pairs['BACKEND_URL'] == 'http://localhost:3000'
    assert pairs['AI_SERVICE_KEY'] == ''
    assert pairs['SNAPSHOT_MAX_BYTES'] == '2097152'


def test_gitignore_goc_co_dong_ai_vision():
    lines = (ROOT / '.gitignore').read_text(encoding='utf-8').splitlines()
    for needed in ('ai-vision/.env', 'ai-vision/.venv/', 'ai-vision/data/', '*.pt'):
        assert needed in lines


def test_file_ps1_chi_ascii():
    for p in (AI / 'scripts').glob('*.ps1'):
        p.read_bytes().decode('ascii')
```

Run: `.\.venv\Scripts\python -m pytest tests/test_repo_rules.py -v` (trong `ai-vision\`)
Expected: FAIL ở `test_env_example_khong_chua_khoa` (chưa có `.env.example`).

- [ ] **Step 9: Viết `.env.example`, `pytest.ini`, `__init__.py`, khung README**

`ai-vision/.env.example`:

```
BACKEND_URL=http://localhost:3000
AI_SERVICE_KEY=
SNAPSHOT_MAX_BYTES=2097152
```

`ai-vision/pytest.ini`:

```ini
[pytest]
testpaths = tests
```

`ai-vision/swiftletcare_ai/__init__.py`:

```python
"""SwiftletCare ai-vision: dem chim yen qua vach va phat hien thien dich tren video."""
```

`ai-vision/README.md` (khung, Task 14 viết đủ):

```markdown
# ai-vision

Spec: `docs/superpowers/specs/2026-10-15-swiftletcare-ai-vision-design.md`. Plan: `docs/superpowers/plans/2026-10-16-swiftletcare-ai-vision.md`.

**Chạy `git status` trước mỗi lần commit**: không được có video, ảnh, trọng số (`*.pt`), `.env` trong thay đổi.

## Cài đặt

    py -3.12 -m venv .venv
    .\.venv\Scripts\python -m pip install -r requirements.txt
    copy .env.example .env      # điền AI_SERVICE_KEY lấy từ người chạy backend
    .\.venv\Scripts\python -m pytest
```

- [ ] **Step 10: Chạy test**

Run: `.\.venv\Scripts\python -m pytest -v`
Expected: PASS 4 test.

- [ ] **Step 11: Commit**

```powershell
git status   # kiem khong co .venv, data, *.pt, .env
git add ai-vision/requirements.txt ai-vision/.env.example ai-vision/pytest.ini ai-vision/README.md ai-vision/swiftletcare_ai/__init__.py ai-vision/tests/test_repo_rules.py ai-vision/spikes
git commit -m "chore(ai-vision): môi trường Python, ghim phiên bản, kết quả bước kiểm chứng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Có sửa `.gitignore` ở Step 6 hoặc spec ở Step 7 thì `git add` thêm đúng file đó.)

---

### Task 2: Vạch đếm và test tổng hợp (khóa chiều ra/vào)

**Files:**
- Create: `ai-vision/swiftletcare_ai/counting.py`, `ai-vision/tests/test_counting.py`
- Modify: `ai-vision/spikes/RESULTS.md` (S20), spec ai-vision mục 4.2 (ghi hành vi quan sát được)

**Interfaces:**
- Consumes: kết quả S3 (Task 1).
- Produces: `counting.py`:
  - `SV_IN_MEANS: str` — `'in'` hoặc `'out'`; chỗ **duy nhất** ánh xạ chiều supervision sang hợp đồng.
  - `class LineCounter: __init__(self, start: tuple[float, float], end: tuple[float, float], frame_w: int, frame_h: int)`; `update(self, dets: sv.Detections) -> list[tuple[str, int]]` — mỗi lần qua vạch một phần tử `(chiều 'in'|'out', tracker_id)`.

- [ ] **Step 1: Viết test (phải fail)**

`ai-vision/tests/test_counting.py`:

```python
import numpy as np
import supervision as sv

from swiftletcare_ai.counting import LineCounter

W = H = 1000
START, END = (0.10, 0.55), (0.90, 0.55)  # nhu vi du YAML spec 3.4: vach ngang y = 550


def det(track_id: int, y: float, x: float = 500.0) -> sv.Detections:
    return sv.Detections(
        xyxy=np.array([[x - 10, y - 10, x + 10, y + 10]], dtype=float),
        confidence=np.array([0.9]),
        class_id=np.array([0]),
        tracker_id=np.array([track_id]),
    )


def run(counter: LineCounter, steps: list[tuple[int, float]]) -> list[tuple[str, int]]:
    out = []
    for track_id, y in steps:
        out += counter.update(det(track_id, y))
    return out


def totals(events):
    return sum(1 for d, _ in events if d == 'in'), sum(1 for d, _ in events if d == 'out')


def test_bay_len_qua_vach_la_out():
    events = run(LineCounter(START, END, W, H), [(1, y) for y in (700, 650, 600, 500, 450, 400)])
    assert events == [('out', 1)]


def test_bay_xuong_qua_vach_la_in():
    events = run(LineCounter(START, END, W, H), [(1, y) for y in (400, 450, 500, 600, 650, 700)])
    assert events == [('in', 1)]


def test_hoan_doi_start_end_thi_dao_chieu():
    events = run(LineCounter(END, START, W, H), [(1, y) for y in (700, 650, 600, 500, 450, 400)])
    assert events == [('in', 1)]


def test_hai_track_doc_lap():
    c = LineCounter(START, END, W, H)
    steps = [(1, 700), (2, 400), (1, 600), (2, 500), (1, 500), (2, 600), (1, 400), (2, 700)]
    assert totals(run(c, steps)) == (1, 1)


def test_khung_rong_khong_loi():
    assert LineCounter(START, END, W, H).update(sv.Detections.empty()) == []


# Hai test duoi KHOA hanh vi that cua supervision (spec 7.1). Gia thuyet ban dau ghi o day;
# chay ma khac thi doi assert theo ket qua that, ghi S20 va spec 4.2 (Step 5).
def test_track_mat_roi_hien_lai_voi_id_moi():
    # id 1 bay tu duoi toi sat vach roi mat; id 2 xuat hien phia tren vach va bay tiep len.
    steps = [(1, 700), (1, 650), (1, 600), (2, 500), (2, 450), (2, 400)]
    assert totals(run(LineCounter(START, END, W, H), steps)) == (0, 0)


def test_luon_qua_lai_tren_vach():
    # bat dau duoi vach, len - xuong - len qua vach
    steps = [(1, y) for y in (600, 500, 600, 500)]
    assert totals(run(LineCounter(START, END, W, H), steps)) == (1, 2)
```

Run: `.\.venv\Scripts\python -m pytest tests/test_counting.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'swiftletcare_ai.counting'`.

- [ ] **Step 2: Viết `ai-vision/swiftletcare_ai/counting.py`**

Theo S3: nếu `LineZone` không có `triggering_anchors` thì bỏ tham số đó (mặc định bốn góc) và ghi vào S3; còn lại giữ nguyên.

```python
"""Vach dem: cho DUY NHAT dung sv.LineZone va anh xa chieu sang 'in'/'out' cua hop dong (spec 3.4)."""
import supervision as sv

# Chieu 'in' cua supervision tuong ung chieu nao cua hop dong. CHI SUA O DAY.
# Khoa bang tests/test_counting.py: start ben trai, end ben phai -> bay len la 'out'.
# supervision 0.30.9 (chay thu 17/10/2026): 'in' cua supervision = chim bay LEN = 'out' cua hop dong.
SV_IN_MEANS = 'out'
_OTHER = {'in': 'out', 'out': 'in'}


class LineCounter:
    def __init__(self, start: tuple[float, float], end: tuple[float, float], frame_w: int, frame_h: int):
        self._zone = sv.LineZone(
            start=sv.Point(start[0] * frame_w, start[1] * frame_h),
            end=sv.Point(end[0] * frame_w, end[1] * frame_h),
            triggering_anchors=(sv.Position.CENTER,),
        )

    def update(self, dets: sv.Detections) -> list[tuple[str, int]]:
        if len(dets) == 0:
            return []
        crossed_in, crossed_out = self._zone.trigger(dets)
        events = []
        for i in range(len(dets)):
            track_id = int(dets.tracker_id[i])
            if crossed_in[i]:
                events.append((SV_IN_MEANS, track_id))
            if crossed_out[i]:
                events.append((_OTHER[SV_IN_MEANS], track_id))
        return events
```

- [ ] **Step 3: Chạy test, chốt `SV_IN_MEANS`**

Run: `.\.venv\Scripts\python -m pytest tests/test_counting.py -v`
Expected: PASS 7 test.

Giá trị `'out'` lấy từ lần chạy thử với supervision 0.30.9 lúc viết plan (17/10/2026, Python 3.13, ngoài repo); hai test hành vi cũng đã khớp giả thuyết ở lần chạy đó. Bản cài thật ở Task 1 khác 0.30.9 mà ba test chiều (`bay_len`, `bay_xuong`, `hoan_doi`) **cùng fail vì đảo chiều**: đổi `SV_IN_MEANS = 'in'`, chạy lại. Đây là **sửa duy nhất được phép** cho chiều; không đảo trong test, không thêm cờ.

- [ ] **Step 4: Khóa hai hành vi chưa biết**

Nếu `test_track_mat_roi_hien_lai_voi_id_moi` hoặc `test_luon_qua_lai_tren_vach` fail: đọc giá trị thật trong thông báo của pytest, **đổi assert sang giá trị thật**, sửa chú thích phía trên test cho đúng hành vi. Không sửa `counting.py` để ép theo giả thuyết.

Run: `.\.venv\Scripts\python -m pytest tests/test_counting.py -v`
Expected: PASS 7 test.

- [ ] **Step 5: Ghi kết quả vào RESULTS.md và spec**

`spikes/RESULTS.md` dòng S20: giá trị `SV_IN_MEANS` đã chốt, kết quả hai test cuối (VD "track mất rồi hiện lại: (0, 0) — không đếm"; "lượn qua lại: (1, 2) — mỗi lần qua vạch đều đếm").

Spec ai-vision mục 4.2: thay câu "Track mất rồi xuất hiện lại với id mới có thể làm đếm thừa hoặc thiếu; test tổng hợp (Phần 7) khóa hành vi thật của code, spec ghi đúng hành vi đó." bằng câu ghi hành vi quan sát được, kèm phiên bản supervision. Mục 7.5 "Chưa kiểm chứng" bỏ dòng tương ứng.

- [ ] **Step 6: Commit**

```powershell
git add ai-vision/swiftletcare_ai/counting.py ai-vision/tests/test_counting.py ai-vision/spikes/RESULTS.md docs/superpowers/specs/2026-10-15-swiftletcare-ai-vision-design.md
git commit -m "feat(ai-vision): vạch đếm supervision, test tổng hợp khóa chiều ra/vào và hành vi lượn, mất track

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Thời gian — chuỗi UTC có `Z`, cửa sổ 5 phút, đồng hồ giả

**Files:**
- Create: `ai-vision/swiftletcare_ai/timeutil.py`, `ai-vision/tests/test_timeutil.py`

**Interfaces:**
- Consumes: không.
- Produces: `timeutil.py`:
  - `ISO_Z: re.Pattern` — `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$`
  - `WINDOW: timedelta` (5 phút)
  - `utc_iso(dt: datetime) -> str` — ném `ValueError` nếu `dt` không có múi giờ hoặc không phải UTC.
  - `window_start(at: datetime) -> datetime` — làm tròn xuống 5 phút, UTC.
  - `parse_utc(s: str) -> datetime` — chỉ nhận dạng `ISO_Z`, ném `ValueError` khác.
  - `class SystemClock`, `class FakeClock(start: datetime)` cùng ba hàm `now() -> datetime` (UTC có múi giờ), `monotonic() -> float`, `sleep(seconds: float) -> None`; `FakeClock.advance(seconds: float) -> None`, `FakeClock.jump(seconds: float) -> None` (chỉ đổi giờ thật, không đổi `monotonic`).

- [ ] **Step 1: Viết test (phải fail)**

`ai-vision/tests/test_timeutil.py`:

```python
from datetime import datetime, timedelta, timezone

import pytest

from swiftletcare_ai.timeutil import ISO_Z, FakeClock, parse_utc, utc_iso, window_start

UTC = timezone.utc


def dt(s: str) -> datetime:
    return datetime.strptime(s, '%Y-%m-%dT%H:%M:%S').replace(tzinfo=UTC)


@pytest.mark.parametrize('at,expected', [
    ('2026-10-12T10:04:59', '2026-10-12T10:00:00Z'),
    ('2026-10-12T10:05:00', '2026-10-12T10:05:00Z'),
    ('2026-10-12T10:09:59', '2026-10-12T10:05:00Z'),
    ('2026-10-12T23:59:59', '2026-10-12T23:55:00Z'),
    ('2026-10-13T00:00:00', '2026-10-13T00:00:00Z'),
])
def test_window_start_lam_tron_xuong(at, expected):
    assert utc_iso(window_start(dt(at))) == expected


def test_window_start_bo_phan_le_giay():
    at = dt('2026-10-12T10:07:30') + timedelta(microseconds=999_999)
    assert utc_iso(window_start(at)) == '2026-10-12T10:05:00Z'


def test_window_start_doi_mui_gio_ve_utc():
    at = datetime(2026, 10, 13, 6, 3, 0, tzinfo=timezone(timedelta(hours=7)))
    assert utc_iso(window_start(at)) == '2026-10-12T23:00:00Z'


def test_moi_cua_so_trong_mot_ngay_deu_tron_5_phut_va_co_z():
    start = dt('2026-10-12T00:00:00')
    for s in range(0, 86400, 37):
        text = utc_iso(window_start(start + timedelta(seconds=s)))
        assert ISO_Z.match(text)
        assert text[14:16] in {f'{m:02d}' for m in range(0, 60, 5)} and text[17:19] == '00'


def test_utc_iso_cat_phan_le_va_co_z():
    assert utc_iso(dt('2026-10-12T10:40:07') + timedelta(microseconds=500_000)) == '2026-10-12T10:40:07Z'


def test_utc_iso_tu_choi_datetime_khong_mui_gio():
    with pytest.raises(ValueError):
        utc_iso(datetime(2026, 10, 12, 10, 0, 0))


def test_utc_iso_tu_choi_mui_gio_khac_utc():
    with pytest.raises(ValueError):
        utc_iso(datetime(2026, 10, 12, 17, 0, 0, tzinfo=timezone(timedelta(hours=7))))


@pytest.mark.parametrize('bad', ['2026-10-12T10:00:00', '2026-10-12T10:00:00+07:00', '2026-10-12 10:00:00Z', ''])
def test_parse_utc_chi_nhan_z(bad):
    with pytest.raises(ValueError):
        parse_utc(bad)


def test_parse_utc_hop_le():
    assert parse_utc('2026-10-12T10:40:07Z') == dt('2026-10-12T10:40:07')


def test_fake_clock():
    c = FakeClock(dt('2026-10-12T10:00:00'))
    c.sleep(1.5)
    assert c.now() == dt('2026-10-12T10:00:01') + timedelta(milliseconds=500)
    assert c.monotonic() == 1.5
    c.jump(-120)
    assert c.now() == dt('2026-10-12T09:58:01') + timedelta(milliseconds=500)
    assert c.monotonic() == 1.5
```

Run: `.\.venv\Scripts\python -m pytest tests/test_timeutil.py -v`
Expected: FAIL `ModuleNotFoundError`.

- [ ] **Step 2: Viết `ai-vision/swiftletcare_ai/timeutil.py`**

```python
"""Thoi gian: moi moc gui di la UTC co Z, cua so tron 5 phut (spec 4.3, hop dong 2.4)."""
import re
import time
from datetime import datetime, timedelta, timezone

ISO_Z = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
WINDOW = timedelta(minutes=5)


def utc_iso(dt: datetime) -> str:
    if dt.tzinfo is None or dt.utcoffset() != timedelta(0):
        raise ValueError('can datetime UTC co mui gio')
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')


def window_start(at: datetime) -> datetime:
    at = at.astimezone(timezone.utc)
    return at.replace(minute=at.minute - at.minute % 5, second=0, microsecond=0)


def parse_utc(s: str) -> datetime:
    if not ISO_Z.match(s):
        raise ValueError(f'can dang YYYY-MM-DDTHH:MM:SSZ, nhan {s!r}')
    return datetime.strptime(s, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(timezone.utc)

    def monotonic(self) -> float:
        return time.monotonic()

    def sleep(self, seconds: float) -> None:
        if seconds > 0:
            time.sleep(seconds)


class FakeClock:
    def __init__(self, start: datetime):
        self._now = start
        self._mono = 0.0

    def now(self) -> datetime:
        return self._now

    def monotonic(self) -> float:
        return self._mono

    def sleep(self, seconds: float) -> None:
        if seconds > 0:
            self.advance(seconds)

    def advance(self, seconds: float) -> None:
        self._now += timedelta(seconds=seconds)
        self._mono += seconds

    def jump(self, seconds: float) -> None:
        """Gio may nhay (dong bo gio Windows); monotonic khong doi."""
        self._now += timedelta(seconds=seconds)
```

- [ ] **Step 3: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_timeutil.py -v`
Expected: PASS 17 test.

- [ ] **Step 4: Commit**

```powershell
git add ai-vision/swiftletcare_ai/timeutil.py ai-vision/tests/test_timeutil.py
git commit -m "feat(ai-vision): chuỗi UTC có Z, cửa sổ 5 phút, đồng hồ giả cho test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cấu hình camera, `.env`, danh sách camera đối chiếu fixture, điều kiện fps

**Files:**
- Create: `ai-vision/swiftletcare_ai/config.py`, `ai-vision/tests/conftest.py`, `ai-vision/tests/test_config.py`, `ai-vision/tests/test_camera_list.py`, `ai-vision/cameras/H1-F0-CAMERA.yaml`, `ai-vision/cameras/H2-F0-CAMERA.yaml`

**Interfaces:**
- Consumes: không.
- Produces: `config.py`:
  - `AI_DIR: Path` (thư mục `ai-vision/`), `CAMERAS = ('H1-F0-CAMERA', 'H2-F0-CAMERA')`, `SWIFTLET = 'swiftlet'`, `PREDATOR_CLASSES = ('rat', 'snake', 'owl')`, `DEFAULT_SNAPSHOT_MAX_BYTES = 2097152`.
  - `class ConfigError(Exception)`.
  - `@dataclass(frozen=True) LineCfg(start: tuple[float, float], end: tuple[float, float])`, `PredatorCfg(confidence: float, confirm_frames: int, confirm_seconds: float, cooldown_seconds: float)`, `CameraConfig(camera: str, playlist: tuple[Path, ...], line: LineCfg, swiftlet_confidence: float, predator: PredatorCfg, process_fps: float | None)`.
  - `load_camera_config(path: Path, base_dir: Path) -> CameraConfig`.
  - `@dataclass(frozen=True) EnvConfig(backend_url: str | None, service_key: str | None, snapshot_max_bytes: int)`; `__repr__` **không in khóa**.
  - `read_env_file(path: Path) -> dict[str, str]`, `load_env(path: Path, need_backend: bool) -> EnvConfig`.
  - `check_confirm_fps(confirm_frames: int, confirm_seconds: float, fps: float) -> None` — ném `ConfigError` có fps đo được và cách sửa.
- `tests/conftest.py`: fixture `ai_fixtures_dir -> Path` (đi ngược lên tới `contracts/fixtures/ai`, không thấy thì `pytest.fail`), hàm `write_yaml(tmp_path, data, name='H1-F0-CAMERA.yaml') -> Path`, `VALID_CAMERA: dict`.

- [ ] **Step 1: Viết `tests/conftest.py` và test (phải fail)**

`ai-vision/tests/conftest.py`:

```python
import copy
from pathlib import Path

import pytest
import yaml

VALID_CAMERA = {
    'camera': 'H1-F0-CAMERA',
    'playlist': ['data/videos/V01.mp4'],
    'line': {'start': [0.10, 0.55], 'end': [0.90, 0.55]},
    'swiftlet': {'confidence': 0.40},
    'predator': {'confidence': 0.50, 'confirm_frames': 3, 'confirm_seconds': 2, 'cooldown_seconds': 300},
    'process_fps': None,
}


def camera_data(**changes) -> dict:
    data = copy.deepcopy(VALID_CAMERA)
    data.update(changes)
    return data


def write_yaml(tmp_path: Path, data, name: str = 'H1-F0-CAMERA.yaml') -> Path:
    (tmp_path / 'data' / 'videos').mkdir(parents=True, exist_ok=True)
    (tmp_path / 'data' / 'videos' / 'V01.mp4').write_bytes(b'video')
    path = tmp_path / name
    path.write_text(yaml.safe_dump(data, allow_unicode=True), encoding='utf-8')
    return path


@pytest.fixture(scope='session')
def ai_fixtures_dir() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / 'contracts' / 'fixtures' / 'ai'
        if candidate.is_dir():
            return candidate
    pytest.fail('chua co contracts/fixtures/ai, can merge integration-contract truoc')
```

`ai-vision/tests/test_config.py`:

```python
import pytest

from conftest import camera_data, write_yaml
from swiftletcare_ai.config import (
    DEFAULT_SNAPSHOT_MAX_BYTES, ConfigError, check_confirm_fps, load_camera_config, load_env, read_env_file,
)


def load(tmp_path, data, name='H1-F0-CAMERA.yaml'):
    return load_camera_config(write_yaml(tmp_path, data, name), tmp_path)


def expect_error(tmp_path, data, *fragments, name='H1-F0-CAMERA.yaml'):
    with pytest.raises(ConfigError) as e:
        load(tmp_path, data, name)
    msg = str(e.value)
    assert name in msg
    for f in fragments:
        assert f in msg, msg
    return msg


def test_cau_hinh_hop_le(tmp_path):
    cfg = load(tmp_path, camera_data())
    assert cfg.camera == 'H1-F0-CAMERA'
    assert cfg.playlist == (tmp_path / 'data' / 'videos' / 'V01.mp4',)
    assert cfg.line.start == (0.10, 0.55) and cfg.line.end == (0.90, 0.55)
    assert cfg.swiftlet_confidence == 0.40
    assert cfg.predator.confirm_frames == 3 and cfg.predator.cooldown_seconds == 300
    assert cfg.process_fps is None


def test_camera_khong_co_trong_danh_sach(tmp_path):
    expect_error(tmp_path, camera_data(camera='H9-F0-CAMERA'), 'camera', 'H9-F0-CAMERA', 'H1-F0-CAMERA',
                 name='H9-F0-CAMERA.yaml')


def test_camera_khac_ten_file(tmp_path):
    expect_error(tmp_path, camera_data(camera='H2-F0-CAMERA'), 'camera', 'H2-F0-CAMERA')


def test_playlist_rong(tmp_path):
    expect_error(tmp_path, camera_data(playlist=[]), 'playlist')


def test_playlist_file_khong_ton_tai(tmp_path):
    expect_error(tmp_path, camera_data(playlist=['data/videos/X.mp4']), 'playlist', 'X.mp4')


def test_playlist_duong_dan_ngoai_ascii(tmp_path):
    (tmp_path / 'data' / 'videos').mkdir(parents=True)
    (tmp_path / 'data' / 'videos' / 'Yến 01.mp4').write_bytes(b'video')
    msg = expect_error(tmp_path, camera_data(playlist=['data/videos/Yến 01.mp4']), 'playlist', 'ASCII')
    assert 'doi ten' in msg


def test_playlist_khong_phai_danh_sach(tmp_path):
    expect_error(tmp_path, camera_data(playlist='data/videos/V01.mp4'), 'playlist')


@pytest.mark.parametrize('line,field', [
    ({'start': [1.2, 0.5], 'end': [0.9, 0.5]}, 'line.start'),
    ({'start': [0.1, 0.5], 'end': [0.9, -0.1]}, 'line.end'),
    ({'start': [0.5, 0.5], 'end': [0.5, 0.5]}, 'line'),
    ({'start': [0.1], 'end': [0.9, 0.5]}, 'line.start'),
    ({'start': [0.1, 0.5]}, 'line.end'),
    ({'start': [0.1, 0.5], 'end': [0.9, 0.5], 'flip': True}, 'line.flip'),
])
def test_vach_sai(tmp_path, line, field):
    expect_error(tmp_path, camera_data(line=line), field)


@pytest.mark.parametrize('value', [0, -0.1, 1.5, 'cao', True])
def test_swiftlet_confidence_sai(tmp_path, value):
    expect_error(tmp_path, camera_data(swiftlet={'confidence': value}), 'swiftlet.confidence', '(0, 1]')


@pytest.mark.parametrize('value', [0.49, 1.01])
def test_predator_confidence_ngoai_khoang(tmp_path, value):
    data = camera_data()
    data['predator']['confidence'] = value
    expect_error(tmp_path, data, 'predator.confidence', '[0.5, 1]')


@pytest.mark.parametrize('field,value', [
    ('confirm_frames', 0), ('confirm_frames', 2.5), ('confirm_seconds', 0), ('cooldown_seconds', -1),
])
def test_predator_so_duong(tmp_path, field, value):
    data = camera_data()
    data['predator'][field] = value
    expect_error(tmp_path, data, f'predator.{field}')


@pytest.mark.parametrize('value', [0, -5, 'nhanh'])
def test_process_fps_sai(tmp_path, value):
    expect_error(tmp_path, camera_data(process_fps=value), 'process_fps')


def test_process_fps_so_duong(tmp_path):
    assert load(tmp_path, camera_data(process_fps=8)).process_fps == 8


def test_thieu_truong(tmp_path):
    data = camera_data()
    del data['process_fps']
    expect_error(tmp_path, data, 'process_fps', 'thieu')


def test_truong_la(tmp_path):
    expect_error(tmp_path, camera_data(imgsz=640), 'imgsz', 'la')


def test_file_rong(tmp_path):
    path = tmp_path / 'H1-F0-CAMERA.yaml'
    path.write_text('', encoding='utf-8')
    with pytest.raises(ConfigError, match='H1-F0-CAMERA.yaml'):
        load_camera_config(path, tmp_path)


def test_yaml_co_bom_van_doc_duoc(tmp_path):
    path = write_yaml(tmp_path, camera_data())
    path.write_bytes(b'\xef\xbb\xbf' + path.read_bytes())
    assert load_camera_config(path, tmp_path).camera == 'H1-F0-CAMERA'


def test_hai_file_cau_hinh_mau_hop_le():
    from swiftletcare_ai.config import AI_DIR
    for cam in ('H1-F0-CAMERA', 'H2-F0-CAMERA'):
        text = (AI_DIR / 'cameras' / f'{cam}.yaml').read_text(encoding='utf-8')
        assert f'camera: {cam}' in text


# ---- .env ----

def test_read_env_file_bo_dong_trong_va_chu_thich_va_bom(tmp_path):
    p = tmp_path / '.env'
    p.write_bytes(b'\xef\xbb\xbf# chu thich\nBACKEND_URL=http://10.0.0.5:3000/\n\nAI_SERVICE_KEY=abc=def\n')
    assert read_env_file(p) == {'BACKEND_URL': 'http://10.0.0.5:3000/', 'AI_SERVICE_KEY': 'abc=def'}


def test_load_env_day_du(tmp_path):
    p = tmp_path / '.env'
    p.write_text('BACKEND_URL=http://localhost:3000/\nAI_SERVICE_KEY=bi-mat-123\nSNAPSHOT_MAX_BYTES=1000\n', encoding='utf-8')
    env = load_env(p, need_backend=True)
    assert env.backend_url == 'http://localhost:3000'
    assert env.service_key == 'bi-mat-123'
    assert env.snapshot_max_bytes == 1000
    assert 'bi-mat-123' not in repr(env)


def test_load_env_thieu_snapshot_dung_mac_dinh(tmp_path):
    p = tmp_path / '.env'
    p.write_text('BACKEND_URL=http://localhost:3000\nAI_SERVICE_KEY=k\n', encoding='utf-8')
    assert load_env(p, need_backend=True).snapshot_max_bytes == DEFAULT_SNAPSHOT_MAX_BYTES == 2097152


@pytest.mark.parametrize('text,var', [
    ('AI_SERVICE_KEY=k\n', 'BACKEND_URL'),
    ('BACKEND_URL=http://localhost:3000\nAI_SERVICE_KEY=\n', 'AI_SERVICE_KEY'),
])
def test_load_env_thieu_bien_bat_buoc(tmp_path, text, var):
    p = tmp_path / '.env'
    p.write_text(text, encoding='utf-8')
    with pytest.raises(ConfigError, match=var):
        load_env(p, need_backend=True)


def test_load_env_khong_in_khoa_khi_loi(tmp_path):
    p = tmp_path / '.env'
    p.write_text('AI_SERVICE_KEY=bi-mat-123\nSNAPSHOT_MAX_BYTES=abc\n', encoding='utf-8')
    with pytest.raises(ConfigError) as e:
        load_env(p, need_backend=False)
    assert 'SNAPSHOT_MAX_BYTES' in str(e.value) and 'bi-mat-123' not in str(e.value)


def test_load_env_offline_khong_can_file(tmp_path):
    env = load_env(tmp_path / '.env', need_backend=False)
    assert env.backend_url is None and env.snapshot_max_bytes == DEFAULT_SNAPSHOT_MAX_BYTES


def test_load_env_live_can_file(tmp_path):
    with pytest.raises(ConfigError, match='.env'):
        load_env(tmp_path / '.env', need_backend=True)


# ---- dieu kien fps (spec 3.4) ----

def test_check_confirm_fps_thoa():
    check_confirm_fps(3, 2, 1.5)


def test_check_confirm_fps_khong_thoa_bao_fps_va_cach_sua():
    with pytest.raises(ConfigError) as e:
        check_confirm_fps(3, 2, 1.2)
    msg = str(e.value)
    assert '1.2' in msg and 'confirm_frames' in msg and 'confirm_seconds' in msg and 'imgsz' in msg
```

`ai-vision/tests/test_camera_list.py`:

```python
import json

from swiftletcare_ai.config import CAMERAS


def collect_codes(node, out: set):
    if isinstance(node, dict):
        for key, value in node.items():
            if key in ('camera', 'device') and isinstance(value, str):
                out.add(value)
            collect_codes(value, out)
    elif isinstance(node, list):
        for item in node:
            collect_codes(item, out)


def test_danh_sach_camera_khop_fixture_hai_chieu(ai_fixtures_dir):
    codes = set()
    for f in sorted(ai_fixtures_dir.glob('*.json')):
        collect_codes(json.loads(f.read_text(encoding='utf-8')), codes)
    assert codes, 'khong tim thay ma camera nao trong fixture AI'
    assert codes <= set(CAMERAS), f'fixture co ma camera la: {codes - set(CAMERAS)}'
    assert set(CAMERAS) <= codes, f'ma camera khong co trong fixture: {set(CAMERAS) - codes}'
```

Run: `.\.venv\Scripts\python -m pytest tests/test_config.py tests/test_camera_list.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'swiftletcare_ai.config'`.

- [ ] **Step 2: Viết `ai-vision/swiftletcare_ai/config.py`**

```python
"""Cau hinh camera (YAML) va .env. Gap loi dau tien thi dung, bao ten file, truong, gia tri, gia tri hop le (spec 3.3, 3.4)."""
import math
from dataclasses import dataclass, field
from pathlib import Path

import yaml

AI_DIR = Path(__file__).resolve().parent.parent
CAMERAS = ('H1-F0-CAMERA', 'H2-F0-CAMERA')
SWIFTLET = 'swiftlet'
PREDATOR_CLASSES = ('rat', 'snake', 'owl')
DEFAULT_SNAPSHOT_MAX_BYTES = 2097152

_TOP = ('camera', 'playlist', 'line', 'swiftlet', 'predator', 'process_fps')
_PREDATOR = ('confidence', 'confirm_frames', 'confirm_seconds', 'cooldown_seconds')


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class LineCfg:
    start: tuple[float, float]
    end: tuple[float, float]


@dataclass(frozen=True)
class PredatorCfg:
    confidence: float
    confirm_frames: int
    confirm_seconds: float
    cooldown_seconds: float


@dataclass(frozen=True)
class CameraConfig:
    camera: str
    playlist: tuple[Path, ...]
    line: LineCfg
    swiftlet_confidence: float
    predator: PredatorCfg
    process_fps: float | None


def _is_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


class _Checker:
    def __init__(self, path: Path):
        self.name = path.name

    def fail(self, field_name: str, value, valid: str):
        raise ConfigError(f'{self.name}: truong {field_name} = {value!r} sai; hop le: {valid}')

    def keys(self, node, expected: tuple[str, ...], prefix: str):
        if not isinstance(node, dict):
            self.fail(prefix or '(goc)', node, f'bang co cac truong {", ".join(expected)}')
        for k in expected:
            if k not in node:
                raise ConfigError(f'{self.name}: thieu truong {prefix}{k}')
        for k in node:
            if k not in expected:
                raise ConfigError(f'{self.name}: truong la {prefix}{k}; chi duoc co {", ".join(expected)}')

    def point(self, value, field_name: str) -> tuple[float, float]:
        if not (isinstance(value, list) and len(value) == 2 and all(_is_num(v) and 0 <= v <= 1 for v in value)):
            self.fail(field_name, value, 'hai so trong [0, 1]')
        return (float(value[0]), float(value[1]))

    def positive(self, value, field_name: str) -> float:
        if not (_is_num(value) and value > 0):
            self.fail(field_name, value, 'so duong')
        return value


def load_camera_config(path: Path, base_dir: Path) -> CameraConfig:
    c = _Checker(path)
    try:
        data = yaml.safe_load(path.read_text(encoding='utf-8-sig'))
    except (OSError, yaml.YAMLError) as e:
        raise ConfigError(f'{path.name}: khong doc duoc YAML ({e.__class__.__name__})') from None
    c.keys(data, _TOP, '')

    camera = data['camera']
    if camera not in CAMERAS:
        c.fail('camera', camera, ', '.join(CAMERAS))
    if camera != path.stem:
        c.fail('camera', camera, f'trung ten file ({path.stem})')

    playlist = data['playlist']
    if not isinstance(playlist, list) or not playlist or not all(isinstance(p, str) for p in playlist):
        c.fail('playlist', playlist, 'danh sach duong dan video khong rong')
    files = []
    for p in playlist:
        if not p.isascii():
            c.fail('playlist', p, 'duong dan chi ky tu ASCII (OpenCV tren Windows khong mo duoc duong dan co dau); hay doi ten file/thu muc')
        full = base_dir / p
        if not full.is_file():
            c.fail('playlist', p, f'file ton tai (tinh tu {base_dir})')
        files.append(full)

    c.keys(data['line'], ('start', 'end'), 'line.')
    start = c.point(data['line']['start'], 'line.start')
    end = c.point(data['line']['end'], 'line.end')
    if start == end:
        c.fail('line', data['line'], 'start va end khac nhau')

    c.keys(data['swiftlet'], ('confidence',), 'swiftlet.')
    sc = data['swiftlet']['confidence']
    if not (_is_num(sc) and 0 < sc <= 1):
        c.fail('swiftlet.confidence', sc, '(0, 1]')

    pr = data['predator']
    c.keys(pr, _PREDATOR, 'predator.')
    if not (_is_num(pr['confidence']) and 0.5 <= pr['confidence'] <= 1):
        c.fail('predator.confidence', pr['confidence'], '[0.5, 1] (backend bo qua duoi 0.5)')
    frames = pr['confirm_frames']
    if not (isinstance(frames, int) and not isinstance(frames, bool) and frames > 0):
        c.fail('predator.confirm_frames', frames, 'so nguyen duong')
    predator = PredatorCfg(
        confidence=float(pr['confidence']),
        confirm_frames=frames,
        confirm_seconds=float(c.positive(pr['confirm_seconds'], 'predator.confirm_seconds')),
        cooldown_seconds=float(c.positive(pr['cooldown_seconds'], 'predator.cooldown_seconds')),
    )

    fps = data['process_fps']
    if fps is not None:
        c.positive(fps, 'process_fps')

    return CameraConfig(
        camera=camera,
        playlist=tuple(files),
        line=LineCfg(start, end),
        swiftlet_confidence=float(sc),
        predator=predator,
        process_fps=None if fps is None else float(fps),
    )


@dataclass(frozen=True)
class EnvConfig:
    backend_url: str | None
    service_key: str | None = field(repr=False)
    snapshot_max_bytes: int


def read_env_file(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        values[key.strip()] = value.strip()
    return values


def load_env(path: Path, need_backend: bool) -> EnvConfig:
    if path.is_file():
        values = read_env_file(path)
    elif need_backend:
        raise ConfigError(f'thieu file {path} (chep .env.example thanh .env roi dien gia tri)')
    else:
        values = {}
    raw = values.get('SNAPSHOT_MAX_BYTES', '')
    if raw == '':
        max_bytes = DEFAULT_SNAPSHOT_MAX_BYTES
    elif raw.isdigit() and int(raw) > 0:
        max_bytes = int(raw)
    else:
        raise ConfigError('.env: SNAPSHOT_MAX_BYTES phai la so nguyen duong (byte)')
    url = values.get('BACKEND_URL') or None
    key = values.get('AI_SERVICE_KEY') or None
    if need_backend:
        if not url:
            raise ConfigError('.env: thieu BACKEND_URL')
        if not key:
            raise ConfigError('.env: thieu AI_SERVICE_KEY (lay tu nguoi chay backend)')
    return EnvConfig(backend_url=url.rstrip('/') if url else None, service_key=key, snapshot_max_bytes=max_bytes)


def check_confirm_fps(confirm_frames: int, confirm_seconds: float, fps: float) -> None:
    if confirm_frames > fps * confirm_seconds:
        raise ConfigError(
            f'fps xu ly do duoc {fps:.1f} khong du: can confirm_frames <= fps x confirm_seconds '
            f'({confirm_frames} > {fps:.1f} x {confirm_seconds:g}). Cach sua: giam predator.confirm_frames, '
            f'tang predator.confirm_seconds, hoac giam kich thuoc anh suy luan (--imgsz).'
        )
```

Lưu ý: `@dataclass` không cho trường có giá trị mặc định đứng trước trường không mặc định; `field(repr=False)` không đặt mặc định nên hợp lệ.

- [ ] **Step 3: Viết hai file cấu hình mẫu**

`ai-vision/cameras/H1-F0-CAMERA.yaml` (playlist và số là minh họa; TV3 chốt theo video thật, spec 3.4):

```yaml
camera: H1-F0-CAMERA
playlist:                     # duong dan tinh tu ai-vision/, chi ky tu ASCII
  - data/videos/V01.mp4
  - data/videos/R02.mp4
# Vach dem nam ngang, toa do chuan hoa [0,1] theo khung hinh.
# Ra = chim bay tu duoi len, qua vach, sang phia TREN khung hinh.
# Vao = chim bay tu tren xuong, sang phia DUOI khung hinh.
# Muon dao chieu: hoan doi start va end, khong co co dao chieu.
line:
  start: [0.10, 0.55]
  end:   [0.90, 0.55]
swiftlet:
  confidence: 0.40
predator:
  confidence: 0.50           # >= 0.5 vi SP bo qua duoi 0.5 (LOW_CONFIDENCE)
  confirm_frames: 3          # so khung DA XU LY
  confirm_seconds: 2
  cooldown_seconds: 300      # khop @CooldownMinutes = 5 cua SP
process_fps: null            # null = theo fps cua video; so nho hon = gioi han so khung xu ly moi giay
```

`ai-vision/cameras/H2-F0-CAMERA.yaml`: giống hệt, đổi dòng đầu thành `camera: H2-F0-CAMERA` và playlist thành `data/videos/V02.mp4`, `data/videos/S01.mp4`.

- [ ] **Step 4: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_config.py tests/test_camera_list.py -v`
Expected: PASS mọi test trong `test_config.py`. `test_camera_list.py`: PASS nếu PR fixture hợp đồng đã merge; chưa merge thì FAIL với "chua co contracts/fixtures/ai, can merge integration-contract truoc" — **đúng thiết kế** (spec 7.3), ghi vào mô tả commit và làm tiếp.

- [ ] **Step 5: Commit**

```powershell
git add ai-vision/swiftletcare_ai/config.py ai-vision/tests/conftest.py ai-vision/tests/test_config.py ai-vision/tests/test_camera_list.py ai-vision/cameras
git commit -m "feat(ai-vision): kiểm cấu hình camera và .env, danh sách camera đối chiếu fixture, điều kiện fps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Log JSON Lines và file khóa chống chạy trùng

**Files:**
- Create: `ai-vision/swiftletcare_ai/logjson.py`, `ai-vision/swiftletcare_ai/lockfile.py`, `ai-vision/tests/test_logjson.py`, `ai-vision/tests/test_lockfile.py`

**Interfaces:**
- Consumes: `utc_iso`, `FakeClock` (Task 3).
- Produces:
  - `logjson.py`: `FIELDS: dict[str, tuple[str, ...]]` (bảng spec 5.1); `class JsonLog: __init__(self, camera: str, path: Path | None, clock, stream=None)`; `write(self, level: str, type_: str, **fields) -> None` (ném `ValueError` nếu `level` lạ hoặc thiếu trường bắt buộc của `type_`); `info/warning/error(self, type_: str, **fields)`. Kiểu `type_` ngoài bảng (`video.frame_error`, `start`, `error`) được phép, không kiểm trường.
  - `lockfile.py`: `class LockExists(Exception)` có thuộc tính `created_at: str`; `acquire(path: Path, clock) -> None`; `release(path: Path) -> None`; `lock_path(ai_dir: Path, camera: str) -> Path` (`data/run/<camera>.lock`).

- [ ] **Step 1: Viết test (phải fail)**

`ai-vision/tests/test_logjson.py`:

```python
import io
import json
from datetime import datetime, timezone

import pytest

from swiftletcare_ai.logjson import FIELDS, JsonLog
from swiftletcare_ai.timeutil import FakeClock

T0 = datetime(2026, 10, 12, 10, 40, 7, tzinfo=timezone.utc)


def make(tmp_path):
    stream = io.StringIO()
    return JsonLog('H1-F0-CAMERA', tmp_path / 'logs' / 'H1-F0-CAMERA.log', FakeClock(T0), stream), stream


def test_moi_dong_la_json_du_truong_chung(tmp_path):
    log, stream = make(tmp_path)
    log.info('heartbeat', status=200)
    line = json.loads(stream.getvalue())
    assert line == {'ts': '2026-10-12T10:40:07Z', 'level': 'info', 'camera': 'H1-F0-CAMERA', 'type': 'heartbeat', 'status': 200}
    assert json.loads((tmp_path / 'logs' / 'H1-F0-CAMERA.log').read_text(encoding='utf-8')) == line


def test_ghi_noi_khong_ghi_de(tmp_path):
    log, _ = make(tmp_path)
    log.info('heartbeat', status=200)
    log2, _ = make(tmp_path)
    log2.error('heartbeat', status=400)
    lines = (tmp_path / 'logs' / 'H1-F0-CAMERA.log').read_text(encoding='utf-8').splitlines()
    assert [json.loads(l)['level'] for l in lines] == ['info', 'error']


def test_bang_truong_theo_spec_5_1():
    assert FIELDS == {
        'predator.confirmed': ('class', 'confidence', 'at'),
        'predator.cooldown_blocked': ('class', 'at', 'remainingSeconds'),
        'predator.sent': ('class', 'at', 'attempt', 'status', 'created', 'alertId', 'skipReason'),
        'predator.dropped': ('class', 'at', 'attempt', 'status', 'code', 'reason'),
        'counts.sent': ('windows', 'attempt', 'status'),
        'counts.dropped': ('windowStart', 'in', 'out', 'status', 'code', 'reason'),
        'heartbeat': ('status',),
        'fps': ('fps', 'droppedFrameRatio'),
        'stop': ('reason', 'exitCode'),
    }


@pytest.mark.parametrize('type_', sorted(FIELDS))
def test_thieu_truong_bat_buoc_thi_nem_loi(tmp_path, type_):
    log, _ = make(tmp_path)
    fields = {f: None for f in FIELDS[type_][:-1]}
    with pytest.raises(ValueError, match=FIELDS[type_][-1]):
        log.info(type_, **fields)


def test_level_la_bi_tu_choi(tmp_path):
    log, _ = make(tmp_path)
    with pytest.raises(ValueError):
        log.write('debug', 'heartbeat', status=200)


def test_type_ngoai_bang_duoc_phep(tmp_path):
    log, stream = make(tmp_path)
    log.warning('video.frame_error', file='V01.mp4', frame=12)
    assert json.loads(stream.getvalue())['frame'] == 12


def test_tieng_viet_va_ky_tu_dac_biet_giu_nguyen(tmp_path):
    log, stream = make(tmp_path)
    log.error('stop', reason='sai khóa "x"\nxuống dòng', exitCode=2)
    assert stream.getvalue().count('\n') == 1
    assert json.loads(stream.getvalue())['reason'] == 'sai khóa "x"\nxuống dòng'


def test_khong_co_file_log_chi_ghi_man_hinh():
    stream = io.StringIO()
    JsonLog('H1-F0-CAMERA', None, FakeClock(T0), stream).info('heartbeat', status=200)
    assert json.loads(stream.getvalue())['status'] == 200
```

`ai-vision/tests/test_lockfile.py`:

```python
from datetime import datetime, timezone

import pytest

from swiftletcare_ai.lockfile import LockExists, acquire, lock_path, release
from swiftletcare_ai.timeutil import FakeClock

T0 = datetime(2026, 10, 12, 10, 40, 7, tzinfo=timezone.utc)


def test_lock_path(tmp_path):
    assert lock_path(tmp_path, 'H1-F0-CAMERA') == tmp_path / 'data' / 'run' / 'H1-F0-CAMERA.lock'


def test_tao_duoc_va_ghi_thoi_diem(tmp_path):
    p = lock_path(tmp_path, 'H1-F0-CAMERA')
    acquire(p, FakeClock(T0))
    assert p.read_text(encoding='utf-8').strip() == '2026-10-12T10:40:07Z'


def test_da_co_thi_dung_bao_thoi_diem_tao(tmp_path):
    p = lock_path(tmp_path, 'H1-F0-CAMERA')
    acquire(p, FakeClock(T0))
    with pytest.raises(LockExists) as e:
        acquire(p, FakeClock(T0))
    assert e.value.created_at == '2026-10-12T10:40:07Z'
    assert '2026-10-12T10:40:07Z' in str(e.value) and str(p) in str(e.value)
    assert 'xoa tay' in str(e.value)


def test_file_khoa_rong_van_bao_duoc(tmp_path):
    p = lock_path(tmp_path, 'H1-F0-CAMERA')
    p.parent.mkdir(parents=True)
    p.write_text('', encoding='utf-8')
    with pytest.raises(LockExists) as e:
        acquire(p, FakeClock(T0))
    assert e.value.created_at  # lay tu thoi diem sua file


def test_release_xoa_file_va_goi_lai_khong_loi(tmp_path):
    p = lock_path(tmp_path, 'H1-F0-CAMERA')
    acquire(p, FakeClock(T0))
    release(p)
    assert not p.exists()
    release(p)
```

Run: `.\.venv\Scripts\python -m pytest tests/test_logjson.py tests/test_lockfile.py -v`
Expected: FAIL `ModuleNotFoundError`.

- [ ] **Step 2: Viết `ai-vision/swiftletcare_ai/logjson.py`**

```python
"""Log doc duoc bang may: moi su kien mot dong JSON, ra man hinh va noi them vao file (spec 5.1)."""
import json
import sys
import threading
from pathlib import Path

from .timeutil import utc_iso

FIELDS = {
    'predator.confirmed': ('class', 'confidence', 'at'),
    'predator.cooldown_blocked': ('class', 'at', 'remainingSeconds'),
    'predator.sent': ('class', 'at', 'attempt', 'status', 'created', 'alertId', 'skipReason'),
    'predator.dropped': ('class', 'at', 'attempt', 'status', 'code', 'reason'),
    'counts.sent': ('windows', 'attempt', 'status'),
    'counts.dropped': ('windowStart', 'in', 'out', 'status', 'code', 'reason'),
    'heartbeat': ('status',),
    'fps': ('fps', 'droppedFrameRatio'),
    'stop': ('reason', 'exitCode'),
}
LEVELS = ('info', 'warning', 'error')


class JsonLog:
    def __init__(self, camera: str, path: Path | None, clock, stream=None):
        self.camera = camera
        self.path = path
        self.clock = clock
        self.stream = stream if stream is not None else sys.stdout
        self._lock = threading.Lock()
        if path is not None:
            path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, level: str, type_: str, **fields) -> None:
        if level not in LEVELS:
            raise ValueError(f'level la: {level}')
        missing = [f for f in FIELDS.get(type_, ()) if f not in fields]
        if missing:
            raise ValueError(f'log {type_} thieu truong: {", ".join(missing)}')
        record = {'ts': utc_iso(self.clock.now()), 'level': level, 'camera': self.camera, 'type': type_, **fields}
        line = json.dumps(record, ensure_ascii=False)
        with self._lock:
            print(line, file=self.stream, flush=True)
            if self.path is not None:
                with self.path.open('a', encoding='utf-8') as f:
                    f.write(line + '\n')

    def info(self, type_: str, **fields) -> None:
        self.write('info', type_, **fields)

    def warning(self, type_: str, **fields) -> None:
        self.write('warning', type_, **fields)

    def error(self, type_: str, **fields) -> None:
        self.write('error', type_, **fields)
```

- [ ] **Step 3: Viết `ai-vision/swiftletcare_ai/lockfile.py`**

```python
"""File khoa chong chay trung mot camera (spec 3.5). Khong tu do tien trinh con song."""
import os
from datetime import datetime, timezone
from pathlib import Path

from .timeutil import utc_iso


class LockExists(Exception):
    def __init__(self, path: Path, created_at: str):
        self.created_at = created_at
        super().__init__(
            f'file khoa {path} da co (tao luc {created_at}). Kiem tra khong con cua so nao dang chay camera nay, '
            f'roi xoa tay file do va chay lai.'
        )


def lock_path(ai_dir: Path, camera: str) -> Path:
    return ai_dir / 'data' / 'run' / f'{camera}.lock'


def acquire(path: Path, clock) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        created = path.read_text(encoding='utf-8').strip()
        if not created:
            created = utc_iso(datetime.fromtimestamp(path.stat().st_mtime, timezone.utc))
        raise LockExists(path, created) from None
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(utc_iso(clock.now()) + '\n')


def release(path: Path) -> None:
    path.unlink(missing_ok=True)
```

- [ ] **Step 4: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_logjson.py tests/test_lockfile.py -v`
Expected: PASS mọi test.

- [ ] **Step 5: Commit**

```powershell
git add ai-vision/swiftletcare_ai/logjson.py ai-vision/swiftletcare_ai/lockfile.py ai-vision/tests/test_logjson.py ai-vision/tests/test_lockfile.py
git commit -m "feat(ai-vision): log JSON Lines kiểm trường theo loại, file khóa chống chạy trùng camera

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Cửa sổ đếm 5 phút và hàng đợi số đếm

**Files:**
- Create: `ai-vision/swiftletcare_ai/windows.py`, `ai-vision/tests/test_windows.py`

**Interfaces:**
- Consumes: `window_start`, `WINDOW` (Task 3).
- Produces: `windows.py`:
  - `MAX_BATCH = 500`, `EXPIRE_AFTER = timedelta(minutes=60)`.
  - `class WindowCounter: __init__(self, on_close: Callable[[datetime, int, int], None])`; `observe(at: datetime) -> None` (sang cửa sổ khác thì gọi `on_close(ws_cũ, in, out)` rồi bắt đầu từ 0); `add(direction: str, at: datetime) -> None` (`'in'`/`'out'`); `current() -> tuple[datetime, int, int] | None`.
  - `class CountQueue: put(ws: datetime, in_: int, out: int) -> None` (lấy lớn hơn từng cột, ném `ValueError` nếu âm); `batch() -> list[tuple[datetime, int, int]]` (cũ trước, ≤ 500); `ack(sent: list[tuple[datetime, int, int]]) -> None` (chỉ xóa cửa sổ chưa có tổng mới hơn); `expire(now: datetime) -> list[tuple[datetime, int, int]]` (xóa và trả cửa sổ đóng quá 60 phút); `pending() -> list[tuple[datetime, int, int]]`; `__len__`. An toàn khi gọi từ hai luồng.

- [ ] **Step 1: Viết test (phải fail)**

`ai-vision/tests/test_windows.py`:

```python
from datetime import datetime, timedelta, timezone

import pytest

from swiftletcare_ai.windows import MAX_BATCH, CountQueue, WindowCounter

UTC = timezone.utc
T = datetime(2026, 10, 12, 10, 0, 0, tzinfo=UTC)


def at(minutes: float) -> datetime:
    return T + timedelta(minutes=minutes)


def test_dem_trong_mot_cua_so():
    closed = []
    w = WindowCounter(lambda *a: closed.append(a))
    w.add('out', at(0.5))
    w.add('out', at(1))
    w.add('in', at(4.9))
    assert w.current() == (at(0), 1, 2)
    assert closed == []


def test_sang_cua_so_moi_thi_dong_cua_so_cu_va_bat_dau_tu_0():
    closed = []
    w = WindowCounter(lambda *a: closed.append(a))
    w.add('in', at(4))
    w.observe(at(5))
    assert closed == [(at(0), 1, 0)]
    assert w.current() == (at(5), 0, 0)


def test_cua_so_khong_co_chim_van_co_tong_0_0():
    w = WindowCounter(lambda *a: None)
    w.observe(at(2))
    assert w.current() == (at(0), 0, 0)


def test_chua_quan_sat_thi_current_none():
    assert WindowCounter(lambda *a: None).current() is None


def test_chieu_la_bi_tu_choi():
    with pytest.raises(ValueError):
        WindowCounter(lambda *a: None).add('up', at(0))


def test_dong_ho_nhay_lui_tong_trong_hang_doi_khong_giam():
    q = CountQueue()
    w = WindowCounter(q.put)
    for _ in range(5):
        w.add('out', at(6))           # cua so 10:05, 5 out
    w.add('in', at(3))                # dong ho lui ve cua so 10:00 -> dong 10:05
    w.observe(at(7))                  # dong ho tien lai -> dong 10:00, mo lai 10:05 tu 0
    w.add('out', at(7))
    q.put(*w.current())
    assert dict((ws, (i, o)) for ws, i, o in q.pending()) == {at(0): (1, 0), at(5): (0, 5)}


def test_hang_doi_tong_moi_ghi_de_va_khong_giam():
    q = CountQueue()
    q.put(at(0), 3, 1)
    q.put(at(0), 5, 1)
    q.put(at(0), 4, 2)
    assert q.pending() == [(at(0), 5, 2)]


def test_hang_doi_tu_choi_so_am():
    with pytest.raises(ValueError):
        CountQueue().put(at(0), -1, 0)


def test_batch_cu_truoc_toi_da_500():
    q = CountQueue()
    for i in range(MAX_BATCH + 3):
        q.put(T - timedelta(minutes=5 * i), i, 0)
    b = q.batch()
    assert len(b) == MAX_BATCH == 500
    assert b == sorted(b)
    assert b[0][0] == T - timedelta(minutes=5 * (MAX_BATCH + 2))


def test_ack_khong_xoa_cua_so_co_tong_moi_trong_luc_gui():
    q = CountQueue()
    q.put(at(0), 3, 1)
    q.put(at(5), 0, 0)
    sent = q.batch()
    q.put(at(5), 1, 0)                # tong moi den trong luc dang gui
    q.ack(sent)
    assert q.pending() == [(at(5), 1, 0)]


def test_expire_bo_cua_so_dong_qua_60_phut():
    q = CountQueue()
    q.put(at(0), 2, 3)                # dong luc 10:05
    q.put(at(10), 1, 1)
    assert q.expire(at(65)) == []     # 10:05 + 60 phut = 11:05, chua qua
    assert q.expire(at(65.01)) == [(at(0), 2, 3)]
    assert q.pending() == [(at(10), 1, 1)]


def test_len():
    q = CountQueue()
    q.put(at(0), 0, 0)
    assert len(q) == 1
```

Run: `.\.venv\Scripts\python -m pytest tests/test_windows.py -v`
Expected: FAIL `ModuleNotFoundError`.

- [ ] **Step 2: Viết `ai-vision/swiftletcare_ai/windows.py`**

```python
"""Cua so dem 5 phut va hang doi so dem cho gui (spec 4.3, 5.2, 5.4)."""
import threading
from datetime import datetime, timedelta
from typing import Callable

from .timeutil import WINDOW, window_start

MAX_BATCH = 500
EXPIRE_AFTER = timedelta(minutes=60)


class WindowCounter:
    def __init__(self, on_close: Callable[[datetime, int, int], None]):
        self._on_close = on_close
        self._ws: datetime | None = None
        self._in = 0
        self._out = 0

    def observe(self, at: datetime) -> None:
        ws = window_start(at)
        if self._ws is None:
            self._ws = ws
        elif ws != self._ws:
            self._on_close(self._ws, self._in, self._out)
            self._ws, self._in, self._out = ws, 0, 0

    def add(self, direction: str, at: datetime) -> None:
        if direction not in ('in', 'out'):
            raise ValueError(f'chieu la: {direction}')
        self.observe(at)
        if direction == 'in':
            self._in += 1
        else:
            self._out += 1

    def current(self) -> tuple[datetime, int, int] | None:
        return None if self._ws is None else (self._ws, self._in, self._out)


class CountQueue:
    """Tu dien theo windowStart (mot tien trinh = mot camera); moi cot chi tang."""

    def __init__(self):
        self._d: dict[datetime, tuple[int, int]] = {}
        self._lock = threading.Lock()

    def put(self, ws: datetime, in_: int, out: int) -> None:
        if in_ < 0 or out < 0:
            raise ValueError('so dem am')
        with self._lock:
            old_in, old_out = self._d.get(ws, (0, 0))
            self._d[ws] = (max(old_in, in_), max(old_out, out))

    def pending(self) -> list[tuple[datetime, int, int]]:
        with self._lock:
            return [(ws, i, o) for ws, (i, o) in sorted(self._d.items())]

    def batch(self) -> list[tuple[datetime, int, int]]:
        return self.pending()[:MAX_BATCH]

    def ack(self, sent: list[tuple[datetime, int, int]]) -> None:
        with self._lock:
            for ws, i, o in sent:
                if self._d.get(ws) == (i, o):
                    del self._d[ws]

    def expire(self, now: datetime) -> list[tuple[datetime, int, int]]:
        with self._lock:
            old = [ws for ws in self._d if now - (ws + WINDOW) > EXPIRE_AFTER]
            return [(ws, *self._d.pop(ws)) for ws in sorted(old)]

    def __len__(self) -> int:
        with self._lock:
            return len(self._d)
```

- [ ] **Step 3: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_windows.py -v`
Expected: PASS 12 test.

- [ ] **Step 4: Commit**

```powershell
git add ai-vision/swiftletcare_ai/windows.py ai-vision/tests/test_windows.py
git commit -m "feat(ai-vision): cửa sổ đếm 5 phút, hàng đợi số đếm chỉ tăng, tối đa 500, bỏ sau 60 phút

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Xác nhận thiên địch và cooldown phía AI

**Files:**
- Create: `ai-vision/swiftletcare_ai/predators.py`, `ai-vision/tests/test_predators.py`

**Interfaces:**
- Consumes: `PredatorCfg`, `PREDATOR_CLASSES` (Task 4).
- Produces: `predators.py`:
  - `@dataclass(frozen=True) Box(cls: str, confidence: float, xyxy: tuple[float, float, float, float])`.
  - `@dataclass Confirmed(cls: str, at: datetime, confidence: float, frame: np.ndarray, boxes: list[Box])` — `at`, `confidence` (làm tròn 2 chữ số), `frame`, `boxes` của **khung tin cậy cao nhất trong các khung đủ để xác nhận**.
  - `@dataclass Blocked(cls: str, at: datetime, remaining_seconds: int)`.
  - `class PredatorConfirmer: __init__(self, cfg: PredatorCfg)`; `observe(self, cls: str, at: datetime, confidence: float, frame: np.ndarray, boxes: list[Box]) -> Confirmed | Blocked | None`; `release(self, cls: str) -> None` (gọi được từ luồng gửi).

Ghi chú bộ nhớ: mỗi lớp giữ tối đa `confirm_frames − 1` khung đang chờ (đủ `confirm_frames` là xác nhận hoặc bị chặn rồi xóa), nên bộ nhớ có trần cố định, đúng spec 4.4 ("giữ tối đa `confirm_frames` khung").

- [ ] **Step 1: Viết test (phải fail)**

`ai-vision/tests/test_predators.py`:

```python
import threading
from datetime import datetime, timedelta, timezone

import numpy as np

from swiftletcare_ai.config import PredatorCfg
from swiftletcare_ai.predators import Blocked, Box, Confirmed, PredatorConfirmer

T = datetime(2026, 10, 12, 10, 0, 0, tzinfo=timezone.utc)
CFG = PredatorCfg(confidence=0.5, confirm_frames=3, confirm_seconds=2, cooldown_seconds=300)


def s(seconds: float) -> datetime:
    return T + timedelta(seconds=seconds)


def frame(tag: int) -> np.ndarray:
    return np.full((4, 4, 3), tag, dtype=np.uint8)


def feed(c, cls, items):
    """items: [(giay, confidence)] -> danh sach ket qua khac None"""
    out = []
    for sec, conf in items:
        r = c.observe(cls, s(sec), conf, frame(round(conf * 100)), [Box(cls, conf, (0, 0, 1, 1))])
        if r is not None:
            out.append(r)
    return out


def test_3_khung_trong_2_giay_thi_xac_nhan():
    r = feed(PredatorConfirmer(CFG), 'snake', [(0, 0.6), (1, 0.9), (2.0, 0.7)])
    assert len(r) == 1 and isinstance(r[0], Confirmed)
    assert r[0].cls == 'snake'


def test_3_khung_trai_2_1_giay_thi_khong():
    assert feed(PredatorConfirmer(CFG), 'snake', [(0, 0.6), (1.05, 0.9), (2.1, 0.7)]) == []


def test_anh_la_khung_tin_cay_cao_nhat_trong_cac_khung_xac_nhan():
    r = feed(PredatorConfirmer(CFG), 'rat', [(0, 0.95), (3, 0.6), (3.5, 0.87), (4, 0.7)])[0]
    assert r.at == s(3.5)
    assert r.confidence == 0.87
    assert int(r.frame[0, 0, 0]) == 87
    assert r.boxes == [Box('rat', 0.87, (0, 0, 1, 1))]


def test_confidence_lam_tron_2_chu_so():
    r = feed(PredatorConfirmer(CFG), 'owl', [(0, 0.876), (0.5, 0.6), (1, 0.6)])[0]
    assert r.confidence == 0.88


def test_hai_lop_doc_lap():
    c = PredatorConfirmer(CFG)
    r = feed(c, 'rat', [(0, 0.6), (0.5, 0.6)]) + feed(c, 'snake', [(0.6, 0.6), (0.7, 0.6)])
    assert r == []
    r = feed(c, 'rat', [(1, 0.6)]) + feed(c, 'snake', [(1.1, 0.6)])
    assert [x.cls for x in r] == ['rat', 'snake']
    assert all(isinstance(x, Confirmed) for x in r)


def test_cooldown_chan_dung_300_giay_theo_at_va_moi_lan_xac_nhan_bi_chan_tra_1_blocked():
    c = PredatorConfirmer(CFG)
    feed(c, 'snake', [(0, 0.6), (1, 0.6), (2, 0.6)])                 # xac nhan luc 2 s, chan toi 302 s
    r = feed(c, 'snake', [(100, 0.6), (100.5, 0.6), (101, 0.6), (101.5, 0.6), (102, 0.6), (102.5, 0.6)])
    assert r == [Blocked('snake', s(101), 201), Blocked('snake', s(102.5), 200)]
    r = feed(c, 'snake', [(300, 0.6), (301, 0.6), (301.9, 0.6)])
    assert r == [Blocked('snake', s(301.9), 1)]
    r = feed(c, 'snake', [(302, 0.6), (302.5, 0.6), (303, 0.6)])
    assert len(r) == 1 and isinstance(r[0], Confirmed)


def test_cooldown_rieng_tung_lop():
    c = PredatorConfirmer(CFG)
    feed(c, 'snake', [(0, 0.6), (1, 0.6), (2, 0.6)])
    r = feed(c, 'owl', [(3, 0.6), (3.5, 0.6), (4, 0.6)])
    assert isinstance(r[0], Confirmed)


def test_release_nha_cooldown():
    c = PredatorConfirmer(CFG)
    feed(c, 'snake', [(0, 0.6), (1, 0.6), (2, 0.6)])
    c.release('snake')
    r = feed(c, 'snake', [(10, 0.6), (11, 0.6), (12, 0.6)])
    assert isinstance(r[0], Confirmed)


def test_release_tu_luong_khac_khong_loi():
    c = PredatorConfirmer(CFG)
    feed(c, 'snake', [(0, 0.6), (1, 0.6), (2, 0.6)])
    t = threading.Thread(target=c.release, args=('snake',))
    t.start()
    t.join()
    assert isinstance(feed(c, 'snake', [(10, 0.6), (11, 0.6), (12, 0.6)])[0], Confirmed)


def test_bo_nho_co_tran_so_khung_cho():
    c = PredatorConfirmer(CFG)
    feed(c, 'snake', [(i * 0.9, 0.6) for i in range(1000)])
    assert len(c._hits['snake']) < CFG.confirm_frames
```

Run: `.\.venv\Scripts\python -m pytest tests/test_predators.py -v`
Expected: FAIL `ModuleNotFoundError`.

- [ ] **Step 2: Viết `ai-vision/swiftletcare_ai/predators.py`**

```python
"""Xac nhan thien dich nhieu khung va cooldown phia AI, rieng tung lop (spec 4.4)."""
import math
import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np

from .config import PREDATOR_CLASSES, PredatorCfg


@dataclass(frozen=True)
class Box:
    cls: str
    confidence: float
    xyxy: tuple[float, float, float, float]


@dataclass
class Confirmed:
    cls: str
    at: datetime
    confidence: float
    frame: np.ndarray
    boxes: list[Box]


@dataclass
class Blocked:
    cls: str
    at: datetime
    remaining_seconds: int


@dataclass
class _Hit:
    at: datetime
    confidence: float
    frame: np.ndarray
    boxes: list[Box]


class PredatorConfirmer:
    def __init__(self, cfg: PredatorCfg):
        self._cfg = cfg
        self._hits: dict[str, deque[_Hit]] = {c: deque() for c in PREDATOR_CLASSES}
        self._until: dict[str, datetime | None] = {c: None for c in PREDATOR_CLASSES}
        self._lock = threading.Lock()

    def observe(self, cls: str, at: datetime, confidence: float, frame: np.ndarray, boxes: list[Box]):
        hits = self._hits[cls]
        hits.append(_Hit(at, confidence, frame, boxes))
        while hits and (at - hits[0].at).total_seconds() > self._cfg.confirm_seconds:
            hits.popleft()
        if len(hits) < self._cfg.confirm_frames:
            return None
        best = max(hits, key=lambda h: h.confidence)
        hits.clear()
        with self._lock:
            until = self._until[cls]
            if until is not None and at < until:
                return Blocked(cls, at, math.ceil((until - at).total_seconds()))
            self._until[cls] = at + timedelta(seconds=self._cfg.cooldown_seconds)
        return Confirmed(cls, best.at, round(best.confidence, 2), best.frame, best.boxes)

    def release(self, cls: str) -> None:
        with self._lock:
            self._until[cls] = None
```

- [ ] **Step 3: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_predators.py -v`
Expected: PASS 10 test.

- [ ] **Step 4: Commit**

```powershell
git add ai-vision/swiftletcare_ai/predators.py ai-vision/tests/test_predators.py
git commit -m "feat(ai-vision): xác nhận thiên địch 3 khung trong 2 giây, cooldown riêng từng lớp, nhả cooldown

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Ảnh chụp thiên địch — vẽ khung bao, JPEG 90, thu nhỏ 75%

**Files:**
- Create: `ai-vision/swiftletcare_ai/snapshot.py`, `ai-vision/tests/test_snapshot.py`

**Interfaces:**
- Consumes: `Box` (Task 7), fixture `ai_fixtures_dir` (Task 4).
- Produces: `snapshot.py`: `JPEG_QUALITY = 90`, `SCALE = 0.75`; `draw_boxes(frame: np.ndarray, boxes: list[Box]) -> np.ndarray` (bản sao, không sửa khung gốc); `encode_within(img: np.ndarray, max_bytes: int) -> bytes`; `encode_snapshot(frame: np.ndarray, boxes: list[Box], max_bytes: int) -> bytes`; `shrink_jpeg(data: bytes, max_bytes: int) -> bytes` (thu nhỏ ít nhất một lần 75%, cho lần gửi lại sau 413).

- [ ] **Step 1: Viết test (phải fail)**

`ai-vision/tests/test_snapshot.py`:

```python
import cv2
import numpy as np
import pytest

from swiftletcare_ai.predators import Box
from swiftletcare_ai.snapshot import draw_boxes, encode_snapshot, encode_within, shrink_jpeg

JPEG_MAGIC = b'\xff\xd8\xff'


def noisy(h=720, w=1280) -> np.ndarray:
    return np.random.default_rng(1).integers(0, 255, (h, w, 3), dtype=np.uint8)


def decode(data: bytes) -> np.ndarray:
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)


def test_anh_snake_cua_hop_dong_ra_jpeg_du_nho(ai_fixtures_dir):
    frame = cv2.imread(str(ai_fixtures_dir / 'snake.jpg'))
    assert frame is not None
    data = encode_snapshot(frame, [Box('snake', 0.87, (2, 2, 30, 30))], 2097152)
    assert data[:3] == JPEG_MAGIC and len(data) <= 2097152


def test_gioi_han_nho_thi_thu_nho_toi_khi_du():
    frame = noisy()
    full = encode_within(frame, 10**9)
    data = encode_within(frame, len(full) // 5)
    assert data[:3] == JPEG_MAGIC and len(data) <= len(full) // 5
    h, w = decode(data).shape[:2]
    assert w < 1280 and h < 720


def test_khong_the_thu_nho_du_thi_bao_loi():
    with pytest.raises(ValueError):
        encode_within(noisy(), 50)


def test_draw_boxes_khong_sua_khung_goc_va_co_ve():
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    out = draw_boxes(frame, [Box('rat', 0.91, (10, 10, 60, 60))])
    assert frame.sum() == 0
    assert out.sum() > 0


def test_shrink_jpeg_nho_hon_ban_dau():
    first = encode_within(noisy(), 10**9)
    again = shrink_jpeg(first, 10**9)
    assert again[:3] == JPEG_MAGIC
    assert decode(again).shape[1] == int(1280 * 0.75)
```

Run: `.\.venv\Scripts\python -m pytest tests/test_snapshot.py -v`
Expected: FAIL `ModuleNotFoundError`. (Chưa merge fixture hợp đồng thì `test_anh_snake_cua_hop_dong…` fail vì thiếu thư mục — đúng thiết kế; bốn test còn lại không cần fixture.)

- [ ] **Step 2: Viết `ai-vision/swiftletcare_ai/snapshot.py`**

```python
"""Anh gui kem su kien thien dich: khung goc + khung bao + nhan, JPEG 90, thu nho 75% toi khi du nho (spec 4.4)."""
import cv2
import numpy as np

from .predators import Box

JPEG_QUALITY = 90
SCALE = 0.75
_MIN_SIDE = 16
_COLOR = (0, 0, 255)


def draw_boxes(frame: np.ndarray, boxes: list[Box]) -> np.ndarray:
    img = frame.copy()
    for b in boxes:
        x1, y1, x2, y2 = (int(round(v)) for v in b.xyxy)
        cv2.rectangle(img, (x1, y1), (x2, y2), _COLOR, 2)
        cv2.putText(img, f'{b.cls} {b.confidence:.2f}', (x1, max(y1 - 6, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, _COLOR, 2)
    return img


def _resize(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    nw, nh = int(w * SCALE), int(h * SCALE)
    if nw < _MIN_SIDE or nh < _MIN_SIDE:
        raise ValueError('anh qua nho, khong thu nho them duoc')
    return cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)


def encode_within(img: np.ndarray, max_bytes: int) -> bytes:
    while True:
        ok, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not ok:
            raise ValueError('khong ma hoa duoc JPEG')
        if len(buf) <= max_bytes:
            return buf.tobytes()
        img = _resize(img)


def encode_snapshot(frame: np.ndarray, boxes: list[Box], max_bytes: int) -> bytes:
    return encode_within(draw_boxes(frame, boxes), max_bytes)


def shrink_jpeg(data: bytes, max_bytes: int) -> bytes:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    return encode_within(_resize(img), max_bytes)
```

- [ ] **Step 3: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_snapshot.py -v`
Expected: PASS 5 test (4 nếu fixture hợp đồng chưa merge, test `snake` fail có chủ ý).

- [ ] **Step 4: Commit**

```powershell
git add ai-vision/swiftletcare_ai/snapshot.py ai-vision/tests/test_snapshot.py
git commit -m "feat(ai-vision): ảnh thiên địch vẽ khung bao, JPEG 90, thu nhỏ 75% tới khi đủ nhỏ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Payload gửi backend và test hình dạng theo fixture hợp đồng

**Files:**
- Create: `ai-vision/swiftletcare_ai/payloads.py`, `ai-vision/tests/shapes.py`, `ai-vision/tests/test_payloads.py`, `ai-vision/tests/test_contract_shapes.py`

**Interfaces:**
- Consumes: `CAMERAS`, `PREDATOR_CLASSES` (Task 4), `utc_iso`, `window_start`, `ISO_Z` (Task 3), `MAX_BATCH` (Task 6).
- Produces:
  - `payloads.py`: `counts_payload(camera: str, items: list[tuple[datetime, int, int]]) -> list[dict]`; `predator_metadata(camera: str, cls: str, confidence: float, at: datetime) -> dict`; `heartbeat_payload(camera: str, at: datetime) -> dict`. Cả ba ném `ValueError` khi camera lạ, lớp lạ, số âm, `confidence` ngoài [0, 1], cửa sổ không tròn 5 phút, quá 500 phần tử.
  - `tests/shapes.py`: `shape_problems(expected, actual, path='') -> list[str]` (so khóa và kiểu; chỗ giữ chỗ kiểm theo spec 1.5; chỗ giữ chỗ lạ → lỗi), `load_fixture(dir: Path, name: str) -> dict`.

- [ ] **Step 1: Viết `tests/shapes.py` và test (phải fail)**

`ai-vision/tests/shapes.py`:

```python
"""So HINH DANG payload cua AI voi fixture hop dong. Chi kiem kieu, khong thay gia tri (spec 1.5, CLAUDE.md)."""
import json
import re
from pathlib import Path

ISO_Z = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
PLACEHOLDER = re.compile(r'^\{\{(.+)\}\}$')
NOW = re.compile(r'^now(?:[+-]\d+[smh])?$')


def load_fixture(fixtures_dir: Path, name: str) -> dict:
    return json.loads((fixtures_dir / name).read_text(encoding='utf-8'))


def _placeholder_problem(name: str, actual, path: str) -> str | None:
    if NOW.match(name) or name in ('window', 'any:iso'):
        if not (isinstance(actual, str) and ISO_Z.match(actual)):
            return f'{path}: can chuoi UTC co Z, nhan {actual!r}'
        if name == 'window' and not (actual[14:16] in {f'{m:02d}' for m in range(0, 60, 5)} and actual[17:19] == '00'):
            return f'{path}: cua so phai tron 5 phut, nhan {actual}'
        return None
    if name == 'any:id':
        ok = isinstance(actual, int) and not isinstance(actual, bool) and actual > 0
        return None if ok else f'{path}: can so nguyen duong, nhan {actual!r}'
    if name == 'any:string':
        return None if isinstance(actual, str) and actual else f'{path}: can chuoi khong rong, nhan {actual!r}'
    return f'{path}: cho giu cho la {{{{{name}}}}}'


def shape_problems(expected, actual, path: str = '') -> list[str]:
    if isinstance(expected, str):
        m = PLACEHOLDER.match(expected)
        if m:
            p = _placeholder_problem(m.group(1), actual, path)
            return [p] if p else []
        return [] if isinstance(actual, str) else [f'{path}: can chuoi, nhan {type(actual).__name__}']
    if isinstance(expected, bool) or expected is None:
        return [] if type(actual) is type(expected) else [f'{path}: can {type(expected).__name__}, nhan {actual!r}']
    if isinstance(expected, (int, float)):
        ok = isinstance(actual, (int, float)) and not isinstance(actual, bool)
        return [] if ok else [f'{path}: can so, nhan {actual!r}']
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return [f'{path}: can object, nhan {type(actual).__name__}']
        problems = []
        if set(expected) != set(actual):
            problems.append(f'{path}: khoa khac nhau, thieu {sorted(set(expected) - set(actual))}, thua {sorted(set(actual) - set(expected))}')
        for k in set(expected) & set(actual):
            problems += shape_problems(expected[k], actual[k], f'{path}.{k}')
        return problems
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            return [f'{path}: can mang {len(expected)} phan tu, nhan {actual!r}']
        problems = []
        for i, (e, a) in enumerate(zip(expected, actual)):
            problems += shape_problems(e, a, f'{path}[{i}]')
        return problems
    return [f'{path}: kieu fixture khong ho tro {type(expected).__name__}']
```

`ai-vision/tests/test_payloads.py`:

```python
from datetime import datetime, timedelta, timezone

import pytest

from shapes import shape_problems
from swiftletcare_ai.payloads import counts_payload, heartbeat_payload, predator_metadata

UTC = timezone.utc
WS = datetime(2026, 10, 12, 10, 5, 0, tzinfo=UTC)
AT = datetime(2026, 10, 12, 10, 40, 7, 123456, tzinfo=UTC)


def test_counts_payload():
    assert counts_payload('H1-F0-CAMERA', [(WS, 5, 1)]) == [
        {'camera': 'H1-F0-CAMERA', 'windowStart': '2026-10-12T10:05:00Z', 'in': 5, 'out': 1}]


@pytest.mark.parametrize('items', [
    [(WS, -1, 0)],
    [(WS, 0, -1)],
    [(WS, 1.5, 0)],
    [(WS, True, 0)],
    [(WS + timedelta(minutes=1), 1, 0)],
    [(WS.replace(tzinfo=None), 1, 0)],
    [(WS, 0, 0)] * 501,
])
def test_counts_payload_tu_choi(items):
    with pytest.raises(ValueError):
        counts_payload('H1-F0-CAMERA', items)


def test_counts_payload_camera_la():
    with pytest.raises(ValueError):
        counts_payload('H9-F0-CAMERA', [(WS, 1, 0)])


def test_predator_metadata():
    assert predator_metadata('H1-F0-CAMERA', 'snake', 0.8749, AT) == {
        'camera': 'H1-F0-CAMERA', 'class': 'snake', 'confidence': 0.87, 'at': '2026-10-12T10:40:07Z'}


@pytest.mark.parametrize('cls,conf', [('cat', 0.9), ('swiftlet', 0.9), ('Snake', 0.9), ('snake', 1.2), ('snake', -0.1)])
def test_predator_metadata_tu_choi(cls, conf):
    with pytest.raises(ValueError):
        predator_metadata('H1-F0-CAMERA', cls, conf, AT)


def test_predator_metadata_tu_choi_gio_khong_utc():
    with pytest.raises(ValueError):
        predator_metadata('H1-F0-CAMERA', 'snake', 0.9, AT.astimezone(timezone(timedelta(hours=7))))


def test_heartbeat_payload():
    assert heartbeat_payload('H2-F0-CAMERA', AT) == {'device': 'H2-F0-CAMERA', 'at': '2026-10-12T10:40:07Z'}


def test_shape_problems_tu_kiem():
    assert shape_problems({'a': '{{now}}'}, {'a': '2026-10-12T10:40:07Z'}) == []
    assert shape_problems({'a': '{{now-1m}}'}, {'a': '2026-10-12T10:40:07+07:00'})
    assert shape_problems({'a': '{{window}}'}, {'a': '2026-10-12T10:41:00Z'})
    assert shape_problems({'a': '{{la}}'}, {'a': 'x'})
    assert shape_problems({'a': 1}, {'a': 1, 'b': 2})
    assert shape_problems({'a': 0.87}, {'a': 1}) == []
    assert shape_problems({'a': 0.87}, {'a': True})
```

`ai-vision/tests/test_contract_shapes.py`:

```python
"""Fixture hop le: payload cua AI dung hinh dang. Invalid nhom 'AI tu tranh': ham tao payload khong the sinh dang do (spec 7.3)."""
from datetime import datetime, timedelta, timezone

import pytest

from shapes import load_fixture, shape_problems
from swiftletcare_ai.payloads import counts_payload, heartbeat_payload, predator_metadata
from swiftletcare_ai.timeutil import window_start

NOW = datetime.now(timezone.utc)

AI_FILES = {
    'bird-counts.json', 'bird-counts.resend-smaller.json', 'predator-detection.json',
    'predator-detection.cooldown.json', 'predator-detection.low-confidence.json', 'heartbeat.cut.json',
    'bird-counts.invalid-window-not-aligned.json', 'bird-counts.invalid-negative.json',
    'bird-counts.invalid-missing-z.json', 'predator-detection.invalid-class.json',
    'predator-detection.invalid-offset.json', 'predator-detection.invalid-not-jpeg.json',
    'ai.invalid-service-key.json',
}


def test_bo_fixture_ai_dung_ban_doi_chieu(ai_fixtures_dir):
    assert {p.name for p in ai_fixtures_dir.glob('*.json')} == AI_FILES
    assert (ai_fixtures_dir / 'snake.jpg').is_file() and (ai_fixtures_dir / 'not-jpeg.png').is_file()


@pytest.mark.parametrize('name', ['bird-counts.json', 'bird-counts.resend-smaller.json'])
def test_bird_counts_hinh_dang(ai_fixtures_dir, name):
    f = load_fixture(ai_fixtures_dir, name)
    assert (f['method'], f['path']) == ('POST', '/api/ai/bird-counts')
    assert set(f['headers']) == {'X-Service-Key'}
    item = f['body'][0]
    payload = counts_payload(item['camera'], [(window_start(NOW), item['in'], item['out'])])
    assert shape_problems(f['body'], payload) == []


@pytest.mark.parametrize('name', [
    'predator-detection.json', 'predator-detection.cooldown.json', 'predator-detection.low-confidence.json',
])
def test_predator_hinh_dang(ai_fixtures_dir, name):
    f = load_fixture(ai_fixtures_dir, name)
    assert (f['method'], f['path']) == ('POST', '/api/ai/predator-detections')
    assert set(f['body']) == {'metadata', 'image'}
    m = f['body']['metadata']
    payload = predator_metadata(m['camera'], m['class'], m['confidence'], NOW - timedelta(minutes=1))
    assert shape_problems(m, payload) == []


def test_heartbeat_hinh_dang(ai_fixtures_dir):
    f = load_fixture(ai_fixtures_dir, 'heartbeat.cut.json')
    assert (f['method'], f['path']) == ('POST', '/api/ai/heartbeat')
    assert shape_problems(f['body'], heartbeat_payload(f['body']['device'], NOW)) == []


# ---- invalid nhom "AI tu tranh" ----

def test_invalid_negative_khong_sinh_duoc(ai_fixtures_dir):
    item = load_fixture(ai_fixtures_dir, 'bird-counts.invalid-negative.json')['body'][0]
    with pytest.raises(ValueError):
        counts_payload(item['camera'], [(window_start(NOW), item['in'], item['out'])])


def test_invalid_class_khong_sinh_duoc(ai_fixtures_dir):
    m = load_fixture(ai_fixtures_dir, 'predator-detection.invalid-class.json')['body']['metadata']
    with pytest.raises(ValueError):
        predator_metadata(m['camera'], m['class'], m['confidence'], NOW)


@pytest.mark.parametrize('name,placeholder', [
    ('bird-counts.invalid-window-not-aligned.json', '{{window+1m}}'),
    ('bird-counts.invalid-missing-z.json', '{{window:noZ}}'),
])
def test_invalid_cua_so_ham_cua_so_luon_tron_va_co_z(ai_fixtures_dir, name, placeholder):
    assert load_fixture(ai_fixtures_dir, name)['body'][0]['windowStart'] == placeholder
    for s in range(0, 7200, 13):
        ws = counts_payload('H1-F0-CAMERA', [(window_start(NOW + timedelta(seconds=s)), 0, 0)])[0]['windowStart']
        assert ws.endswith('Z') and ws[14:16] in {f'{m:02d}' for m in range(0, 60, 5)} and ws[17:19] == '00'


def test_invalid_offset_ham_thoi_diem_luon_co_z(ai_fixtures_dir):
    m = load_fixture(ai_fixtures_dir, 'predator-detection.invalid-offset.json')['body']['metadata']
    assert m['at'] == '{{now:+07:00}}'
    at = predator_metadata('H1-F0-CAMERA', 'snake', 0.9, NOW)['at']
    assert at.endswith('Z') and '+' not in at
```

Run: `.\.venv\Scripts\python -m pytest tests/test_payloads.py tests/test_contract_shapes.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'swiftletcare_ai.payloads'`.

- [ ] **Step 2: Viết `ai-vision/swiftletcare_ai/payloads.py`**

```python
"""Payload gui backend (hop dong 2.4). Ham tao payload khong the sinh du lieu sai (spec 7.3)."""
from datetime import datetime

from .config import CAMERAS, PREDATOR_CLASSES
from .timeutil import utc_iso, window_start
from .windows import MAX_BATCH


def _camera(camera: str) -> str:
    if camera not in CAMERAS:
        raise ValueError(f'camera la: {camera}')
    return camera


def _count(v) -> int:
    if not isinstance(v, int) or isinstance(v, bool) or v < 0:
        raise ValueError(f'so dem phai la so nguyen khong am: {v!r}')
    return v


def counts_payload(camera: str, items: list[tuple[datetime, int, int]]) -> list[dict]:
    _camera(camera)
    if len(items) > MAX_BATCH:
        raise ValueError(f'qua {MAX_BATCH} cua so mot lan gui')
    out = []
    for ws, in_, out_ in items:
        text = utc_iso(ws)
        if window_start(ws) != ws:
            raise ValueError(f'cua so khong tron 5 phut: {text}')
        out.append({'camera': camera, 'windowStart': text, 'in': _count(in_), 'out': _count(out_)})
    return out


def predator_metadata(camera: str, cls: str, confidence: float, at: datetime) -> dict:
    if cls not in PREDATOR_CLASSES:
        raise ValueError(f'lop thien dich la: {cls}')
    if not 0 <= confidence <= 1:
        raise ValueError(f'confidence ngoai [0, 1]: {confidence}')
    return {'camera': _camera(camera), 'class': cls, 'confidence': round(float(confidence), 2), 'at': utc_iso(at)}


def heartbeat_payload(camera: str, at: datetime) -> dict:
    return {'device': _camera(camera), 'at': utc_iso(at)}
```

- [ ] **Step 3: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_payloads.py tests/test_contract_shapes.py -v`
Expected: PASS mọi test trong `test_payloads.py`; `test_contract_shapes.py` PASS khi fixture hợp đồng đã merge (chưa merge → fail "chua co contracts/fixtures/ai…", đúng thiết kế). Fixture thật khác bản đối chiếu (tên file, chỗ giữ chỗ) → test fail chỉ ra chỗ khác: **báo TV2**, không sửa fixture; sửa `AI_FILES` hoặc `shapes.py` chỉ khi PR hợp đồng đã đổi thật.

- [ ] **Step 4: Commit**

```powershell
git add ai-vision/swiftletcare_ai/payloads.py ai-vision/tests/shapes.py ai-vision/tests/test_payloads.py ai-vision/tests/test_contract_shapes.py
git commit -m "feat(ai-vision): payload đếm chim, thiên địch, heartbeat; test hình dạng theo fixture hợp đồng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Luồng gửi — bảng mã trả về, thử lại, dừng vì 401/404, heartbeat, gửi nốt

**Files:**
- Create: `ai-vision/swiftletcare_ai/sender.py`, `ai-vision/tests/fake_backend.py`, `ai-vision/tests/test_sender.py`

**Interfaces:**
- Consumes: `EnvConfig` (Task 4), `JsonLog` (Task 5), `CountQueue` (Task 6), `shrink_jpeg` (Task 8), `counts_payload`, `predator_metadata`, `heartbeat_payload` (Task 9), `utc_iso` (Task 3).
- Produces: `sender.py`:
  - `RETRY_DELAYS = (5, 15, 30, 60, 120)`, `TIMEOUT = (5, 10)`, `PATHS: dict[str, str]`.
  - `@dataclass PendingEvent(cls: str, at: datetime, confidence: float, jpeg: bytes, retries: int = 0, next_try: float = 0.0, shrunk: bool = False)`.
  - `class Sender: __init__(self, camera: str, env: EnvConfig, queue: CountQueue, log: JsonLog, release: Callable[[str], None], clock, retry_delays=RETRY_DELAYS, heartbeat_every: float | None = None, tick: float = 0.2)`.
  - Thuộc tính `fatal: str | None` (thông báo dừng khi 401/404; luồng xử lý video kiểm mỗi khung).
  - Gọi từ luồng xử lý video: `wake_counts() -> None`, `submit(ev: PendingEvent) -> None`, `start() -> None`, `drain(seconds: float) -> tuple[list[tuple[datetime, int, int]], list[PendingEvent]]` (ngừng luồng, gửi nốt mỗi thứ một lần trong hạn, trả phần còn lại).
  - Dùng trong test (đồng bộ, không luồng): `run_once() -> None`, `send_counts()`, `send_event(ev) -> bool`, `send_heartbeat()`.
- `tests/fake_backend.py`: `class FakeBackend` (context manager): `url: str`; `respond(path: str, *responses)` — mỗi phần tử `(status, body)` hoặc `(status, body, delay_giay)`, `body` là `dict`/`list` (JSON) hoặc `str` (thân thô); dùng lần lượt, phần tử cuối lặp lại; `requests: list[Recorded]`; `to(path) -> list[Recorded]`. `Recorded`: `method, path, headers (dict), body (bytes), json, parts (dict tên → (content_type, nội dung))`.

- [ ] **Step 1: Viết `tests/fake_backend.py`**

```python
"""Backend gia cho test: http.server cua thu vien chuan, ghi lai moi request.
Doc multipart bang email.parser (khong dung cgi - da bo khoi Python 3.13, spec 7.4)."""
import email.parser
import email.policy
import json
import threading
import time
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULTS = {
    '/api/ai/bird-counts': (200, {'windowsUpserted': 1, 'windowsUnchanged': 0}),
    '/api/ai/predator-detections': (200, {'created': True, 'alertId': 1, 'skipReason': None}),
    '/api/ai/heartbeat': (200, {'accepted': 1, 'rejected': 0}),
}


@dataclass
class Recorded:
    method: str
    path: str
    headers: dict
    body: bytes
    json: object = None
    parts: dict = field(default_factory=dict)


def parse_multipart(content_type: str, body: bytes) -> dict:
    msg = email.parser.BytesParser(policy=email.policy.default).parsebytes(
        b'Content-Type: ' + content_type.encode('ascii') + b'\r\n\r\n' + body)
    return {
        part.get_param('name', header='content-disposition'): (part.get_content_type(), part.get_content())
        for part in msg.iter_parts()
    }


class _Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        backend = self.server.backend
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        ct = self.headers.get('Content-Type', '')
        rec = Recorded('POST', self.path, dict(self.headers), body)
        if ct.startswith('application/json'):
            rec.json = json.loads(body)
        elif ct.startswith('multipart/form-data'):
            rec.parts = parse_multipart(ct, body)
        status, payload, delay = backend.next_response(self.path)
        backend.requests.append(rec)
        if delay:
            time.sleep(delay)
        data = payload.encode('utf-8') if isinstance(payload, str) else json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'text/plain' if isinstance(payload, str) else 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


class FakeBackend:
    def __init__(self):
        self.requests: list[Recorded] = []
        self._script: dict[str, list] = {}
        self._lock = threading.Lock()
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), _Handler)
        self.server.backend = self
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}'
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def respond(self, path: str, *responses) -> None:
        self._script[path] = [r if len(r) == 3 else (r[0], r[1], 0) for r in responses]

    def next_response(self, path: str):
        with self._lock:
            queue = self._script.get(path)
            if not queue:
                status, body = DEFAULTS.get(path, (404, {'message': f'Cannot POST {path}'}))
                return status, body, 0
            return queue.pop(0) if len(queue) > 1 else queue[0]

    def to(self, path: str) -> list[Recorded]:
        return [r for r in self.requests if r.path == path]

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
```

- [ ] **Step 2: Viết test (phải fail)**

`ai-vision/tests/test_sender.py`:

```python
import io
import json
import socket
import time
from datetime import datetime, timedelta, timezone

import cv2
import numpy as np
import pytest

from fake_backend import FakeBackend
from shapes import load_fixture
from swiftletcare_ai.config import EnvConfig
from swiftletcare_ai.logjson import JsonLog
from swiftletcare_ai.payloads import predator_metadata
from swiftletcare_ai.sender import PATHS, RETRY_DELAYS, PendingEvent, Sender
from swiftletcare_ai.snapshot import encode_within
from swiftletcare_ai.timeutil import FakeClock
from swiftletcare_ai.windows import CountQueue

T = datetime(2026, 10, 12, 10, 7, 30, tzinfo=timezone.utc)
WS = datetime(2026, 10, 12, 10, 5, 0, tzinfo=timezone.utc)
KEY = 'khoa-thu-nghiem-0123456789abcdef0123456789'
JPEG = encode_within(np.full((48, 64, 3), 128, dtype=np.uint8), 10**6)
COUNTS, PRED, HB = PATHS['counts'], PATHS['predator'], PATHS['heartbeat']


@pytest.fixture
def backend():
    with FakeBackend() as b:
        yield b


class Rig:
    def __init__(self, url: str, tmp_path, **kw):
        self.clock = FakeClock(T)
        self.log_path = tmp_path / 'H1-F0-CAMERA.log'
        self.log = JsonLog('H1-F0-CAMERA', self.log_path, self.clock, io.StringIO())
        self.queue = CountQueue()
        self.released = []
        env = EnvConfig(backend_url=url, service_key=KEY, snapshot_max_bytes=2097152)
        self.sender = Sender('H1-F0-CAMERA', env, self.queue, self.log, self.released.append, self.clock, **kw)

    def logs(self, type_=None):
        lines = [json.loads(l) for l in self.log_path.read_text(encoding='utf-8').splitlines()]
        return [l for l in lines if type_ is None or l['type'] == type_]

    def counts_now(self):
        self.sender.wake_counts()
        self.sender.run_once()


@pytest.fixture
def rig(backend, tmp_path):
    return Rig(backend.url, tmp_path)


def event(at=T) -> PendingEvent:
    return PendingEvent('snake', at, 0.87, JPEG)


# ---- bird-counts ----

def test_counts_200_xoa_khoi_hang_doi_va_log(backend, rig):
    rig.queue.put(WS, 5, 1)
    rig.counts_now()
    [req] = backend.to(COUNTS)
    assert req.json == [{'camera': 'H1-F0-CAMERA', 'windowStart': '2026-10-12T10:05:00Z', 'in': 5, 'out': 1}]
    assert req.headers['X-Service-Key'] == KEY
    assert len(rig.queue) == 0
    [line] = rig.logs('counts.sent')
    assert (line['status'], line['attempt'], line['level']) == (200, 1, 'info')
    assert line['windows'] == [{'windowStart': '2026-10-12T10:05:00Z', 'in': 5, 'out': 1}]


def test_counts_khong_gui_khi_chua_den_luot(backend, rig):
    rig.queue.put(WS, 5, 1)
    rig.sender.run_once()
    assert backend.to(COUNTS) == []


def test_counts_5xx_giu_lai_gui_lan_sau(backend, rig):
    backend.respond(COUNTS, (503, {}), (200, {'windowsUpserted': 1, 'windowsUnchanged': 0}))
    rig.queue.put(WS, 5, 1)
    rig.counts_now()
    assert len(rig.queue) == 1
    rig.counts_now()
    assert len(rig.queue) == 0
    assert [(l['status'], l['attempt']) for l in rig.logs('counts.sent')] == [(503, 1), (200, 2)]


def test_counts_mat_ket_noi_giu_lai(tmp_path):
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    r = Rig(f'http://127.0.0.1:{port}', tmp_path)
    r.queue.put(WS, 5, 1)
    r.counts_now()
    assert len(r.queue) == 1
    assert r.logs('counts.sent')[0]['status'] is None


def test_counts_400_log_error_bo_lo(backend, rig):
    backend.respond(COUNTS, (400, {'error': {'code': 'VALIDATION_ERROR', 'message': 'x', 'sqlNumber': 50012, 'details': {'fields': ['in', 'out']}}}))
    rig.queue.put(WS, 5, 1)
    rig.counts_now()
    assert len(rig.queue) == 0
    [line] = rig.logs('counts.dropped')
    assert line['level'] == 'error' and line['code'] == 'VALIDATION_ERROR' and line['in'] == 5
    assert line['details'] == {'fields': ['in', 'out']}


def test_counts_cua_so_dong_qua_60_phut_bi_bo_kem_so(backend, rig):
    rig.queue.put(WS - timedelta(hours=2), 7, 3)
    rig.counts_now()
    assert backend.to(COUNTS) == []
    [line] = rig.logs('counts.dropped')
    assert (line['windowStart'], line['in'], line['out']) == ('2026-10-12T08:05:00Z', 7, 3)


def test_counts_200_than_khong_phai_json_van_xoa(backend, rig):
    backend.respond(COUNTS, (200, 'OK'))
    rig.queue.put(WS, 1, 0)
    rig.counts_now()
    assert len(rig.queue) == 0


# ---- predator-detections ----

def test_predator_200_multipart_dung(backend, rig):
    rig.sender.submit(event())
    rig.sender.run_once()
    [req] = backend.to(PRED)
    assert req.headers['Content-Type'].startswith('multipart/form-data; boundary=')
    assert req.headers['X-Service-Key'] == KEY
    ct, meta = req.parts['metadata']
    assert json.loads(meta) == predator_metadata('H1-F0-CAMERA', 'snake', 0.87, T)
    assert req.parts['image'] == ('image/jpeg', JPEG)
    [line] = rig.logs('predator.sent')
    assert (line['created'], line['alertId'], line['skipReason'], line['attempt']) == (True, 1, None, 1)


def test_predator_5xx_roi_200_gui_lai_chinh_su_kien(backend, rig):
    backend.respond(PRED, (500, {}), (200, {'created': True, 'alertId': 9, 'skipReason': None}))
    rig.sender.submit(event())
    rig.sender.run_once()
    rig.sender.run_once()                       # chua toi 5 giay
    assert len(backend.to(PRED)) == 1
    rig.clock.advance(5)
    rig.sender.run_once()
    first, second = backend.to(PRED)
    assert first.parts == second.parts
    assert [l['status'] for l in rig.logs('predator.sent')] == [500, 200]


def test_predator_5xx_mai_thi_bo_sau_5_lan_thu_lai_va_nha_cooldown(backend, rig):
    backend.respond(PRED, (503, {}))
    rig.sender.submit(event())
    rig.sender.run_once()
    for d in RETRY_DELAYS:
        rig.clock.advance(d)
        rig.sender.run_once()
    assert len(backend.to(PRED)) == 6
    [line] = rig.logs('predator.dropped')
    assert line['attempt'] == 6
    assert rig.released == ['snake']
    rig.clock.advance(1000)
    rig.sender.run_once()
    assert len(backend.to(PRED)) == 6


def test_predator_413_thu_nho_gui_lai_dung_1_lan(backend, rig):
    backend.respond(PRED, (413, {}), (200, {'created': True, 'alertId': 2, 'skipReason': None}))
    rig.sender.submit(event())
    rig.sender.run_once()
    first, second = backend.to(PRED)
    big = cv2.imdecode(np.frombuffer(first.parts['image'][1], np.uint8), cv2.IMREAD_COLOR)
    small = cv2.imdecode(np.frombuffer(second.parts['image'][1], np.uint8), cv2.IMREAD_COLOR)
    assert small.shape[1] < big.shape[1]


def test_predator_413_hai_lan_thi_bo_giu_cooldown(backend, rig):
    backend.respond(PRED, (413, {'error': {'code': 'PAYLOAD_TOO_LARGE', 'message': 'x', 'sqlNumber': None, 'details': None}}))
    rig.sender.submit(event())
    rig.sender.run_once()
    rig.clock.advance(300)
    rig.sender.run_once()
    assert len(backend.to(PRED)) == 2
    [line] = rig.logs('predator.dropped')
    assert 'SNAPSHOT_MAX_BYTES' in line['reason']
    assert rig.released == []


def test_predator_400_log_error_khong_thu_lai_giu_cooldown(backend, rig):
    backend.respond(PRED, (400, {'error': {'code': 'VALIDATION_ERROR', 'message': 'x', 'sqlNumber': None, 'details': {'fields': ['class']}}}))
    rig.sender.submit(event())
    rig.sender.run_once()
    rig.clock.advance(300)
    rig.sender.run_once()
    assert len(backend.to(PRED)) == 1
    [line] = rig.logs('predator.dropped')
    assert (line['level'], line['code']) == ('error', 'VALIDATION_ERROR')
    assert rig.released == []


def test_predator_415_theo_fixture_hop_dong(backend, rig, ai_fixtures_dir):
    f = load_fixture(ai_fixtures_dir, 'predator-detection.invalid-not-jpeg.json')
    backend.respond(PRED, (f['status'], f['response']))
    rig.sender.submit(event())
    rig.sender.run_once()
    rig.clock.advance(300)
    rig.sender.run_once()
    assert len(backend.to(PRED)) == 1
    [line] = rig.logs('predator.dropped')
    assert (line['level'], line['status'], line['code']) == ('error', 415, 'UNSUPPORTED_MEDIA_TYPE')
    assert rig.released == []


def test_predator_cooldown_sau_khoi_dong_lai_khong_thu_lai(backend, rig, ai_fixtures_dir):
    f = load_fixture(ai_fixtures_dir, 'predator-detection.cooldown.json')
    backend.respond(PRED, (f['status'], f['response']))
    rig.sender.submit(event())                  # tien trinh moi, chua co cooldown phia AI
    rig.sender.run_once()
    rig.clock.advance(300)
    rig.sender.run_once()
    assert len(backend.to(PRED)) == 1
    [line] = rig.logs('predator.sent')
    assert (line['created'], line['skipReason']) == (False, 'COOLDOWN')


def test_predator_200_than_khong_phai_json_khong_chet(backend, rig):
    backend.respond(PRED, (200, '<html>ok</html>'))
    rig.sender.submit(event())
    rig.sender.run_once()
    [line] = rig.logs('predator.sent')
    assert line['created'] is None and line['status'] == 200


# ---- dung vi 401 / 404 ----

def test_401_theo_fixture_thi_dung_khong_lo_khoa(backend, rig, ai_fixtures_dir):
    f = load_fixture(ai_fixtures_dir, 'ai.invalid-service-key.json')
    backend.respond(COUNTS, (f['status'], f['response']))
    rig.queue.put(WS, 5, 1)
    rig.counts_now()
    assert 'AI_SERVICE_KEY' in rig.sender.fatal
    log_text = rig.log_path.read_text(encoding='utf-8') if rig.log_path.exists() else ''
    assert KEY not in rig.sender.fatal and KEY not in log_text
    rig.sender.submit(event())
    rig.counts_now()
    assert len(backend.requests) == 1


def test_404_camera_not_found_thi_dung(backend, rig):
    backend.respond(PRED, (404, {'error': {'code': 'CAMERA_NOT_FOUND', 'message': 'x', 'sqlNumber': None, 'details': None}}))
    rig.sender.submit(event())
    rig.sender.run_once()
    assert 'CSDL' in rig.sender.fatal


def test_404_khac_thi_dung_bao_sai_duong_dan(backend, rig):
    backend.respond(COUNTS, (404, {'message': 'Cannot POST /api/ai/bird-counts'}))
    rig.queue.put(WS, 5, 1)
    rig.counts_now()
    assert 'BACKEND_URL' in rig.sender.fatal


# ---- heartbeat ----

def test_heartbeat_theo_chu_ky_that_bai_khong_thu_lai(backend, tmp_path):
    r = Rig(backend.url, tmp_path, heartbeat_every=30)
    backend.respond(HB, (503, {}), (200, {'accepted': 1, 'rejected': 0}))
    r.sender.run_once()
    r.clock.advance(1)
    r.sender.run_once()
    assert len(backend.to(HB)) == 1
    r.clock.advance(29)
    r.sender.run_once()
    assert len(backend.to(HB)) == 2
    assert backend.to(HB)[0].json == {'device': 'H1-F0-CAMERA', 'at': '2026-10-12T10:07:30Z'}
    assert [l['status'] for l in r.logs('heartbeat')] == [503, 200]


def test_heartbeat_rejected_thi_canh_bao(backend, tmp_path):
    r = Rig(backend.url, tmp_path, heartbeat_every=30)
    backend.respond(HB, (200, {'accepted': 0, 'rejected': 1}))
    r.sender.run_once()
    assert r.logs('heartbeat')[0]['level'] == 'warning'


def test_heartbeat_tat_mac_dinh(backend, rig):
    rig.sender.run_once()
    assert backend.to(HB) == []


# ---- luong va gui not ----

def test_luong_gui_chay_nen_va_drain(backend, rig):
    rig.sender.start()
    rig.sender.submit(event())
    deadline = time.monotonic() + 5
    while not backend.to(PRED) and time.monotonic() < deadline:
        time.sleep(0.02)
    left_counts, left_events = rig.sender.drain(2)
    assert len(backend.to(PRED)) == 1
    assert (left_counts, left_events) == ([], [])


def test_drain_gui_not_moi_thu_mot_lan_tra_phan_con_lai(backend, rig):
    backend.respond(PRED, (503, {}))
    rig.queue.put(WS, 2, 0)
    rig.sender.submit(event())
    left_counts, left_events = rig.sender.drain(10)
    assert left_counts == [] and len(backend.to(COUNTS)) == 1
    assert len(left_events) == 1 and len(backend.to(PRED)) == 1
```

Run: `.\.venv\Scripts\python -m pytest tests/test_sender.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'swiftletcare_ai.sender'`.

- [ ] **Step 3: Viết `ai-vision/swiftletcare_ai/sender.py`**

```python
"""Luong gui rieng co hang doi - cho DUY NHAT goi HTTP toi backend (spec 5). Khong bao gio log khoa."""
import json
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

import requests

from .config import EnvConfig
from .logjson import JsonLog
from .payloads import counts_payload, heartbeat_payload, predator_metadata
from .snapshot import shrink_jpeg
from .timeutil import utc_iso
from .windows import CountQueue

RETRY_DELAYS = (5, 15, 30, 60, 120)
TIMEOUT = (5, 10)
PATHS = {
    'counts': '/api/ai/bird-counts',
    'predator': '/api/ai/predator-detections',
    'heartbeat': '/api/ai/heartbeat',
}
_REASONS = {
    400: 'payload sai - code AI co bug',
    413: 'qua lon',
    415: 'backend tu choi kieu du lieu - code AI co bug',
}


@dataclass
class PendingEvent:
    cls: str
    at: datetime
    confidence: float
    jpeg: bytes
    retries: int = 0
    next_try: float = 0.0
    shrunk: bool = False


def _body(resp):
    try:
        return resp.json()
    except ValueError:
        return None


def _error(resp) -> tuple[str | None, object]:
    body = _body(resp)
    if isinstance(body, dict) and isinstance(body.get('error'), dict):
        return body['error'].get('code'), body['error'].get('details')
    return None, None


class Sender:
    def __init__(self, camera: str, env: EnvConfig, queue: CountQueue, log: JsonLog,
                 release: Callable[[str], None], clock, retry_delays=RETRY_DELAYS,
                 heartbeat_every: float | None = None, tick: float = 0.2):
        self.camera = camera
        self.queue = queue
        self.log = log
        self.fatal: str | None = None
        self._url = env.backend_url
        self._key = env.service_key
        self._max_bytes = env.snapshot_max_bytes
        self._release = release
        self._clock = clock
        self._delays = tuple(retry_delays)
        self._heartbeat_every = heartbeat_every
        self._next_heartbeat = clock.monotonic() if heartbeat_every else None
        self._tick = tick
        self._events: list[PendingEvent] = []
        self._counts_due = False
        self._counts_attempt = 0
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._session = requests.Session()

    # ---- goi tu luong xu ly video ----

    def wake_counts(self) -> None:
        with self._lock:
            self._counts_due = True
        self._wake.set()

    def submit(self, ev: PendingEvent) -> None:
        with self._lock:
            self._events.append(ev)
        self._wake.set()

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name=f'sender-{self.camera}', daemon=True)
        self._thread.start()

    def drain(self, seconds: float):
        self._stop.set()
        self._wake.set()
        if self._thread is not None:
            self._thread.join(timeout=seconds)
        deadline = self._clock.monotonic() + seconds
        if self.fatal is None and self._clock.monotonic() < deadline:
            self.send_counts()
        with self._lock:
            events = list(self._events)
        for ev in events:
            if self.fatal is not None or self._clock.monotonic() >= deadline:
                break
            if self.send_event(ev):
                with self._lock:
                    self._events.remove(ev)
        with self._lock:
            return self.queue.pending(), list(self._events)

    # ---- vong lap cua luong gui ----

    def _run(self) -> None:
        while not self._stop.is_set() and self.fatal is None:
            try:
                self.run_once()
            except Exception as e:  # luong gui khong duoc chet vi mot loi le
                self.log.error('error', where='sender', message=f'{e.__class__.__name__}: {e}')
            self._wake.wait(self._tick)
            self._wake.clear()

    def run_once(self) -> None:
        if self.fatal is not None:
            return
        with self._lock:
            due, self._counts_due = self._counts_due, False
        if due:
            self.send_counts()
        now = self._clock.monotonic()
        with self._lock:
            ready = [e for e in self._events if e.next_try <= now]
        for ev in ready:
            if self.fatal is not None:
                return
            if self.send_event(ev):
                with self._lock:
                    self._events.remove(ev)
        if self._next_heartbeat is not None and self.fatal is None and now >= self._next_heartbeat:
            self._next_heartbeat = now + self._heartbeat_every
            self.send_heartbeat()

    # ---- HTTP ----

    def _post(self, path: str, **kwargs):
        try:
            return self._session.post(self._url + path, headers={'X-Service-Key': self._key}, timeout=TIMEOUT, **kwargs)
        except requests.RequestException:
            return None

    def _check_fatal(self, status: int, resp) -> bool:
        if status == 401:
            self.fatal = 'sai khoa dich vu, kiem tra AI_SERVICE_KEY trong .env'
        elif status == 404 and _error(resp)[0] == 'CAMERA_NOT_FOUND':
            self.fatal = f'camera {self.camera} khong co trong CSDL, da ngung dung hoac khong phai CAMERA'
        elif status == 404:
            self.fatal = 'sai duong dan (404), kiem tra BACKEND_URL trong .env'
        else:
            return False
        return True

    def send_counts(self) -> None:
        for ws, i, o in self.queue.expire(self._clock.now()):
            self.log.warning('counts.dropped', windowStart=utc_iso(ws), **{'in': i, 'out': o}, status=None,
                             code=None, reason='cua so dong qua 60 phut chua gui duoc - nhap tay neu can')
        items = self.queue.batch()
        if not items:
            return
        self._counts_attempt += 1
        resp = self._post(PATHS['counts'], json=counts_payload(self.camera, items))
        status = resp.status_code if resp is not None else None
        windows = [{'windowStart': utc_iso(ws), 'in': i, 'out': o} for ws, i, o in items]
        if status == 200:
            self.queue.ack(items)
            self.log.info('counts.sent', windows=windows, attempt=self._counts_attempt, status=200)
            self._counts_attempt = 0
            return
        if status is None or status >= 500:
            self.log.warning('counts.sent', windows=windows, attempt=self._counts_attempt, status=status)
            return
        if self._check_fatal(status, resp):
            return
        code, details = _error(resp)
        level = 'error' if status in (400, 415) else 'warning'
        for ws, i, o in items:
            self.log.write(level, 'counts.dropped', windowStart=utc_iso(ws), **{'in': i, 'out': o}, status=status,
                           code=code, reason=_REASONS.get(status, f'ma {status}'), details=details)
        self.queue.ack(items)
        self._counts_attempt = 0

    def send_event(self, ev: PendingEvent) -> bool:
        """True = xong (gui duoc hoac bo), False = giu lai cho lan thu sau."""
        meta = predator_metadata(self.camera, ev.cls, ev.confidence, ev.at)
        resp = self._post(PATHS['predator'], data={'metadata': json.dumps(meta)},
                          files={'image': ('snapshot.jpg', ev.jpeg, 'image/jpeg')})
        status = resp.status_code if resp is not None else None
        base = {'class': ev.cls, 'at': meta['at'], 'attempt': ev.retries + 1, 'status': status}
        if status == 200:
            body = _body(resp)
            body = body if isinstance(body, dict) else {}
            self.log.info('predator.sent', **base, created=body.get('created'), alertId=body.get('alertId'),
                          skipReason=body.get('skipReason'))
            return True
        if status == 413 and not ev.shrunk:
            ev.shrunk = True
            try:
                ev.jpeg = shrink_jpeg(ev.jpeg, self._max_bytes)
            except ValueError:
                pass
            else:
                return self.send_event(ev)
        if status is None or status >= 500:
            if ev.retries < len(self._delays):
                ev.next_try = self._clock.monotonic() + self._delays[ev.retries]
                ev.retries += 1
                self.log.warning('predator.sent', **base, created=None, alertId=None, skipReason=None)
                return False
            self.log.warning('predator.dropped', **base, code=None, reason='het lan thu lai - nha cooldown')
            self._release(ev.cls)
            return True
        if self._check_fatal(status, resp):
            return True
        code, details = _error(resp)
        if status == 413:
            reason = f'anh qua lon ({len(ev.jpeg)} byte) - kiem tra SNAPSHOT_MAX_BYTES hai ben'
        else:
            reason = _REASONS.get(status, f'ma {status}')
        level = 'error' if status in (400, 415) else 'warning'
        self.log.write(level, 'predator.dropped', **base, code=code, reason=reason, details=details)
        return True

    def send_heartbeat(self) -> None:
        resp = self._post(PATHS['heartbeat'], json=heartbeat_payload(self.camera, self._clock.now()))
        status = resp.status_code if resp is not None else None
        if status == 200:
            body = _body(resp)
            rejected = body.get('rejected') if isinstance(body, dict) else None
            if isinstance(rejected, int) and rejected > 0:
                self.log.warning('heartbeat', status=200, rejected=rejected)
            else:
                self.log.info('heartbeat', status=200)
            return
        if status is not None and self._check_fatal(status, resp):
            return
        level = 'error' if status in (400, 415) else 'warning'
        self.log.write(level, 'heartbeat', status=status)
```

- [ ] **Step 4: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_sender.py -v`
Expected: PASS mọi test (ba test dùng `ai_fixtures_dir` fail có chủ ý nếu fixture hợp đồng chưa merge). Nếu `test_predator_200_multipart_dung` fail ở `req.parts`: xem lại kết quả S6 (Task 1), dùng `superpowers:systematic-debugging`.

- [ ] **Step 5: Commit**

```powershell
git add ai-vision/swiftletcare_ai/sender.py ai-vision/tests/fake_backend.py ai-vision/tests/test_sender.py
git commit -m "feat(ai-vision): luồng gửi theo bảng mã trả về, thử lại 5 lần, dừng khi 401/404, heartbeat, gửi nốt khi dừng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Phát video (playlist, bỏ khung theo giờ thật, khung lỗi) và bộ nhận dạng

**Files:**
- Create: `ai-vision/swiftletcare_ai/video.py`, `ai-vision/swiftletcare_ai/detector.py`, `ai-vision/tests/fakes.py`, `ai-vision/tests/test_video.py`, `ai-vision/tests/test_detector.py`, `ai-vision/spikes/check_seek.py`

**Interfaces:**
- Consumes: `JsonLog` (Task 5), `FakeClock` (Task 3), `ConfigError`, `SWIFTLET`, `PREDATOR_CLASSES` (Task 4), kết quả S4, S5 (Task 1).
- Produces:
  - `video.py`: `class VideoOpenError(Exception)`; `@dataclass Frame(image: np.ndarray, video_index: int, path: Path, pos: float, new_video: bool, fps: float)` — `pos` tính từ đầu **playlist** ở `offline`, từ đầu **video** ở `live`; `class VideoPlayer: __init__(self, camera: str, paths: tuple[Path, ...], log: JsonLog, clock, opener=cv2.VideoCapture, process_fps: float | None = None)`; `check_all() -> float` (mở thử mọi video, trả fps video đầu); `first_frames(n: int) -> list[np.ndarray]`; `offline() -> Iterator[Frame]` (một lượt, không bỏ khung trừ khi `process_fps` nhỏ hơn fps video); `live() -> Iterator[Frame]` (lặp vô hạn, theo giờ thật, bỏ khung khi chậm); bộ đếm `processed: int`, `skipped: int`.
  - `detector.py`: `class Detector: __init__(self, weights: Path, imgsz: int | None = None)`, thuộc tính `names: dict[int, str]`, `__call__(frame) -> sv.Detections`; `require_classes(names: dict[int, str]) -> None` (thiếu lớp nào thì `ConfigError`); `measure_fps(detect: Callable[[np.ndarray], object], frames: list[np.ndarray], warmup: int = 5) -> float`.
  - `tests/fakes.py`: `FakeCapture(n=50, fps=10.0, bad=(), opened=True, size=(48, 64))` (khung thứ `i` có mọi điểm ảnh = `i % 256`), `fake_opener(specs: dict[str, dict]) -> Callable[[str], FakeCapture]` (khóa là tên file), `value(frame) -> int`.

- [ ] **Step 1: Viết `tests/fakes.py` và test (phải fail)**

`ai-vision/tests/fakes.py`:

```python
"""Ban gia cho video va mo hinh: test khong can file video hay best.pt."""
from pathlib import Path

import cv2
import numpy as np


class FakeCapture:
    def __init__(self, n=50, fps=10.0, bad=(), opened=True, size=(48, 64)):
        self.n, self.fps, self.bad, self.opened, self.size = n, fps, set(bad), opened, size
        self.pos = 0

    def isOpened(self):
        return self.opened

    def get(self, prop):
        return {cv2.CAP_PROP_FPS: self.fps, cv2.CAP_PROP_FRAME_COUNT: float(self.n)}.get(prop, 0.0)

    def read(self):
        if self.pos >= self.n:
            return False, None
        i = self.pos
        self.pos += 1
        if i in self.bad:
            return False, None
        return True, np.full((*self.size, 3), i % 256, dtype=np.uint8)

    def grab(self):
        return self.read()[0]

    def release(self):
        pass


def fake_opener(specs: dict[str, dict]):
    return lambda path: FakeCapture(**specs[Path(path).name])


def value(frame) -> int:
    return int(frame[0, 0, 0])
```

`ai-vision/tests/test_video.py`:

```python
import io
import json
import math
from datetime import datetime, timezone
from itertools import islice
from pathlib import Path

import pytest

from fakes import fake_opener, value
from swiftletcare_ai.logjson import JsonLog
from swiftletcare_ai.timeutil import FakeClock
from swiftletcare_ai.video import VideoOpenError, VideoPlayer

T = datetime(2026, 10, 12, 10, 0, 0, tzinfo=timezone.utc)
A, B = Path('data/videos/A.mp4'), Path('data/videos/B.mp4')


def player(specs, paths=(A,), process_fps=None, clock=None, log_stream=None):
    clock = clock or FakeClock(T)
    log = JsonLog('H1-F0-CAMERA', None, clock, log_stream or io.StringIO())
    return VideoPlayer('H1-F0-CAMERA', paths, log, clock, opener=fake_opener(specs), process_fps=process_fps), clock


def test_offline_doc_het_theo_thu_tu_va_noi_playlist():
    p, _ = player({'A.mp4': {'n': 3, 'fps': 10}, 'B.mp4': {'n': 2, 'fps': 5}}, paths=(A, B))
    frames = list(p.offline())
    assert [(f.video_index, value(f.image)) for f in frames] == [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1)]
    assert [round(f.pos, 3) for f in frames] == [0.0, 0.1, 0.2, 0.3, 0.5]
    assert [f.new_video for f in frames] == [True, False, False, True, False]
    assert p.processed == 5 and p.skipped == 0


def test_offline_process_fps_gioi_han_so_khung():
    p, _ = player({'A.mp4': {'n': 10, 'fps': 10}}, process_fps=5)
    assert [value(f.image) for f in p.offline()] == [0, 2, 4, 6, 8]
    assert p.skipped == 5


def test_khung_loi_giua_chung_bo_qua_va_log():
    stream = io.StringIO()
    p, _ = player({'A.mp4': {'n': 5, 'bad': {2}}}, log_stream=stream)
    assert [value(f.image) for f in p.offline()] == [0, 1, 3, 4]
    [line] = [json.loads(l) for l in stream.getvalue().splitlines()]
    assert (line['type'], line['file'], line['frame']) == ('video.frame_error', 'A.mp4', 2)


def test_video_khong_mo_duoc_bao_ten_file_va_camera():
    p, _ = player({'A.mp4': {'opened': False}})
    with pytest.raises(VideoOpenError) as e:
        p.check_all()
    assert 'A.mp4' in str(e.value) and 'H1-F0-CAMERA' in str(e.value)


@pytest.mark.parametrize('fps', [0.0, math.nan, -1.0])
def test_video_fps_hong_thi_dung(fps):
    p, _ = player({'A.mp4': {'fps': fps}})
    with pytest.raises(VideoOpenError, match='fps'):
        p.check_all()


def test_check_all_tra_fps_video_dau():
    p, _ = player({'A.mp4': {'fps': 25}, 'B.mp4': {'fps': 30}}, paths=(A, B))
    assert p.check_all() == 25


def test_first_frames():
    p, _ = player({'A.mp4': {'n': 40}})
    assert [value(f) for f in p.first_frames(30)] == list(range(30))
    p, _ = player({'A.mp4': {'n': 7}})
    assert len(p.first_frames(30)) == 7


def test_live_cham_thi_bo_khung_va_khong_vuot_gio_that():
    p, clock = player({'A.mp4': {'n': 1000, 'fps': 10}})
    seen = []
    for f in islice(p.live(), 6):
        assert f.pos <= clock.monotonic() + 1e-9          # khung khong bao gio di truoc gio that
        seen.append(value(f.image))
        clock.advance(0.25)                                # xu ly cham: 4 khung/giay < 10
    assert seen == [0, 2, 5, 7, 10, 12]
    assert p.skipped == 7


def test_live_nhanh_thi_cho_dung_toc_do_phat():
    p, clock = player({'A.mp4': {'n': 1000, 'fps': 10}})
    frames = list(islice(p.live(), 10))
    assert [value(f.image) for f in frames] == list(range(10))
    assert clock.monotonic() == pytest.approx(0.9)


def test_live_process_fps():
    p, _ = player({'A.mp4': {'n': 1000, 'fps': 10}}, process_fps=2)
    assert [value(f.image) for f in islice(p.live(), 4)] == [0, 5, 10, 15]


def test_live_het_playlist_quay_lai_dau_va_bao_doi_video():
    p, _ = player({'A.mp4': {'n': 3}, 'B.mp4': {'n': 3}}, paths=(A, B))
    frames = list(islice(p.live(), 8))
    assert [f.video_index for f in frames] == [0, 0, 0, 1, 1, 1, 0, 0]
    assert [f.new_video for f in frames] == [True, False, False, True, False, False, True, False]
```

`ai-vision/tests/test_detector.py`:

```python
import time
from pathlib import Path

import numpy as np
import pytest

from swiftletcare_ai.config import AI_DIR, ConfigError
from swiftletcare_ai.detector import measure_fps, require_classes

WEIGHTS = AI_DIR / 'data' / 'weights' / 'best.pt'


def test_measure_fps_bo_5_khung_dau():
    calls = []

    def detect(frame):
        calls.append(frame)
        time.sleep(0.2 if len(calls) <= 5 else 0.02)

    fps = measure_fps(detect, [np.zeros((2, 2, 3))] * 30)
    assert len(calls) == 30
    assert 10 < fps < 60


def test_measure_fps_it_khung_bao_loi():
    with pytest.raises(ValueError):
        measure_fps(lambda f: None, [np.zeros((2, 2, 3))] * 5)


def test_detector_thieu_file_trong_so_bao_ro(tmp_path):
    from swiftletcare_ai.detector import Detector
    with pytest.raises(ConfigError, match='download_weights'):
        Detector(tmp_path / 'khong-co.pt')


def test_require_classes():
    require_classes({0: 'swiftlet', 1: 'rat', 2: 'snake', 3: 'owl'})
    with pytest.raises(ConfigError, match='owl'):
        require_classes({0: 'swiftlet', 1: 'rat', 2: 'snake'})


@pytest.mark.skipif(not WEIGHTS.is_file(), reason='chua co data/weights/best.pt (chay scripts/download_weights.py)')
def test_mo_hinh_that_nap_duoc_va_du_lop(ai_fixtures_dir):
    import cv2
    from swiftletcare_ai.detector import Detector
    d = Detector(WEIGHTS)
    require_classes(d.names)
    dets = d(cv2.imread(str(ai_fixtures_dir / 'snake.jpg')))
    assert len(dets.xyxy) == len(dets.class_id)
```

Run: `.\.venv\Scripts\python -m pytest tests/test_video.py tests/test_detector.py -v`
Expected: FAIL `ModuleNotFoundError`.

- [ ] **Step 2: Viết `ai-vision/swiftletcare_ai/video.py`**

```python
"""Phat playlist: offline mot luot; live theo gio that, bo khung khi CPU cham, lap lai khi het (spec 3.4, 4.1)."""
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import cv2
import numpy as np

from .logjson import JsonLog

MAX_BAD = 30  # so khung loi lien tiep toi da truoc khi coi nhu het video


class VideoOpenError(Exception):
    pass


@dataclass
class Frame:
    image: np.ndarray
    video_index: int
    path: Path
    pos: float
    new_video: bool
    fps: float


class VideoPlayer:
    def __init__(self, camera: str, paths: tuple[Path, ...], log: JsonLog, clock,
                 opener=cv2.VideoCapture, process_fps: float | None = None):
        self.camera = camera
        self.paths = paths
        self.log = log
        self.clock = clock
        self._opener = opener
        self._pf = process_fps
        self.processed = 0
        self.skipped = 0

    def _open(self, path: Path):
        cap = self._opener(str(path))
        if not cap.isOpened():
            raise VideoOpenError(f'camera {self.camera}: khong mo duoc video {path}')
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps or not math.isfinite(fps) or fps <= 0:
            cap.release()
            raise VideoOpenError(f'camera {self.camera}: video {path} co fps khong hop le ({fps})')
        return cap, fps, int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    def _bad(self, path: Path, idx: int, total: int, bad: int) -> bool:
        """True = bo qua khung loi va doc tiep; False = coi nhu het video."""
        if total and idx < total and bad < MAX_BAD:
            self.log.warning('video.frame_error', file=path.name, frame=idx)
            return True
        return False

    def check_all(self) -> float:
        first = None
        for path in self.paths:
            cap, fps, _ = self._open(path)
            cap.release()
            first = fps if first is None else first
        return first

    def first_frames(self, n: int) -> list[np.ndarray]:
        cap, _, _ = self._open(self.paths[0])
        frames = []
        try:
            while len(frames) < n:
                ok, img = cap.read()
                if not ok:
                    break
                frames.append(img)
        finally:
            cap.release()
        return frames

    def offline(self) -> Iterator[Frame]:
        offset = 0.0
        for vi, path in enumerate(self.paths):
            cap, fps, total = self._open(path)
            idx, bad, last_slot, first = -1, 0, -1, True
            try:
                while True:
                    ok, img = cap.read()
                    idx += 1
                    if not ok:
                        if self._bad(path, idx, total, bad):
                            bad += 1
                            continue
                        break
                    bad = 0
                    if self._pf and self._pf < fps:
                        slot = int(idx * self._pf / fps)
                        if slot == last_slot:
                            self.skipped += 1
                            continue
                        last_slot = slot
                    self.processed += 1
                    yield Frame(img, vi, path, offset + idx / fps, first, fps)
                    first = False
            finally:
                cap.release()
            offset += idx / fps

    def live(self) -> Iterator[Frame]:
        clock = self.clock
        while True:
            for vi, path in enumerate(self.paths):
                cap, fps, total = self._open(path)
                start = clock.monotonic()
                idx, bad, first, last_proc = -1, 0, True, None
                try:
                    while True:
                        if self._pf and last_proc is not None:
                            gap = 1 / self._pf - (clock.monotonic() - last_proc)
                            if gap > 0:
                                clock.sleep(gap)
                        elapsed = clock.monotonic() - start
                        want = int(elapsed * fps + 1e-9)
                        if want <= idx:
                            clock.sleep((idx + 1) / fps - elapsed)
                            continue
                        ended = False
                        while idx < want - 1:
                            idx += 1
                            if cap.grab():
                                self.skipped += 1
                            elif not self._bad(path, idx, total, bad):
                                ended = True
                                break
                            else:
                                bad += 1
                        if ended:
                            break
                        ok, img = cap.read()
                        idx += 1
                        if not ok:
                            if self._bad(path, idx, total, bad):
                                bad += 1
                                continue
                            break
                        bad = 0
                        self.processed += 1
                        last_proc = clock.monotonic()
                        yield Frame(img, vi, path, idx / fps, first, fps)
                        first = False
                finally:
                    cap.release()
```

`+ 1e-9` trong `want` chống sai số dấu phẩy động (VD `0.3 * 10 = 2.9999…`).

- [ ] **Step 3: Viết `ai-vision/swiftletcare_ai/detector.py`**

Theo S4/S5 (Task 1): nếu `Detections.from_ultralytics` khác tên thì sửa đúng một dòng trong `__call__`.

```python
"""Bo nhan dang Ultralytics (YOLOv8n da train 4 lop) va do fps khi khoi dong (spec 3.4)."""
import time
from pathlib import Path
from typing import Callable

import numpy as np
import supervision as sv

from .config import PREDATOR_CLASSES, SWIFTLET, ConfigError


class Detector:
    def __init__(self, weights: Path, imgsz: int | None = None):
        if not Path(weights).is_file():
            raise ConfigError(f'chua co trong so {weights} (chay scripts/download_weights.py)')
        from ultralytics import YOLO  # nap cham, chi khi can mo hinh that
        self._model = YOLO(str(weights))
        self._imgsz = imgsz
        self.names: dict[int, str] = dict(self._model.names)

    def __call__(self, frame: np.ndarray) -> sv.Detections:
        kwargs = {'verbose': False}
        if self._imgsz:
            kwargs['imgsz'] = self._imgsz
        return sv.Detections.from_ultralytics(self._model.predict(frame, **kwargs)[0])


def require_classes(names: dict[int, str]) -> None:
    missing = [c for c in (SWIFTLET, *PREDATOR_CLASSES) if c not in names.values()]
    if missing:
        raise ConfigError(f'trong so thieu lop: {", ".join(missing)} (co: {sorted(names.values())})')


def measure_fps(detect: Callable[[np.ndarray], object], frames: list[np.ndarray], warmup: int = 5) -> float:
    if len(frames) <= warmup:
        raise ValueError(f'can hon {warmup} khung de do fps')
    for f in frames[:warmup]:
        detect(f)
    t = time.perf_counter()
    for f in frames[warmup:]:
        detect(f)
    return (len(frames) - warmup) / max(time.perf_counter() - t, 1e-9)
```

- [ ] **Step 4: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_video.py tests/test_detector.py -v`
Expected: PASS mọi test; `test_mo_hinh_that_nap_duoc_va_du_lop` hiện `SKIPPED (chua co data/weights/best.pt …)` cho tới Task 13.

- [ ] **Step 5: Viết `ai-vision/spikes/check_seek.py` (S17, chạy khi đã có video thật)**

```python
"""Do toc do grab (bo khung) so voi read tren video that (spec 3.5). Chay: .\\.venv\\Scripts\\python spikes\\check_seek.py data\\videos\\V01.mp4"""
import sys
import time

import cv2

cap = cv2.VideoCapture(sys.argv[1])
print('fps video', cap.get(cv2.CAP_PROP_FPS), 'so khung', cap.get(cv2.CAP_PROP_FRAME_COUNT))
t = time.perf_counter()
for _ in range(300):
    cap.read()
read_ms = (time.perf_counter() - t) / 300 * 1000
t = time.perf_counter()
for _ in range(300):
    cap.grab()
grab_ms = (time.perf_counter() - t) / 300 * 1000
print(f'read {read_ms:.2f} ms/khung, grab {grab_ms:.2f} ms/khung')
```

- [ ] **Step 6: Kiểm tay S17 (khi đã có ít nhất một video thật)**

Run: `.\.venv\Scripts\python spikes\check_seek.py data\videos\V01.mp4`
Expected: in `read … ms/khung, grab … ms/khung`. Ghi S17 vào `RESULTS.md`. Nếu `grab` không nhanh hơn `read` đáng kể và fps máy thấp hơn fps video nhiều, ghi rõ — Task 15 Step 7 (so sánh offline với live) đo ảnh hưởng.

- [ ] **Step 7: Commit**

```powershell
git add ai-vision/swiftletcare_ai/video.py ai-vision/swiftletcare_ai/detector.py ai-vision/tests/fakes.py ai-vision/tests/test_video.py ai-vision/tests/test_detector.py ai-vision/spikes/check_seek.py ai-vision/spikes/RESULTS.md
git commit -m "feat(ai-vision): phát playlist theo giờ thật có bỏ khung, bỏ qua khung lỗi, bộ nhận dạng và đo fps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Ráp luồng xử lý — lệnh `live`, `offline`, dừng và Ctrl+C

**Files:**
- Create: `ai-vision/swiftletcare_ai/pipeline.py`, `ai-vision/swiftletcare_ai/app.py`, `ai-vision/swiftletcare_ai/__main__.py`, `ai-vision/tests/test_pipeline.py`, `ai-vision/tests/test_app.py`
- Modify: `ai-vision/tests/fakes.py` (thêm `NAMES`, `detections`, `FakeDetector`, `FakeTracker`)

**Interfaces:**
- Consumes: mọi thứ của Task 2–11: `LineCounter`; `utc_iso`, `parse_utc`, `SystemClock`, `FakeClock`; `load_camera_config`, `load_env`, `check_confirm_fps`, `ConfigError`, `CAMERAS`, `AI_DIR`, `SWIFTLET`, `PREDATOR_CLASSES`; `JsonLog`; `acquire`, `release`, `lock_path`, `LockExists`; `WindowCounter`, `CountQueue`; `PredatorConfirmer`, `Box`, `Confirmed`, `Blocked`; `encode_snapshot`; `Sender`, `PendingEvent`, `RETRY_DELAYS`; `VideoPlayer`, `VideoOpenError`; `Detector`, `require_classes`, `measure_fps`.
- Produces:
  - `pipeline.py`: `class Pipeline: __init__(self, cfg: CameraConfig, names: dict[int, str], windows: WindowCounter, confirmer: PredatorConfirmer, log: JsonLog, on_crossing: Callable[[datetime, str, int], None], on_confirmed: Callable[[Confirmed], None], make_tracker: Callable[[float], object])`; `new_video(fps: float) -> None`; `process(frame: np.ndarray, dets: sv.Detections, at: datetime) -> None`. Ghi log `predator.confirmed` và `predator.cooldown_blocked`.
  - `app.py`: `EXIT_OK = 0`, `EXIT_ERROR = 1`, `EXIT_STOP = 2`, `EXIT_INTERRUPT = 130`; `make_tracker(fps: float)` (chỗ **duy nhất** tạo ByteTrack); `@dataclass Timing(counts_every=60, heartbeat_every=30, retry_delays=RETRY_DELAYS, drain_seconds=10, fps_log_every=60, tick=0.2)`; `@dataclass Deps(clock, opener, make_detector, make_tracker, timing, stream, ai_dir)`; `run_live(camera: str, weights: Path, imgsz: int | None, heartbeat: bool, deps: Deps) -> int`; `run_offline(camera: str, out: Path, weights: Path, imgsz: int | None, t0: datetime | None, playlist: list[str] | None, deps: Deps) -> int`.
  - `__main__.py`: `build_parser() -> argparse.ArgumentParser`, `main(argv: list[str] | None = None) -> int`.
  - `fakes.py` thêm: `NAMES = {0: 'swiftlet', 1: 'rat', 2: 'snake', 3: 'owl'}`; `detections(items: list[tuple[str, float, tuple]]) -> sv.Detections`; `FakeDetector(script=None, interrupt_at=None, on_interrupt=None, error_at=None)` — `script(i)` nhận số thứ tự lần gọi (bắt đầu 0, **kể cả 30 lần đo fps của `live`**), trả danh sách `(lớp, confidence, xyxy)`; `FakeTracker` gán `tracker_id = int(x1 // 10) + 1`; `bird_up(i, start, x=28.0, h=48)`.

- [ ] **Step 1: Thêm vào `tests/fakes.py`**

```python
import supervision as sv

NAMES = {0: 'swiftlet', 1: 'rat', 2: 'snake', 3: 'owl'}
_IDS = {v: k for k, v in NAMES.items()}


def detections(items) -> sv.Detections:
    if not items:
        return sv.Detections.empty()
    return sv.Detections(
        xyxy=np.array([xyxy for _, _, xyxy in items], dtype=float),
        confidence=np.array([c for _, c, _ in items], dtype=float),
        class_id=np.array([_IDS[n] for n, _, _ in items]),
    )


class FakeDetector:
    def __init__(self, script=None, interrupt_at=None, on_interrupt=None, error_at=None):
        self.names = NAMES
        self.calls = 0
        self._script, self._interrupt_at, self._on_interrupt, self._error_at = script, interrupt_at, on_interrupt, error_at

    def __call__(self, frame):
        i = self.calls
        self.calls += 1
        if i == self._interrupt_at:
            if self._on_interrupt:
                self._on_interrupt()
            raise KeyboardInterrupt
        if i == self._error_at:
            raise RuntimeError('loi gia trong mo hinh')
        return detections(self._script(i) if self._script else [])


class FakeTracker:
    """id = int(x1 // 10) + 1: hai con chim o hai cot x khac nhau co hai id khac nhau."""
    def update_with_detections(self, dets: sv.Detections) -> sv.Detections:
        dets.tracker_id = (dets.xyxy[:, 0] // 10).astype(int) + 1 if len(dets) else np.array([], dtype=int)
        return dets


def bird_up(i: int, start: int, x: float = 28.0, h: int = 48) -> list:
    """Mot con chim bay tu duoi len qua vach y = 0.55 * h trong 11 lan goi tu start (qua vach giua k = 4 va 5)."""
    k = i - start
    if not 0 <= k <= 10:
        return []
    y = h * 0.85 - k * (h * 0.07)
    return [('swiftlet', 0.9, (x, y - 3, x + 8, y + 3))]
```

- [ ] **Step 2: Viết test pipeline (phải fail)**

`ai-vision/tests/test_pipeline.py`:

```python
import io
import json
from datetime import datetime, timedelta, timezone

import numpy as np

from conftest import camera_data, write_yaml
from fakes import NAMES, FakeTracker, bird_up, detections
from swiftletcare_ai.config import load_camera_config
from swiftletcare_ai.logjson import JsonLog
from swiftletcare_ai.pipeline import Pipeline
from swiftletcare_ai.predators import PredatorConfirmer
from swiftletcare_ai.timeutil import FakeClock
from swiftletcare_ai.windows import WindowCounter

T = datetime(2026, 10, 12, 10, 0, 0, tzinfo=timezone.utc)
FRAME = np.zeros((48, 64, 3), dtype=np.uint8)


def build(tmp_path):
    cfg = load_camera_config(write_yaml(tmp_path, camera_data()), tmp_path)
    stream = io.StringIO()
    log = JsonLog('H1-F0-CAMERA', None, FakeClock(T), stream)
    closed, crossings, confirmed = [], [], []
    windows = WindowCounter(lambda *a: closed.append(a))
    p = Pipeline(cfg, NAMES, windows, PredatorConfirmer(cfg.predator), log,
                 lambda *a: crossings.append(a), confirmed.append, lambda fps: FakeTracker())
    p.new_video(10)
    return p, windows, closed, crossings, confirmed, stream


def at(i):
    return T + timedelta(seconds=i / 10)


def test_chim_bay_len_qua_vach_tinh_out(tmp_path):
    p, windows, _, crossings, _, _ = build(tmp_path)
    for i in range(12):
        p.process(FRAME, detections(bird_up(i, 0)), at(i))
    assert windows.current() == (T, 0, 1)
    assert [(c[1], c[2]) for c in crossings] == [('out', 3)]


def test_chim_duoi_nguong_tin_cay_khong_vao_tracker(tmp_path):
    p, windows, _, crossings, _, _ = build(tmp_path)
    for i in range(12):
        items = [(n, 0.3, xyxy) for n, _, xyxy in bird_up(i, 0)]
        p.process(FRAME, detections(items), at(i))
    assert crossings == [] and windows.current() == (T, 0, 0)


def test_thien_dich_khong_di_qua_tracker(tmp_path):
    p, _, _, crossings, _, _ = build(tmp_path)
    for i in range(12):
        items = [('rat', 0.9, xyxy) for _, _, xyxy in bird_up(i, 0)]
        p.process(FRAME, detections(items), at(i))
    assert crossings == []


def test_xac_nhan_thien_dich_log_va_goi_on_confirmed(tmp_path):
    p, _, _, _, confirmed, stream = build(tmp_path)
    box = (5.0, 5.0, 20.0, 20.0)
    for i, conf in enumerate([0.6, 0.95, 0.7]):
        p.process(FRAME, detections([('snake', conf, box), ('snake', 0.55, box), ('owl', 0.4, box)]), at(i))
    [c] = confirmed
    assert (c.cls, c.confidence, c.at) == ('snake', 0.95, at(1))
    assert [b.cls for b in c.boxes] == ['snake', 'snake']           # owl 0.4 < 0.5 khong ve
    [line] = [json.loads(l) for l in stream.getvalue().splitlines()]
    assert (line['type'], line['class'], line['confidence'], line['at']) == ('predator.confirmed', 'snake', 0.95, '2026-10-12T10:00:00Z')


def test_xac_nhan_bi_chan_ghi_cooldown_blocked(tmp_path):
    p, _, _, _, confirmed, stream = build(tmp_path)
    for i in range(6):
        p.process(FRAME, detections([('rat', 0.8, (1.0, 1.0, 9.0, 9.0))]), at(i))
    assert len(confirmed) == 1
    types = [json.loads(l)['type'] for l in stream.getvalue().splitlines()]
    assert types == ['predator.confirmed', 'predator.cooldown_blocked']


def test_doi_video_tao_tracker_va_vach_moi(tmp_path):
    p, windows, _, crossings, _, _ = build(tmp_path)
    for i in range(5):                                  # nua duong, chua qua vach
        p.process(FRAME, detections(bird_up(i, 0)), at(i))
    p.new_video(10)
    for i in range(5, 12):                              # video moi: cung id xuat hien phia tren vach
        p.process(FRAME, detections(bird_up(i, 0)), at(i))
    assert crossings == []


def test_khung_rong_van_cap_nhat_cua_so(tmp_path):
    p, windows, closed, _, _, _ = build(tmp_path)
    p.process(FRAME, detections([]), T)
    p.process(FRAME, detections([]), T + timedelta(minutes=5))
    assert closed == [(T, 0, 0)]
```

Run: `.\.venv\Scripts\python -m pytest tests/test_pipeline.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'swiftletcare_ai.pipeline'`.

- [ ] **Step 3: Viết `ai-vision/swiftletcare_ai/pipeline.py`**

```python
"""Xu ly mot khung: tracker + vach dem + cua so (chi swiftlet), xac nhan thien dich (spec 4.2-4.4)."""
from datetime import datetime
from typing import Callable

import numpy as np
import supervision as sv

from .config import PREDATOR_CLASSES, SWIFTLET, CameraConfig
from .counting import LineCounter
from .logjson import JsonLog
from .predators import Blocked, Box, Confirmed, PredatorConfirmer
from .timeutil import utc_iso
from .windows import WindowCounter


class Pipeline:
    def __init__(self, cfg: CameraConfig, names: dict[int, str], windows: WindowCounter,
                 confirmer: PredatorConfirmer, log: JsonLog,
                 on_crossing: Callable[[datetime, str, int], None],
                 on_confirmed: Callable[[Confirmed], None],
                 make_tracker: Callable[[float], object]):
        self._cfg = cfg
        self._names = names
        self.windows = windows
        self._confirmer = confirmer
        self._log = log
        self._on_crossing = on_crossing
        self._on_confirmed = on_confirmed
        self._make_tracker = make_tracker
        self._tracker = None
        self._line: LineCounter | None = None

    def new_video(self, fps: float) -> None:
        self._tracker = self._make_tracker(fps)
        self._line = None

    def process(self, frame: np.ndarray, dets: sv.Detections, at: datetime) -> None:
        self.windows.observe(at)
        n = len(dets)
        names = np.array([self._names[int(c)] for c in dets.class_id], dtype=object) if n else np.array([], dtype=object)
        conf = dets.confidence if n else np.array([], dtype=float)

        swift = dets[(names == SWIFTLET) & (conf >= self._cfg.swiftlet_confidence)] if n else dets
        tracked = self._tracker.update_with_detections(swift)
        if self._line is None:
            h, w = frame.shape[:2]
            self._line = LineCounter(self._cfg.line.start, self._cfg.line.end, w, h)
        for direction, track_id in self._line.update(tracked):
            self.windows.add(direction, at)
            self._on_crossing(at, direction, track_id)

        boxes = [
            Box(str(names[i]), float(conf[i]), tuple(float(v) for v in dets.xyxy[i]))
            for i in range(n)
            if names[i] in PREDATOR_CLASSES and conf[i] >= self._cfg.predator.confidence
        ]
        for cls in PREDATOR_CLASSES:
            mine = [b.confidence for b in boxes if b.cls == cls]
            if not mine:
                continue
            result = self._confirmer.observe(cls, at, max(mine), frame, boxes)
            if isinstance(result, Confirmed):
                self._log.info('predator.confirmed', **{'class': cls}, confidence=result.confidence, at=utc_iso(result.at))
                self._on_confirmed(result)
            elif isinstance(result, Blocked):
                self._log.info('predator.cooldown_blocked', **{'class': cls}, at=utc_iso(result.at),
                               remainingSeconds=result.remaining_seconds)
```

Ghi chú: `Confirmed.at` là `at` của khung tốt nhất, chưa cắt phần lẻ giây; `utc_iso` cắt khi ghi log và khi gửi, nên log và payload cùng một chuỗi.

- [ ] **Step 4: Chạy test pipeline**

Run: `.\.venv\Scripts\python -m pytest tests/test_pipeline.py -v`
Expected: PASS 7 test.

- [ ] **Step 5: Viết test app (phải fail)**

`ai-vision/tests/test_app.py`:

```python
import _thread
import csv
import io
import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest

from conftest import camera_data, write_yaml
from fake_backend import FakeBackend
from fakes import FakeDetector, FakeTracker, bird_up, fake_opener
from swiftletcare_ai.__main__ import build_parser
from swiftletcare_ai.app import EXIT_ERROR, EXIT_INTERRUPT, EXIT_OK, EXIT_STOP, Deps, Timing, run_live, run_offline
from swiftletcare_ai.lockfile import lock_path
from swiftletcare_ai.sender import PATHS
from swiftletcare_ai.timeutil import FakeClock

T = datetime(2026, 10, 12, 10, 7, 30, tzinfo=timezone.utc)
CAM = 'H1-F0-CAMERA'
KEY = 'khoa-thu-nghiem-0123456789abcdef0123456789'
WEIGHTS = Path('khong-dung-toi.pt')
SNAKE = ('snake', 0.9, (5.0, 5.0, 20.0, 20.0))


@pytest.fixture
def backend():
    with FakeBackend() as b:
        yield b


def setup_ai(tmp_path, backend_url=None, **camera_changes):
    write_yaml(tmp_path / 'cameras', camera_data(**camera_changes))
    # write_yaml tao data/videos trong thu muc truyen vao; video can nam duoi ai_dir
    (tmp_path / 'data' / 'videos').mkdir(parents=True, exist_ok=True)
    (tmp_path / 'data' / 'videos' / 'V01.mp4').write_bytes(b'video')
    if backend_url:
        (tmp_path / '.env').write_text(f'BACKEND_URL={backend_url}\nAI_SERVICE_KEY={KEY}\n', encoding='utf-8')
    return tmp_path


def deps(ai_dir, detector, video=None, **timing):
    return Deps(
        clock=FakeClock(T),
        opener=fake_opener({'V01.mp4': video or {'n': 3000, 'fps': 10}}),
        make_detector=lambda w, s: detector,
        make_tracker=lambda fps: FakeTracker(),
        timing=Timing(**{'counts_every': 1000, 'tick': 0.01, **timing}),
        stream=io.StringIO(),
        ai_dir=ai_dir,
    )


def logs(ai_dir, type_=None):
    path = ai_dir / 'data' / 'logs' / f'{CAM}.log'
    lines = [json.loads(l) for l in path.read_text(encoding='utf-8').splitlines()]
    return [l for l in lines if type_ is None or l['type'] == type_]


# ---- live ----

def test_live_dem_chim_ctrl_c_gui_tong_cuoi_xoa_khoa(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    det = FakeDetector(script=lambda i: bird_up(i, 60), interrupt_at=30 + 700)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, det)) == EXIT_OK
    last = backend.to(PATHS['counts'])[-1].json
    assert last == [{'camera': CAM, 'windowStart': '2026-10-12T10:05:00Z', 'in': 0, 'out': 1}]
    assert not lock_path(ai, CAM).exists()
    assert logs(ai, 'stop')[-1]['exitCode'] == 0


def test_live_gui_tong_moi_60_giay_ke_ca_0_0(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    det = FakeDetector(interrupt_at=30 + 650)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, det, counts_every=60)) == EXIT_OK
    bodies = [r.json for r in backend.to(PATHS['counts'])]
    assert {'camera': CAM, 'windowStart': '2026-10-12T10:05:00Z', 'in': 0, 'out': 0} in bodies[0]


def test_live_thien_dich_gui_mot_su_kien_co_anh(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    det = FakeDetector(script=lambda i: [SNAKE] if 40 <= i <= 60 else [], interrupt_at=120)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, det)) == EXIT_OK
    [req] = backend.to(PATHS['predator'])
    meta = json.loads(req.parts['metadata'][1])
    assert (meta['camera'], meta['class'], meta['confidence']) == (CAM, 'snake', 0.9)
    assert req.parts['image'][1][:3] == b'\xff\xd8\xff'
    assert len(logs(ai, 'predator.confirmed')) == 1
    assert len(logs(ai, 'predator.cooldown_blocked')) == 6


@pytest.mark.parametrize('status,body,word', [
    (401, {'error': {'code': 'UNAUTHENTICATED', 'message': 'x', 'sqlNumber': None, 'details': None}}, 'AI_SERVICE_KEY'),
    (404, {'error': {'code': 'CAMERA_NOT_FOUND', 'message': 'x', 'sqlNumber': None, 'details': None}}, 'CSDL'),
    (404, {'message': 'Cannot POST /api/ai/bird-counts'}, 'BACKEND_URL'),
])
def test_live_401_404_dung_ma_khac_0_xoa_khoa_khong_gui_them(backend, tmp_path, status, body, word):
    backend.respond(PATHS['counts'], (status, body))
    ai = setup_ai(tmp_path, backend.url)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector(), counts_every=1)) == EXIT_STOP
    assert not lock_path(ai, CAM).exists()
    assert len(backend.requests) == 1
    stop = logs(ai, 'stop')[-1]
    assert word in stop['reason'] and stop['exitCode'] == EXIT_STOP
    assert KEY not in (ai / 'data' / 'logs' / f'{CAM}.log').read_text(encoding='utf-8')


def test_live_ctrl_c_lan_hai_thoat_ngay(backend, tmp_path):
    backend.respond(PATHS['counts'], (200, {'windowsUpserted': 1, 'windowsUnchanged': 0}, 1.0))
    ai = setup_ai(tmp_path, backend.url)
    second = lambda: threading.Timer(0.3, _thread.interrupt_main).start()
    det = FakeDetector(interrupt_at=40, on_interrupt=second)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, det)) == EXIT_INTERRUPT
    assert len(backend.requests) == 1
    assert not lock_path(ai, CAM).exists()


def test_live_loi_khong_luong_truoc_gui_not_ma_1(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector(error_at=45))) == EXIT_ERROR
    assert len(backend.to(PATHS['counts'])) == 1
    assert 'RuntimeError' in logs(ai, 'error')[0]['message']
    assert not lock_path(ai, CAM).exists()


def test_live_file_khoa_da_co_thi_dung_khong_xoa_khoa(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    lock = lock_path(ai, CAM)
    lock.parent.mkdir(parents=True)
    lock.write_text('2026-10-12T09:00:00Z\n', encoding='utf-8')
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector())) == EXIT_STOP
    assert lock.exists()
    assert '2026-10-12T09:00:00Z' in logs(ai, 'stop')[0]['reason']


def test_live_thieu_cau_hinh_dung_khong_tao_khoa(tmp_path):
    (tmp_path / '.env').write_text(f'BACKEND_URL=http://127.0.0.1:9\nAI_SERVICE_KEY={KEY}\n', encoding='utf-8')
    assert run_live(CAM, WEIGHTS, None, False, deps(tmp_path, FakeDetector())) == EXIT_STOP
    assert not lock_path(tmp_path, CAM).exists()


def test_live_video_khong_mo_duoc_dung_xoa_khoa(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector(), video={'opened': False})) == EXIT_STOP
    assert not lock_path(ai, CAM).exists()
    assert 'V01.mp4' in logs(ai, 'stop')[0]['reason']


def test_live_khong_thoa_dieu_kien_fps_thi_dung(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url, process_fps=1)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector())) == EXIT_STOP
    assert 'fps' in logs(ai, 'stop')[0]['reason']


def wait_for(cond, seconds=5.0):
    deadline = time.monotonic() + seconds
    while not cond() and time.monotonic() < deadline:
        time.sleep(0.02)


def test_live_heartbeat_chi_khi_bat_co(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    det = FakeDetector(interrupt_at=35, on_interrupt=lambda: time.sleep(0.3))   # cho luong gui co thoi gian chay
    run_live(CAM, WEIGHTS, None, False, deps(ai, det, heartbeat_every=1))
    assert backend.to(PATHS['heartbeat']) == []
    ai2 = setup_ai(tmp_path / 'b', backend.url)
    det = FakeDetector(interrupt_at=35, on_interrupt=lambda: wait_for(lambda: backend.to(PATHS['heartbeat'])))
    run_live(CAM, WEIGHTS, None, True, deps(ai2, det, heartbeat_every=1))
    assert backend.to(PATHS['heartbeat'])[0].json['device'] == CAM


# ---- offline ----

def read_csv(path):
    with path.open(encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def test_offline_ghi_csv_khong_gui_gi(tmp_path):
    ai = setup_ai(tmp_path)                     # khong co .env: offline khong can
    script = lambda i: bird_up(i, 60) + bird_up(i, 150, x=48.0) + ([SNAKE] if 20 <= i <= 22 else [])
    out = tmp_path / 'out'
    code = run_offline(CAM, out, WEIGHTS, None, datetime(2026, 10, 12, 10, 4, 50, tzinfo=timezone.utc), None,
                       deps(ai, FakeDetector(script=script), video={'n': 200, 'fps': 10}))
    assert code == EXIT_OK
    assert read_csv(out / 'counts.csv') == [
        {'camera': CAM, 'windowStart': '2026-10-12T10:00:00Z', 'in': '0', 'out': '1'},
        {'camera': CAM, 'windowStart': '2026-10-12T10:05:00Z', 'in': '0', 'out': '1'},
    ]
    crossings = read_csv(out / 'crossings.csv')
    assert [(c['chieu'], c['track_id']) for c in crossings] == [('out', '3'), ('out', '5')]
    [pred] = read_csv(out / 'predators.csv')
    assert (pred['camera'], pred['class'], pred['confidence']) == (CAM, 'snake', '0.9')
    [snap] = list((out / 'snapshots').glob('*.jpg'))
    assert snap.read_bytes()[:3] == b'\xff\xd8\xff'
    assert logs_offline(out, 'predator.confirmed')


def logs_offline(out, type_):
    lines = [json.loads(l) for l in (out / f'{CAM}.log').read_text(encoding='utf-8').splitlines()]
    return [l for l in lines if l['type'] == type_]


def test_offline_playlist_ghi_de_va_dieu_kien_fps(tmp_path):
    ai = setup_ai(tmp_path, process_fps=1)
    code = run_offline(CAM, tmp_path / 'out', WEIGHTS, None, None, ['data/videos/V01.mp4'],
                       deps(ai, FakeDetector(), video={'n': 20, 'fps': 10}))
    assert code == EXIT_STOP


# ---- dong lenh ----

def test_parser():
    p = build_parser()
    a = p.parse_args(['live', '--camera', CAM, '--heartbeat'])
    assert (a.cmd, a.camera, a.heartbeat, a.imgsz) == ('live', CAM, True, None)
    a = p.parse_args(['offline', '--camera', CAM, '--out', 'data/out/H1', '--t0', '2026-10-12T10:00:00Z',
                      '--playlist', 'data/videos/T01.mp4', '--imgsz', '320'])
    assert (a.out, a.t0, a.playlist, a.imgsz) == (Path('data/out/H1'), '2026-10-12T10:00:00Z', ['data/videos/T01.mp4'], 320)
    with pytest.raises(SystemExit):
        p.parse_args(['live', '--camera', 'H9-F0-CAMERA'])
```

Lưu ý `setup_ai`: `write_yaml(tmp_path / 'cameras', …)` tạo file `cameras/H1-F0-CAMERA.yaml`; playlist `data/videos/V01.mp4` tính từ `ai_dir` nên tạo thêm file giả ở `tmp_path/data/videos/`.

Run: `.\.venv\Scripts\python -m pytest tests/test_app.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'swiftletcare_ai.app'`.

- [ ] **Step 6: Viết `ai-vision/swiftletcare_ai/app.py`**

```python
"""Rap luong: lenh live (gui backend) va offline (ghi CSV). Phu thuoc ngoai di qua Deps de test thay duoc."""
import csv
import dataclasses
import math
import sys
import time
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable

import cv2
import supervision as sv

from .config import AI_DIR, ConfigError, check_confirm_fps, load_camera_config, load_env
from .detector import Detector, measure_fps, require_classes
from .lockfile import LockExists, acquire, lock_path, release
from .logjson import JsonLog
from .pipeline import Pipeline
from .predators import Confirmed, PredatorConfirmer
from .sender import RETRY_DELAYS, PendingEvent, Sender
from .snapshot import encode_snapshot
from .timeutil import SystemClock, utc_iso
from .video import VideoOpenError, VideoPlayer
from .windows import CountQueue, WindowCounter

EXIT_OK, EXIT_ERROR, EXIT_STOP, EXIT_INTERRUPT = 0, 1, 2, 130
FPS_FRAMES = 30


def make_tracker(fps: float):
    """Cho DUY NHAT tao ByteTrack (ten tham so theo S4, Task 1)."""
    return sv.ByteTrack(frame_rate=max(1, round(fps)))


@dataclass
class Timing:
    counts_every: float = 60
    heartbeat_every: float = 30
    retry_delays: tuple = RETRY_DELAYS
    drain_seconds: float = 10
    fps_log_every: float = 60
    tick: float = 0.2


@dataclass
class Deps:
    clock: object = field(default_factory=SystemClock)
    opener: Callable = cv2.VideoCapture
    make_detector: Callable = Detector
    make_tracker: Callable = make_tracker
    timing: Timing = field(default_factory=Timing)
    stream: object = None
    ai_dir: Path = AI_DIR


def _load(camera: str, deps: Deps, need_backend: bool):
    ai = deps.ai_dir
    return load_camera_config(ai / 'cameras' / f'{camera}.yaml', ai), load_env(ai / '.env', need_backend)


def _start(cfg, player: VideoPlayer, deps: Deps, weights: Path, imgsz, measure: bool):
    """Mo thu video, nap mo hinh, kiem dieu kien fps (spec 3.4). Tra (detector, fps_xu_ly)."""
    video_fps = player.check_all()
    detector = deps.make_detector(weights, imgsz)
    require_classes(detector.names)
    fps = min(video_fps, cfg.process_fps or math.inf)
    if measure:
        fps = min(fps, measure_fps(detector, player.first_frames(FPS_FRAMES)))
    check_confirm_fps(cfg.predator.confirm_frames, cfg.predator.confirm_seconds, fps)
    return detector, fps


def run_live(camera: str, weights: Path, imgsz: int | None, heartbeat: bool, deps: Deps) -> int:
    clock, timing = deps.clock, deps.timing
    try:
        cfg, env = _load(camera, deps, need_backend=True)
    except ConfigError as e:
        print(f'Loi cau hinh: {e}', file=sys.stderr)
        return EXIT_STOP
    log = JsonLog(camera, deps.ai_dir / 'data' / 'logs' / f'{camera}.log', clock, deps.stream)
    lock = lock_path(deps.ai_dir, camera)
    try:
        acquire(lock, clock)
    except LockExists as e:
        log.error('stop', reason=str(e), exitCode=EXIT_STOP)
        return EXIT_STOP

    queue, windows, sender = CountQueue(), None, None
    try:
        player = VideoPlayer(camera, cfg.playlist, log, clock, deps.opener, cfg.process_fps)
        try:
            detector, fps = _start(cfg, player, deps, weights, imgsz, measure=True)
        except (ConfigError, VideoOpenError) as e:
            log.error('stop', reason=str(e), exitCode=EXIT_STOP)
            return EXIT_STOP
        log.info('start', fpsXuLy=round(fps, 1))

        confirmer = PredatorConfirmer(cfg.predator)
        sender = Sender(camera, env, queue, log, confirmer.release, clock, timing.retry_delays,
                        timing.heartbeat_every if heartbeat else None, timing.tick)

        def on_close(ws, in_, out):
            queue.put(ws, in_, out)
            sender.wake_counts()

        def on_confirmed(c: Confirmed):
            jpeg = encode_snapshot(c.frame, c.boxes, env.snapshot_max_bytes)
            sender.submit(PendingEvent(c.cls, c.at, c.confidence, jpeg))

        windows = WindowCounter(on_close)
        pipe = Pipeline(cfg, detector.names, windows, confirmer, log, lambda *a: None, on_confirmed, deps.make_tracker)
        sender.start()
        now = clock.monotonic()
        next_counts, next_fps = now + timing.counts_every, now + timing.fps_log_every
        fps_mark = (now, player.processed, player.skipped)

        for frame in player.live():
            if sender.fatal is not None:
                log.error('stop', reason=sender.fatal, exitCode=EXIT_STOP)
                return EXIT_STOP
            if frame.new_video:
                pipe.new_video(frame.fps)
            at = clock.now()
            pipe.process(frame.image, detector(frame.image), at)
            now = clock.monotonic()
            if now >= next_counts:
                next_counts = now + timing.counts_every
                queue.put(*windows.current())
                sender.wake_counts()
            if now >= next_fps:
                next_fps = now + timing.fps_log_every
                t0, p0, s0 = fps_mark
                done, skipped = player.processed - p0, player.skipped - s0
                real_fps = done / max(now - t0, 1e-9)
                ratio = round(skipped / max(done + skipped, 1), 3)
                ok = cfg.predator.confirm_frames <= real_fps * cfg.predator.confirm_seconds
                log.write('info' if ok else 'warning', 'fps', fps=round(real_fps, 2), droppedFrameRatio=ratio)
                fps_mark = (now, player.processed, player.skipped)
        return EXIT_OK  # live() khong bao gio het; dong nay chi de day du
    except KeyboardInterrupt:
        return _finish(log, queue, windows, sender, timing, 'ctrl+c', EXIT_OK)
    except Exception:
        log.error('error', message=traceback.format_exc())
        return _finish(log, queue, windows, sender, timing, 'loi khong luong truoc', EXIT_ERROR)
    finally:
        release(lock)


def _finish(log: JsonLog, queue: CountQueue, windows, sender, timing: Timing, reason: str, code: int) -> int:
    """Ctrl+C lan 1 / loi: dua tong cuoi vao hang doi, gui not toi da drain_seconds. Ctrl+C lan 2: thoat ngay."""
    try:
        if sender is not None:
            if windows is not None and windows.current() is not None:
                queue.put(*windows.current())
            lost_counts, lost_events = sender.drain(timing.drain_seconds)
            for ws, i, o in lost_counts:
                log.warning('counts.dropped', windowStart=utc_iso(ws), **{'in': i, 'out': o}, status=None,
                            code=None, reason='mat khi dung')
            for ev in lost_events:
                log.warning('predator.dropped', **{'class': ev.cls}, at=utc_iso(ev.at), attempt=ev.retries + 1,
                            status=None, code=None, reason='mat khi dung')
            if sender.fatal is not None:
                reason, code = sender.fatal, EXIT_STOP
        log.write('info' if code == EXIT_OK else 'error', 'stop', reason=reason, exitCode=code)
        return code
    except KeyboardInterrupt:
        log.warning('stop', reason='ctrl+c lan hai - thoat ngay', exitCode=EXIT_INTERRUPT)
        return EXIT_INTERRUPT


def run_offline(camera: str, out: Path, weights: Path, imgsz: int | None, t0: datetime | None,
                playlist: list[str] | None, deps: Deps) -> int:
    clock = deps.clock
    try:
        cfg, env = _load(camera, deps, need_backend=False)
    except ConfigError as e:
        print(f'Loi cau hinh: {e}', file=sys.stderr)
        return EXIT_STOP
    if playlist:
        cfg = dataclasses.replace(cfg, playlist=tuple(deps.ai_dir / p for p in playlist))
    out.mkdir(parents=True, exist_ok=True)
    (out / 'snapshots').mkdir(exist_ok=True)
    log = JsonLog(camera, out / f'{camera}.log', clock, deps.stream)
    player = VideoPlayer(camera, cfg.playlist, log, clock, deps.opener, cfg.process_fps)
    try:
        detector, _ = _start(cfg, player, deps, weights, imgsz, measure=False)
    except (ConfigError, VideoOpenError) as e:
        log.error('stop', reason=str(e), exitCode=EXIT_STOP)
        return EXIT_STOP
    t0 = t0 or clock.now()

    with (out / 'counts.csv').open('w', encoding='utf-8', newline='') as fc, \
            (out / 'predators.csv').open('w', encoding='utf-8', newline='') as fp, \
            (out / 'crossings.csv').open('w', encoding='utf-8', newline='') as fx:
        counts, preds, crossings = csv.writer(fc), csv.writer(fp), csv.writer(fx)
        counts.writerow(['camera', 'windowStart', 'in', 'out'])
        preds.writerow(['camera', 'class', 'confidence', 'at'])
        crossings.writerow(['at', 'chieu', 'track_id'])

        def on_confirmed(c: Confirmed):
            at = utc_iso(c.at)
            preds.writerow([camera, c.cls, c.confidence, at])
            name = f'{c.cls}_{at.replace(":", "")}.jpg'
            (out / 'snapshots' / name).write_bytes(encode_snapshot(c.frame, c.boxes, env.snapshot_max_bytes))

        windows = WindowCounter(lambda ws, i, o: counts.writerow([camera, utc_iso(ws), i, o]))
        pipe = Pipeline(cfg, detector.names, windows, PredatorConfirmer(cfg.predator), log,
                        lambda at, d, tid: crossings.writerow([utc_iso(at), d, tid]), on_confirmed, deps.make_tracker)
        started = time.perf_counter()
        for frame in player.offline():
            if frame.new_video:
                pipe.new_video(frame.fps)
            at = t0 + timedelta(seconds=frame.pos)
            pipe.process(frame.image, detector(frame.image), at)
        if windows.current() is not None:
            counts.writerow([camera, utc_iso(windows.current()[0]), *windows.current()[1:]])
    elapsed = max(time.perf_counter() - started, 1e-9)
    log.info('fps', fps=round(player.processed / elapsed, 2),
             droppedFrameRatio=round(player.skipped / max(player.processed + player.skipped, 1), 3))
    log.info('stop', reason='het playlist', exitCode=EXIT_OK)
    return EXIT_OK
```

- [ ] **Step 7: Viết `ai-vision/swiftletcare_ai/__main__.py`**

```python
"""Dong lenh: python -m swiftletcare_ai live|offline --camera <ma> (spec 3.5)."""
import argparse
import sys
from pathlib import Path

from .app import Deps, run_live, run_offline
from .config import AI_DIR, CAMERAS
from .timeutil import parse_utc

DEFAULT_WEIGHTS = AI_DIR / 'data' / 'weights' / 'best.pt'


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog='python -m swiftletcare_ai')
    sub = p.add_subparsers(dest='cmd', required=True)
    live = sub.add_parser('live', help='phat playlist theo gio that, gui ket qua cho backend')
    off = sub.add_parser('offline', help='xu ly playlist mot luot, ghi CSV, khong gui gi')
    for s in (live, off):
        s.add_argument('--camera', required=True, choices=CAMERAS)
        s.add_argument('--weights', type=Path, default=DEFAULT_WEIGHTS)
        s.add_argument('--imgsz', type=int, default=None, help='kich thuoc anh suy luan (mac dinh theo trong so)')
    live.add_argument('--heartbeat', action='store_true', help='gui heartbeat 30 giay (can backend co /api/ai/heartbeat)')
    off.add_argument('--out', type=Path, required=True)
    off.add_argument('--t0', default=None, help='moc bat dau dang YYYY-MM-DDTHH:MM:SSZ (mac dinh: gio chay)')
    off.add_argument('--playlist', nargs='+', default=None, help='thay playlist trong YAML (duong dan tinh tu ai-vision/)')
    return p


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding='utf-8')
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.cmd == 'live':
        return run_live(args.camera, args.weights, args.imgsz, args.heartbeat, Deps())
    try:
        t0 = parse_utc(args.t0) if args.t0 else None
    except ValueError as e:
        parser.error(str(e))
    return run_offline(args.camera, args.out, args.weights, args.imgsz, t0, args.playlist, Deps())


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 8: Chạy toàn bộ test**

Run: `.\.venv\Scripts\python -m pytest -v`
Expected: PASS mọi test (trừ các test cần fixture hợp đồng nếu PR chưa merge, và test mô hình thật `SKIPPED`).

`test_live_ctrl_c_lan_hai_thoat_ngay` dựa vào `_thread.interrupt_main` (spec 7.5 "Chưa kiểm chứng": gửi Ctrl+C cho tiến trình con trên Windows có thể khó). Nếu test này treo hoặc không ổn định trên máy nhóm: đánh dấu `@pytest.mark.skip(reason='Ctrl+C lan hai kiem tay o Step 9')`, ghi vào S8, và kiểm tay ở Step 9 — không xóa test.

- [ ] **Step 9: Kiểm tay Ctrl+C và lệnh thật (S8) — cần `best.pt` (Task 13) và một video thật**

```powershell
.\.venv\Scripts\python -m swiftletcare_ai offline --camera H1-F0-CAMERA --out data\out\H1
.\.venv\Scripts\python -m swiftletcare_ai live --camera H1-F0-CAMERA
```

Với `live`: không cần backend thật cho bước này (để `BACKEND_URL` trỏ cổng không ai nghe, VD `http://localhost:3999`). Đợi dòng `"type": "start"`, nhấn Ctrl+C **một lần** → có dòng `stop` `exitCode 0` sau tối đa ~10 giây, `data\run\H1-F0-CAMERA.lock` đã xóa. Chạy lại, nhấn Ctrl+C **hai lần** liên tiếp → thoát ngay, `exitCode 130`, file khóa đã xóa. Ghi S8: Ctrl+C có ra `KeyboardInterrupt` khi đang đọc video/chạy mô hình không.

- [ ] **Step 10: Commit**

```powershell
git status   # khong co data\, *.pt, .env
git add ai-vision/swiftletcare_ai/pipeline.py ai-vision/swiftletcare_ai/app.py ai-vision/swiftletcare_ai/__main__.py ai-vision/tests/fakes.py ai-vision/tests/test_pipeline.py ai-vision/tests/test_app.py ai-vision/spikes/RESULTS.md
git commit -m "feat(ai-vision): lệnh live và offline, gửi tổng mỗi 60 giây, dừng khi 401/404, Ctrl+C gửi nốt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Dữ liệu và trọng số — `SOURCES.md`, chia tập theo nguồn, notebook Colab, tải và kiểm trọng số

**Files:**
- Create: `ai-vision/SOURCES.md`, `ai-vision/splits.csv`, `ai-vision/weights.json`, `ai-vision/scripts/split_dataset.py`, `ai-vision/scripts/download_weights.py`, `ai-vision/train/train.ipynb`, `ai-vision/tests/test_data_scripts.py`

**Interfaces:**
- Consumes: `AI_DIR`, `SWIFTLET`, `PREDATOR_CLASSES`, `ConfigError` (Task 4), `require_classes` (Task 11), `read_pins` (Task 1, `tests/test_repo_rules.py`).
- Produces:
  - `scripts/split_dataset.py`: `SPLITS = ('train', 'val', 'test')`; `source_of(name: str) -> str`; `read_splits(path: Path) -> dict[str, str]`; `assign(images: list[Path], splits: dict[str, str]) -> dict[Path, str]` (nguồn lạ → `ValueError`); `label_for(image: Path) -> Path`; `background_ratio(labels: list[Path]) -> float`; `main(argv: list[str] | None = None) -> int` (`--export DIR --out DIR [--splits splits.csv]`).
  - `scripts/download_weights.py`: `sha256_file(path: Path) -> str`; `download(url: str, dest: Path, expected_sha256: str) -> None` (lệch → xóa file, `ValueError`); `main(argv: list[str] | None = None) -> int` (`[--verify-only]`).
  - `weights.json` khóa: `url, sha256, roboflowVersion, epochs, imgsz, seed, backgroundRatio, ultralytics, torch`.

- [ ] **Step 1: Viết test (phải fail)**

`ai-vision/tests/test_data_scripts.py`:

```python
import functools
import hashlib
import json
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import pytest
import yaml

from swiftletcare_ai.config import AI_DIR
from test_repo_rules import read_pins

sys.path.insert(0, str(AI_DIR / 'scripts'))
import download_weights  # noqa: E402
import split_dataset  # noqa: E402


def make_export(root, files: dict[str, str]):
    """files: 'train/V01_0001_jpg.rf.ab.jpg' -> noi dung nhan YOLO ('' = anh nen)."""
    for rel, label in files.items():
        split, name = rel.split('/')
        (root / split / 'images').mkdir(parents=True, exist_ok=True)
        (root / split / 'labels').mkdir(parents=True, exist_ok=True)
        (root / split / 'images' / name).write_bytes(b'jpg')
        (root / split / 'labels' / (name.rsplit('.', 1)[0] + '.txt')).write_text(label, encoding='utf-8')
    (root / 'data.yaml').write_text(yaml.safe_dump({'names': ['owl', 'rat', 'snake', 'swiftlet'], 'nc': 4}), encoding='utf-8')


def test_source_of_lay_ma_nguon_dau_ten():
    assert split_dataset.source_of('V01_000123.jpg') == 'V01'
    assert split_dataset.source_of('R02_15_jpg.rf.9f8e.jpg') == 'R02'


def test_read_splits(tmp_path):
    p = tmp_path / 'splits.csv'
    p.write_text('nguon,tap\nV01,train\nV02,val\nR01,test\n', encoding='utf-8')
    assert split_dataset.read_splits(p) == {'V01': 'train', 'V02': 'val', 'R01': 'test'}


def test_read_splits_tap_la(tmp_path):
    p = tmp_path / 'splits.csv'
    p.write_text('nguon,tap\nV01,training\n', encoding='utf-8')
    with pytest.raises(ValueError, match='training'):
        split_dataset.read_splits(p)


def test_assign_theo_nguon_khong_theo_thu_muc_export(tmp_path):
    a, b = tmp_path / 'valid/images/V01_1.jpg', tmp_path / 'train/images/R01_7.jpg'
    assert split_dataset.assign([a, b], {'V01': 'train', 'R01': 'test'}) == {a: 'train', b: 'test'}


def test_assign_nguon_khong_co_trong_splits_thi_bao_loi(tmp_path):
    with pytest.raises(ValueError, match='X09'):
        split_dataset.assign([tmp_path / 'train/images/X09_1.jpg'], {'V01': 'train'})


def test_background_ratio(tmp_path):
    labels = []
    for i, text in enumerate(['0 0.5 0.5 0.1 0.1\n', '', '1 0.2 0.2 0.1 0.1\n', '']):
        p = tmp_path / f'{i}.txt'
        p.write_text(text, encoding='utf-8')
        labels.append(p)
    labels.append(tmp_path / 'khong-co.txt')       # khong co file nhan = anh nen
    assert split_dataset.background_ratio(labels) == pytest.approx(3 / 5)


def test_main_chia_lai_theo_nguon_va_ghi_data_yaml(tmp_path):
    export, out = tmp_path / 'export', tmp_path / 'dataset'
    make_export(export, {
        'train/V01_1_jpg.rf.a.jpg': '3 0.5 0.5 0.1 0.1\n',
        'train/R01_1_jpg.rf.b.jpg': '1 0.5 0.5 0.1 0.1\n',
        'valid/V01_2_jpg.rf.c.jpg': '',
        'test/V02_1_jpg.rf.d.jpg': '3 0.4 0.4 0.1 0.1\n',
    })
    splits = tmp_path / 'splits.csv'
    splits.write_text('nguon,tap\nV01,train\nR01,test\nV02,val\n', encoding='utf-8')
    assert split_dataset.main(['--export', str(export), '--out', str(out), '--splits', str(splits)]) == 0
    assert sorted(p.name for p in (out / 'train' / 'images').iterdir()) == ['V01_1_jpg.rf.a.jpg', 'V01_2_jpg.rf.c.jpg']
    assert [p.name for p in (out / 'test' / 'images').iterdir()] == ['R01_1_jpg.rf.b.jpg']
    assert (out / 'test' / 'labels' / 'R01_1_jpg.rf.b.txt').read_text(encoding='utf-8') == '1 0.5 0.5 0.1 0.1\n'
    data = yaml.safe_load((out / 'data.yaml').read_text(encoding='utf-8'))
    assert data['names'] == ['owl', 'rat', 'snake', 'swiftlet']
    assert (data['train'], data['val'], data['test']) == ('train/images', 'val/images', 'test/images')


def test_main_lop_export_khac_4_lop_thi_dung(tmp_path):
    export = tmp_path / 'export'
    make_export(export, {'train/V01_1.jpg': ''})
    (export / 'data.yaml').write_text(yaml.safe_dump({'names': ['bird', 'rat']}), encoding='utf-8')
    splits = tmp_path / 'splits.csv'
    splits.write_text('nguon,tap\nV01,train\n', encoding='utf-8')
    assert split_dataset.main(['--export', str(export), '--out', str(tmp_path / 'o'), '--splits', str(splits)]) != 0


@pytest.fixture
def file_server(tmp_path):
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(tmp_path))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{server.server_address[1]}'
    server.shutdown()
    server.server_close()


def test_download_dung_sha(tmp_path, file_server):
    (tmp_path / 'best.pt').write_bytes(b'trong-so')
    dest = tmp_path / 'out' / 'best.pt'
    download_weights.download(f'{file_server}/best.pt', dest, hashlib.sha256(b'trong-so').hexdigest())
    assert dest.read_bytes() == b'trong-so'


def test_download_lech_sha_thi_xoa_va_bao_loi(tmp_path, file_server):
    (tmp_path / 'best.pt').write_bytes(b'trong-so')
    dest = tmp_path / 'out' / 'best.pt'
    with pytest.raises(ValueError, match='SHA-256'):
        download_weights.download(f'{file_server}/best.pt', dest, '0' * 64)
    assert not dest.exists() and not dest.with_suffix('.pt.part').exists()


def test_weights_json_du_khoa():
    data = json.loads((AI_DIR / 'weights.json').read_text(encoding='utf-8'))
    assert list(data) == ['url', 'sha256', 'roboflowVersion', 'epochs', 'imgsz', 'seed', 'backgroundRatio', 'ultralytics', 'torch']


def test_notebook_ghim_trung_requirements():
    pins = read_pins(AI_DIR / 'requirements.txt')
    nb = json.loads((AI_DIR / 'train' / 'train.ipynb').read_text(encoding='utf-8'))
    text = '\n'.join(''.join(c['source']) for c in nb['cells'])
    assert f"ultralytics=={pins['ultralytics']}" in text
    assert f"supervision=={pins['supervision']}" in text
    assert 'torch==' not in text            # Colab dung torch co san (spec 2.5)
```

Run: `.\.venv\Scripts\python -m pytest tests/test_data_scripts.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'download_weights'`.

- [ ] **Step 2: Viết `ai-vision/scripts/split_dataset.py`**

Cấu trúc export Roboflow giả định `train|valid|test/images|labels` + `data.yaml` (S11 xác nhận; khác thì sửa `_images()` theo bản export thật và ghi vào S11).

```python
"""Chia lai tap theo MA NGUON (splits.csv), khong dung che do chia ngau nhien cua Roboflow (spec 2.4).
Chay: .\\.venv\\Scripts\\python scripts\\split_dataset.py --export data\\export --out data\\dataset"""
import argparse
import csv
import shutil
import sys
from pathlib import Path

import yaml

SPLITS = ('train', 'val', 'test')
CLASSES = {'swiftlet', 'rat', 'snake', 'owl'}
IMAGE_EXT = {'.jpg', '.jpeg', '.png'}
AI_DIR = Path(__file__).resolve().parent.parent


def source_of(name: str) -> str:
    return name.split('_', 1)[0]


def read_splits(path: Path) -> dict[str, str]:
    with path.open(encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    result = {}
    for row in rows:
        if row['tap'] not in SPLITS:
            raise ValueError(f'{path.name}: nguon {row["nguon"]} co tap la "{row["tap"]}"; hop le: {", ".join(SPLITS)}')
        result[row['nguon']] = row['tap']
    return result


def label_for(image: Path) -> Path:
    return image.parent.parent / 'labels' / (image.stem + '.txt')


def assign(images: list[Path], splits: dict[str, str]) -> dict[Path, str]:
    result = {}
    for img in images:
        src = source_of(img.name)
        if src not in splits:
            raise ValueError(f'anh {img.name}: nguon {src} khong co trong splits.csv')
        result[img] = splits[src]
    return result


def background_ratio(labels: list[Path]) -> float:
    empty = sum(1 for p in labels if not p.is_file() or not p.read_text(encoding='utf-8').strip())
    return empty / len(labels) if labels else 0.0


def _images(export: Path) -> list[Path]:
    return sorted(p for p in export.glob('*/images/*') if p.suffix.lower() in IMAGE_EXT)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--export', type=Path, required=True, help='thu muc export YOLOv8 cua Roboflow da giai nen')
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--splits', type=Path, default=AI_DIR / 'splits.csv')
    args = ap.parse_args(argv)

    names = yaml.safe_load((args.export / 'data.yaml').read_text(encoding='utf-8'))['names']
    names = list(names.values()) if isinstance(names, dict) else list(names)
    if set(names) != CLASSES:
        print(f'Loi: lop trong export {names} khac {sorted(CLASSES)} (ten lop phai viet thuong, spec 2.1)', file=sys.stderr)
        return 1
    try:
        plan = assign(_images(args.export), read_splits(args.splits))
    except ValueError as e:
        print(f'Loi: {e}', file=sys.stderr)
        return 1

    for split in SPLITS:
        for sub in ('images', 'labels'):
            (args.out / split / sub).mkdir(parents=True, exist_ok=True)
    for img, split in plan.items():
        shutil.copy2(img, args.out / split / 'images' / img.name)
        label = label_for(img)
        target = args.out / split / 'labels' / label.name
        if label.is_file():
            shutil.copy2(label, target)
        else:
            target.write_text('', encoding='utf-8')
    (args.out / 'data.yaml').write_text(yaml.safe_dump({
        'path': '.', 'train': 'train/images', 'val': 'val/images', 'test': 'test/images', 'names': names,
    }, sort_keys=False), encoding='utf-8')

    for split in SPLITS:
        labels = sorted((args.out / split / 'labels').glob('*.txt'))
        print(f'{split}: {len(labels)} anh, ti le anh nen {background_ratio(labels):.1%}')
    print('Ghi ti le anh nen THUC TE cua train vao weights.json (backgroundRatio). Mac dinh toi da 10% (spec 2.3).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
```

`path: '.'` trong `data.yaml`: Ultralytics tính đường dẫn tương đối theo thư mục chứa `data.yaml` hay thư mục chạy — S12/Task 13 Step 6 kiểm trên Colab; sai thì notebook ghi đè `path` bằng đường dẫn tuyệt đối (ô số 4).

- [ ] **Step 3: Viết `ai-vision/scripts/download_weights.py`**

```python
"""Tai best.pt theo weights.json, so SHA-256, nap thu bang Ultralytics (spec 2.6).
Chay: .\\.venv\\Scripts\\python scripts\\download_weights.py [--verify-only]"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import requests

AI_DIR = Path(__file__).resolve().parent.parent
DEST = AI_DIR / 'data' / 'weights' / 'best.pt'


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path, expected_sha256: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + '.part')
    with requests.get(url, stream=True, timeout=(10, 60)) as r:
        r.raise_for_status()
        with part.open('wb') as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    actual = sha256_file(part)
    if actual != expected_sha256.lower():
        part.unlink()
        raise ValueError(f'SHA-256 lech: can {expected_sha256}, tai ve {actual}. Da xoa file vua tai.')
    part.replace(dest)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--verify-only', action='store_true', help='khong tai; chi kiem SHA-256 va nap thu file da co')
    args = ap.parse_args(argv)
    meta = json.loads((AI_DIR / 'weights.json').read_text(encoding='utf-8'))
    if not meta.get('url') or not meta.get('sha256'):
        print('Loi: weights.json chua co url/sha256 (chua train xong?)', file=sys.stderr)
        return 1
    try:
        if not args.verify_only:
            download(meta['url'], DEST, meta['sha256'])
        elif sha256_file(DEST) != meta['sha256'].lower():
            print(f'Loi: SHA-256 cua {DEST} khong khop weights.json', file=sys.stderr)
            return 1
    except (requests.RequestException, ValueError, OSError) as e:
        print(f'Loi: {e}', file=sys.stderr)
        return 1

    import ultralytics
    from ultralytics import YOLO
    sys.path.insert(0, str(AI_DIR))
    from swiftletcare_ai.detector import require_classes
    model = YOLO(str(DEST))
    require_classes(dict(model.names))
    print('Nap duoc', DEST, 'lop', dict(model.names))
    if meta.get('ultralytics') != ultralytics.__version__:
        print(f'Chu y: Colab train bang ultralytics {meta.get("ultralytics")}, may nay {ultralytics.__version__} '
              f'- ghi chenh lech vao spec ai-vision 2.6')
    return 0


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 4: Viết `SOURCES.md`, `splits.csv`, `weights.json`**

`ai-vision/SOURCES.md`:

```markdown
# Nguồn dữ liệu và giấy phép

Một dòng mỗi nguồn (spec ai-vision 2.2). Chỉ dùng nguồn công khai có giấy phép cho phép dùng; chỉ tải lên Roboflow nguồn **cho phép chia sẻ lại**. Video, ảnh, dataset **không** vào git.

`MIN_BOX_PX` (cạnh ngắn tối thiểu của khung bao, tính trên ảnh gốc): _TV3 chốt khi xem dữ liệu, ghi cả vào spec 2.3_.

| Mã | Người đăng | URL | Giấy phép | Chia sẻ lại | Ngày tải | Lớp | Tập | Công cụ gán nhãn | Khoảng cắt khung |
|---|---|---|---|---|---|---|---|---|---|
| — | Ultralytics | https://github.com/ultralytics/ultralytics | AGPL-3.0 | có | — | (thư viện) | — | — | — |
```

`ai-vision/splits.csv` (TV3 thêm một dòng mỗi nguồn; mỗi nguồn đúng một tập; mỗi lớp ≥ 2 nguồn nếu có thể, spec 2.4):

```
nguon,tap
```

`ai-vision/weights.json`:

```json
{
  "url": "",
  "sha256": "",
  "roboflowVersion": null,
  "epochs": null,
  "imgsz": null,
  "seed": null,
  "backgroundRatio": null,
  "ultralytics": null,
  "torch": null
}
```

- [ ] **Step 5: Viết `ai-vision/train/train.ipynb`**

Notebook JSON (nbformat 4). Số phiên bản trong ô 2 phải trùng `requirements.txt` (test kiểm).

```json
{
 "nbformat": 4,
 "nbformat_minor": 5,
 "metadata": {"kernelspec": {"name": "python3", "display_name": "Python 3"}, "accelerator": "GPU"},
 "cells": [
  {"cell_type": "markdown", "metadata": {}, "source": [
   "# SwiftletCare — train YOLOv8n 4 lớp trên Colab\n",
   "\n",
   "Spec ai-vision 2.5–2.6. Runtime → Change runtime type → GPU. Dataset: zip thư mục `data/dataset` do `scripts/split_dataset.py` tạo, tải lên Google Drive `MyDrive/swiftletcare/dataset.zip`.\n",
   "\n",
   "Ghi ô 3 (phiên bản, GPU) vào `spikes/RESULTS.md` mục S12."
  ]},
  {"cell_type": "code", "metadata": {}, "execution_count": null, "outputs": [], "source": [
   "!pip install -q ultralytics==8.4.178 supervision==0.30.9"
  ]},
  {"cell_type": "code", "metadata": {}, "execution_count": null, "outputs": [], "source": [
   "import torch, ultralytics, supervision\n",
   "print('ultralytics', ultralytics.__version__, 'torch', torch.__version__, 'supervision', supervision.__version__)\n",
   "print('GPU', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '-')"
  ]},
  {"cell_type": "code", "metadata": {}, "execution_count": null, "outputs": [], "source": [
   "from google.colab import drive\n",
   "drive.mount('/content/drive')\n",
   "!unzip -q -o /content/drive/MyDrive/swiftletcare/dataset.zip -d /content/dataset\n",
   "import yaml, pathlib\n",
   "DATA = pathlib.Path('/content/dataset/data.yaml')\n",
   "cfg = yaml.safe_load(DATA.read_text())\n",
   "cfg['path'] = '/content/dataset'\n",
   "DATA.write_text(yaml.safe_dump(cfg, sort_keys=False))\n",
   "print(cfg)"
  ]},
  {"cell_type": "code", "metadata": {}, "execution_count": null, "outputs": [], "source": [
   "# TV3 chon tren tap val; ghi vao weights.json\n",
   "EPOCHS = 100\n",
   "IMGSZ = 640\n",
   "SEED = 0\n",
   "from ultralytics import YOLO\n",
   "model = YOLO('yolov8n.pt')\n",
   "result = model.train(data=str(DATA), epochs=EPOCHS, imgsz=IMGSZ, seed=SEED, device=0, project='/content/runs', name='swiftletcare')\n",
   "BEST = pathlib.Path(result.save_dir) / 'weights' / 'best.pt'\n",
   "print(BEST)"
  ]},
  {"cell_type": "code", "metadata": {}, "execution_count": null, "outputs": [], "source": [
   "# Kiem nhanh tren val (KHONG dung tap test de chinh tham so, spec 6.1)\n",
   "YOLO(str(BEST)).val(data=str(DATA), split='val', imgsz=IMGSZ)"
  ]},
  {"cell_type": "code", "metadata": {}, "execution_count": null, "outputs": [], "source": [
   "import hashlib, json, shutil\n",
   "sha = hashlib.sha256(BEST.read_bytes()).hexdigest()\n",
   "shutil.copy(BEST, '/content/drive/MyDrive/swiftletcare/best.pt')\n",
   "print(json.dumps({'url': '', 'sha256': sha, 'roboflowVersion': None, 'epochs': EPOCHS, 'imgsz': IMGSZ, 'seed': SEED,\n",
   "                  'backgroundRatio': None, 'ultralytics': ultralytics.__version__, 'torch': torch.__version__}, indent=2))"
  ]}
 ]
}
```

Tên tham số `epochs`, `imgsz`, `seed`, `device`, `project`, `name`, `split` lấy theo S5; khác thì sửa ô tương ứng.

- [ ] **Step 6: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_data_scripts.py -v`
Expected: PASS 13 test.

- [ ] **Step 7: Commit (phần code)**

```powershell
git status   # khong co data\, *.pt
git add ai-vision/SOURCES.md ai-vision/splits.csv ai-vision/weights.json ai-vision/scripts/split_dataset.py ai-vision/scripts/download_weights.py ai-vision/train/train.ipynb ai-vision/tests/test_data_scripts.py
git commit -m "feat(ai-vision): chia tập theo nguồn, notebook Colab ghim phiên bản, tải và kiểm SHA-256 trọng số

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Làm dữ liệu và train (tay, theo mốc tuần 1–2)**

1. Tìm nguồn, điền `SOURCES.md` (mỗi nguồn một dòng; S13: giấy phép, chia sẻ lại, mỗi lớp ≥ 2 nguồn). Tra gói Roboflow miễn phí (S10), ghi URL trang giá và ngày tra.
2. Gán nhãn (TV3 + TV5) theo spec 2.3; chốt `MIN_BOX_PX`, ghi vào `SOURCES.md` và spec 2.3. **Không bật augmentation của Roboflow.**
3. Export định dạng YOLOv8 (S11: tên định dạng thật, cấu trúc thư mục), giải nén vào `data\export\`.
4. Điền `splits.csv`, chạy `.\.venv\Scripts\python scripts\split_dataset.py --export data\export --out data\dataset`. Tỷ lệ ảnh nền train > 10% thì bớt ảnh nền hoặc ghi lý do (spec 2.3).
5. Zip `data\dataset` (`Compress-Archive data\dataset\* data\dataset.zip`), tải lên Drive, chạy `train.ipynb` trên Colab. Ghi S12 từ ô 3.
6. Tải `best.pt` từ Drive về `data\weights\best.pt`. Tạo Release (S14):

```powershell
gh release create ai-weights-v1 data\weights\best.pt --title "ai-vision trong so v1" --notes "YOLOv8n 4 lop, xem ai-vision/weights.json"
```

Không có quyền tạo Release: dùng kho lưu trữ khác có link tải, ghi vào S14.

7. Điền `weights.json` từ ô cuối notebook; `url` = link tải asset của Release (lấy bằng `gh release view ai-weights-v1 --json assets`). Repo **private** thì `requests` không tải được asset: tải bằng `gh release download ai-weights-v1 -p best.pt -D data\weights` rồi chạy `download_weights.py --verify-only`; ghi cách đã dùng vào README.
8. Chạy `.\.venv\Scripts\python scripts\download_weights.py` (hoặc `--verify-only`) → `Nap duoc …`; ghi S15 (chênh lệch bản Ultralytics nếu có, cả vào spec 2.6).
9. Chạy lại `.\.venv\Scripts\python -m pytest` → `test_mo_hinh_that_nap_duoc_va_du_lop` không còn `SKIPPED`, PASS.

- [ ] **Step 9: Commit (dữ liệu và trọng số)**

```powershell
git status   # chi SOURCES.md, splits.csv, weights.json, RESULTS.md, spec; KHONG co anh, video, best.pt
git add ai-vision/SOURCES.md ai-vision/splits.csv ai-vision/weights.json ai-vision/spikes/RESULTS.md docs/superpowers/specs/2026-10-15-swiftletcare-ai-vision-design.md
git commit -m "chore(ai-vision): nguồn dữ liệu, chia tập theo nguồn, metadata trọng số v1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14 (Nên có): Video đầu ra có khung bao, script chạy nhiều camera, README đầy đủ

**Files:**
- Create: `ai-vision/scripts/start-cameras.ps1`, `ai-vision/tests/test_extras.py`
- Modify: `ai-vision/swiftletcare_ai/pipeline.py` (`process` trả danh sách khung đã vẽ), `ai-vision/swiftletcare_ai/snapshot.py` (thêm `annotate`), `ai-vision/swiftletcare_ai/app.py` (`run_offline(..., annotated: bool = False)`), `ai-vision/swiftletcare_ai/__main__.py` (cờ `--annotated-video`), `ai-vision/README.md`

**Interfaces:**
- Consumes: `Pipeline`, `run_offline`, `build_parser` (Task 12), `draw_boxes` (Task 8), `LineCfg` (Task 4).
- Produces: `Pipeline.process(...) -> list[Box]` (khung chim ≥ `swiftlet.confidence` và thiên địch ≥ `predator.confidence` của khung đó); `snapshot.annotate(frame: np.ndarray, boxes: list[Box], line: LineCfg) -> np.ndarray`; `run_offline(camera, out, weights, imgsz, t0, playlist, deps, annotated: bool = False) -> int` ghi `out/annotated.mp4` (mp4v, fps của video đầu, kích thước khung của video đầu); `scripts/start-cameras.ps1 [-Cameras <mã>...] [-Heartbeat]`.

- [ ] **Step 1: Viết test (phải fail)**

`ai-vision/tests/test_extras.py`:

```python
import io
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from fakes import FakeDetector, FakeTracker, bird_up, fake_opener
from swiftletcare_ai.__main__ import build_parser
from swiftletcare_ai.app import EXIT_OK, Deps, Timing, run_offline
from swiftletcare_ai.config import AI_DIR, LineCfg
from swiftletcare_ai.predators import Box
from swiftletcare_ai.snapshot import annotate
from swiftletcare_ai.timeutil import FakeClock
from test_app import setup_ai

CAM = 'H1-F0-CAMERA'


def test_annotate_ve_vach_va_khung_khong_sua_goc():
    frame = np.zeros((100, 200, 3), dtype=np.uint8)
    out = annotate(frame, [Box('swiftlet', 0.8, (10, 10, 30, 30))], LineCfg((0.1, 0.5), (0.9, 0.5)))
    assert frame.sum() == 0
    assert out[50, 100].sum() > 0          # diem giua vach
    assert out[10, 20].sum() > 0           # canh tren khung bao


def test_offline_annotated_video(tmp_path):
    ai = setup_ai(tmp_path)
    deps = Deps(clock=FakeClock(datetime(2026, 10, 12, 10, 0, tzinfo=timezone.utc)),
                opener=fake_opener({'V01.mp4': {'n': 30, 'fps': 10}}),
                make_detector=lambda w, s: FakeDetector(script=lambda i: bird_up(i, 5)),
                make_tracker=lambda fps: FakeTracker(), timing=Timing(), stream=io.StringIO(), ai_dir=ai)
    out = tmp_path / 'out'
    assert run_offline(CAM, out, Path('x.pt'), None, None, None, deps, annotated=True) == EXIT_OK
    cap = cv2.VideoCapture(str(out / 'annotated.mp4'))
    assert cap.isOpened()
    assert int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) == 30
    cap.release()


def test_offline_khong_co_co_thi_khong_ghi_video(tmp_path):
    ai = setup_ai(tmp_path)
    deps = Deps(clock=FakeClock(datetime(2026, 10, 12, 10, 0, tzinfo=timezone.utc)),
                opener=fake_opener({'V01.mp4': {'n': 5, 'fps': 10}}),
                make_detector=lambda w, s: FakeDetector(), make_tracker=lambda fps: FakeTracker(),
                timing=Timing(), stream=io.StringIO(), ai_dir=ai)
    run_offline(CAM, tmp_path / 'out', Path('x.pt'), None, None, None, deps)
    assert not (tmp_path / 'out' / 'annotated.mp4').exists()


def test_parser_co_annotated_video():
    a = build_parser().parse_args(['offline', '--camera', CAM, '--out', 'o', '--annotated-video'])
    assert a.annotated_video is True


def test_start_cameras_ps1_parse_duoc_bang_powershell_5_1():
    script = AI_DIR / 'scripts' / 'start-cameras.ps1'
    script.read_bytes().decode('ascii')
    check = (f"$e = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('{script}', [ref]$null, [ref]$e); "
             "if ($e.Count) { $e | ForEach-Object { $_.Message }; exit 1 }")
    r = subprocess.run(['powershell', '-NoProfile', '-Command', check], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    text = script.read_text(encoding='ascii')
    assert 'H1-F0-CAMERA' in text and 'H2-F0-CAMERA' in text and '--heartbeat' in text
```

Run: `.\.venv\Scripts\python -m pytest tests/test_extras.py -v`
Expected: FAIL `ImportError: cannot import name 'annotate'`.

- [ ] **Step 2: Thêm `annotate` vào `snapshot.py`**

```python
_LINE_COLOR = (0, 255, 255)
_SWIFT_COLOR = (0, 200, 0)


def annotate(frame: np.ndarray, boxes: list[Box], line) -> np.ndarray:
    """Khung cho video dau ra: vach dem + moi khung bao (chim mau xanh, thien dich mau do)."""
    img = draw_boxes(frame, [b for b in boxes if b.cls != 'swiftlet'])
    h, w = img.shape[:2]
    p1 = (int(line.start[0] * w), int(line.start[1] * h))
    p2 = (int(line.end[0] * w), int(line.end[1] * h))
    cv2.line(img, p1, p2, _LINE_COLOR, 2)
    for b in boxes:
        if b.cls == 'swiftlet':
            x1, y1, x2, y2 = (int(round(v)) for v in b.xyxy)
            cv2.rectangle(img, (x1, y1), (x2, y2), _SWIFT_COLOR, 1)
    return img
```

- [ ] **Step 3: `Pipeline.process` trả danh sách khung**

Trong `pipeline.py`, đổi chữ ký thành `def process(self, frame, dets, at) -> list[Box]:`. Sau khi tính `boxes` (thiên địch), thêm khung chim đã lọc và trả về ở cuối hàm:

```python
        swift_boxes = [
            Box(SWIFTLET, float(c), tuple(float(v) for v in xyxy))
            for xyxy, c in zip(swift.xyxy, swift.confidence if len(swift) else [])
        ]
```

(đặt ngay sau dòng `swift = …`), và dòng cuối hàm:

```python
        return swift_boxes + boxes
```

Test Task 12 không đổi (không dùng giá trị trả về).

- [ ] **Step 4: `run_offline(..., annotated=False)` và cờ dòng lệnh**

Trong `app.py`: thêm tham số cuối `annotated: bool = False` cho `run_offline`; import `annotate` từ `.snapshot`. Trước vòng `for frame in player.offline():` thêm `writer, size = None, None`; thân vòng đổi thành:

```python
        for frame in player.offline():
            if frame.new_video:
                pipe.new_video(frame.fps)
            at = t0 + timedelta(seconds=frame.pos)
            drawn = pipe.process(frame.image, detector(frame.image), at)
            if annotated:
                img = annotate(frame.image, drawn, cfg.line)
                if writer is None:
                    size = (img.shape[1], img.shape[0])
                    writer = cv2.VideoWriter(str(out / 'annotated.mp4'), cv2.VideoWriter_fourcc(*'mp4v'), frame.fps, size)
                if (img.shape[1], img.shape[0]) != size:
                    img = cv2.resize(img, size)
                writer.write(img)
        if writer is not None:
            writer.release()
```

Trong `__main__.py`: `off.add_argument('--annotated-video', action='store_true', help='ghi them out/annotated.mp4 co ve khung bao va vach dem')`; lời gọi đổi thành `run_offline(args.camera, args.out, args.weights, args.imgsz, t0, args.playlist, Deps(), annotated=args.annotated_video)`.

- [ ] **Step 5: Viết `ai-vision/scripts/start-cameras.ps1` (chỉ ASCII)**

```powershell
# Mo moi camera mot cua so PowerShell rieng, chay lenh live (spec ai-vision 3.5).
# Chay tu thu muc ai-vision:  powershell -ExecutionPolicy Bypass -File scripts\start-cameras.ps1
# Tuy chon: -Cameras H1-F0-CAMERA   -Heartbeat (chi khi backend da co /api/ai/heartbeat)
param(
    [string[]]$Cameras = @('H1-F0-CAMERA', 'H2-F0-CAMERA'),
    [switch]$Heartbeat
)
$ErrorActionPreference = 'Stop'
$aiDir = Split-Path -Parent $PSScriptRoot
$python = Join-Path $aiDir '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    throw "Chua co $python - cai moi truong theo README truoc"
}
foreach ($cam in $Cameras) {
    $cmdArgs = "-m swiftletcare_ai live --camera $cam"
    if ($Heartbeat) { $cmdArgs = "$cmdArgs --heartbeat" }
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $aiDir -ArgumentList @('-NoExit', '-Command', "& '$python' $cmdArgs")
    Write-Host "Da mo cua so cho $cam"
}
```

- [ ] **Step 6: Viết đủ `ai-vision/README.md`**

Thay khung của Task 1 bằng đủ các mục (tiếng Việt có dấu):

1. **Đọc trước**: spec, plan; chạy `git status` trước mỗi lần commit (không video, ảnh, `*.pt`, `.env`).
2. **Cài đặt**: Python 3.12 (`py -0p`), lệnh tạo `.venv`, cài `requirements.txt`, chép `.env.example` → `.env`; `AI_SERVICE_KEY` xin người chạy backend, **không gửi khóa qua kênh công khai, không commit**. Tải trọng số: `.\.venv\Scripts\python scripts\download_weights.py` (repo private: `gh release download` + `--verify-only`, xem Task 13).
3. **Cấu hình camera**: giải thích từng trường `cameras/*.yaml` (bảng spec 3.4); **đảo chiều ra/vào bằng cách hoán đổi `start` và `end`**; playlist chỉ ký tự ASCII.
4. **Lệnh chạy**: `live`, `offline` (kèm `--t0`, `--playlist`, `--imgsz`, `--annotated-video`), `pytest`, `scripts\start-cameras.ps1`. `--heartbeat` chỉ bật khi backend đã có `/api/ai/heartbeat` (plan backend Task 26); bật sớm sẽ nhận 404 và AI dừng.
5. **Mã thoát**: 0 bình thường/Ctrl+C, 1 lỗi không lường trước, 2 cấu hình/khởi động/401/404/file khóa, 130 Ctrl+C lần hai.
6. **File khóa**: `data\run\<mã camera>.lock`; báo đã có thì kiểm không còn cửa sổ nào chạy camera đó rồi **xóa tay**.
7. **Log**: `data\logs\<mã camera>.log`, JSON Lines, bảng `type` (spec 5.1); không chứa khóa.
8. **Quy tắc buổi demo** (spec 4.6): chạy AI trước 20:00 giờ VN; dữ liệu mẫu neo hôm qua; tập dượt dùng `SwiftletCare_Dev`; thứ tự bật: SQL Server → Mosquitto → simulator → backend → AI → web, mobile.
9. **Số đo**: trỏ `results/README.md` (Task 15).

- [ ] **Step 7: Chạy test**

Run: `.\.venv\Scripts\python -m pytest -v`
Expected: PASS mọi test (trừ test cần fixture hợp đồng nếu PR chưa merge).

- [ ] **Step 8: Commit**

```powershell
git add ai-vision/swiftletcare_ai/snapshot.py ai-vision/swiftletcare_ai/pipeline.py ai-vision/swiftletcare_ai/app.py ai-vision/swiftletcare_ai/__main__.py ai-vision/scripts/start-cameras.ps1 ai-vision/tests/test_extras.py ai-vision/README.md
git commit -m "feat(ai-vision): video đầu ra có khung bao và vạch đếm, script mở nhiều camera, README đầy đủ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Số đo cho báo cáo (Phần 6) — hàm chỉ số, script đo, CSV kết quả

**Files:**
- Create: `ai-vision/swiftletcare_ai/metrics.py`, `ai-vision/scripts/evaluate.py`, `ai-vision/scripts/measure_speed.py`, `ai-vision/scripts/eval_detector.py`, `ai-vision/tests/test_metrics.py`, `ai-vision/results/README.md`, `ai-vision/results/events_gt.csv`, `ai-vision/results/counting_segments.csv`

**Interfaces:**
- Consumes: `parse_utc` (Task 3), `Detector`, `measure_fps` (Task 11), `run_offline`, `Deps` (Task 12), `PREDATOR_CLASSES` (Task 4).
- Produces: `metrics.py` (hàm thuần):
  - `event_metrics(events: list[tuple[str, str, float]], gt: list[tuple[str, str, float, float]]) -> dict[str, dict]` — `events` = `(video, lớp, giây)`, `gt` = `(video, lớp, bắt đầu, kết thúc)`; mỗi lớp `{n_events, tp_events, precision, n_segments, detected, recall}` (`precision`/`recall` là `None` khi mẫu số 0).
  - `false_alarms(lines: list[dict], hours: float) -> dict[str, dict]` — mỗi lớp `{confirmed, blocked, per_hour_cooldown, per_hour_raw}`.
  - `segment_counts(crossings: list[tuple[float, str]], start: float, end: float) -> tuple[int, int]` — `(in, out)` trong `[start, end)`.
  - `counting_summary(rows: list[dict]) -> dict[str, dict]` — khóa `'in'`, `'out'`, mỗi khóa `{tong_tay, tong_ai, mae, sai_so_tuong_doi, sai_lech_co_dau}`; `rows` có `tay_in, tay_out, ai_in, ai_out` (số).
  - `offline_vs_live(live_lines: list[dict], offline_rows: list[dict]) -> list[dict]` — `{windowStart, live_in, live_out, offline_in, offline_out, lech_in, lech_out}`; live lấy `counts.sent` **status 200 cuối cùng** của mỗi cửa sổ.
  - `read_jsonl(path: Path) -> list[dict]`.

- [ ] **Step 1: Viết test (phải fail)**

`ai-vision/tests/test_metrics.py`:

```python
import csv
import json
import sys

import pytest

from swiftletcare_ai.config import AI_DIR
from swiftletcare_ai.metrics import counting_summary, event_metrics, false_alarms, offline_vs_live, segment_counts

sys.path.insert(0, str(AI_DIR / 'scripts'))
import evaluate  # noqa: E402


def test_event_metrics_theo_su_kien():
    gt = [('T01', 'snake', 10, 20), ('T01', 'snake', 50, 60), ('T02', 'rat', 0, 5)]
    events = [('T01', 'snake', 12), ('T01', 'snake', 15), ('T01', 'snake', 40), ('T02', 'rat', 3), ('T02', 'owl', 3)]
    m = event_metrics(events, gt)
    assert m['snake'] == {'n_events': 3, 'tp_events': 2, 'precision': pytest.approx(2 / 3),
                          'n_segments': 2, 'detected': 1, 'recall': 0.5}
    assert m['rat']['precision'] == 1.0 and m['rat']['recall'] == 1.0
    assert m['owl'] == {'n_events': 1, 'tp_events': 0, 'precision': 0.0, 'n_segments': 0, 'detected': 0, 'recall': None}


def test_event_metrics_su_kien_khac_video_khong_tinh():
    m = event_metrics([('T02', 'snake', 12)], [('T01', 'snake', 10, 20)])
    assert m['snake']['tp_events'] == 0 and m['snake']['detected'] == 0


def test_false_alarms():
    lines = [{'type': 'predator.confirmed', 'class': 'rat'}] * 3 + [{'type': 'predator.cooldown_blocked', 'class': 'rat'}] * 9 \
        + [{'type': 'counts.sent'}]
    fa = false_alarms(lines, hours=1.5)
    assert fa['rat'] == {'confirmed': 3, 'blocked': 9, 'per_hour_cooldown': 2.0, 'per_hour_raw': 8.0}
    assert fa['owl'] == {'confirmed': 0, 'blocked': 0, 'per_hour_cooldown': 0.0, 'per_hour_raw': 0.0}


def test_segment_counts_nua_khoang():
    crossings = [(0.0, 'out'), (59.9, 'in'), (60.0, 'out'), (61.0, 'out')]
    assert segment_counts(crossings, 0, 60) == (1, 1)
    assert segment_counts(crossings, 60, 120) == (0, 2)


def test_counting_summary():
    rows = [{'tay_in': 10, 'tay_out': 4, 'ai_in': 8, 'ai_out': 5},
            {'tay_in': 0, 'tay_out': 6, 'ai_in': 1, 'ai_out': 6}]
    s = counting_summary(rows)
    assert s['in'] == {'tong_tay': 10, 'tong_ai': 9, 'mae': 1.5, 'sai_so_tuong_doi': 0.3, 'sai_lech_co_dau': -0.1}
    assert s['out'] == {'tong_tay': 10, 'tong_ai': 11, 'mae': 0.5, 'sai_so_tuong_doi': 0.1, 'sai_lech_co_dau': 0.1}


def test_counting_summary_tong_tay_0():
    s = counting_summary([{'tay_in': 0, 'tay_out': 0, 'ai_in': 2, 'ai_out': 0}])
    assert s['in']['sai_so_tuong_doi'] is None and s['in']['sai_lech_co_dau'] is None


def test_offline_vs_live_lay_lan_gui_200_cuoi():
    live = [
        {'type': 'counts.sent', 'status': 200, 'windows': [{'windowStart': '2026-10-12T10:00:00Z', 'in': 1, 'out': 2}]},
        {'type': 'counts.sent', 'status': 503, 'windows': [{'windowStart': '2026-10-12T10:00:00Z', 'in': 9, 'out': 9}]},
        {'type': 'counts.sent', 'status': 200, 'windows': [{'windowStart': '2026-10-12T10:00:00Z', 'in': 3, 'out': 4}]},
    ]
    offline = [{'windowStart': '2026-10-12T10:00:00Z', 'in': '5', 'out': '4'},
               {'windowStart': '2026-10-12T10:05:00Z', 'in': '1', 'out': '0'}]
    assert offline_vs_live(live, offline) == [
        {'windowStart': '2026-10-12T10:00:00Z', 'live_in': 3, 'live_out': 4, 'offline_in': 5, 'offline_out': 4, 'lech_in': -2, 'lech_out': 0},
        {'windowStart': '2026-10-12T10:05:00Z', 'live_in': None, 'live_out': None, 'offline_in': 1, 'offline_out': 0, 'lech_in': None, 'lech_out': None},
    ]


def test_evaluate_counting_ghi_csv(tmp_path):
    run = tmp_path / 'V05'
    run.mkdir()
    (run / 'crossings.csv').write_text(
        'at,chieu,track_id\n2000-01-01T00:00:05Z,out,1\n2000-01-01T00:00:30Z,in,2\n2000-01-01T00:01:10Z,out,3\n', encoding='utf-8')
    seg = tmp_path / 'segments.csv'
    seg.write_text('video,doan,bat_dau_s,ket_thuc_s,tay_in,tay_out\nV05,1,0,60,1,2\nV05,2,60,120,0,1\n', encoding='utf-8')
    out = tmp_path / 'res'
    assert evaluate.main(['counting', '--segments', str(seg), '--runs', str(run), '--t0', '2000-01-01T00:00:00Z', '--out', str(out)]) == 0
    with (out / 'counting.csv').open(encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
    assert [(r['doan'], r['ai_in'], r['ai_out']) for r in rows] == [('1', '1', '1'), ('2', '0', '1')]
    assert (out / 'counting_summary.csv').is_file()
```

Run: `.\.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'swiftletcare_ai.metrics'`.

- [ ] **Step 2: Viết `ai-vision/swiftletcare_ai/metrics.py`**

```python
"""Chi so cho bao cao (spec Phan 6). Ham thuan, khong doc file tru read_jsonl."""
import json
from pathlib import Path

from .config import PREDATOR_CLASSES


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text(encoding='utf-8').splitlines() if l.strip()]


def _ratio(a: float, b: float):
    return a / b if b else None


def event_metrics(events, gt) -> dict[str, dict]:
    result = {}
    for cls in PREDATOR_CLASSES:
        ev = [(v, t) for v, c, t in events if c == cls]
        segs = [(v, s, e) for v, c, s, e in gt if c == cls]
        hit = lambda v, t: any(v == sv and s <= t <= e for sv, s, e in segs)
        tp = sum(1 for v, t in ev if hit(v, t))
        detected = sum(1 for sv, s, e in segs if any(v == sv and s <= t <= e for v, t in ev))
        result[cls] = {'n_events': len(ev), 'tp_events': tp, 'precision': _ratio(tp, len(ev)),
                       'n_segments': len(segs), 'detected': detected, 'recall': _ratio(detected, len(segs))}
    return result


def false_alarms(lines: list[dict], hours: float) -> dict[str, dict]:
    result = {}
    for cls in PREDATOR_CLASSES:
        confirmed = sum(1 for l in lines if l.get('type') == 'predator.confirmed' and l.get('class') == cls)
        blocked = sum(1 for l in lines if l.get('type') == 'predator.cooldown_blocked' and l.get('class') == cls)
        result[cls] = {'confirmed': confirmed, 'blocked': blocked,
                       'per_hour_cooldown': confirmed / hours, 'per_hour_raw': (confirmed + blocked) / hours}
    return result


def segment_counts(crossings, start: float, end: float) -> tuple[int, int]:
    inside = [d for t, d in crossings if start <= t < end]
    return inside.count('in'), inside.count('out')


def counting_summary(rows: list[dict]) -> dict[str, dict]:
    result = {}
    for d in ('in', 'out'):
        tay = [r[f'tay_{d}'] for r in rows]
        ai = [r[f'ai_{d}'] for r in rows]
        abs_err = sum(abs(a - t) for a, t in zip(ai, tay))
        result[d] = {
            'tong_tay': sum(tay), 'tong_ai': sum(ai),
            'mae': abs_err / len(rows) if rows else None,
            'sai_so_tuong_doi': _ratio(abs_err, sum(tay)),
            'sai_lech_co_dau': _ratio(sum(ai) - sum(tay), sum(tay)),
        }
    return result


def offline_vs_live(live_lines: list[dict], offline_rows: list[dict]) -> list[dict]:
    live = {}
    for l in live_lines:
        if l.get('type') == 'counts.sent' and l.get('status') == 200:
            for w in l['windows']:
                live[w['windowStart']] = (w['in'], w['out'])
    rows = []
    for r in offline_rows:
        ws, oi, oo = r['windowStart'], int(r['in']), int(r['out'])
        li, lo = live.get(ws, (None, None))
        rows.append({'windowStart': ws, 'live_in': li, 'live_out': lo, 'offline_in': oi, 'offline_out': oo,
                     'lech_in': None if li is None else li - oi, 'lech_out': None if lo is None else lo - oo})
    return rows
```

- [ ] **Step 3: Viết `ai-vision/scripts/evaluate.py`**

```python
"""Tinh so do tu ket qua offline/live (spec 6.4-6.7). Ghi CSV vao results/ (mac dinh).
  events          --gt results/events_gt.csv --runs data/out/eval/T01 ... --t0 2000-01-01T00:00:00Z
  false-alarms    --logs data/out/fa/S01/H1-F0-CAMERA.log ... --videos data/videos/S01.mp4 ...
  counting        --segments results/counting_segments.csv --runs data/out/count/V05 ... --t0 2000-01-01T00:00:00Z
  offline-vs-live --live-log data/logs/H1-F0-CAMERA.log --offline data/out/ovl/counts.csv
Moi thu muc --runs la mot lan offline chay rieng mot video (--playlist <video> --t0 <t0>), ten thu muc = ma video."""
import argparse
import csv
import sys
from pathlib import Path

import cv2

AI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_DIR))
from swiftletcare_ai.metrics import (  # noqa: E402
    counting_summary, event_metrics, false_alarms, offline_vs_live, read_jsonl, segment_counts,
)
from swiftletcare_ai.timeutil import parse_utc  # noqa: E402


def _read(path: Path) -> list[dict]:
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def _write(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]) if rows else ['trong'])
        w.writeheader()
        w.writerows(rows)
    print('Da ghi', path)


def _seconds(at: str, t0) -> float:
    return (parse_utc(at) - t0).total_seconds()


def cmd_events(a) -> int:
    t0 = parse_utc(a.t0)
    gt = [(r['video'], r['class'], float(r['bat_dau_s']), float(r['ket_thuc_s'])) for r in _read(a.gt)]
    events = [(run.name, r['class'], _seconds(r['at'], t0)) for run in a.runs for r in _read(run / 'predators.csv')]
    m = event_metrics(events, gt)
    _write(a.out / 'events.csv', [{'lop': c, **v} for c, v in m.items()])
    return 0


def cmd_false_alarms(a) -> int:
    hours = 0.0
    for v in a.videos:
        cap = cv2.VideoCapture(str(v))
        hours += cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS) / 3600
        cap.release()
    lines = [l for p in a.logs for l in read_jsonl(p)]
    fa = false_alarms(lines, hours)
    _write(a.out / 'false_alarms.csv', [{'lop': c, 'gio_video': round(hours, 3), **v} for c, v in fa.items()])
    if hours < 1:
        print('Chu y: tong video < 1 gio, so moi gio la ngoai suy (spec 6.5)')
    return 0


def cmd_counting(a) -> int:
    t0 = parse_utc(a.t0)
    crossings = {run.name: [(_seconds(r['at'], t0), r['chieu']) for r in _read(run / 'crossings.csv')] for run in a.runs}
    rows = []
    for s in _read(a.segments):
        ai_in, ai_out = segment_counts(crossings[s['video']], float(s['bat_dau_s']), float(s['ket_thuc_s']))
        extra = {k: v for k, v in s.items() if k.startswith('nguoi_dem_lai')}
        rows.append({'video': s['video'], 'doan': s['doan'], 'tay_in': int(s['tay_in']), 'tay_out': int(s['tay_out']),
                     'ai_in': ai_in, 'ai_out': ai_out, **extra})
    _write(a.out / 'counting.csv', rows)
    summary = counting_summary(rows)
    _write(a.out / 'counting_summary.csv', [{'chieu': d, **v} for d, v in summary.items()])
    return 0


def cmd_offline_vs_live(a) -> int:
    live = read_jsonl(a.live_log)
    rows = offline_vs_live(live, _read(a.offline))
    _write(a.out / 'offline_vs_live.csv', rows)
    ratios = [l['droppedFrameRatio'] for l in live if l.get('type') == 'fps']
    if ratios:
        print(f'Ti le khung bi bo trung binh (live): {sum(ratios) / len(ratios):.3f}')
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', type=Path, default=AI_DIR / 'results')
    sub = ap.add_subparsers(dest='cmd', required=True)
    e = sub.add_parser('events')
    e.add_argument('--gt', type=Path, required=True)
    e.add_argument('--runs', type=Path, nargs='+', required=True)
    e.add_argument('--t0', required=True)
    f = sub.add_parser('false-alarms')
    f.add_argument('--logs', type=Path, nargs='+', required=True)
    f.add_argument('--videos', type=Path, nargs='+', required=True)
    c = sub.add_parser('counting')
    c.add_argument('--segments', type=Path, required=True)
    c.add_argument('--runs', type=Path, nargs='+', required=True)
    c.add_argument('--t0', required=True)
    o = sub.add_parser('offline-vs-live')
    o.add_argument('--live-log', type=Path, required=True)
    o.add_argument('--offline', type=Path, required=True)
    for p in (e, f, c, o):
        p.add_argument('--out', type=Path, default=argparse.SUPPRESS)
    a = ap.parse_args(argv)
    return {'events': cmd_events, 'false-alarms': cmd_false_alarms, 'counting': cmd_counting,
            'offline-vs-live': cmd_offline_vs_live}[a.cmd](a)


if __name__ == '__main__':
    sys.exit(main())
```

(`--out` đặt được cả trước lẫn sau tên lệnh; test đặt sau.)

- [ ] **Step 4: Viết `ai-vision/scripts/measure_speed.py` và `ai-vision/scripts/eval_detector.py`**

`measure_speed.py`:

```python
"""Toc do tren CPU o nhieu do phan giai (spec 6.2). Ghi results/speed.csv.
Chay: .\\.venv\\Scripts\\python scripts\\measure_speed.py --may "<ten CPU, RAM>" --camera H1-F0-CAMERA --video data/videos/T01.mp4 --imgsz 640 320"""
import argparse
import csv
import io
import sys
import tempfile
from pathlib import Path

import cv2

AI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_DIR))
from swiftletcare_ai.app import Deps, run_offline  # noqa: E402
from swiftletcare_ai.detector import Detector, measure_fps  # noqa: E402
from swiftletcare_ai.metrics import read_jsonl  # noqa: E402

FRAMES = 305  # >= 300 khung + 5 khung khoi dong


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--may', required=True)
    ap.add_argument('--camera', required=True)
    ap.add_argument('--video', required=True, help='duong dan tinh tu ai-vision/')
    ap.add_argument('--imgsz', type=int, nargs='+', required=True)
    ap.add_argument('--weights', type=Path, default=AI_DIR / 'data' / 'weights' / 'best.pt')
    a = ap.parse_args(argv)
    cap = cv2.VideoCapture(str(AI_DIR / a.video))
    frames = []
    while len(frames) < FRAMES:
        ok, img = cap.read()
        if not ok:
            break
        frames.append(img)
    cap.release()
    if len(frames) < FRAMES:
        print(f'Chu y: video chi co {len(frames)} khung (< {FRAMES})')
    rows = []
    for size in a.imgsz:
        fps_model = measure_fps(Detector(a.weights, size), frames)
        with tempfile.TemporaryDirectory() as tmp:
            run_offline(a.camera, Path(tmp), a.weights, size, None, [a.video], Deps(stream=io.StringIO()))
            fps_full = [l for l in read_jsonl(Path(tmp) / f'{a.camera}.log') if l['type'] == 'fps'][-1]['fps']
        rows.append({'may': a.may, 'imgsz': size, 'fps_mo_hinh': round(fps_model, 2),
                     'fps_toan_luong': fps_full, 'ms_moi_khung': round(1000 / fps_full, 1)})
        print(rows[-1])
    out = AI_DIR / 'results' / 'speed.csv'
    out.parent.mkdir(exist_ok=True)
    with out.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    return 0


if __name__ == '__main__':
    sys.exit(main())
```

`eval_detector.py` (tên trường kết quả val theo S23 — Step 6 kiểm và sửa nếu khác):

```python
"""Do chinh xac mo hinh theo khung tren tap TEST, tung lop, nhieu do phan giai (spec 6.3). Ghi results/detector.csv.
Chay: .\\.venv\\Scripts\\python scripts\\eval_detector.py --data data/dataset/data.yaml --imgsz 640 320 --single-source owl"""
import argparse
import csv
import sys
from pathlib import Path

from ultralytics import YOLO

AI_DIR = Path(__file__).resolve().parent.parent


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', type=Path, required=True)
    ap.add_argument('--imgsz', type=int, nargs='+', required=True)
    ap.add_argument('--weights', type=Path, default=AI_DIR / 'data' / 'weights' / 'best.pt')
    ap.add_argument('--single-source', nargs='*', default=[], help='lop chi co mot nguon (khong co tap test doc lap)')
    a = ap.parse_args(argv)
    rows = []
    for size in a.imgsz:
        m = YOLO(str(a.weights)).val(data=str(a.data), split='test', imgsz=size, verbose=False)
        for i, cls_index in enumerate(m.box.ap_class_index):
            name = m.names[int(cls_index)]
            p, r, ap50, ap = m.box.class_result(i)
            rows.append({'imgsz': size, 'lop': name, 'precision': round(float(p), 4), 'recall': round(float(r), 4),
                         'map50': round(float(ap50), 4), 'map50_95': round(float(ap), 4),
                         'ghi_chu': 'khong co tap test doc lap' if name in a.single_source else ''})
    out = AI_DIR / 'results' / 'detector.csv'
    out.parent.mkdir(exist_ok=True)
    with out.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print('Da ghi', out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 5: Chạy test**

Run: `.\.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: PASS 8 test.

- [ ] **Step 6: Viết khung `results/`, commit phần code**

`ai-vision/results/events_gt.csv` (TV3 điền **trước khi** chạy mô hình trên video đó, spec 6.4):

```
video,class,bat_dau_s,ket_thuc_s
```

`ai-vision/results/counting_segments.csv` (đoạn ~1 phút, đếm tay theo `MIN_BOX_PX` và vạch cấu hình; TV5 đếm lại ~20% vào hai cột cuối, để trống nếu không đếm lại):

```
video,doan,bat_dau_s,ket_thuc_s,tay_in,tay_out,nguoi_dem_lai_in,nguoi_dem_lai_out
```

`ai-vision/results/README.md`:

```markdown
# Kết quả đo ai-vision

Spec ai-vision Phần 6. **Không có ngưỡng đạt/không đạt**: ghi số đo thật kèm giải thích.

- Máy đo: _CPU, RAM_ · Ngày đo: _…_ · Trọng số: `weights.json` (sha256 _…_) · Cấu hình: `cameras/*.yaml` tại commit _…_
- Đóng băng trọng số và cấu hình từ: _01/11 (M3)_. Train lại sau ngày này thì **đo lại tất cả**.

| File | Mục spec | Cách tạo |
|---|---|---|
| `speed.csv` | 6.2 | `scripts\measure_speed.py` |
| `detector.csv` | 6.3, 6.4 theo khung | `scripts\eval_detector.py` |
| `events.csv` | 6.4 theo sự kiện | `offline` từng video thiên địch test + `scripts\evaluate.py events` |
| `false_alarms.csv` | 6.5 | `offline` từng video chỉ có chim yến test + `scripts\evaluate.py false-alarms` |
| `counting.csv`, `counting_summary.csv` | 6.6 | `offline` + `scripts\evaluate.py counting` |
| `offline_vs_live.csv` | 6.7 | `live` một lượt trên `SwiftletCare_Dev` + `offline --t0 <lúc bắt đầu live>` + `scripts\evaluate.py offline-vs-live` |
| `e2e.md` | 7.5 | Task 16 |

Hạn chế cần nhắc trong báo cáo: spec 1.4 (đặc biệt 1, 2, 6, 7, 10, 11); tổng video < 1 giờ thì số báo động giả mỗi giờ là ngoại suy.
```

```powershell
git add ai-vision/swiftletcare_ai/metrics.py ai-vision/scripts/evaluate.py ai-vision/scripts/measure_speed.py ai-vision/scripts/eval_detector.py ai-vision/tests/test_metrics.py ai-vision/results
git commit -m "feat(ai-vision): chỉ số Precision/Recall theo sự kiện, báo động giả mỗi giờ, sai số đếm, so sánh offline với live

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Đo thật (tay, theo mốc 01/11–04/11)**

Thứ tự, đúng quy tắc 6.1:
1. **Trên tập val** (trước 01/11): chọn `swiftlet.confidence`, `predator.confidence`, vị trí vạch, `confirm_frames`/`confirm_seconds`, kích thước ảnh suy luận. Ghi S18. Không xem tập test để chỉnh.
2. **01/11 (M3)**: đóng băng `weights.json` và `cameras/*.yaml`; ghi commit vào `results/README.md`.
3. `events_gt.csv`: ghi tay các đoạn thiên địch của video test **trước** khi chạy mô hình trên video đó.
4. Tốc độ: `.\.venv\Scripts\python scripts\measure_speed.py --may "<CPU, RAM>" --camera H1-F0-CAMERA --video data/videos/T01.mp4 --imgsz <imgsz train> <mức giảm>`.
5. Theo khung: `.\.venv\Scripts\python scripts\eval_detector.py --data data/dataset/data.yaml --imgsz <hai mức> --single-source <lớp chỉ một nguồn>`. Lần đầu chạy: in `m.box` để xác nhận `ap_class_index`, `class_result` (S23); khác thì sửa script, ghi S23.
6. Theo sự kiện, mỗi video thiên địch test `Txx`: `.\.venv\Scripts\python -m swiftletcare_ai offline --camera H1-F0-CAMERA --playlist data/videos/Txx.mp4 --t0 2000-01-01T00:00:00Z --out data/out/eval/Txx`, rồi `scripts\evaluate.py events --gt results/events_gt.csv --runs data/out/eval/T01 … --t0 2000-01-01T00:00:00Z`.
7. Báo động giả: `offline` từng video chỉ có chim yến test vào `data/out/fa/<mã>`, rồi `scripts\evaluate.py false-alarms --logs data/out/fa/<mã>/H1-F0-CAMERA.log … --videos data/videos/<mã>.mp4 …`.
8. Đếm: điền `counting_segments.csv` (TV3 đếm tay, TV5 đếm lại ~20%), `offline` từng video vào `data/out/count/<mã>` với `--t0 2000-01-01T00:00:00Z`, rồi `scripts\evaluate.py counting --segments results/counting_segments.csv --runs … --t0 2000-01-01T00:00:00Z`.
9. Offline vs live: chạy `live --camera H1-F0-CAMERA` hết một lượt playlist trên `SwiftletCare_Dev` (backend dev chạy), ghi giờ bắt đầu (dòng `start` trong log, dạng `…Z`); chạy `offline --camera H1-F0-CAMERA --t0 <giờ đó> --out data/out/ovl`; rồi `scripts\evaluate.py offline-vs-live --live-log data/logs/H1-F0-CAMERA.log --offline data/out/ovl/counts.csv`.
10. Điền `results/README.md` (máy, ngày, sha256), commit CSV (không ảnh, không video). **Hạn 04/11**, báo TV5.

```powershell
git status   # chi results\*.csv, results\README.md; khong co data\
git add ai-vision/results ai-vision/spikes/RESULTS.md
git commit -m "docs(ai-vision): số đo trên tập test (tốc độ, Precision/Recall, báo động giả, sai số đếm, offline so với live)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Kiểm tay đầu-cuối với backend thật (spec 7.5)

**Files:**
- Create: `ai-vision/results/e2e.md`
- Modify: `ai-vision/spikes/RESULTS.md` (S22), spec ai-vision mục 5.6/7.5 nếu kết quả khác

**Interfaces:**
- Consumes: backend đã xong plan backend Task 19 (mốc trước 29/10); CSDL `SwiftletCare_Dev` có dữ liệu mẫu; `best.pt`; playlist H1 có đoạn thiên địch **ở đầu** (để bước 4 phát lại kịp trong 5 phút).
- Produces: `results/e2e.md` — bằng chứng duy nhất AI chạy đúng với backend thật.

- [ ] **Step 1: Chuẩn bị**

- Hỏi TV2 giá trị `AI_SERVICE_KEY` của backend dev (qua kênh riêng), ghi vào `ai-vision\.env`; `BACKEND_URL` đúng máy chạy backend.
- Kiểm `SNAPSHOT_MAX_BYTES` hai bên bằng nhau (S19).
- Mở web (hoặc gọi API) của H1 để xem số đếm và cảnh báo.

- [ ] **Step 2: Kiểm 404 thật (S22)**

```powershell
curl.exe -s -i -X POST -H "X-Service-Key: x" http://localhost:3000/api/ai/khong-co
```

Expected: `HTTP/1.1 4xx`. Ghi body thật vào S22. Nếu route sai trả 401 (guard chạy trước) thay vì 404: ghi rõ — AI vẫn dừng, chỉ khác thông báo (spec 5.6).

- [ ] **Step 3: Chạy theo 7 bước spec 7.5**

1. `.\.venv\Scripts\python -m swiftletcare_ai live --camera H1-F0-CAMERA` **ít nhất 10 phút**.
2. Số đếm trên web/API đúng cửa sổ 5 phút (so với dòng `counts.sent` trong `data\logs\H1-F0-CAMERA.log`).
3. Khi đoạn thiên địch phát: có cảnh báo PREDATOR, xem được ảnh có khung bao. Ghi `at` của sự kiện (dòng `predator.sent`).
4. Trong vòng **5 phút** sau bước 3: Ctrl+C, chạy lại `live` ngay; khi đoạn thiên địch cùng lớp được xác nhận lại, log có `predator.sent` với `"skipReason": "COOLDOWN"`, web không có cảnh báo mới. Quá 5 phút thì làm lại.
5. Ctrl+C: tổng cuối của cửa sổ đang mở đã vào CSDL (API `/api/houses/{id}/birds…` hoặc web); `data\run\H1-F0-CAMERA.lock` đã xóa.
6. (Nếu backend đã xong Task 26) chạy lại với `--heartbeat`: `LastSeenAt` của `H1-F0-CAMERA` cập nhật.

- [ ] **Step 4: Ghi `ai-vision/results/e2e.md`**

```markdown
# Kiểm tay đầu-cuối ai-vision ↔ backend (spec 7.5)

- Ngày: _…_ · Người làm: TV3 · Commit ai-vision: _…_ · Commit backend: _…_ · CSDL: SwiftletCare_Dev

| Bước | Kết quả mong đợi | Kết quả thật | Đạt |
|---|---|---|---|
| 1 | `live` chạy ≥ 10 phút, không dừng | | |
| 2 | Số đếm đúng cửa sổ 5 phút | | |
| 3 | Cảnh báo PREDATOR + ảnh có khung bao; `at` = … | | |
| 4 | Khởi động lại trong 5 phút → `skipReason: COOLDOWN`, không có cảnh báo mới | | |
| 5 | Tổng cuối vào CSDL; file khóa đã xóa | | |
| 6 | Heartbeat cập nhật `LastSeenAt` (nếu có Task 26 backend) | | |

Ghi chú: test hình dạng và backend giả không chứng minh AI chạy đúng với backend thật; bảng này là bằng chứng.
```

Bước nào không đạt: dùng `superpowers:systematic-debugging`, báo TV2 nếu lỗi ở backend; **không tự sửa hợp đồng**.

- [ ] **Step 5: Commit**

```powershell
git add ai-vision/results/e2e.md ai-vision/spikes/RESULTS.md
git commit -m "docs(ai-vision): kết quả kiểm tay đầu-cuối với backend thật

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Có sửa spec theo kết quả thì `git add` thêm file spec.)

---

## Kiểm tra cuối cùng (trước khi mở PR `ai-vision` → `main`)

- [ ] `cd ai-vision; .\.venv\Scripts\python -m pytest -v` → PASS (test mô hình thật không còn `SKIPPED` khi đã có `best.pt`; test fixture hợp đồng PASS sau khi PR hợp đồng đã merge).
- [ ] `git status --short` không có `.venv`, `data\`, `*.pt`, `.env`, ảnh, video.
- [ ] `spikes/RESULTS.md` không còn dòng trống: mỗi mục có kết quả hoặc "chưa kiểm được" + lý do.
- [ ] Spec ai-vision đã ghi lại mọi chỗ lệch phát hiện khi thực thi (bản Python, phiên bản gói, hành vi vạch đếm, `MIN_BOX_PX`, chênh lệch Ultralytics) và đã báo nhóm.
- [ ] Rà nhánh bằng `superpowers:requesting-code-review`; sửa vấn đề nghiêm trọng.
- [ ] Mở PR `ai-vision` → `main`, ít nhất một người duyệt (CLAUDE.md); nội dung PR liệt kê task đã làm, kết quả S2, S3, S20, S22 và trạng thái `results/`.
