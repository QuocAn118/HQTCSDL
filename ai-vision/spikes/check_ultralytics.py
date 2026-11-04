"""Kiem chung Ultralytics tren CPU: nap YOLOv8n co san, toc do, ten tham so train/val (spec 2.5, 2.6, 6.3)."""
import time
import tempfile
from pathlib import Path

import numpy as np
import ultralytics
from ultralytics import YOLO
from ultralytics.cfg import get_cfg

print('ultralytics', ultralytics.__version__)
temp = tempfile.TemporaryDirectory()
model = YOLO(str(Path(temp.name) / 'yolov8n.pt'))
print('names', model.names)
frame = np.zeros((720, 1280, 3), dtype=np.uint8)
times = []
for i in range(30):
    t = time.perf_counter()
    result = model.predict(frame, verbose=False, device='cpu')[0]
    times.append(time.perf_counter() - t)
avg = sum(times[5:]) / len(times[5:])
print('fps_mo_hinh', round(1 / avg, 2), 'ms', round(avg * 1000, 1))
print('kieu ket qua', type(result).__name__, 'co boxes', hasattr(result, 'boxes'))
cfg = get_cfg()
print('tham so train', {k: getattr(cfg, k) for k in ('epochs', 'imgsz', 'seed', 'batch', 'device')})
temp.cleanup()
