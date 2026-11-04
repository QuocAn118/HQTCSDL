"""Chi so cho bao cao (spec Phan 6). Ham thuan, khong doc file tru read_jsonl."""
import json
import math
from pathlib import Path

from .config import PREDATOR_CLASSES


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text(encoding='utf-8').splitlines() if l.strip()]


def _ratio(a: float, b: float):
    return a / b if b else None


def frame_counts(predictions, ground_truth, n_classes: int, iou_threshold: float = 0.5):
    """TP/FP/FN per class at a fixed confidence, greedy highest-score first.

    Predictions: (class_id, score, xyxy); GT: (class_id, xyxy).
    Each GT may match once, only to the same class, at IoU >= threshold.
    """
    counts = [[0, 0, 0] for _ in range(n_classes)]
    used = set()
    for cls, score, box in sorted(predictions, key=lambda p: p[1], reverse=True):
        best, best_iou = None, -1.0
        for index, (gt_cls, gt_box) in enumerate(ground_truth):
            if index in used or gt_cls != cls:
                continue
            intersection = max(0, min(box[2], gt_box[2]) - max(box[0], gt_box[0])) * max(0, min(box[3], gt_box[3]) - max(box[1], gt_box[1]))
            area = max(0, box[2] - box[0]) * max(0, box[3] - box[1])
            gt_area = max(0, gt_box[2] - gt_box[0]) * max(0, gt_box[3] - gt_box[1])
            union = area + gt_area - intersection
            iou = intersection / union if union else 0
            if iou >= iou_threshold and iou > best_iou:
                best, best_iou = index, iou
        counts[cls][0 if best is not None else 1] += 1
        if best is not None:
            used.add(best)
    for index, (cls, _) in enumerate(ground_truth):
        if index not in used:
            counts[cls][2] += 1
    return [tuple(c) for c in counts]


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
