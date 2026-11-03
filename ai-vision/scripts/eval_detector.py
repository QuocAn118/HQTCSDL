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
