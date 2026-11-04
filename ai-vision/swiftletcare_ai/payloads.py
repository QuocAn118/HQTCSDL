"""Payload gui backend (hop dong 2.4). Ham tao payload khong the sinh du lieu sai (spec 7.3)."""
from datetime import datetime

from .config import CAMERAS, PREDATOR_CLASSES
from .timeutil import utc_iso, window_start
from .windows import MAX_BATCH


def _camera(camera: str) -> str:
    if camera not in CAMERAS:
        raise ValueError(f'camera la: {camera}')
    return camera


def _count(v) -> int:
    if not isinstance(v, int) or isinstance(v, bool) or v < 0:
        raise ValueError(f'so dem phai la so nguyen khong am: {v!r}')
    return v


def counts_payload(camera: str, items: list[tuple[datetime, int, int]]) -> list[dict]:
    _camera(camera)
    if len(items) > MAX_BATCH:
        raise ValueError(f'qua {MAX_BATCH} cua so mot lan gui')
    out = []
    for ws, in_, out_ in items:
        text = utc_iso(ws)
        if window_start(ws) != ws:
            raise ValueError(f'cua so khong tron 5 phut: {text}')
        out.append({'camera': camera, 'windowStart': text, 'in': _count(in_), 'out': _count(out_)})
    return out


def predator_metadata(camera: str, cls: str, confidence: float, at: datetime) -> dict:
    if cls not in PREDATOR_CLASSES:
        raise ValueError(f'lop thien dich la: {cls}')
    if not 0 <= confidence <= 1:
        raise ValueError(f'confidence ngoai [0, 1]: {confidence}')
    return {'camera': _camera(camera), 'class': cls, 'confidence': round(float(confidence), 2), 'at': utc_iso(at)}


def heartbeat_payload(camera: str, at: datetime) -> dict:
    return {'device': _camera(camera), 'at': utc_iso(at)}
