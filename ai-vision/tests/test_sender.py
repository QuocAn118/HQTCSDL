import io
import json
import socket
import time
from datetime import datetime, timedelta, timezone

import cv2
import numpy as np
import pytest

from fake_backend import FakeBackend
from shapes import load_fixture
from swiftletcare_ai.config import EnvConfig
from swiftletcare_ai.logjson import JsonLog
from swiftletcare_ai.payloads import predator_metadata
from swiftletcare_ai.sender import PATHS, RETRY_DELAYS, PendingEvent, Sender
from swiftletcare_ai.snapshot import encode_within
from swiftletcare_ai.timeutil import FakeClock
from swiftletcare_ai.windows import CountQueue

T = datetime(2026, 10, 12, 10, 7, 30, tzinfo=timezone.utc)
WS = datetime(2026, 10, 12, 10, 5, 0, tzinfo=timezone.utc)
KEY = 'khoa-thu-nghiem-0123456789abcdef0123456789'
JPEG = encode_within(np.full((48, 64, 3), 128, dtype=np.uint8), 10**6)
COUNTS, PRED, HB = PATHS['counts'], PATHS['predator'], PATHS['heartbeat']


@pytest.fixture
def backend():
    with FakeBackend() as b:
        yield b


class Rig:
    def __init__(self, url: str, tmp_path, **kw):
        self.clock = FakeClock(T)
        self.log_path = tmp_path / 'H1-F0-CAMERA.log'
        self.log = JsonLog('H1-F0-CAMERA', self.log_path, self.clock, io.StringIO())
        self.queue = CountQueue()
        self.released = []
        env = EnvConfig(backend_url=url, service_key=KEY, snapshot_max_bytes=2097152)
        self.sender = Sender('H1-F0-CAMERA', env, self.queue, self.log, self.released.append, self.clock, **kw)

    def logs(self, type_=None):
        lines = [json.loads(l) for l in self.log_path.read_text(encoding='utf-8').splitlines()]
        return [l for l in lines if type_ is None or l['type'] == type_]

    def counts_now(self):
        self.sender.wake_counts()
        self.sender.run_once()


@pytest.fixture
def rig(backend, tmp_path):
    return Rig(backend.url, tmp_path)


def event(at=T) -> PendingEvent:
    return PendingEvent('snake', at, 0.87, JPEG)


# ---- bird-counts ----

def test_counts_200_xoa_khoi_hang_doi_va_log(backend, rig):
    rig.queue.put(WS, 5, 1)
    rig.counts_now()
    [req] = backend.to(COUNTS)
    assert req.json == [{'camera': 'H1-F0-CAMERA', 'windowStart': '2026-10-12T10:05:00Z', 'in': 5, 'out': 1}]
    assert req.headers['X-Service-Key'] == KEY
    assert len(rig.queue) == 0
    [line] = rig.logs('counts.sent')
    assert (line['status'], line['attempt'], line['level']) == (200, 1, 'info')
    assert line['windows'] == [{'windowStart': '2026-10-12T10:05:00Z', 'in': 5, 'out': 1}]


def test_counts_khong_gui_khi_chua_den_luot(backend, rig):
    rig.queue.put(WS, 5, 1)
    rig.sender.run_once()
    assert backend.to(COUNTS) == []


def test_counts_5xx_giu_lai_gui_lan_sau(backend, rig):
    backend.respond(COUNTS, (503, {}), (200, {'windowsUpserted': 1, 'windowsUnchanged': 0}))
    rig.queue.put(WS, 5, 1)
    rig.counts_now()
    assert len(rig.queue) == 1
    rig.counts_now()
    assert len(rig.queue) == 0
    assert [(l['status'], l['attempt']) for l in rig.logs('counts.sent')] == [(503, 1), (200, 2)]


def test_counts_mat_ket_noi_giu_lai(tmp_path):
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    r = Rig(f'http://127.0.0.1:{port}', tmp_path)
    r.queue.put(WS, 5, 1)
    r.counts_now()
    assert len(r.queue) == 1
    assert r.logs('counts.sent')[0]['status'] is None


def test_counts_400_log_error_bo_lo(backend, rig):
    backend.respond(COUNTS, (400, {'error': {'code': 'VALIDATION_ERROR', 'message': 'x', 'sqlNumber': 50012, 'details': {'fields': ['in', 'out']}}}))
    rig.queue.put(WS, 5, 1)
    rig.counts_now()
    assert len(rig.queue) == 0
    [line] = rig.logs('counts.dropped')
    assert line['level'] == 'error' and line['code'] == 'VALIDATION_ERROR' and line['in'] == 5
    assert line['details'] == {'fields': ['in', 'out']}


def test_counts_cua_so_dong_qua_60_phut_bi_bo_kem_so(backend, rig):
    rig.queue.put(WS - timedelta(hours=2), 7, 3)
    rig.counts_now()
    assert backend.to(COUNTS) == []
    [line] = rig.logs('counts.dropped')
    assert (line['windowStart'], line['in'], line['out']) == ('2026-10-12T08:05:00Z', 7, 3)


def test_counts_200_than_khong_phai_json_van_xoa(backend, rig):
    backend.respond(COUNTS, (200, 'OK'))
    rig.queue.put(WS, 1, 0)
    rig.counts_now()
    assert len(rig.queue) == 0


# ---- predator-detections ----

def test_predator_200_multipart_dung(backend, rig):
    rig.sender.submit(event())
    rig.sender.run_once()
    [req] = backend.to(PRED)
    assert req.headers['Content-Type'].startswith('multipart/form-data; boundary=')
    assert req.headers['X-Service-Key'] == KEY
    ct, meta = req.parts['metadata']
    assert json.loads(meta) == predator_metadata('H1-F0-CAMERA', 'snake', 0.87, T)
    assert req.parts['image'] == ('image/jpeg', JPEG)
    [line] = rig.logs('predator.sent')
    assert (line['created'], line['alertId'], line['skipReason'], line['attempt']) == (True, 1, None, 1)


def test_predator_5xx_roi_200_gui_lai_chinh_su_kien(backend, rig):
    backend.respond(PRED, (500, {}), (200, {'created': True, 'alertId': 9, 'skipReason': None}))
    rig.sender.submit(event())
    rig.sender.run_once()
    rig.sender.run_once()                       # chua toi 5 giay
    assert len(backend.to(PRED)) == 1
    rig.clock.advance(5)
    rig.sender.run_once()
    first, second = backend.to(PRED)
    assert first.parts == second.parts
    assert [l['status'] for l in rig.logs('predator.sent')] == [500, 200]


def test_predator_5xx_mai_thi_bo_sau_5_lan_thu_lai_va_nha_cooldown(backend, rig):
    backend.respond(PRED, (503, {}))
    rig.sender.submit(event())
    rig.sender.run_once()
    for d in RETRY_DELAYS:
        rig.clock.advance(d)
        rig.sender.run_once()
    assert len(backend.to(PRED)) == 6
    [line] = rig.logs('predator.dropped')
    assert line['attempt'] == 6
    assert rig.released == ['snake']
    rig.clock.advance(1000)
    rig.sender.run_once()
    assert len(backend.to(PRED)) == 6


def test_predator_413_thu_nho_gui_lai_dung_1_lan(backend, rig):
    backend.respond(PRED, (413, {}), (200, {'created': True, 'alertId': 2, 'skipReason': None}))
    rig.sender.submit(event())
    rig.sender.run_once()
    first, second = backend.to(PRED)
    big = cv2.imdecode(np.frombuffer(first.parts['image'][1], np.uint8), cv2.IMREAD_COLOR)
    small = cv2.imdecode(np.frombuffer(second.parts['image'][1], np.uint8), cv2.IMREAD_COLOR)
    assert small.shape[1] < big.shape[1]


def test_predator_413_hai_lan_thi_bo_giu_cooldown(backend, rig):
    backend.respond(PRED, (413, {'error': {'code': 'PAYLOAD_TOO_LARGE', 'message': 'x', 'sqlNumber': None, 'details': None}}))
    rig.sender.submit(event())
    rig.sender.run_once()
    rig.clock.advance(300)
    rig.sender.run_once()
    assert len(backend.to(PRED)) == 2
    [line] = rig.logs('predator.dropped')
    assert 'SNAPSHOT_MAX_BYTES' in line['reason']
    assert rig.released == []


def test_predator_400_log_error_khong_thu_lai_giu_cooldown(backend, rig):
    backend.respond(PRED, (400, {'error': {'code': 'VALIDATION_ERROR', 'message': 'x', 'sqlNumber': None, 'details': {'fields': ['class']}}}))
    rig.sender.submit(event())
    rig.sender.run_once()
    rig.clock.advance(300)
    rig.sender.run_once()
    assert len(backend.to(PRED)) == 1
    [line] = rig.logs('predator.dropped')
    assert (line['level'], line['code']) == ('error', 'VALIDATION_ERROR')
    assert rig.released == []


def test_predator_415_theo_fixture_hop_dong(backend, rig, ai_fixtures_dir):
    f = load_fixture(ai_fixtures_dir, 'predator-detection.invalid-not-jpeg.json')
    backend.respond(PRED, (f['status'], f['response']))
    rig.sender.submit(event())
    rig.sender.run_once()
    rig.clock.advance(300)
    rig.sender.run_once()
    assert len(backend.to(PRED)) == 1
    [line] = rig.logs('predator.dropped')
    assert (line['level'], line['status'], line['code']) == ('error', 415, 'UNSUPPORTED_MEDIA_TYPE')
    assert rig.released == []


def test_predator_cooldown_sau_khoi_dong_lai_khong_thu_lai(backend, rig, ai_fixtures_dir):
    f = load_fixture(ai_fixtures_dir, 'predator-detection.cooldown.json')
    backend.respond(PRED, (f['status'], f['response']))
    rig.sender.submit(event())                  # tien trinh moi, chua co cooldown phia AI
    rig.sender.run_once()
    rig.clock.advance(300)
    rig.sender.run_once()
    assert len(backend.to(PRED)) == 1
    [line] = rig.logs('predator.sent')
    assert (line['created'], line['skipReason']) == (False, 'COOLDOWN')


def test_predator_200_than_khong_phai_json_khong_chet(backend, rig):
    backend.respond(PRED, (200, '<html>ok</html>'))
    rig.sender.submit(event())
    rig.sender.run_once()
    [line] = rig.logs('predator.sent')
    assert line['created'] is None and line['status'] == 200


# ---- dung vi 401 / 404 ----

def test_401_theo_fixture_thi_dung_khong_lo_khoa(backend, rig, ai_fixtures_dir):
    f = load_fixture(ai_fixtures_dir, 'ai.invalid-service-key.json')
    backend.respond(COUNTS, (f['status'], f['response']))
    rig.queue.put(WS, 5, 1)
    rig.counts_now()
    assert 'AI_SERVICE_KEY' in rig.sender.fatal
    log_text = rig.log_path.read_text(encoding='utf-8') if rig.log_path.exists() else ''
    assert KEY not in rig.sender.fatal and KEY not in log_text
    rig.sender.submit(event())
    rig.counts_now()
    assert len(backend.requests) == 1


def test_404_camera_not_found_thi_dung(backend, rig):
    backend.respond(PRED, (404, {'error': {'code': 'CAMERA_NOT_FOUND', 'message': 'x', 'sqlNumber': None, 'details': None}}))
    rig.sender.submit(event())
    rig.sender.run_once()
    assert 'CSDL' in rig.sender.fatal


def test_404_khac_thi_dung_bao_sai_duong_dan(backend, rig):
    backend.respond(COUNTS, (404, {'message': 'Cannot POST /api/ai/bird-counts'}))
    rig.queue.put(WS, 5, 1)
    rig.counts_now()
    assert 'BACKEND_URL' in rig.sender.fatal


# ---- heartbeat ----

def test_heartbeat_theo_chu_ky_that_bai_khong_thu_lai(backend, tmp_path):
    r = Rig(backend.url, tmp_path, heartbeat_every=30)
    backend.respond(HB, (503, {}), (200, {'accepted': 1, 'rejected': 0}))
    r.sender.run_once()
    r.clock.advance(1)
    r.sender.run_once()
    assert len(backend.to(HB)) == 1
    r.clock.advance(29)
    r.sender.run_once()
    assert len(backend.to(HB)) == 2
    assert backend.to(HB)[0].json == {'device': 'H1-F0-CAMERA', 'at': '2026-10-12T10:07:30Z'}
    assert [l['status'] for l in r.logs('heartbeat')] == [503, 200]


def test_heartbeat_rejected_thi_canh_bao(backend, tmp_path):
    r = Rig(backend.url, tmp_path, heartbeat_every=30)
    backend.respond(HB, (200, {'accepted': 0, 'rejected': 1}))
    r.sender.run_once()
    assert r.logs('heartbeat')[0]['level'] == 'warning'


def test_heartbeat_tat_mac_dinh(backend, rig):
    rig.sender.run_once()
    assert backend.to(HB) == []


# ---- luong va gui not ----

def test_luong_gui_chay_nen_va_drain(backend, rig):
    rig.sender.start()
    rig.sender.submit(event())
    deadline = time.monotonic() + 5
    while not backend.to(PRED) and time.monotonic() < deadline:
        time.sleep(0.02)
    left_counts, left_events = rig.sender.drain(2)
    assert len(backend.to(PRED)) == 1
    assert (left_counts, left_events) == ([], [])


def test_drain_gui_not_moi_thu_mot_lan_tra_phan_con_lai(backend, rig):
    backend.respond(PRED, (503, {}))
    rig.queue.put(WS, 2, 0)
    rig.sender.submit(event())
    left_counts, left_events = rig.sender.drain(10)
    assert left_counts == [] and len(backend.to(COUNTS)) == 1
    assert len(left_events) == 1 and len(backend.to(PRED)) == 1


def test_drain_khong_vuot_han_khi_backend_cham(rig, monkeypatch):
    calls = []

    def slow_post(*args, **kwargs):
        calls.append(time.monotonic())
        time.sleep(0.4)
        class Response:
            status_code = 200
            def json(self): return {}
        return Response()

    monkeypatch.setattr(rig.sender._session, 'post', slow_post)
    rig.queue.put(WS, 1, 0)
    rig.sender.submit(event())
    started = time.monotonic()
    rig.sender.drain(0.1)
    elapsed = time.monotonic() - started
    assert elapsed < 0.3
    requests_at_return = len(calls)
    time.sleep(0.5)
    assert len(calls) == requests_at_return == 1
