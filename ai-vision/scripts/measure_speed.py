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
