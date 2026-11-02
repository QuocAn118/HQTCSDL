import io
import json
from datetime import datetime, timedelta, timezone

import numpy as np

from conftest import camera_data, write_yaml
from fakes import NAMES, FakeTracker, bird_up, detections
from swiftletcare_ai.config import load_camera_config
from swiftletcare_ai.logjson import JsonLog
from swiftletcare_ai.pipeline import Pipeline
from swiftletcare_ai.predators import PredatorConfirmer
from swiftletcare_ai.timeutil import FakeClock
from swiftletcare_ai.windows import WindowCounter

T = datetime(2026, 10, 12, 10, 0, 0, tzinfo=timezone.utc)
FRAME = np.zeros((48, 64, 3), dtype=np.uint8)


def build(tmp_path):
    cfg = load_camera_config(write_yaml(tmp_path, camera_data()), tmp_path)
    stream = io.StringIO()
    log = JsonLog('H1-F0-CAMERA', None, FakeClock(T), stream)
    closed, crossings, confirmed = [], [], []
    windows = WindowCounter(lambda *a: closed.append(a))
    p = Pipeline(cfg, NAMES, windows, PredatorConfirmer(cfg.predator), log,
                 lambda *a: crossings.append(a), confirmed.append, lambda fps: FakeTracker())
    p.new_video(10)
    return p, windows, closed, crossings, confirmed, stream


def at(i):
    return T + timedelta(seconds=i / 10)


def test_chim_bay_len_qua_vach_tinh_out(tmp_path):
    p, windows, _, crossings, _, _ = build(tmp_path)
    for i in range(12):
        p.process(FRAME, detections(bird_up(i, 0)), at(i))
    assert windows.current() == (T, 0, 1)
    assert [(c[1], c[2]) for c in crossings] == [('out', 3)]


def test_chim_duoi_nguong_tin_cay_khong_vao_tracker(tmp_path):
    p, windows, _, crossings, _, _ = build(tmp_path)
    for i in range(12):
        items = [(n, 0.3, xyxy) for n, _, xyxy in bird_up(i, 0)]
        p.process(FRAME, detections(items), at(i))
    assert crossings == [] and windows.current() == (T, 0, 0)


def test_thien_dich_khong_di_qua_tracker(tmp_path):
    p, _, _, crossings, _, _ = build(tmp_path)
    for i in range(12):
        items = [('rat', 0.9, xyxy) for _, _, xyxy in bird_up(i, 0)]
        p.process(FRAME, detections(items), at(i))
    assert crossings == []


def test_xac_nhan_thien_dich_log_va_goi_on_confirmed(tmp_path):
    p, _, _, _, confirmed, stream = build(tmp_path)
    box = (5.0, 5.0, 20.0, 20.0)
    for i, conf in enumerate([0.6, 0.95, 0.7]):
        p.process(FRAME, detections([('snake', conf, box), ('snake', 0.55, box), ('owl', 0.4, box)]), at(i))
    [c] = confirmed
    assert (c.cls, c.confidence, c.at) == ('snake', 0.95, at(1))
    assert [b.cls for b in c.boxes] == ['snake', 'snake']           # owl 0.4 < 0.5 khong ve
    [line] = [json.loads(l) for l in stream.getvalue().splitlines()]
    assert (line['type'], line['class'], line['confidence'], line['at']) == ('predator.confirmed', 'snake', 0.95, '2026-10-12T10:00:00Z')


def test_xac_nhan_bi_chan_ghi_cooldown_blocked(tmp_path):
    p, _, _, _, confirmed, stream = build(tmp_path)
    for i in range(6):
        p.process(FRAME, detections([('rat', 0.8, (1.0, 1.0, 9.0, 9.0))]), at(i))
    assert len(confirmed) == 1
    types = [json.loads(l)['type'] for l in stream.getvalue().splitlines()]
    assert types == ['predator.confirmed', 'predator.cooldown_blocked']


def test_doi_video_tao_tracker_va_vach_moi(tmp_path):
    p, windows, _, crossings, _, _ = build(tmp_path)
    for i in range(5):                                  # nua duong, chua qua vach
        p.process(FRAME, detections(bird_up(i, 0)), at(i))
    p.new_video(10)
    for i in range(5, 12):                              # video moi: cung id xuat hien phia tren vach
        p.process(FRAME, detections(bird_up(i, 0)), at(i))
    assert crossings == []


def test_khung_rong_van_cap_nhat_cua_so(tmp_path):
    p, windows, closed, _, _, _ = build(tmp_path)
    p.process(FRAME, detections([]), T)
    p.process(FRAME, detections([]), T + timedelta(minutes=5))
    assert closed == [(T, 0, 0)]
