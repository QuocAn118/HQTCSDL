"""Dong lenh: python -m swiftletcare_ai live|offline --camera <ma> (spec 3.5)."""
import argparse
import sys
from pathlib import Path

from .app import Deps, run_live, run_offline
from .config import AI_DIR, CAMERAS
from .timeutil import parse_utc

DEFAULT_WEIGHTS = AI_DIR / 'data' / 'weights' / 'best.pt'


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog='python -m swiftletcare_ai')
    sub = p.add_subparsers(dest='cmd', required=True)
    live = sub.add_parser('live', help='phat playlist theo gio that, gui ket qua cho backend')
    off = sub.add_parser('offline', help='xu ly playlist mot luot, ghi CSV, khong gui gi')
    for s in (live, off):
        s.add_argument('--camera', required=True, choices=CAMERAS)
        s.add_argument('--weights', type=Path, default=DEFAULT_WEIGHTS)
        s.add_argument('--imgsz', type=int, default=None, help='kich thuoc anh suy luan (mac dinh theo trong so)')
    live.add_argument('--heartbeat', action='store_true', help='gui heartbeat 30 giay (can backend co /api/ai/heartbeat)')
    off.add_argument('--out', type=Path, required=True)
    off.add_argument('--t0', default=None, help='moc bat dau dang YYYY-MM-DDTHH:MM:SSZ (mac dinh: gio chay)')
    off.add_argument('--playlist', nargs='+', default=None, help='thay playlist trong YAML (duong dan tinh tu ai-vision/)')
    return p


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.cmd == 'live':
        return run_live(args.camera, args.weights, args.imgsz, args.heartbeat, Deps())
    try:
        t0 = parse_utc(args.t0) if args.t0 else None
    except ValueError as e:
        parser.error(str(e))
    return run_offline(args.camera, args.out, args.weights, args.imgsz, t0, args.playlist, Deps())


if __name__ == '__main__':
    sys.exit(main())
