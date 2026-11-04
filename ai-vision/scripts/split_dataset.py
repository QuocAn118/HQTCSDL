"""Split a YOLO export by source codes, preserving its class IDs.

The existing split_v3 is prepared with split_dataset.ps1; this command is for
new exports with source-prefixed image names. Existing outputs are never reused.
"""
import argparse
import csv
from pathlib import Path
import re
import shutil
import sys

import yaml

SPLITS = ('train', 'val', 'test')
CLASSES = {'swiftlet', 'rat', 'snake', 'owl'}
IMAGE_EXT = {'.jpg', '.jpeg', '.png'}
AI_DIR = Path(__file__).resolve().parents[1]


def source_of(name: str) -> str:
    source, separator, _ = name.partition('_')
    if not separator or not re.fullmatch(r'[A-Z]+[0-9]+', source):
        raise ValueError(f'anh {name}: thieu ma nguon dau ten, vi du V01_0001.jpg')
    return source


def read_splits(path: Path) -> dict[str, str]:
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if set(reader.fieldnames or []) != {'nguon', 'tap'}:
            raise ValueError(f'{path.name}: can hai cot nguon,tap')
        result = {}
        for row in reader:
            source = (row.get('nguon') or '').strip()
            split = (row.get('tap') or '').strip()
            if not re.fullmatch(r'[A-Z]+[0-9]+', source):
                raise ValueError(f'{path.name}: ma nguon khong hop le {source!r}')
            if split not in SPLITS:
                raise ValueError(f'{path.name}: nguon {source} co tap la {split!r}; hop le: {", ".join(SPLITS)}')
            if source in result:
                raise ValueError(f'{path.name}: nguon trung {source}')
            result[source] = split
    if not result:
        raise ValueError(f'{path.name}: danh sach nguon rong')
    return result


def label_for(image: Path) -> Path:
    return image.parent.parent / 'labels' / (image.stem + '.txt')


def assign(images: list[Path], splits: dict[str, str]) -> dict[Path, str]:
    assignments = {}
    for image in images:
        source = source_of(image.name)
        if source not in splits:
            raise ValueError(f'anh {image.name}: nguon {source} khong co trong splits.csv')
        assignments[image] = splits[source]
    return assignments


def background_ratio(labels: list[Path]) -> float:
    empty = sum(not path.is_file() or not path.read_text(encoding='utf-8-sig').strip() for path in labels)
    return empty / len(labels) if labels else 0.0


def _images(export: Path) -> list[Path]:
    return sorted(path for path in export.glob('*/images/*') if path.is_file() and path.suffix.lower() in IMAGE_EXT)


def _names(config) -> list[str]:
    names = config.get('names') if isinstance(config, dict) else None
    if isinstance(names, dict):
        if set(map(str, names)) != {'0', '1', '2', '3'}:
            raise ValueError('class ID phai la 0,1,2,3')
        names = [names[i] if i in names else names[str(i)] for i in range(4)]
    if not isinstance(names, list) or len(names) != 4 or set(names) != CLASSES:
        raise ValueError('lop trong export phai dung bon ten swiftlet, rat, snake, owl')
    return names


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--splits', type=Path, default=AI_DIR / 'splits.csv')
    args = parser.parse_args(argv)
    try:
        if args.out.exists():
            raise ValueError('dau ra da ton tai; chon thu muc moi, khong ghi de')
        if args.out.resolve().is_relative_to(args.export.resolve()):
            raise ValueError('dau ra khong duoc nam trong thu muc export')
        names = _names(yaml.safe_load((args.export / 'data.yaml').read_text(encoding='utf-8-sig')))
        images = _images(args.export)
        if not images:
            raise ValueError('export khong co anh')
        assignments = assign(images, read_splits(args.splits))
        destinations = set()
        for image, split in assignments.items():
            # Protect both image and label names on case-insensitive Windows.
            for sub, name in [('images', image.name), ('labels', label_for(image).name)]:
                key = (split, sub, name.casefold())
                if key in destinations:
                    raise ValueError(f'trung ten dau ra: {name}')
                destinations.add(key)

        for split in SPLITS:
            for sub in ('images', 'labels'):
                (args.out / split / sub).mkdir(parents=True)
        for image, split in assignments.items():
            shutil.copy2(image, args.out / split / 'images' / image.name)
            label = label_for(image)
            target = args.out / split / 'labels' / label.name
            if label.is_file():
                shutil.copy2(label, target)
            else:
                target.write_text('', encoding='utf-8')
        (args.out / 'data.yaml').write_text(yaml.safe_dump({
            'path': args.out.resolve().as_posix(),
            'train': 'train/images', 'val': 'val/images', 'test': 'test/images',
            'nc': 4, 'names': names,
        }, sort_keys=False), encoding='utf-8')
        for split in SPLITS:
            labels = sorted((args.out / split / 'labels').glob('*.txt'))
            print(f'{split}: {len(labels)} anh, ti le anh nen {background_ratio(labels):.1%}')
        return 0
    except (OSError, UnicodeError, ValueError, yaml.YAMLError) as error:
        print(f'Loi: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
