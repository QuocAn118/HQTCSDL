import copy
from pathlib import Path

import pytest
import yaml

VALID_CAMERA = {
    'camera': 'H1-F0-CAMERA',
    'playlist': ['data/videos/V01.mp4'],
    'line': {'start': [0.10, 0.55], 'end': [0.90, 0.55]},
    'swiftlet': {'confidence': 0.40},
    'predator': {'confidence': 0.50, 'confirm_frames': 3, 'confirm_seconds': 2, 'cooldown_seconds': 300},
    'process_fps': None,
}


def camera_data(**changes) -> dict:
    data = copy.deepcopy(VALID_CAMERA)
    data.update(changes)
    return data


def write_yaml(tmp_path: Path, data, name: str = 'H1-F0-CAMERA.yaml') -> Path:
    (tmp_path / 'data' / 'videos').mkdir(parents=True, exist_ok=True)
    (tmp_path / 'data' / 'videos' / 'V01.mp4').write_bytes(b'video')
    path = tmp_path / name
    path.write_text(yaml.safe_dump(data, allow_unicode=True), encoding='utf-8')
    return path


@pytest.fixture(scope='session')
def ai_fixtures_dir() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / 'contracts' / 'fixtures' / 'ai'
        if candidate.is_dir():
            return candidate
    pytest.fail('chua co contracts/fixtures/ai, can merge integration-contract truoc')
