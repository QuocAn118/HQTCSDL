import re
import json
import hashlib
from pathlib import Path

AI = Path(__file__).resolve().parent.parent
ROOT = AI.parent
PINNED = {'torch', 'torchvision', 'ultralytics', 'supervision', 'requests', 'PyYAML', 'pytest', 'opencv-python', 'numpy'}


def read_pins(path: Path) -> dict[str, str]:
    pins = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        name, sep, version = line.partition('==')
        assert sep == '==', f'dong khong ghim ==: {line}'
        pins[name] = version
    return pins


def test_requirements_ghim_dung_chin_goi():
    pins = read_pins(AI / 'requirements.txt')
    assert set(pins) == PINNED
    for name, version in pins.items():
        assert re.fullmatch(r'\d+(\.\d+)+', version), f'{name}=={version}'


def test_env_example_khong_chua_khoa():
    lines = [l for l in (AI / '.env.example').read_text(encoding='utf-8').splitlines() if l.strip()]
    pairs = dict(l.split('=', 1) for l in lines)
    assert list(pairs) == ['BACKEND_URL', 'AI_SERVICE_KEY', 'SNAPSHOT_MAX_BYTES']
    assert pairs['BACKEND_URL'] == 'http://localhost:3000'
    assert pairs['AI_SERVICE_KEY'] == ''
    assert pairs['SNAPSHOT_MAX_BYTES'] == '2097152'


def test_gitignore_goc_co_dong_ai_vision():
    lines = (ROOT / '.gitignore').read_text(encoding='utf-8').splitlines()
    for needed in ('ai-vision/.env', 'ai-vision/.venv/', 'ai-vision/data/', '*.pt'):
        assert needed in lines


def test_file_ps1_chi_ascii():
    for p in (AI / 'scripts').glob('*.ps1'):
        p.read_bytes().decode('ascii')


def test_notebook_ghim_cung_ban_ultralytics_va_supervision():
    pins = read_pins(AI / 'requirements.txt')
    notebook = json.loads((AI / 'train' / 'train.ipynb').read_text(encoding='utf-8'))
    code = '\n'.join(''.join(cell['source']) for cell in notebook['cells'] if cell['cell_type'] == 'code')
    for name in ('ultralytics', 'supervision'):
        assert f'{name}=={pins[name]}' in code
    assert 'torch==' not in code  # Colab keeps its existing GPU torch.


def test_frozen_tracked_artifacts_giu_nguyen_byte_sau_checkout():
    frozen = json.loads((AI / 'results/freeze.json').read_text(encoding='utf-8'))
    for relative, expected in frozen['files'].items():
        if relative.startswith('data/'):
            continue  # Dataset is local and is not shipped in Git.
        actual = hashlib.sha256((AI / relative).read_bytes()).hexdigest()
        assert actual == expected, f'Frozen artifact changed (including line endings): {relative}'
