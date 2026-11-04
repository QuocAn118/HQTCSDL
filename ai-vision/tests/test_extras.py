import io
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from fakes import FakeDetector, FakeTracker, bird_up, fake_opener
from swiftletcare_ai.__main__ import build_parser
from swiftletcare_ai.app import EXIT_OK, Deps, Timing, run_offline
from swiftletcare_ai.config import AI_DIR, LineCfg
from swiftletcare_ai.predators import Box
from swiftletcare_ai.snapshot import annotate
from swiftletcare_ai.timeutil import FakeClock
from test_app import setup_ai

CAM = 'H1-F0-CAMERA'


def test_annotate_ve_vach_va_khung_khong_sua_goc():
    frame = np.zeros((100, 200, 3), dtype=np.uint8)
    out = annotate(frame, [Box('swiftlet', 0.8, (10, 10, 30, 30))], LineCfg((0.1, 0.5), (0.9, 0.5)))
    assert frame.sum() == 0
    assert out[50, 100].sum() > 0          # diem giua vach
    assert out[10, 20].sum() > 0           # canh tren khung bao


def test_offline_annotated_video(tmp_path):
    ai = setup_ai(tmp_path)
    deps = Deps(clock=FakeClock(datetime(2026, 10, 12, 10, 0, tzinfo=timezone.utc)),
                opener=fake_opener({'V01.mp4': {'n': 30, 'fps': 10}}),
                make_detector=lambda w, s: FakeDetector(script=lambda i: bird_up(i, 5)),
                make_tracker=lambda fps: FakeTracker(), timing=Timing(), stream=io.StringIO(), ai_dir=ai)
    out = tmp_path / 'out'
    assert run_offline(CAM, out, Path('x.pt'), None, None, None, deps, annotated=True) == EXIT_OK
    cap = cv2.VideoCapture(str(out / 'annotated.mp4'))
    assert cap.isOpened()
    assert int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) == 30
    cap.release()


def test_offline_khong_co_co_thi_khong_ghi_video(tmp_path):
    ai = setup_ai(tmp_path)
    deps = Deps(clock=FakeClock(datetime(2026, 10, 12, 10, 0, tzinfo=timezone.utc)),
                opener=fake_opener({'V01.mp4': {'n': 5, 'fps': 10}}),
                make_detector=lambda w, s: FakeDetector(), make_tracker=lambda fps: FakeTracker(),
                timing=Timing(), stream=io.StringIO(), ai_dir=ai)
    run_offline(CAM, tmp_path / 'out', Path('x.pt'), None, None, None, deps)
    assert not (tmp_path / 'out' / 'annotated.mp4').exists()


def test_khong_mo_duoc_writer_thi_bao_loi_va_release(tmp_path, monkeypatch):
    from swiftletcare_ai.app import EXIT_STOP
    ai = setup_ai(tmp_path)
    released = []

    class FailedWriter:
        def isOpened(self): return False
        def release(self): released.append(True)

    monkeypatch.setattr(cv2, 'VideoWriter', lambda *args: FailedWriter())
    deps = Deps(opener=fake_opener({'V01.mp4': {'n': 5, 'fps': 10}}),
                make_detector=lambda w, s: FakeDetector(), make_tracker=lambda fps: FakeTracker(),
                stream=io.StringIO(), ai_dir=ai)
    assert run_offline(CAM, tmp_path / 'out', Path('x.pt'), None, None, None,
                       deps, annotated=True) == EXIT_STOP
    assert released == [True]


def test_start_cameras_tu_choi_ma_camera_la():
    script = AI_DIR / 'scripts' / 'start-cameras.ps1'
    result = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass',
                             '-File', str(script), '-Cameras', 'INVALID'],
                            capture_output=True)
    assert result.returncode != 0


def test_parser_co_annotated_video():
    a = build_parser().parse_args(['offline', '--camera', CAM, '--out', 'o', '--annotated-video'])
    assert a.annotated_video is True


def test_start_cameras_ps1_parse_duoc_bang_powershell_5_1():
    script = AI_DIR / 'scripts' / 'start-cameras.ps1'
    script.read_bytes().decode('ascii')
    check = (f"$e = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('{script}', [ref]$null, [ref]$e); "
             "if ($e.Count) { $e | ForEach-Object { $_.Message }; exit 1 }")
    r = subprocess.run(['powershell', '-NoProfile', '-Command', check], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    text = script.read_text(encoding='ascii')
    assert 'H1-F0-CAMERA' in text and 'H2-F0-CAMERA' in text and '--heartbeat' in text
