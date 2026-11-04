"""Read-only train/val label audit and reproducible annotated review sheets.

Never reads the test split or modifies labels. Eight pixels is a diagnostic
flag only, not a decision about MIN_BOX_PX or an automatic exclusion rule.
"""
import argparse
import csv
import json
import math
from pathlib import Path
import random
import statistics

from PIL import Image, ImageDraw

NAMES = ['owl', 'rat', 'snake', 'swiftlet']


def parse_boxes(text, n_classes):
    boxes, errors = [], []
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            values = list(map(float, line.split()))
            if len(values) != 5 or not all(math.isfinite(x) for x in values):
                raise ValueError('expected five finite numbers')
            cls, x, y, w, h = values
            if cls != int(cls) or not 0 <= cls < n_classes:
                raise ValueError('invalid class ID')
            if not (0 < w <= 1 and 0 < h <= 1 and x-w/2 >= -1e-6 and y-h/2 >= -1e-6
                    and x+w/2 <= 1+1e-6 and y+h/2 <= 1+1e-6):
                raise ValueError('invalid rectangle or outside image')
            boxes.append((int(cls), x, y, w, h))
        except ValueError as error:
            errors.append({'line': number, 'reason': str(error)})
    return boxes, errors


def box_stats(box, width, height):
    cls, x, y, w, h = box
    a, b = w*width, h*height
    return {'min_side_px': min(a, b), 'area_fraction': w*h,
            'aspect_ratio': max(a, b)/min(a, b)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    manifest = list(csv.DictReader((args.dataset / 'split_manifest.csv').open(encoding='utf-8-sig')))
    rows, problems, objects = [], [], []
    for record in manifest:
        if record['split'] not in {'train', 'val'}:
            continue
        image, label = args.dataset / record['image'], args.dataset / record['label']
        boxes, errors = parse_boxes(label.read_text(encoding='utf-8-sig'), len(NAMES))
        with Image.open(image) as im:
            width, height = im.size
        stat = [box_stats(box, width, height) for box in boxes]
        row = {'image': record['image'], 'label': record['label'], 'split': record['split'],
               'source': record['source_id'], 'class': record['class'], 'width': width, 'height': height,
               'boxes': len(boxes), 'min_side_px': min((s['min_side_px'] for s in stat), default=0),
               'tiny_boxes_lt_8px': sum(s['min_side_px'] < 8 for s in stat),
               'extreme_aspect_gt_20': sum(s['aspect_ratio'] > 20 for s in stat)}
        rows.append(row)
        for error in errors:
            problems.append({'image': record['image'], **error})
        if len(boxes) != len(set(boxes)):
            problems.append({'image': record['image'], 'line': None, 'reason': 'duplicate boxes'})
        for box, stats in zip(boxes, stat):
            objects.append({'split': record['split'], 'class': NAMES[box[0]], **stats})
    with (args.out / 'images.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    summary = {'imagesReviewedTechnically': len(rows), 'testImagesRead': 0, 'errors': problems,
               'note': 'Flags require visual review; no label edits or exclusions performed.', 'classes': []}
    selected = []
    for cls in NAMES:
        for split in ['train', 'val']:
            mine = [x for x in objects if x['class'] == cls and x['split'] == split]
            summary['classes'].append({'class': cls, 'split': split, 'objects': len(mine),
                                      'medianMinSidePx': statistics.median(x['min_side_px'] for x in mine) if mine else None,
                                      'tinyBoxesLt8px': sum(x['min_side_px'] < 8 for x in mine)})
        pool = [row for row in rows if row['class'] == cls and row['split'] == 'train']
        pool = sorted(pool, key=lambda x: x['image'])
        sample = random.Random(42).sample(pool, min(12, len(pool)))
        sheet = Image.new('RGB', (4*360, 3*280), 'white')
        for index, row in enumerate(sample):
            with Image.open(args.dataset / row['image']) as im:
                im = im.convert('RGB')
            draw = ImageDraw.Draw(im)
            boxes, _ = parse_boxes((args.dataset / row['label']).read_text(encoding='utf-8-sig'), 4)
            for c, x, y, w, h in boxes:
                draw.rectangle(((x-w/2)*im.width, (y-h/2)*im.height, (x+w/2)*im.width, (y+h/2)*im.height), outline='red', width=3)
                draw.text(((x-w/2)*im.width, max(0, (y-h/2)*im.height)), NAMES[c], fill='red')
            im.thumbnail((356, 245))
            left, top = index % 4 * 360, index // 4 * 280
            sheet.paste(im, (left, top+30))
            ImageDraw.Draw(sheet).text((left+3, top+3), f'{cls} #{index+1} {row["source"]}', fill='black')
            selected.append({'sheet': cls, 'sample': index+1, **row})
        sheet.save(args.out / f'{cls}-train.jpg')
    with (args.out / 'visual_samples.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(selected[0]))
        writer.writeheader()
        writer.writerows(selected)
    (args.out / 'summary.json').write_text(json.dumps(summary, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
