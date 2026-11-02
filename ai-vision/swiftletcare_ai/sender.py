"""Luong gui rieng co hang doi - cho DUY NHAT goi HTTP toi backend (spec 5). Khong bao gio log khoa."""
import json
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

import requests

from .config import EnvConfig
from .logjson import JsonLog
from .payloads import counts_payload, heartbeat_payload, predator_metadata
from .snapshot import shrink_jpeg
from .timeutil import utc_iso
from .windows import CountQueue

RETRY_DELAYS = (5, 15, 30, 60, 120)
TIMEOUT = (5, 10)
PATHS = {
    'counts': '/api/ai/bird-counts',
    'predator': '/api/ai/predator-detections',
    'heartbeat': '/api/ai/heartbeat',
}
_REASONS = {
    400: 'payload sai - code AI co bug',
    413: 'qua lon',
    415: 'backend tu choi kieu du lieu - code AI co bug',
}


@dataclass
class PendingEvent:
    cls: str
    at: datetime
    confidence: float
    jpeg: bytes
    retries: int = 0
    next_try: float = 0.0
    shrunk: bool = False


def _body(resp):
    try:
        return resp.json()
    except ValueError:
        return None


def _error(resp) -> tuple[str | None, object]:
    body = _body(resp)
    if isinstance(body, dict) and isinstance(body.get('error'), dict):
        return body['error'].get('code'), body['error'].get('details')
    return None, None


class Sender:
    def __init__(self, camera: str, env: EnvConfig, queue: CountQueue, log: JsonLog,
                 release: Callable[[str], None], clock, retry_delays=RETRY_DELAYS,
                 heartbeat_every: float | None = None, tick: float = 0.2):
        self.camera = camera
        self.queue = queue
        self.log = log
        self.fatal: str | None = None
        self._url = env.backend_url
        self._key = env.service_key
        self._max_bytes = env.snapshot_max_bytes
        self._release = release
        self._clock = clock
        self._delays = tuple(retry_delays)
        self._heartbeat_every = heartbeat_every
        self._next_heartbeat = clock.monotonic() if heartbeat_every else None
        self._tick = tick
        self._events: list[PendingEvent] = []
        self._counts_due = False
        self._counts_attempt = 0
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._session = requests.Session()
        self._drain_deadline: float | None = None

    # ---- goi tu luong xu ly video ----

    def wake_counts(self) -> None:
        with self._lock:
            self._counts_due = True
        self._wake.set()

    def submit(self, ev: PendingEvent) -> None:
        with self._lock:
            self._events.append(ev)
        self._wake.set()

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name=f'sender-{self.camera}', daemon=True)
        self._thread.start()

    def drain(self, seconds: float):
        self._drain_deadline = time.monotonic() + max(seconds, 0)
        self._stop.set()
        self._wake.set()
        if self._thread is not None:
            self._thread.join(timeout=max(0, self._drain_deadline - time.monotonic()))
            if self._thread.is_alive():
                with self._lock:
                    return self.queue.pending(), list(self._events)

        def flush():
            if self.fatal is None and time.monotonic() < self._drain_deadline:
                self.send_counts()
            with self._lock:
                events = list(self._events)
            for ev in events:
                if self.fatal is not None or time.monotonic() >= self._drain_deadline:
                    break
                if self.send_event(ev):
                    with self._lock:
                        self._events.remove(ev)

        worker = threading.Thread(target=flush, name=f'drain-{self.camera}', daemon=True)
        worker.start()
        worker.join(timeout=max(0, self._drain_deadline - time.monotonic()))
        with self._lock:
            return self.queue.pending(), list(self._events)

    # ---- vong lap cua luong gui ----

    def _run(self) -> None:
        while not self._stop.is_set() and self.fatal is None:
            try:
                self.run_once()
            except Exception as e:  # luong gui khong duoc chet vi mot loi le
                self.log.error('error', where='sender', message=f'{e.__class__.__name__}: {e}')
            self._wake.wait(self._tick)
            self._wake.clear()

    def run_once(self) -> None:
        if self.fatal is not None:
            return
        with self._lock:
            due, self._counts_due = self._counts_due, False
        if due:
            self.send_counts()
        now = self._clock.monotonic()
        with self._lock:
            ready = [e for e in self._events if e.next_try <= now]
        for ev in ready:
            if self.fatal is not None:
                return
            if self.send_event(ev):
                with self._lock:
                    self._events.remove(ev)
        if self._next_heartbeat is not None and self.fatal is None and now >= self._next_heartbeat:
            self._next_heartbeat = now + self._heartbeat_every
            self.send_heartbeat()

    # ---- HTTP ----

    def _post(self, path: str, **kwargs):
        if self.fatal is not None:
            return None
        timeout = TIMEOUT
        if self._drain_deadline is not None:
            remaining = self._drain_deadline - time.monotonic()
            if remaining <= 0:
                return None
            timeout = (min(TIMEOUT[0], remaining / 2), min(TIMEOUT[1], remaining / 2))
        try:
            return self._session.post(self._url + path, headers={'X-Service-Key': self._key}, timeout=timeout, **kwargs)
        except requests.RequestException:
            return None

    def _check_fatal(self, status: int, resp) -> bool:
        if status == 401:
            self.fatal = 'sai khoa dich vu, kiem tra AI_SERVICE_KEY trong .env'
        elif status == 404 and _error(resp)[0] == 'CAMERA_NOT_FOUND':
            self.fatal = f'camera {self.camera} khong co trong CSDL, da ngung dung hoac khong phai CAMERA'
        elif status == 404:
            self.fatal = 'sai duong dan (404), kiem tra BACKEND_URL trong .env'
        else:
            return False
        return True

    def send_counts(self) -> None:
        for ws, i, o in self.queue.expire(self._clock.now()):
            self.log.warning('counts.dropped', windowStart=utc_iso(ws), **{'in': i, 'out': o}, status=None,
                             code=None, reason='cua so dong qua 60 phut chua gui duoc - nhap tay neu can')
        items = self.queue.batch()
        if not items:
            return
        self._counts_attempt += 1
        resp = self._post(PATHS['counts'], json=counts_payload(self.camera, items))
        status = resp.status_code if resp is not None else None
        windows = [{'windowStart': utc_iso(ws), 'in': i, 'out': o} for ws, i, o in items]
        if status == 200:
            self.queue.ack(items)
            self.log.info('counts.sent', windows=windows, attempt=self._counts_attempt, status=200)
            self._counts_attempt = 0
            return
        if status is None or status >= 500:
            self.log.warning('counts.sent', windows=windows, attempt=self._counts_attempt, status=status)
            return
        if self._check_fatal(status, resp):
            return
        code, details = _error(resp)
        level = 'error' if status in (400, 415) else 'warning'
        for ws, i, o in items:
            self.log.write(level, 'counts.dropped', windowStart=utc_iso(ws), **{'in': i, 'out': o}, status=status,
                           code=code, reason=_REASONS.get(status, f'ma {status}'), details=details)
        self.queue.ack(items)
        self._counts_attempt = 0

    def send_event(self, ev: PendingEvent) -> bool:
        """True = xong (gui duoc hoac bo), False = giu lai cho lan thu sau."""
        meta = predator_metadata(self.camera, ev.cls, ev.confidence, ev.at)
        resp = self._post(PATHS['predator'], data={'metadata': json.dumps(meta)},
                          files={'image': ('snapshot.jpg', ev.jpeg, 'image/jpeg')})
        status = resp.status_code if resp is not None else None
        base = {'class': ev.cls, 'at': meta['at'], 'attempt': ev.retries + 1, 'status': status}
        if status == 200:
            body = _body(resp)
            body = body if isinstance(body, dict) else {}
            self.log.info('predator.sent', **base, created=body.get('created'), alertId=body.get('alertId'),
                          skipReason=body.get('skipReason'))
            return True
        if status == 413 and not ev.shrunk:
            ev.shrunk = True
            try:
                ev.jpeg = shrink_jpeg(ev.jpeg, self._max_bytes)
            except ValueError:
                pass
            else:
                return self.send_event(ev)
        if status is None or status >= 500:
            if ev.retries < len(self._delays):
                ev.next_try = self._clock.monotonic() + self._delays[ev.retries]
                ev.retries += 1
                self.log.warning('predator.sent', **base, created=None, alertId=None, skipReason=None)
                return False
            self.log.warning('predator.dropped', **base, code=None, reason='het lan thu lai - nha cooldown')
            self._release(ev.cls)
            return True
        if self._check_fatal(status, resp):
            return True
        code, details = _error(resp)
        if status == 413:
            reason = f'anh qua lon ({len(ev.jpeg)} byte) - kiem tra SNAPSHOT_MAX_BYTES hai ben'
        else:
            reason = _REASONS.get(status, f'ma {status}')
        level = 'error' if status in (400, 415) else 'warning'
        self.log.write(level, 'predator.dropped', **base, code=code, reason=reason, details=details)
        return True

    def send_heartbeat(self) -> None:
        resp = self._post(PATHS['heartbeat'], json=heartbeat_payload(self.camera, self._clock.now()))
        status = resp.status_code if resp is not None else None
        if status == 200:
            body = _body(resp)
            rejected = body.get('rejected') if isinstance(body, dict) else None
            if isinstance(rejected, int) and rejected > 0:
                self.log.warning('heartbeat', status=200, rejected=rejected)
            else:
                self.log.info('heartbeat', status=200)
            return
        if status is not None and self._check_fatal(status, resp):
            return
        level = 'error' if status in (400, 415) else 'warning'
        self.log.write(level, 'heartbeat', status=status)
