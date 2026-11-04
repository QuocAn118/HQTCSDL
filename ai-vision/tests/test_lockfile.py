from datetime import datetime, timezone

import pytest

from swiftletcare_ai.lockfile import LockExists, acquire, lock_path, release
from swiftletcare_ai.timeutil import FakeClock

T0 = datetime(2026, 10, 12, 10, 40, 7, tzinfo=timezone.utc)


def test_lock_path(tmp_path):
    assert lock_path(tmp_path, 'H1-F0-CAMERA') == tmp_path / 'data' / 'run' / 'H1-F0-CAMERA.lock'


def test_tao_duoc_va_ghi_thoi_diem(tmp_path):
    p = lock_path(tmp_path, 'H1-F0-CAMERA')
    acquire(p, FakeClock(T0))
    assert p.read_text(encoding='utf-8').strip() == '2026-10-12T10:40:07Z'


def test_da_co_thi_dung_bao_thoi_diem_tao(tmp_path):
    p = lock_path(tmp_path, 'H1-F0-CAMERA')
    acquire(p, FakeClock(T0))
    with pytest.raises(LockExists) as e:
        acquire(p, FakeClock(T0))
    assert e.value.created_at == '2026-10-12T10:40:07Z'
    assert '2026-10-12T10:40:07Z' in str(e.value) and str(p) in str(e.value)
    assert 'xoa tay' in str(e.value)


def test_file_khoa_rong_van_bao_duoc(tmp_path):
    p = lock_path(tmp_path, 'H1-F0-CAMERA')
    p.parent.mkdir(parents=True)
    p.write_text('', encoding='utf-8')
    with pytest.raises(LockExists) as e:
        acquire(p, FakeClock(T0))
    assert e.value.created_at  # lay tu thoi diem sua file


def test_release_xoa_file_va_goi_lai_khong_loi(tmp_path):
    p = lock_path(tmp_path, 'H1-F0-CAMERA')
    acquire(p, FakeClock(T0))
    release(p)
    assert not p.exists()
    release(p)
