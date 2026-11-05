import _thread
import csv
import io
import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest

from conftest import camera_data, write_yaml
from fake_backend import FakeBackend
from fakes import FakeDetector, FakeTracker, bird_up, fake_opener
from swiftletcare_ai.__main__ import build_parser
from swiftletcare_ai.app import EXIT_ERROR, EXIT_INTERRUPT, EXIT_OK, EXIT_STOP, Deps, Timing, run_live, run_offline
from swiftletcare_ai.lockfile import lock_path
from swiftletcare_ai.sender import PATHS
from swiftletcare_ai.timeutil import FakeClock

T = datetime(2026, 10, 12, 10, 7, 30, tzinfo=timezone.utc)
CAM = 'H1-F0-CAMERA'
KEY = 'khoa-thu-nghiem-0123456789abcdef0123456789'
WEIGHTS = Path('khong-dung-toi.pt')
SNAKE = ('snake', 0.9, (5.0, 5.0, 20.0, 20.0))


@pytest.fixture
def backend():
    with FakeBackend() as b:
        yield b


def setup_ai(tmp_path, backend_url=None, **camera_changes):
    write_yaml(tmp_path / 'cameras', camera_data(**camera_changes))
    # write_yaml tao data/videos trong thu muc truyen vao; video can nam duoi ai_dir
    (tmp_path / 'data' / 'videos').mkdir(parents=True, exist_ok=True)
    (tmp_path / 'data' / 'videos' / 'V01.mp4').write_bytes(b'video')
    if backend_url:
        (tmp_path / '.env').write_text(f'BACKEND_URL={backend_url}\nAI_SERVICE_KEY={KEY}\n', encoding='utf-8')
    return tmp_path


def deps(ai_dir, detector, video=None, **timing):
    return Deps(
        clock=FakeClock(T),
        opener=fake_opener({'V01.mp4': video or {'n': 3000, 'fps': 10}}),
        make_detector=lambda w, s: detector,
        make_tracker=lambda fps: FakeTracker(),
        timing=Timing(**{'counts_every': 1000, 'tick': 0.01, **timing}),
        stream=io.StringIO(),
        ai_dir=ai_dir,
    )


def logs(ai_dir, type_=None):
    path = ai_dir / 'data' / 'logs' / f'{CAM}.log'
    lines = [json.loads(l) for l in path.read_text(encoding='utf-8').splitlines()]
    return [l for l in lines if type_ is None or l['type'] == type_]


# ---- live ----

def test_live_dem_chim_ctrl_c_gui_tong_cuoi_xoa_khoa(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    det = FakeDetector(script=lambda i: bird_up(i, 60), interrupt_at=30 + 700)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, det)) == EXIT_OK
    last = backend.to(PATHS['counts'])[-1].json
    assert last == [{'camera': CAM, 'windowStart': '2026-10-12T10:05:00Z', 'in': 0, 'out': 1}]
    assert not lock_path(ai, CAM).exists()
    assert logs(ai, 'stop')[-1]['exitCode'] == 0


def test_live_gui_tong_moi_60_giay_ke_ca_0_0(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    det = FakeDetector(interrupt_at=30 + 650)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, det, counts_every=60)) == EXIT_OK
    bodies = [r.json for r in backend.to(PATHS['counts'])]
    assert {'camera': CAM, 'windowStart': '2026-10-12T10:05:00Z', 'in': 0, 'out': 0} in bodies[0]


def test_live_thien_dich_gui_mot_su_kien_co_anh(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    det = FakeDetector(script=lambda i: [SNAKE] if 40 <= i <= 60 else [], interrupt_at=120)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, det)) == EXIT_OK
    [req] = backend.to(PATHS['predator'])
    meta = json.loads(req.parts['metadata'][1])
    assert (meta['camera'], meta['class'], meta['confidence']) == (CAM, 'snake', 0.9)
    assert req.parts['image'][1][:3] == b'\xff\xd8\xff'
    assert len(logs(ai, 'predator.confirmed')) == 1
    assert len(logs(ai, 'predator.cooldown_blocked')) == 6


@pytest.mark.parametrize('status,body,word', [
    (401, {'error': {'code': 'UNAUTHENTICATED', 'message': 'x', 'sqlNumber': None, 'details': None}}, 'AI_SERVICE_KEY'),
    (404, {'error': {'code': 'CAMERA_NOT_FOUND', 'message': 'x', 'sqlNumber': None, 'details': None}}, 'CSDL'),
    (404, {'message': 'Cannot POST /api/ai/bird-counts'}, 'BACKEND_URL'),
])
def test_live_401_404_dung_ma_khac_0_xoa_khoa_khong_gui_them(backend, tmp_path, status, body, word):
    backend.respond(PATHS['counts'], (status, body))
    ai = setup_ai(tmp_path, backend.url)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector(), counts_every=1)) == EXIT_STOP
    assert not lock_path(ai, CAM).exists()
    assert len(backend.requests) == 1
    stop = logs(ai, 'stop')[-1]
    assert word in stop['reason'] and stop['exitCode'] == EXIT_STOP
    assert KEY not in (ai / 'data' / 'logs' / f'{CAM}.log').read_text(encoding='utf-8')


def test_live_ctrl_c_lan_hai_thoat_ngay(backend, tmp_path):
    backend.respond(PATHS['counts'], (200, {'windowsUpserted': 1, 'windowsUnchanged': 0}, 1.0))
    ai = setup_ai(tmp_path, backend.url)
    second = lambda: threading.Timer(0.3, _thread.interrupt_main).start()
    det = FakeDetector(interrupt_at=40, on_interrupt=second)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, det)) == EXIT_INTERRUPT
    assert len(backend.requests) == 1
    assert not lock_path(ai, CAM).exists()


def test_live_loi_khong_luong_truoc_gui_not_ma_1(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector(error_at=45))) == EXIT_ERROR
    assert len(backend.to(PATHS['counts'])) == 1
    assert 'RuntimeError' in logs(ai, 'error')[0]['message']
    assert not lock_path(ai, CAM).exists()


def test_live_file_khoa_da_co_thi_dung_khong_xoa_khoa(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    lock = lock_path(ai, CAM)
    lock.parent.mkdir(parents=True)
    lock.write_text('2026-10-12T09:00:00Z\n', encoding='utf-8')
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector())) == EXIT_STOP
    assert lock.exists()
    assert '2026-10-12T09:00:00Z' in logs(ai, 'stop')[0]['reason']


def test_live_thieu_cau_hinh_dung_khong_tao_khoa(tmp_path):
    (tmp_path / '.env').write_text(f'BACKEND_URL=http://127.0.0.1:9\nAI_SERVICE_KEY={KEY}\n', encoding='utf-8')
    assert run_live(CAM, WEIGHTS, None, False, deps(tmp_path, FakeDetector())) == EXIT_STOP
    assert not lock_path(tmp_path, CAM).exists()


def test_live_video_khong_mo_duoc_dung_xoa_khoa(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector(), video={'opened': False})) == EXIT_STOP
    assert not lock_path(ai, CAM).exists()
    assert 'V01.mp4' in logs(ai, 'stop')[0]['reason']


def test_live_khong_thoa_dieu_kien_fps_thi_dung(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url, process_fps=1)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector())) == EXIT_STOP
    assert 'fps' in logs(ai, 'stop')[0]['reason']


def wait_for(cond, seconds=5.0):
    deadline = time.monotonic() + seconds
    while not cond() and time.monotonic() < deadline:
        time.sleep(0.02)


def test_live_heartbeat_chi_khi_bat_co(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url)
    det = FakeDetector(interrupt_at=35, on_interrupt=lambda: time.sleep(0.3))   # cho luong gui co thoi gian chay
    run_live(CAM, WEIGHTS, None, False, deps(ai, det, heartbeat_every=1))
    assert backend.to(PATHS['heartbeat']) == []
    ai2 = setup_ai(tmp_path / 'b', backend.url)
    det = FakeDetector(interrupt_at=35, on_interrupt=lambda: wait_for(lambda: backend.to(PATHS['heartbeat'])))
    run_live(CAM, WEIGHTS, None, True, deps(ai2, det, heartbeat_every=1))
    assert backend.to(PATHS['heartbeat'])[0].json['device'] == CAM


# ---- offline ----

def read_csv(path):
    with path.open(encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def test_offline_ghi_csv_khong_gui_gi(tmp_path):
    ai = setup_ai(tmp_path)                     # khong co .env: offline khong can
    script = lambda i: bird_up(i, 60) + bird_up(i, 150, x=48.0) + ([SNAKE] if 21 <= i <= 23 else [])
    out = tmp_path / 'out'
    code = run_offline(CAM, out, WEIGHTS, None, datetime(2026, 10, 12, 10, 4, 50, tzinfo=timezone.utc), None,
                       deps(ai, FakeDetector(script=script), video={'n': 200, 'fps': 10}))
    assert code == EXIT_OK
    assert read_csv(out / 'counts.csv') == [
        {'camera': CAM, 'windowStart': '2026-10-12T10:00:00Z', 'in': '0', 'out': '1'},
        {'camera': CAM, 'windowStart': '2026-10-12T10:05:00Z', 'in': '0', 'out': '1'},
    ]
    crossings = read_csv(out / 'crossings.csv')
    assert [(c['chieu'], c['track_id']) for c in crossings] == [('out', '3'), ('out', '5')]
    [pred] = read_csv(out / 'predators.csv')
    assert (pred['camera'], pred['class'], pred['confidence']) == (CAM, 'snake', '0.9')
    assert float(pred['media_seconds']) == pytest.approx(2.1)
    assert all(float(c['media_seconds']) >= 0 for c in crossings)
    [snap] = list((out / 'snapshots').glob('*.jpg'))
    assert snap.read_bytes()[:3] == b'\xff\xd8\xff'
    assert logs_offline(out, 'predator.confirmed')


def logs_offline(out, type_):
    lines = [json.loads(l) for l in (out / f'{CAM}.log').read_text(encoding='utf-8').splitlines()]
    return [l for l in lines if l['type'] == type_]


def test_offline_playlist_ghi_de_va_dieu_kien_fps(tmp_path):
    ai = setup_ai(tmp_path, process_fps=1)
    code = run_offline(CAM, tmp_path / 'out', WEIGHTS, None, None, ['data/videos/V01.mp4'],
                       deps(ai, FakeDetector(), video={'n': 20, 'fps': 10}))
    assert code == EXIT_STOP


def test_offline_playlist_thay_the_mau_chua_co_video(tmp_path):
    ai = setup_ai(tmp_path, playlist=['data/videos/chua-co.mp4'])
    code = run_offline(CAM, tmp_path / 'out', WEIGHTS, None, None,
                       ['data/videos/V01.mp4'],
                       deps(ai, FakeDetector(), video={'n': 20, 'fps': 10}))
    assert code == EXIT_OK


# ---- dong lenh ----

def test_parser():
    p = build_parser()
    a = p.parse_args(['live', '--camera', CAM, '--heartbeat'])
    assert (a.cmd, a.camera, a.heartbeat, a.imgsz) == ('live', CAM, True, None)
    a = p.parse_args(['offline', '--camera', CAM, '--out', 'data/out/H1', '--t0', '2026-10-12T10:00:00Z',
                      '--playlist', 'data/videos/T01.mp4', '--imgsz', '320'])
    assert (a.out, a.t0, a.playlist, a.imgsz) == (Path('data/out/H1'), '2026-10-12T10:00:00Z', ['data/videos/T01.mp4'], 320)
    with pytest.raises(SystemExit):
        p.parse_args(['live', '--camera', 'H9-F0-CAMERA'])
