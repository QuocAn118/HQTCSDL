"""Tinh so do tu ket qua offline/live (spec 6.4-6.7). Ghi CSV vao results/ (mac dinh).
  events          --gt results/events_gt.csv --runs data/out/eval/T01 ... --t0 2000-01-01T00:00:00Z
  false-alarms    --logs data/out/fa/S01/H1-F0-CAMERA.log ... --videos data/videos/S01.mp4 ...
  counting        --segments results/counting_segments.csv --runs data/out/count/V05 ... --t0 2000-01-01T00:00:00Z
  offline-vs-live --live-log data/logs/H1-F0-CAMERA.log --offline data/out/ovl/counts.csv
Moi thu muc --runs la mot lan offline chay rieng mot video (--playlist <video> --t0 <t0>), ten thu muc = ma video."""
import argparse
import csv
import math
import sys
from pathlib import Path

import cv2

AI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_DIR))
from swiftletcare_ai.metrics import (  # noqa: E402
    counting_summary, event_metrics, false_alarms, offline_vs_live, read_jsonl, segment_counts,
)
from swiftletcare_ai.timeutil import parse_utc  # noqa: E402


def _read(path: Path) -> list[dict]:
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def _write(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]) if rows else ['trong'])
        w.writeheader()
        w.writerows(rows)
    print('Da ghi', path)


def _seconds(at: str, t0) -> float:
    return (parse_utc(at) - t0).total_seconds()


def cmd_events(a) -> int:
    t0 = parse_utc(a.t0)
    gt = [(r['video'], r['class'], float(r['bat_dau_s']), float(r['ket_thuc_s'])) for r in _read(a.gt)]
    events = [(run.name, r['class'], _seconds(r['at'], t0)) for run in a.runs for r in _read(run / 'predators.csv')]
    m = event_metrics(events, gt)
    _write(a.out / 'events.csv', [{'lop': c, **v} for c, v in m.items()])
    return 0


def cmd_false_alarms(a) -> int:
    hours = 0.0
    for v in a.videos:
        cap = cv2.VideoCapture(str(v))
        try:
            fps = cap.get(cv2.CAP_PROP_FPS)
            count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            if not cap.isOpened() or not math.isfinite(fps) or fps <= 0 or not math.isfinite(count) or count <= 0:
                raise ValueError(f'khong doc duoc thoi luong video {v}')
            hours += count / fps / 3600
        finally:
            cap.release()
    lines = [l for p in a.logs for l in read_jsonl(p)]
    fa = false_alarms(lines, hours)
    _write(a.out / 'false_alarms.csv', [{'lop': c, 'gio_video': round(hours, 3), **v} for c, v in fa.items()])
    if hours < 1:
        print('Chu y: tong video < 1 gio, so moi gio la ngoai suy (spec 6.5)')
    return 0


def cmd_counting(a) -> int:
    t0 = parse_utc(a.t0)
    crossings = {run.name: [(_seconds(r['at'], t0), r['chieu']) for r in _read(run / 'crossings.csv')] for run in a.runs}
    rows = []
    for s in _read(a.segments):
        ai_in, ai_out = segment_counts(crossings[s['video']], float(s['bat_dau_s']), float(s['ket_thuc_s']))
        extra = {k: v for k, v in s.items() if k.startswith('nguoi_dem_lai')}
        rows.append({'video': s['video'], 'doan': s['doan'], 'tay_in': int(s['tay_in']), 'tay_out': int(s['tay_out']),
                     'ai_in': ai_in, 'ai_out': ai_out, **extra})
    _write(a.out / 'counting.csv', rows)
    summary = counting_summary(rows)
    _write(a.out / 'counting_summary.csv', [{'chieu': d, **v} for d, v in summary.items()])
    return 0


def cmd_offline_vs_live(a) -> int:
    live = read_jsonl(a.live_log)
    rows = offline_vs_live(live, _read(a.offline))
    _write(a.out / 'offline_vs_live.csv', rows)
    ratios = [l['droppedFrameRatio'] for l in live if l.get('type') == 'fps']
    if ratios:
        print(f'Ti le khung bi bo trung binh (live): {sum(ratios) / len(ratios):.3f}')
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', type=Path, default=AI_DIR / 'results')
    sub = ap.add_subparsers(dest='cmd', required=True)
    e = sub.add_parser('events')
    e.add_argument('--gt', type=Path, required=True)
    e.add_argument('--runs', type=Path, nargs='+', required=True)
    e.add_argument('--t0', required=True)
    f = sub.add_parser('false-alarms')
    f.add_argument('--logs', type=Path, nargs='+', required=True)
    f.add_argument('--videos', type=Path, nargs='+', required=True)
    c = sub.add_parser('counting')
    c.add_argument('--segments', type=Path, required=True)
    c.add_argument('--runs', type=Path, nargs='+', required=True)
    c.add_argument('--t0', required=True)
    o = sub.add_parser('offline-vs-live')
    o.add_argument('--live-log', type=Path, required=True)
    o.add_argument('--offline', type=Path, required=True)
    for p in (e, f, c, o):
        p.add_argument('--out', type=Path, default=argparse.SUPPRESS)
    a = ap.parse_args(argv)
    return {'events': cmd_events, 'false-alarms': cmd_false_alarms, 'counting': cmd_counting,
            'offline-vs-live': cmd_offline_vs_live}[a.cmd](a)


if __name__ == '__main__':
    sys.exit(main())
