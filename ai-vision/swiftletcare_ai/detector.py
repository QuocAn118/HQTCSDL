"""Bo nhan dang Ultralytics (YOLOv8n da train 4 lop) va do fps khi khoi dong (spec 3.4)."""
import time
from pathlib import Path
from typing import Callable

import numpy as np
import supervision as sv

from .config import PREDATOR_CLASSES, SWIFTLET, ConfigError


class Detector:
    def __init__(self, weights: Path, imgsz: int | None = None):
        if not Path(weights).is_file():
            raise ConfigError(f'chua co trong so {weights} (chay scripts/download_weights.py)')
        from ultralytics import YOLO  # nap cham, chi khi can mo hinh that
        self._model = YOLO(str(weights))
        self._imgsz = imgsz
        self.names: dict[int, str] = dict(self._model.names)

    def __call__(self, frame: np.ndarray) -> sv.Detections:
        kwargs = {'verbose': False}
        if self._imgsz:
            kwargs['imgsz'] = self._imgsz
        return sv.Detections.from_ultralytics(self._model.predict(frame, **kwargs)[0])


def require_classes(names: dict[int, str]) -> None:
    missing = [c for c in (SWIFTLET, *PREDATOR_CLASSES) if c not in names.values()]
    if missing:
        raise ConfigError(f'trong so thieu lop: {", ".join(missing)} (co: {sorted(names.values())})')


def measure_fps(detect: Callable[[np.ndarray], object], frames: list[np.ndarray], warmup: int = 5) -> float:
    if len(frames) <= warmup:
        raise ValueError(f'can hon {warmup} khung de do fps')
    for f in frames[:warmup]:
        detect(f)
    t = time.perf_counter()
    for f in frames[warmup:]:
        detect(f)
    return (len(frames) - warmup) / max(time.perf_counter() - t, 1e-9)
