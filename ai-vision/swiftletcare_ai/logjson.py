"""Log doc duoc bang may: moi su kien mot dong JSON, ra man hinh va noi them vao file (spec 5.1)."""
import json
import sys
import threading
from pathlib import Path

from .timeutil import utc_iso

FIELDS = {
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
LEVELS = ('info', 'warning', 'error')


class JsonLog:
    def __init__(self, camera: str, path: Path | None, clock, stream=None):
        self.camera = camera
        self.path = path
        self.clock = clock
        self.stream = stream if stream is not None else sys.stdout
        self._lock = threading.Lock()
        if path is not None:
            path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, level: str, type_: str, **fields) -> None:
        if level not in LEVELS:
            raise ValueError(f'level la: {level}')
        missing = [f for f in FIELDS.get(type_, ()) if f not in fields]
        if missing:
            raise ValueError(f'log {type_} thieu truong: {", ".join(missing)}')
        record = {'ts': utc_iso(self.clock.now()), 'level': level, 'camera': self.camera, 'type': type_, **fields}
        line = json.dumps(record, ensure_ascii=False)
        with self._lock:
            print(line, file=self.stream, flush=True)
            if self.path is not None:
                with self.path.open('a', encoding='utf-8') as f:
                    f.write(line + '\n')

    def info(self, type_: str, **fields) -> None:
        self.write('info', type_, **fields)

    def warning(self, type_: str, **fields) -> None:
        self.write('warning', type_, **fields)

    def error(self, type_: str, **fields) -> None:
        self.write('error', type_, **fields)
