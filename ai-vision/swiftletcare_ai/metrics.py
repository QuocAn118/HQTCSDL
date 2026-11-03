"""Chi so cho bao cao (spec Phan 6). Ham thuan, khong doc file tru read_jsonl."""
import json
import math
from pathlib import Path

from .config import PREDATOR_CLASSES


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text(encoding='utf-8').splitlines() if l.strip()]


def _ratio(a: float, b: float):
    return a / b if b else None


def event_metrics(events, gt) -> dict[str, dict]:
    result = {}
    for cls in PREDATOR_CLASSES:
        ev = [(v, t) for v, c, t in events if c == cls]
        segs = [(v, s, e) for v, c, s, e in gt if c == cls]
        hit = lambda v, t: any(v == sv and s <= t <= e for sv, s, e in segs)
        tp = sum(1 for v, t in ev if hit(v, t))
        detected = sum(1 for sv, s, e in segs if any(v == sv and s <= t <= e for v, t in ev))
        result[cls] = {'n_events': len(ev), 'tp_events': tp, 'precision': _ratio(tp, len(ev)),
                       'n_segments': len(segs), 'detected': detected, 'recall': _ratio(detected, len(segs))}
    return result


def false_alarms(lines: list[dict], hours: float) -> dict[str, dict]:
    if not math.isfinite(hours) or hours <= 0:
        raise ValueError('can tong so gio video huu han duong')
    result = {}
    for cls in PREDATOR_CLASSES:
        confirmed = sum(1 for l in lines if l.get('type') == 'predator.confirmed' and l.get('class') == cls)
        blocked = sum(1 for l in lines if l.get('type') == 'predator.cooldown_blocked' and l.get('class') == cls)
        result[cls] = {'confirmed': confirmed, 'blocked': blocked,
                       'per_hour_cooldown': confirmed / hours, 'per_hour_raw': (confirmed + blocked) / hours}
    return result


def segment_counts(crossings, start: float, end: float) -> tuple[int, int]:
    inside = [d for t, d in crossings if start <= t < end]
    return inside.count('in'), inside.count('out')


def counting_summary(rows: list[dict]) -> dict[str, dict]:
    result = {}
    for d in ('in', 'out'):
        tay = [r[f'tay_{d}'] for r in rows]
        ai = [r[f'ai_{d}'] for r in rows]
        abs_err = sum(abs(a - t) for a, t in zip(ai, tay))
        result[d] = {
            'tong_tay': sum(tay), 'tong_ai': sum(ai),
            'mae': abs_err / len(rows) if rows else None,
            'sai_so_tuong_doi': _ratio(abs_err, sum(tay)),
            'sai_lech_co_dau': _ratio(sum(ai) - sum(tay), sum(tay)),
        }
    return result


def offline_vs_live(live_lines: list[dict], offline_rows: list[dict]) -> list[dict]:
    live = {}
    for l in live_lines:
        if l.get('type') == 'counts.sent' and l.get('status') == 200:
            for w in l['windows']:
                live[w['windowStart']] = (w['in'], w['out'])
    rows = []
    for r in offline_rows:
        ws, oi, oo = r['windowStart'], int(r['in']), int(r['out'])
        li, lo = live.get(ws, (None, None))
        rows.append({'windowStart': ws, 'live_in': li, 'live_out': lo, 'offline_in': oi, 'offline_out': oo,
                     'lech_in': None if li is None else li - oi, 'lech_out': None if lo is None else lo - oo})
    return rows
