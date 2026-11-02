"""Cua so dem 5 phut va hang doi so dem cho gui (spec 4.3, 5.2, 5.4)."""
import threading
from datetime import datetime, timedelta
from typing import Callable

from .timeutil import WINDOW, window_start

MAX_BATCH = 500
EXPIRE_AFTER = timedelta(minutes=60)


class WindowCounter:
    def __init__(self, on_close: Callable[[datetime, int, int], None]):
        self._on_close = on_close
        self._ws: datetime | None = None
        self._in = 0
        self._out = 0

    def observe(self, at: datetime) -> None:
        ws = window_start(at)
        if self._ws is None:
            self._ws = ws
        elif ws != self._ws:
            self._on_close(self._ws, self._in, self._out)
            self._ws, self._in, self._out = ws, 0, 0

    def add(self, direction: str, at: datetime) -> None:
        if direction not in ('in', 'out'):
            raise ValueError(f'chieu la: {direction}')
        self.observe(at)
        if direction == 'in':
            self._in += 1
        else:
            self._out += 1

    def current(self) -> tuple[datetime, int, int] | None:
        return None if self._ws is None else (self._ws, self._in, self._out)


class CountQueue:
    """Tu dien theo windowStart (mot tien trinh = mot camera); moi cot chi tang."""

    def __init__(self):
        self._d: dict[datetime, tuple[int, int]] = {}
        self._lock = threading.Lock()

    def put(self, ws: datetime, in_: int, out: int) -> None:
        if in_ < 0 or out < 0:
            raise ValueError('so dem am')
        with self._lock:
            old_in, old_out = self._d.get(ws, (0, 0))
            self._d[ws] = (max(old_in, in_), max(old_out, out))

    def pending(self) -> list[tuple[datetime, int, int]]:
        with self._lock:
            return [(ws, i, o) for ws, (i, o) in sorted(self._d.items())]

    def batch(self) -> list[tuple[datetime, int, int]]:
        return self.pending()[:MAX_BATCH]

    def ack(self, sent: list[tuple[datetime, int, int]]) -> None:
        with self._lock:
            for ws, i, o in sent:
                if self._d.get(ws) == (i, o):
                    del self._d[ws]

    def expire(self, now: datetime) -> list[tuple[datetime, int, int]]:
        with self._lock:
            old = [ws for ws in self._d if now - (ws + WINDOW) > EXPIRE_AFTER]
            return [(ws, *self._d.pop(ws)) for ws in sorted(old)]

    def __len__(self) -> int:
        with self._lock:
            return len(self._d)
