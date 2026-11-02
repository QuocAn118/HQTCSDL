"""Cau hinh camera (YAML) va .env. Gap loi dau tien thi dung, bao ten file, truong, gia tri, gia tri hop le (spec 3.3, 3.4)."""
import math
from dataclasses import dataclass, field
from pathlib import Path

import yaml

AI_DIR = Path(__file__).resolve().parent.parent
CAMERAS = ('H1-F0-CAMERA', 'H2-F0-CAMERA')
SWIFTLET = 'swiftlet'
PREDATOR_CLASSES = ('rat', 'snake', 'owl')
DEFAULT_SNAPSHOT_MAX_BYTES = 2097152

_TOP = ('camera', 'playlist', 'line', 'swiftlet', 'predator', 'process_fps')
_PREDATOR = ('confidence', 'confirm_frames', 'confirm_seconds', 'cooldown_seconds')


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class LineCfg:
    start: tuple[float, float]
    end: tuple[float, float]


@dataclass(frozen=True)
class PredatorCfg:
    confidence: float
    confirm_frames: int
    confirm_seconds: float
    cooldown_seconds: float


@dataclass(frozen=True)
class CameraConfig:
    camera: str
    playlist: tuple[Path, ...]
    line: LineCfg
    swiftlet_confidence: float
    predator: PredatorCfg
    process_fps: float | None


def _is_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


class _Checker:
    def __init__(self, path: Path):
        self.name = path.name

    def fail(self, field_name: str, value, valid: str):
        raise ConfigError(f'{self.name}: truong {field_name} = {value!r} sai; hop le: {valid}')

    def keys(self, node, expected: tuple[str, ...], prefix: str):
        if not isinstance(node, dict):
            self.fail(prefix or '(goc)', node, f'bang co cac truong {", ".join(expected)}')
        for k in expected:
            if k not in node:
                raise ConfigError(f'{self.name}: thieu truong {prefix}{k}')
        for k in node:
            if k not in expected:
                raise ConfigError(f'{self.name}: truong la {prefix}{k}; chi duoc co {", ".join(expected)}')

    def point(self, value, field_name: str) -> tuple[float, float]:
        if not (isinstance(value, list) and len(value) == 2 and all(_is_num(v) and 0 <= v <= 1 for v in value)):
            self.fail(field_name, value, 'hai so trong [0, 1]')
        return (float(value[0]), float(value[1]))

    def positive(self, value, field_name: str) -> float:
        if not (_is_num(value) and value > 0):
            self.fail(field_name, value, 'so duong')
        return value


def load_camera_config(path: Path, base_dir: Path, *, playlist_override: list[str] | None = None) -> CameraConfig:
    c = _Checker(path)
    try:
        data = yaml.safe_load(path.read_text(encoding='utf-8-sig'))
    except (OSError, UnicodeError, yaml.YAMLError) as e:
        raise ConfigError(f'{path.name}: khong doc duoc YAML ({e.__class__.__name__})') from None
    c.keys(data, _TOP, '')
    if playlist_override is not None:
        data['playlist'] = playlist_override

    camera = data['camera']
    if camera not in CAMERAS:
        c.fail('camera', camera, ', '.join(CAMERAS))
    if camera != path.stem:
        c.fail('camera', camera, f'trung ten file ({path.stem})')

    playlist = data['playlist']
    if not isinstance(playlist, list) or not playlist or not all(isinstance(p, str) for p in playlist):
        c.fail('playlist', playlist, 'danh sach duong dan video khong rong')
    files = []
    for p in playlist:
        if not p.isascii():
            c.fail('playlist', p, 'duong dan chi ky tu ASCII (OpenCV tren Windows khong mo duoc duong dan co dau); hay doi ten file/thu muc')
        full = base_dir / p
        if not full.is_file():
            c.fail('playlist', p, f'file ton tai (tinh tu {base_dir})')
        files.append(full)

    c.keys(data['line'], ('start', 'end'), 'line.')
    start = c.point(data['line']['start'], 'line.start')
    end = c.point(data['line']['end'], 'line.end')
    if start == end:
        c.fail('line', data['line'], 'start va end khac nhau')

    c.keys(data['swiftlet'], ('confidence',), 'swiftlet.')
    sc = data['swiftlet']['confidence']
    if not (_is_num(sc) and 0 < sc <= 1):
        c.fail('swiftlet.confidence', sc, '(0, 1]')

    pr = data['predator']
    c.keys(pr, _PREDATOR, 'predator.')
    if not (_is_num(pr['confidence']) and 0.5 <= pr['confidence'] <= 1):
        c.fail('predator.confidence', pr['confidence'], '[0.5, 1] (backend bo qua duoi 0.5)')
    frames = pr['confirm_frames']
    if not (isinstance(frames, int) and not isinstance(frames, bool) and frames > 0):
        c.fail('predator.confirm_frames', frames, 'so nguyen duong')
    predator = PredatorCfg(
        confidence=float(pr['confidence']),
        confirm_frames=frames,
        confirm_seconds=float(c.positive(pr['confirm_seconds'], 'predator.confirm_seconds')),
        cooldown_seconds=float(c.positive(pr['cooldown_seconds'], 'predator.cooldown_seconds')),
    )

    fps = data['process_fps']
    if fps is not None:
        c.positive(fps, 'process_fps')

    return CameraConfig(
        camera=camera,
        playlist=tuple(files),
        line=LineCfg(start, end),
        swiftlet_confidence=float(sc),
        predator=predator,
        process_fps=None if fps is None else float(fps),
    )


@dataclass(frozen=True)
class EnvConfig:
    backend_url: str | None
    service_key: str | None = field(repr=False)
    snapshot_max_bytes: int


def read_env_file(path: Path) -> dict[str, str]:
    values = {}
    try:
        text = path.read_text(encoding='utf-8-sig')
    except (OSError, UnicodeError) as e:
        raise ConfigError(f'{path.name}: khong doc duoc file ({e.__class__.__name__})') from None
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        values[key.strip()] = value.strip()
    return values


def load_env(path: Path, need_backend: bool) -> EnvConfig:
    if path.is_file():
        values = read_env_file(path)
    elif need_backend:
        raise ConfigError(f'thieu file {path} (chep .env.example thanh .env roi dien gia tri)')
    else:
        values = {}
    raw = values.get('SNAPSHOT_MAX_BYTES', '')
    if raw == '':
        max_bytes = DEFAULT_SNAPSHOT_MAX_BYTES
    elif raw.isdigit() and int(raw) > 0:
        max_bytes = int(raw)
    else:
        raise ConfigError('.env: SNAPSHOT_MAX_BYTES phai la so nguyen duong (byte)')
    url = values.get('BACKEND_URL') or None
    key = values.get('AI_SERVICE_KEY') or None
    if need_backend:
        if not url:
            raise ConfigError('.env: thieu BACKEND_URL')
        if not key:
            raise ConfigError('.env: thieu AI_SERVICE_KEY (lay tu nguoi chay backend)')
    return EnvConfig(backend_url=url.rstrip('/') if url else None, service_key=key, snapshot_max_bytes=max_bytes)


def check_confirm_fps(confirm_frames: int, confirm_seconds: float, fps: float) -> None:
    if not (_is_num(fps) and fps > 0):
        raise ConfigError(f'fps xu ly do duoc {fps!r} khong hop le; can so huu han duong')
    if not (isinstance(confirm_frames, int) and not isinstance(confirm_frames, bool) and confirm_frames > 0):
        raise ConfigError('predator.confirm_frames phai la so nguyen duong')
    if not (_is_num(confirm_seconds) and confirm_seconds > 0):
        raise ConfigError('predator.confirm_seconds phai la so huu han duong')
    if confirm_frames > fps * confirm_seconds:
        raise ConfigError(
            f'fps xu ly do duoc {fps:.1f} khong du: can confirm_frames <= fps x confirm_seconds '
            f'({confirm_frames} > {fps:.1f} x {confirm_seconds:g}). Cach sua: giam predator.confirm_frames, '
            f'tang predator.confirm_seconds, hoac giam kich thuoc anh suy luan (--imgsz).'
        )
