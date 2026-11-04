"""Per-class test precision/recall at frozen confidence and matching IoU 0.5.

Unlike Ultralytics' F1-selected summary, these counts use the deployment
thresholds exactly. Source image labels must be YOLO detection rectangles.
"""
import argparse
import csv
import json
from pathlib import Path
import sys

import yaml
from ultralytics import YOLO

AI_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_DIR))
from swiftletcare_ai.metrics import frame_counts
from download_weights import sha256_file


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--freeze', type=Path, default=AI_DIR / 'results/freeze.json')
    args = parser.parse_args()
    frozen = json.loads(args.freeze.read_text(encoding='utf-8'))
    weights = AI_DIR / frozen['weights']
    if sha256_file(weights) != frozen['weightsSha256']:
        raise ValueError('Weights changed after freeze')
    for rel, digest in frozen['files'].items():
        if sha256_file(AI_DIR / rel) != digest:
            raise ValueError(f'Frozen file changed: {rel}')
    data = yaml.safe_load((AI_DIR / frozen['data']).read_text(encoding='utf-8'))
    images_dir = Path(data['path']) / data['test']
    files = sorted(p for p in images_dir.iterdir() if p.suffix.lower() in {'.jpg', '.jpeg', '.png'})
    names = data['names']
    if isinstance(names, dict):
        names = [names[i] for i in range(len(names))]
    thresholds = [frozen['swiftletConfidence'] if n == 'swiftlet' else frozen['predatorConfidence'] for n in names]
    rows = []
    for size in frozen['imgsz']:
        model = YOLO(str(weights))
        if dict(model.names) != dict(enumerate(names)):
            raise ValueError('Model/dataset class IDs differ')
        totals = [[0, 0, 0] for _ in names]
        # Directory source loads bounded batches; a list loads every image in RAM.
        results = model.predict(source=str(images_dir), stream=True, batch=8,
                                imgsz=size, conf=min(thresholds), iou=frozen['nmsIou'],
                                max_det=300, device='cpu', verbose=False)
        processed = 0
        for result in results:
            image = Path(result.path)
            label = image.parent.parent / 'labels' / (image.stem + '.txt')
            if not label.is_file():
                raise ValueError(f'Missing label: {label}')
            height, width = result.orig_shape
            gt = []
            for line in label.read_text(encoding='utf-8').splitlines():
                cls, x, y, w, h = map(float, line.split())
                gt.append((int(cls), ((x-w/2)*width, (y-h/2)*height, (x+w/2)*width, (y+h/2)*height)))
            pred = [(int(cls), float(score), tuple(box))
                    for cls, score, box in zip(result.boxes.cls.tolist(), result.boxes.conf.tolist(), result.boxes.xyxy.tolist())
                    if score >= thresholds[int(cls)]]
            counts = frame_counts(pred, gt, len(names), frozen['matchingIou'])
            for cls, values in enumerate(counts):
                totals[cls] = [a+b for a, b in zip(totals[cls], values)]
            processed += 1
            if processed % 200 == 0:
                print(f'imgsz={size}: {processed}/{len(files)}', flush=True)
        if processed != len(files):
            raise RuntimeError('Incomplete evaluation')
        for cls, (tp, fp, fn) in enumerate(totals):
            rows.append(dict(imgsz=size, lop=names[cls], confidence=thresholds[cls], iou=frozen['matchingIou'],
                             images=processed, tp=tp, fp=fp, fn=fn,
                             precision=tp/(tp+fp) if tp+fp else None,
                             recall=tp/(tp+fn) if tp+fn else None))
        # Save after each resolution so an interrupted run retains completed work.
        with (AI_DIR / 'results/detector.csv').open('w', newline='', encoding='utf-8') as stream:
            writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
    print('Saved results/detector.csv', flush=True)


if __name__ == '__main__':
    main()
