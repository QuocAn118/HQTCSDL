import time
from pathlib import Path

import numpy as np
import pytest

from swiftletcare_ai.config import AI_DIR, ConfigError
from swiftletcare_ai.detector import measure_fps, require_classes

WEIGHTS = AI_DIR / 'data' / 'weights' / 'best.pt'


def test_measure_fps_bo_5_khung_dau():
    calls = []

    def detect(frame):
        calls.append(frame)
        time.sleep(0.2 if len(calls) <= 5 else 0.02)

    fps = measure_fps(detect, [np.zeros((2, 2, 3))] * 30)
    assert len(calls) == 30
    assert 10 < fps < 60


def test_measure_fps_it_khung_bao_loi():
    with pytest.raises(ValueError):
        measure_fps(lambda f: None, [np.zeros((2, 2, 3))] * 5)


def test_detector_thieu_file_trong_so_bao_ro(tmp_path):
    from swiftletcare_ai.detector import Detector
    with pytest.raises(ConfigError, match='download_weights'):
        Detector(tmp_path / 'khong-co.pt')


def test_require_classes():
    require_classes({0: 'swiftlet', 1: 'rat', 2: 'snake', 3: 'owl'})
    with pytest.raises(ConfigError, match='owl'):
        require_classes({0: 'swiftlet', 1: 'rat', 2: 'snake'})


def test_detector_giu_detection_duoi_nguong_mac_dinh_yolo(tmp_path, monkeypatch):
    import ultralytics
    import supervision as sv
    from swiftletcare_ai.detector import Detector

    class Model:
        names = {0: 'swiftlet', 1: 'rat', 2: 'snake', 3: 'owl'}

        def predict(self, frame, conf=0.25, **kwargs):
            # YAML cho phep nguong swiftlet 0.1; YOLO khong duoc loai truoc.
            return [0.15] if conf <= 0.15 else [None]

    monkeypatch.setattr(ultralytics, 'YOLO', lambda _: Model())
    monkeypatch.setattr(sv.Detections, 'from_ultralytics', staticmethod(lambda result: result))
    weights = tmp_path / 'best.pt'
    weights.touch()
    detector = Detector(weights)
    assert detector(np.zeros((8, 8, 3), dtype=np.uint8)) == 0.15


@pytest.mark.skipif(not WEIGHTS.is_file(), reason='chua co data/weights/best.pt (chay scripts/download_weights.py)')
def test_mo_hinh_that_nap_duoc_va_du_lop(ai_fixtures_dir):
    import cv2
    from swiftletcare_ai.detector import Detector
    d = Detector(WEIGHTS)
    require_classes(d.names)
    image = cv2.imdecode(np.frombuffer((ai_fixtures_dir / 'snake.jpg').read_bytes(), np.uint8), cv2.IMREAD_COLOR)
    dets = d(image)
    assert len(dets.xyxy) == len(dets.class_id)
