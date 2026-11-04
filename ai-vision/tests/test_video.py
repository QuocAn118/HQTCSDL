import io
import json
import math
from datetime import datetime, timezone
from itertools import islice
from pathlib import Path

import pytest

from fakes import fake_opener, value
from swiftletcare_ai.logjson import JsonLog
from swiftletcare_ai.timeutil import FakeClock
from swiftletcare_ai.video import VideoOpenError, VideoPlayer

T = datetime(2026, 10, 12, 10, 0, 0, tzinfo=timezone.utc)
A, B = Path('data/videos/A.mp4'), Path('data/videos/B.mp4')


def player(specs, paths=(A,), process_fps=None, clock=None, log_stream=None):
    clock = clock or FakeClock(T)
    log = JsonLog('H1-F0-CAMERA', None, clock, log_stream or io.StringIO())
    return VideoPlayer('H1-F0-CAMERA', paths, log, clock, opener=fake_opener(specs), process_fps=process_fps), clock


def test_offline_doc_het_theo_thu_tu_va_noi_playlist():
    p, _ = player({'A.mp4': {'n': 3, 'fps': 10}, 'B.mp4': {'n': 2, 'fps': 5}}, paths=(A, B))
    frames = list(p.offline())
    assert [(f.video_index, value(f.image)) for f in frames] == [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1)]
    assert [round(f.pos, 3) for f in frames] == [0.0, 0.1, 0.2, 0.3, 0.5]
    assert [f.new_video for f in frames] == [True, False, False, True, False]
    assert p.processed == 5 and p.skipped == 0


def test_offline_process_fps_gioi_han_so_khung():
    p, _ = player({'A.mp4': {'n': 10, 'fps': 10}}, process_fps=5)
    assert [value(f.image) for f in p.offline()] == [0, 2, 4, 6, 8]
    assert p.skipped == 5


def test_khung_loi_giua_chung_bo_qua_va_log():
    stream = io.StringIO()
    p, _ = player({'A.mp4': {'n': 5, 'bad': {2}}}, log_stream=stream)
    assert [value(f.image) for f in p.offline()] == [0, 1, 3, 4]
    [line] = [json.loads(l) for l in stream.getvalue().splitlines()]
    assert (line['type'], line['file'], line['frame']) == ('video.frame_error', 'A.mp4', 2)


def test_video_khong_mo_duoc_bao_ten_file_va_camera():
    p, _ = player({'A.mp4': {'opened': False}})
    with pytest.raises(VideoOpenError) as e:
        p.check_all()
    assert 'A.mp4' in str(e.value) and 'H1-F0-CAMERA' in str(e.value)


@pytest.mark.parametrize('fps', [0.0, math.nan, -1.0])
def test_video_fps_hong_thi_dung(fps):
    p, _ = player({'A.mp4': {'fps': fps}})
    with pytest.raises(VideoOpenError, match='fps'):
        p.check_all()


def test_check_all_tra_fps_video_dau():
    p, _ = player({'A.mp4': {'fps': 25}, 'B.mp4': {'fps': 30}}, paths=(A, B))
    assert p.check_all() == 25


def test_first_frames():
    p, _ = player({'A.mp4': {'n': 40}})
    assert [value(f) for f in p.first_frames(30)] == list(range(30))
    p, _ = player({'A.mp4': {'n': 7}})
    assert len(p.first_frames(30)) == 7


def test_live_cham_thi_bo_khung_va_khong_vuot_gio_that():
    p, clock = player({'A.mp4': {'n': 1000, 'fps': 10}})
    seen = []
    for f in islice(p.live(), 6):
        assert f.pos <= clock.monotonic() + 1e-9          # khung khong bao gio di truoc gio that
        seen.append(value(f.image))
        clock.advance(0.25)                                # xu ly cham: 4 khung/giay < 10
    assert seen == [0, 2, 5, 7, 10, 12]
    assert p.skipped == 7


def test_live_nhanh_thi_cho_dung_toc_do_phat():
    p, clock = player({'A.mp4': {'n': 1000, 'fps': 10}})
    frames = list(islice(p.live(), 10))
    assert [value(f.image) for f in frames] == list(range(10))
    assert clock.monotonic() == pytest.approx(0.9)


def test_live_process_fps():
    p, _ = player({'A.mp4': {'n': 1000, 'fps': 10}}, process_fps=2)
    assert [value(f.image) for f in islice(p.live(), 4)] == [0, 5, 10, 15]


def test_live_het_playlist_quay_lai_dau_va_bao_doi_video():
    p, _ = player({'A.mp4': {'n': 3}, 'B.mp4': {'n': 3}}, paths=(A, B))
    frames = list(islice(p.live(), 8))
    assert [f.video_index for f in frames] == [0, 0, 0, 1, 1, 1, 0, 0]
    assert [f.new_video for f in frames] == [True, False, False, True, False, False, True, False]
