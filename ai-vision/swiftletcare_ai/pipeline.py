"""Xu ly mot khung: tracker + vach dem + cua so (chi swiftlet), xac nhan thien dich (spec 4.2-4.4)."""
from datetime import datetime
from typing import Callable

import numpy as np
import supervision as sv

from .config import PREDATOR_CLASSES, SWIFTLET, CameraConfig
from .counting import LineCounter
from .logjson import JsonLog
from .predators import Blocked, Box, Confirmed, PredatorConfirmer
from .timeutil import utc_iso
from .windows import WindowCounter


class Pipeline:
    def __init__(self, cfg: CameraConfig, names: dict[int, str], windows: WindowCounter,
                 confirmer: PredatorConfirmer, log: JsonLog,
                 on_crossing: Callable[[datetime, str, int], None],
                 on_confirmed: Callable[[Confirmed], None],
                 make_tracker: Callable[[float], object]):
        self._cfg = cfg
        self._names = names
        self.windows = windows
        self._confirmer = confirmer
        self._log = log
        self._on_crossing = on_crossing
        self._on_confirmed = on_confirmed
        self._make_tracker = make_tracker
        self._tracker = None
        self._line: LineCounter | None = None

    def new_video(self, fps: float) -> None:
        self._tracker = self._make_tracker(fps)
        self._line = None

    def process(self, frame: np.ndarray, dets: sv.Detections, at: datetime) -> list[Box]:
        self.windows.observe(at)
        n = len(dets)
        names = np.array([self._names[int(c)] for c in dets.class_id], dtype=object) if n else np.array([], dtype=object)
        conf = dets.confidence if n else np.array([], dtype=float)

        swift = dets[(names == SWIFTLET) & (conf >= self._cfg.swiftlet_confidence)] if n else dets
        swift_boxes = [
            Box(SWIFTLET, float(confidence), tuple(float(value) for value in xyxy))
            for xyxy, confidence in zip(swift.xyxy, swift.confidence if len(swift) else [])
        ]
        tracked = self._tracker.update_with_detections(swift)
        if self._line is None:
            h, w = frame.shape[:2]
            self._line = LineCounter(self._cfg.line.start, self._cfg.line.end, w, h)
        for direction, track_id in self._line.update(tracked):
            self.windows.add(direction, at)
            self._on_crossing(at, direction, track_id)

        boxes = [
            Box(str(names[i]), float(conf[i]), tuple(float(v) for v in dets.xyxy[i]))
            for i in range(n)
            if names[i] in PREDATOR_CLASSES and conf[i] >= self._cfg.predator.confidence
        ]
        for cls in PREDATOR_CLASSES:
            mine = [b.confidence for b in boxes if b.cls == cls]
            if not mine:
                continue
            result = self._confirmer.observe(cls, at, max(mine), frame, boxes)
            if isinstance(result, Confirmed):
                self._log.info('predator.confirmed', **{'class': cls}, confidence=result.confidence, at=utc_iso(result.at))
                self._on_confirmed(result)
            elif isinstance(result, Blocked):
                self._log.info('predator.cooldown_blocked', **{'class': cls}, at=utc_iso(result.at),
                               remainingSeconds=result.remaining_seconds)
        return swift_boxes + boxes
