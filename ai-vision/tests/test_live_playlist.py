import shutil
import subprocess
from pathlib import Path

from fakes import FakeDetector, fake_opener
from swiftletcare_ai import __main__ as cli
from swiftletcare_ai.__main__ import build_parser
from swiftletcare_ai.app import EXIT_OK, EXIT_STOP, run_live
from swiftletcare_ai.config import AI_DIR
from swiftletcare_ai.lockfile import lock_path
from test_app import CAM, WEIGHTS, backend, deps, setup_ai  # noqa: F401 (backend la fixture)

DEMO = ['data/videos/V04.mp4', 'data/videos/V05.mp4', 'data/videos/V06.mp4', 'data/videos/V07.mp4']
H2 = 'H2-F0-CAMERA'


def test_parser_live_nhan_playlist_mac_dinh_none():
    p = build_parser()
    assert p.parse_args(['live', '--camera', CAM]).playlist is None
    assert p.parse_args(['live', '--camera', CAM, '--playlist', *DEMO]).playlist == DEMO


def test_main_live_chuyen_playlist_xuong_run_live(monkeypatch):
    seen = {}
    monkeypatch.setattr(cli, 'run_live', lambda *a, **k: seen.update(k) or 0)
    assert cli.main(['live', '--camera', CAM, '--playlist', *DEMO]) == 0
    assert seen['playlist'] == DEMO


def test_live_playlist_ghi_de_yaml_ma_khong_sua_file(backend, tmp_path):
    ai = setup_ai(tmp_path, backend.url, playlist=['data/videos/chua-co.mp4'])
    yaml_path = ai / 'cameras' / f'{CAM}.yaml'
    before = yaml_path.read_bytes()
    for name in ('V04.mp4', 'V05.mp4'):
        (ai / 'data' / 'videos' / name).write_bytes(b'video')
    d = deps(ai, FakeDetector(interrupt_at=30 + 5))
    opened = []
    inner = fake_opener({n: {'n': 3000, 'fps': 10} for n in ('V04.mp4', 'V05.mp4')})
    d.opener = lambda p: opened.append(Path(p).name) or inner(p)

    assert run_live(CAM, WEIGHTS, None, False, d, playlist=['data/videos/V04.mp4', 'data/videos/V05.mp4']) == EXIT_OK

    assert opened[:2] == ['V04.mp4', 'V05.mp4']
    assert 'chua-co.mp4' not in opened
    assert yaml_path.read_bytes() == before
    assert not lock_path(ai, CAM).exists()


def test_live_playlist_thieu_file_dung_truoc_khi_lay_khoa(backend, tmp_path, capsys):
    ai = setup_ai(tmp_path, backend.url)
    assert run_live(CAM, WEIGHTS, None, False, deps(ai, FakeDetector()), playlist=['data/videos/V04.mp4']) == EXIT_STOP
    assert 'V04.mp4' in capsys.readouterr().err
    assert not lock_path(ai, CAM).exists()


def _start_cameras(tmp_path, *args):
    """Chay script that tren ban sao, thay Start-Process bang ham in lenh de khong mo cua so."""
    (tmp_path / 'scripts').mkdir()
    script = tmp_path / 'scripts' / 'start-cameras.ps1'
    shutil.copy(AI_DIR / 'scripts' / 'start-cameras.ps1', script)
    python = tmp_path / '.venv' / 'Scripts' / 'python.exe'
    python.parent.mkdir(parents=True)
    python.write_bytes(b'')
    stub = 'function Start-Process { param($FilePath, $WindowStyle, $WorkingDirectory, $ArgumentList) "CMD " + $ArgumentList[2] }'
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
                        f"{stub}; & '{script}' {' '.join(args)}"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    return {c: l for l in r.stdout.splitlines() if l.startswith('CMD') for c in (CAM, H2) if c in l}


def test_start_cameras_demo_chi_h1_dung_playlist_thien_dich(tmp_path):
    cmds = _start_cameras(tmp_path, '-DemoPredators')
    assert cmds[CAM].endswith(f"--camera {CAM} --playlist {' '.join(DEMO)}")
    assert cmds[H2].endswith(f'--camera {H2}')


def test_start_cameras_mac_dinh_khong_doi_playlist(tmp_path):
    cmds = _start_cameras(tmp_path)
    assert set(cmds) == {CAM, H2}
    assert not any('--playlist' in c for c in cmds.values())
