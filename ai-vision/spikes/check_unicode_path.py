"""Kiem chung: OpenCV tren Windows co mo duoc video o duong dan co dau khong (Review Focus 1)."""
import shutil
import tempfile
from pathlib import Path

import cv2
import numpy as np

temp = tempfile.TemporaryDirectory()
tmp = Path(temp.name)
ascii_path = tmp / 'clip.mp4'
w = cv2.VideoWriter(str(ascii_path), cv2.VideoWriter_fourcc(*'mp4v'), 10, (64, 48))
assert w.isOpened(), 'Khong tao duoc video tong hop'
for _ in range(10):
    w.write(np.zeros((48, 64, 3), dtype=np.uint8))
w.release()
vn_dir = tmp / 'Yến thử'
vn_dir.mkdir()
vn_path = vn_dir / 'Yến 01.mp4'
shutil.copy(ascii_path, vn_path)
for label, path in [('ascii', ascii_path), ('co dau', vn_path)]:
    cap = cv2.VideoCapture(str(path))
    try:
        print(label, 'mo duoc', cap.isOpened(), 'doc khung', cap.read()[0])
    finally:
        cap.release()
temp.cleanup()
