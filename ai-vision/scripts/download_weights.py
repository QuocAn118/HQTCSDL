"""Download, hash-check and load weights. Use --verify-only for local files."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

import requests

AI_DIR = Path(__file__).resolve().parents[1]
META = AI_DIR / 'weights.json'
DEST = AI_DIR / 'data' / 'weights' / 'best.pt'
CLASSES = {'owl', 'rat', 'snake', 'swiftlet'}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, dest: Path, expected_sha256: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + '.part')
    try:
        with requests.get(url, stream=True, timeout=(10, 60)) as response:
            response.raise_for_status()
            with part.open('wb') as stream:
                for chunk in response.iter_content(1 << 20):
                    stream.write(chunk)
        if sha256_file(part) != expected_sha256.lower():
            raise ValueError('SHA-256 khong khop. Khong thay the trong so hien co.')
        part.replace(dest)
    finally:
        part.unlink(missing_ok=True)


def require_classes(names: dict) -> None:
    # Task 11's detector does not exist yet. Keep this script standalone.
    if len(names) != 4 or set(names.values()) != CLASSES:
        raise ValueError('Trong so phai co dung bon lop: owl, rat, snake, swiftlet')


def load_and_check(path: Path) -> None:
    import ultralytics
    from ultralytics import YOLO

    model = YOLO(str(path))
    require_classes(dict(model.names))
    print('Nap duoc', path, 'lop', dict(model.names))
    print('Ultralytics may nay:', ultralytics.__version__)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args(argv)
    try:
        meta = json.loads(META.read_text(encoding='utf-8-sig'))
        expected = meta.get('sha256')
        if not isinstance(expected, str) or not re.fullmatch(r'[a-fA-F0-9]{64}', expected):
            raise ValueError('weights.json thieu SHA-256 hop le')
        if args.verify_only:
            if sha256_file(DEST) != expected.lower():
                raise ValueError('SHA-256 file hien co khong khop weights.json')
        else:
            url = meta.get('url')
            if not isinstance(url, str) or not url.startswith('https://'):
                raise ValueError('Chua co URL HTTPS tai trong so. Dung --verify-only cho file da tai tu Drive.')
            download(url, DEST, expected)
        load_and_check(DEST)
        if meta.get('status') == 'trial':
            print('Luu y: trong so train thu; val chi co swiftlet.')
        return 0
    except (OSError, ValueError, requests.RequestException, ImportError, RuntimeError) as exc:
        print('Loi:', exc, file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
