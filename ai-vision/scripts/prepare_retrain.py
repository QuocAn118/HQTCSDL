"""Build a separate train/val pilot; never edits the frozen dataset or weights."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import shutil

import yaml

from review_labels import NAMES, parse_boxes
from split_dataset import read_splits


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def prepare(base, decisions, negatives, validation, out, splits=None):
    if out.exists():
        raise FileExistsError(f'Output already exists: {out}')
    with decisions.open(encoding='utf-8-sig') as stream:
        quarantine = {r['image'] for r in csv.DictReader(stream) if r['decision'] == 'quarantine_v4_only'}
    with (base / 'split_manifest.csv').open(encoding='utf-8-sig') as stream:
        old_train = [r for r in csv.DictReader(stream) if r['split'] == 'train']
    if quarantine - {r['image'] for r in old_train}:
        raise ValueError('Quarantine contains unknown training image')
    chosen = json.loads((validation / 'selected_annotations.json').read_text(encoding='utf-8'))['selected']
    if {r['class'] for r in chosen} != set(NAMES):
        raise ValueError('Validation must contain all four classes')
    items = []
    for row in old_train:
        if row['image'] not in quarantine:
            items.append(('train', base / row['image'], base / row['label']))
    for image in sorted((negatives / 'images').glob('*.jpg')):
        label = negatives / 'labels' / (image.stem + '.txt')
        if label.read_text(encoding='utf-8').strip():
            raise ValueError(f'Expected an empty negative label: {image.name}')
        items.append(('train', image, label))
    for row in chosen:
        name = row['reviewImage']
        if Path(name).name != name:
            raise ValueError('Validation image must be a filename')
        image = validation / 'review' / name
        if digest(image) != row['reviewSha256']:
            raise ValueError(f'Validation image changed: {name}')
        if not (row['license'].startswith('CC') or row['license'] == 'Public domain'):
            raise ValueError(f'Unverified validation license: {name}')
        label = validation / 'labels' / (image.stem + '.txt')
        boxes, errors = parse_boxes(label.read_text(encoding='utf-8'), 4)
        if errors or not boxes or any(NAMES[b[0]] != row['class'] for b in boxes):
            raise ValueError(f'Invalid validation label: {name}')
        if 'boxesNormalizedXyxy' in row:
            expected = [(NAMES.index(row['class']), (x1+x2)/2, (y1+y2)/2, x2-x1, y2-y1)
                        for x1, y1, x2, y2 in row['boxesNormalizedXyxy']]
            if len(expected) != len(boxes) or any(
                not all(math.isclose(a, b, rel_tol=0, abs_tol=1e-6) for a, b in zip(actual, reviewed))
                for actual, reviewed in zip(boxes, expected)
            ):
                raise ValueError(f'YOLO label differs from reviewed annotation: {name}')
        items.append(('val', image, label))
    sources = {split: {image.name.split('_')[0] for s, image, _ in items if s == split} for split in ['train', 'val']}
    if sources['train'] & sources['val']:
        raise ValueError('Source appears in both train and val')
    if splits is not None:
        mapping = read_splits(splits)
        for split, image, _ in items:
            if mapping.get(image.name.split('_')[0]) != split:
                raise ValueError(f'Source split mapping mismatch: {image.name}')
    seen, filenames, hashes, backgrounds = {}, set(), [], 0
    for split, image, label in items:
        if (split, image.name) in filenames:
            raise ValueError('Duplicate output filename')
        filenames.add((split, image.name))
        sha = digest(image)
        if sha in seen and seen[sha] != split:
            raise ValueError('Train/val duplicate image')
        seen[sha] = split
        text = label.read_text(encoding='utf-8-sig')
        _, errors = parse_boxes(text, 4)
        if errors:
            raise ValueError(f'Invalid label: {label.name}')
        backgrounds += split == 'train' and not text.strip()
        hashes.append(sha)
    n_train = sum(s == 'train' for s, _, _ in items)
    if not n_train or backgrounds / n_train > .1:
        raise ValueError('Background ratio must be <= 10%')
    # All validation happens before creating any output.
    out.mkdir(parents=True)
    manifest = []
    for (split, image, label), sha in zip(items, hashes):
        target_image = out / split / 'images' / image.name
        target_label = out / split / 'labels' / label.name
        target_image.parent.mkdir(parents=True, exist_ok=True)
        target_label.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(image, target_image)
        shutil.copy2(label, target_label)
        manifest.append({'image': target_image.relative_to(out).as_posix(),
                         'label': target_label.relative_to(out).as_posix(), 'split': split,
                         'source': image.name.split('_')[0], 'sha256': sha, 'labelSha256': digest(label)})
    with (out / 'manifest.csv').open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(manifest[0]))
        writer.writeheader()
        writer.writerows(manifest)
    (out / 'data.yaml').write_text(yaml.safe_dump({'path': '.', 'train': 'train/images', 'val': 'val/images', 'nc': 4, 'names': NAMES}), encoding='utf-8')
    metadata = {'status': 'pilot_for_retraining_not_frozen', 'trainImages': n_train,
                'valImages': len(items)-n_train, 'quarantinedTrainingImages': len(quarantine),
                'backgroundImages': backgrounds, 'backgroundRatio': backgrounds/n_train,
                'classes': NAMES, 'sources': {k: sorted(v) for k, v in sources.items()},
                'labelReview': 'agent_reviewed_for_pilot' if all(r.get('reviewStatus') == 'agent_reviewed_for_pilot' for r in chosen) else 'not_recorded',
                'notes': ['No test images included or read.', 'Small validation pilot; agent review does not imply independent human review.',
                          'V01 is training data for this iteration and cannot serve as independent evaluation.',
                          'Frozen v3 weights, results and dataset remain unchanged.']}
    (out / 'dataset.json').write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
    shutil.copy2(validation / 'selected_annotations.json', out / 'val_attribution_annotations.json')
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['base', 'decisions', 'negatives', 'validation', 'out', 'splits']:
        parser.add_argument('--'+name, type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(args.base, args.decisions, args.negatives, args.validation, args.out, args.splits)))


if __name__ == '__main__':
    main()
