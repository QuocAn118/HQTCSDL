"""Ban gia cho video va mo hinh: test khong can file video hay best.pt."""
from pathlib import Path

import cv2
import numpy as np


class FakeCapture:
    def __init__(self, n=50, fps=10.0, bad=(), opened=True, size=(48, 64)):
        self.n, self.fps, self.bad, self.opened, self.size = n, fps, set(bad), opened, size
        self.pos = 0

    def isOpened(self):
        return self.opened

    def get(self, prop):
        return {cv2.CAP_PROP_FPS: self.fps, cv2.CAP_PROP_FRAME_COUNT: float(self.n)}.get(prop, 0.0)

    def read(self):
        if self.pos >= self.n:
            return False, None
        i = self.pos
        self.pos += 1
        if i in self.bad:
            return False, None
        return True, np.full((*self.size, 3), i % 256, dtype=np.uint8)

    def grab(self):
        return self.read()[0]

    def release(self):
        pass


def fake_opener(specs: dict[str, dict]):
    return lambda path: FakeCapture(**specs[Path(path).name])


def value(frame) -> int:
    return int(frame[0, 0, 0])

import supervision as sv

NAMES = {0: 'swiftlet', 1: 'rat', 2: 'snake', 3: 'owl'}
_IDS = {v: k for k, v in NAMES.items()}


def detections(items) -> sv.Detections:
    if not items:
        return sv.Detections.empty()
    return sv.Detections(
        xyxy=np.array([xyxy for _, _, xyxy in items], dtype=float),
        confidence=np.array([c for _, c, _ in items], dtype=float),
        class_id=np.array([_IDS[n] for n, _, _ in items]),
    )


class FakeDetector:
    def __init__(self, script=None, interrupt_at=None, on_interrupt=None, error_at=None):
        self.names = NAMES
        self.calls = 0
        self._script, self._interrupt_at, self._on_interrupt, self._error_at = script, interrupt_at, on_interrupt, error_at

    def __call__(self, frame):
        i = self.calls
        self.calls += 1
        if i == self._interrupt_at:
            if self._on_interrupt:
                self._on_interrupt()
            raise KeyboardInterrupt
        if i == self._error_at:
            raise RuntimeError('loi gia trong mo hinh')
        return detections(self._script(i) if self._script else [])


class FakeTracker:
    """id = int(x1 // 10) + 1: hai con chim o hai cot x khac nhau co hai id khac nhau."""
    def update_with_detections(self, dets: sv.Detections) -> sv.Detections:
        dets.tracker_id = (dets.xyxy[:, 0] // 10).astype(int) + 1 if len(dets) else np.array([], dtype=int)
        return dets


def bird_up(i: int, start: int, x: float = 28.0, h: int = 48) -> list:
    """Mot con chim bay tu duoi len qua vach y = 0.55 * h trong 11 lan goi tu start (qua vach giua k = 4 va 5)."""
    k = i - start
    if not 0 <= k <= 10:
        return []
    y = h * 0.85 - k * (h * 0.07)
    return [('swiftlet', 0.9, (x, y - 3, x + 8, y + 3))]
