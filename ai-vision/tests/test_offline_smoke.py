"""Real codec/model/tracker smoke test; not an accuracy measurement."""
import csv
import io

import cv2
import numpy as np
import pytest
import yaml

from conftest import camera_data
from swiftletcare_ai.app import Deps, EXIT_OK, run_offline
from swiftletcare_ai.config import AI_DIR

WEIGHTS = AI_DIR / 'data' / 'weights' / 'best.pt'


@pytest.mark.skipif(not WEIGHTS.is_file(), reason='Can best.pt de kiem tra luong that')
def test_offline_video_tong_hop_voi_mo_hinh_va_tracker_that(tmp_path):
    video = tmp_path / 'data' / 'videos' / 'synthetic.mp4'
    video.parent.mkdir(parents=True)
    writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*'mp4v'), 10, (64, 48))
    assert writer.isOpened()
    try:
        for _ in range(8):
            writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
    finally:
        writer.release()

    cameras = tmp_path / 'cameras'
    cameras.mkdir()
    config = camera_data(playlist=['data/videos/synthetic.mp4'])
    (cameras / 'H1-F0-CAMERA.yaml').write_text(yaml.safe_dump(config), encoding='utf-8')
    out = tmp_path / 'out'
    assert run_offline('H1-F0-CAMERA', out, WEIGHTS, 640, None, None,
                       Deps(ai_dir=tmp_path, stream=io.StringIO())) == EXIT_OK
    with (out / 'counts.csv').open(encoding='utf-8', newline='') as stream:
        rows = list(csv.DictReader(stream))
    assert len(rows) == 1
    assert rows[0]['camera'] == 'H1-F0-CAMERA'
    assert rows[0]['windowStart'].endswith('Z')
    assert int(rows[0]['in']) >= 0 and int(rows[0]['out']) >= 0
    assert (out / 'crossings.csv').is_file()
    assert (out / 'predators.csv').is_file()
