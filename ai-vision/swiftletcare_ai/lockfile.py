"""File khoa chong chay trung mot camera (spec 3.5). Khong tu do tien trinh con song."""
import os
from datetime import datetime, timezone
from pathlib import Path

from .timeutil import utc_iso


class LockExists(Exception):
    def __init__(self, path: Path, created_at: str):
        self.created_at = created_at
        super().__init__(
            f'file khoa {path} da co (tao luc {created_at}). Kiem tra khong con cua so nao dang chay camera nay, '
            f'roi xoa tay file do va chay lai.'
        )


def lock_path(ai_dir: Path, camera: str) -> Path:
    return ai_dir / 'data' / 'run' / f'{camera}.lock'


def acquire(path: Path, clock) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        created = path.read_text(encoding='utf-8').strip()
        if not created:
            created = utc_iso(datetime.fromtimestamp(path.stat().st_mtime, timezone.utc))
        raise LockExists(path, created) from None
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(utc_iso(clock.now()) + '\n')


def release(path: Path) -> None:
    path.unlink(missing_ok=True)
