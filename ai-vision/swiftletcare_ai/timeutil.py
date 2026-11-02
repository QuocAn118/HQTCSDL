"""UTC timestamps and five-minute windows for AI payloads (spec 4.3)."""
import re
import time
from datetime import datetime, timedelta, timezone

ISO_Z = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
WINDOW = timedelta(minutes=5)


def _require_aware(value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('can datetime co mui gio')


def utc_iso(dt: datetime) -> str:
    _require_aware(dt)
    if dt.utcoffset() != timedelta(0):
        raise ValueError('can datetime UTC co mui gio')
    return dt.isoformat(timespec='seconds').replace('+00:00', 'Z')


def window_start(at: datetime) -> datetime:
    _require_aware(at)
    at = at.astimezone(timezone.utc)
    return at.replace(minute=at.minute - at.minute % 5, second=0, microsecond=0)


def parse_utc(s: str) -> datetime:
    if not ISO_Z.fullmatch(s):
        raise ValueError(f'can dang YYYY-MM-DDTHH:MM:SSZ, nhan {s!r}')
    return datetime.strptime(s, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(timezone.utc)

    def monotonic(self) -> float:
        return time.monotonic()

    def sleep(self, seconds: float) -> None:
        if seconds > 0:
            time.sleep(seconds)


class FakeClock:
    def __init__(self, start: datetime):
        _require_aware(start)
        self._now = start.astimezone(timezone.utc)
        self._mono = 0.0

    def now(self) -> datetime:
        return self._now

    def monotonic(self) -> float:
        return self._mono

    def sleep(self, seconds: float) -> None:
        if seconds > 0:
            self.advance(seconds)

    def advance(self, seconds: float) -> None:
        self._now += timedelta(seconds=seconds)
        self._mono += seconds

    def jump(self, seconds: float) -> None:
        """Simulate a wall-clock correction without changing elapsed time."""
        self._now += timedelta(seconds=seconds)
