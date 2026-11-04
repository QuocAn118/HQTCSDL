"""Xac nhan thien dich nhieu khung va cooldown phia AI, rieng tung lop (spec 4.4)."""
import math
import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np

from .config import PREDATOR_CLASSES, PredatorCfg


@dataclass(frozen=True)
class Box:
    cls: str
    confidence: float
    xyxy: tuple[float, float, float, float]


@dataclass
class Confirmed:
    cls: str
    at: datetime
    confidence: float
    frame: np.ndarray
    boxes: list[Box]


@dataclass
class Blocked:
    cls: str
    at: datetime
    remaining_seconds: int


@dataclass
class _Hit:
    at: datetime
    confidence: float
    frame: np.ndarray
    boxes: list[Box]


class PredatorConfirmer:
    def __init__(self, cfg: PredatorCfg):
        self._cfg = cfg
        self._hits: dict[str, deque[_Hit]] = {c: deque() for c in PREDATOR_CLASSES}
        self._until: dict[str, datetime | None] = {c: None for c in PREDATOR_CLASSES}
        self._lock = threading.Lock()

    def observe(self, cls: str, at: datetime, confidence: float, frame: np.ndarray, boxes: list[Box]):
        hits = self._hits[cls]
        hits.append(_Hit(at, confidence, frame, boxes))
        while hits and (at - hits[0].at).total_seconds() > self._cfg.confirm_seconds:
            hits.popleft()
        if len(hits) < self._cfg.confirm_frames:
            return None
        best = max(hits, key=lambda h: h.confidence)
        hits.clear()
        with self._lock:
            until = self._until[cls]
            if until is not None and at < until:
                return Blocked(cls, at, math.ceil((until - at).total_seconds()))
            self._until[cls] = at + timedelta(seconds=self._cfg.cooldown_seconds)
        return Confirmed(cls, best.at, round(best.confidence, 2), best.frame, best.boxes)

    def release(self, cls: str) -> None:
        with self._lock:
            self._until[cls] = None
