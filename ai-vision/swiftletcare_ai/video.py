"""Phat playlist: offline mot luot; live theo gio that, bo khung khi CPU cham, lap lai khi het (spec 3.4, 4.1)."""
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import cv2
import numpy as np

from .logjson import JsonLog

MAX_BAD = 30  # so khung loi lien tiep toi da truoc khi coi nhu het video


class VideoOpenError(Exception):
    pass


@dataclass
class Frame:
    image: np.ndarray
    video_index: int
    path: Path
    pos: float
    new_video: bool
    fps: float


class VideoPlayer:
    def __init__(self, camera: str, paths: tuple[Path, ...], log: JsonLog, clock,
                 opener=cv2.VideoCapture, process_fps: float | None = None):
        self.camera = camera
        self.paths = paths
        self.log = log
        self.clock = clock
        self._opener = opener
        self._pf = process_fps
        self.processed = 0
        self.skipped = 0

    def _open(self, path: Path):
        cap = self._opener(str(path))
        if not cap.isOpened():
            raise VideoOpenError(f'camera {self.camera}: khong mo duoc video {path}')
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps or not math.isfinite(fps) or fps <= 0:
            cap.release()
            raise VideoOpenError(f'camera {self.camera}: video {path} co fps khong hop le ({fps})')
        return cap, fps, int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    def _bad(self, path: Path, idx: int, total: int, bad: int) -> bool:
        """True = bo qua khung loi va doc tiep; False = coi nhu het video."""
        if total and idx < total and bad < MAX_BAD:
            self.log.warning('video.frame_error', file=path.name, frame=idx)
            return True
        return False

    def check_all(self) -> float:
        first = None
        for path in self.paths:
            cap, fps, _ = self._open(path)
            cap.release()
            first = fps if first is None else first
        return first

    def first_frames(self, n: int) -> list[np.ndarray]:
        cap, _, _ = self._open(self.paths[0])
        frames = []
        try:
            while len(frames) < n:
                ok, img = cap.read()
                if not ok:
                    break
                frames.append(img)
        finally:
            cap.release()
        return frames

    def offline(self) -> Iterator[Frame]:
        offset = 0.0
        for vi, path in enumerate(self.paths):
            cap, fps, total = self._open(path)
            idx, bad, last_slot, first = -1, 0, -1, True
            try:
                while True:
                    ok, img = cap.read()
                    idx += 1
                    if not ok:
                        if self._bad(path, idx, total, bad):
                            bad += 1
                            continue
                        break
                    bad = 0
                    if self._pf and self._pf < fps:
                        slot = int(idx * self._pf / fps)
                        if slot == last_slot:
                            self.skipped += 1
                            continue
                        last_slot = slot
                    self.processed += 1
                    yield Frame(img, vi, path, offset + idx / fps, first, fps)
                    first = False
            finally:
                cap.release()
            offset += idx / fps

    def live(self) -> Iterator[Frame]:
        clock = self.clock
        while True:
            for vi, path in enumerate(self.paths):
                cap, fps, total = self._open(path)
                start = clock.monotonic()
                idx, bad, first, last_proc = -1, 0, True, None
                try:
                    while True:
                        if self._pf and last_proc is not None:
                            gap = 1 / self._pf - (clock.monotonic() - last_proc)
                            if gap > 0:
                                clock.sleep(gap)
                        elapsed = clock.monotonic() - start
                        want = int(elapsed * fps + 1e-9)
                        if want <= idx:
                            clock.sleep((idx + 1) / fps - elapsed)
                            continue
                        ended = False
                        while idx < want - 1:
                            idx += 1
                            if cap.grab():
                                self.skipped += 1
                            elif not self._bad(path, idx, total, bad):
                                ended = True
                                break
                            else:
                                bad += 1
                        if ended:
                            break
                        ok, img = cap.read()
                        idx += 1
                        if not ok:
                            if self._bad(path, idx, total, bad):
                                bad += 1
                                continue
                            break
                        bad = 0
                        self.processed += 1
                        last_proc = clock.monotonic()
                        yield Frame(img, vi, path, idx / fps, first, fps)
                        first = False
                finally:
                    cap.release()
