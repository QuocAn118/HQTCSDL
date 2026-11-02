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
