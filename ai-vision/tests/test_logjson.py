import io
import json
from datetime import datetime, timezone

import pytest

from swiftletcare_ai.logjson import FIELDS, JsonLog
from swiftletcare_ai.timeutil import FakeClock

T0 = datetime(2026, 10, 12, 10, 40, 7, tzinfo=timezone.utc)


def make(tmp_path):
    stream = io.StringIO()
    return JsonLog('H1-F0-CAMERA', tmp_path / 'logs' / 'H1-F0-CAMERA.log', FakeClock(T0), stream), stream


def test_moi_dong_la_json_du_truong_chung(tmp_path):
    log, stream = make(tmp_path)
    log.info('heartbeat', status=200)
    line = json.loads(stream.getvalue())
    assert line == {'ts': '2026-10-12T10:40:07Z', 'level': 'info', 'camera': 'H1-F0-CAMERA', 'type': 'heartbeat', 'status': 200}
    assert json.loads((tmp_path / 'logs' / 'H1-F0-CAMERA.log').read_text(encoding='utf-8')) == line


def test_ghi_noi_khong_ghi_de(tmp_path):
    log, _ = make(tmp_path)
    log.info('heartbeat', status=200)
    log2, _ = make(tmp_path)
    log2.error('heartbeat', status=400)
    lines = (tmp_path / 'logs' / 'H1-F0-CAMERA.log').read_text(encoding='utf-8').splitlines()
    assert [json.loads(l)['level'] for l in lines] == ['info', 'error']


def test_bang_truong_theo_spec_5_1():
    assert FIELDS == {
        'predator.confirmed': ('class', 'confidence', 'at'),
        'predator.cooldown_blocked': ('class', 'at', 'remainingSeconds'),
        'predator.sent': ('class', 'at', 'attempt', 'status', 'created', 'alertId', 'skipReason'),
        'predator.dropped': ('class', 'at', 'attempt', 'status', 'code', 'reason'),
        'counts.sent': ('windows', 'attempt', 'status'),
        'counts.dropped': ('windowStart', 'in', 'out', 'status', 'code', 'reason'),
        'heartbeat': ('status',),
        'fps': ('fps', 'droppedFrameRatio'),
        'stop': ('reason', 'exitCode'),
    }


@pytest.mark.parametrize('type_', sorted(FIELDS))
def test_thieu_truong_bat_buoc_thi_nem_loi(tmp_path, type_):
    log, _ = make(tmp_path)
    fields = {f: None for f in FIELDS[type_][:-1]}
    with pytest.raises(ValueError, match=FIELDS[type_][-1]):
        log.info(type_, **fields)


def test_level_la_bi_tu_choi(tmp_path):
    log, _ = make(tmp_path)
    with pytest.raises(ValueError):
        log.write('debug', 'heartbeat', status=200)


def test_type_ngoai_bang_duoc_phep(tmp_path):
    log, stream = make(tmp_path)
    log.warning('video.frame_error', file='V01.mp4', frame=12)
    assert json.loads(stream.getvalue())['frame'] == 12


def test_tieng_viet_va_ky_tu_dac_biet_giu_nguyen(tmp_path):
    log, stream = make(tmp_path)
    log.error('stop', reason='sai khóa "x"\nxuống dòng', exitCode=2)
    assert stream.getvalue().count('\n') == 1
    assert json.loads(stream.getvalue())['reason'] == 'sai khóa "x"\nxuống dòng'


def test_khong_co_file_log_chi_ghi_man_hinh():
    stream = io.StringIO()
    JsonLog('H1-F0-CAMERA', None, FakeClock(T0), stream).info('heartbeat', status=200)
    assert json.loads(stream.getvalue())['status'] == 200
