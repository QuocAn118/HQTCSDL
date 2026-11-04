import json

from swiftletcare_ai.config import CAMERAS


def collect_codes(node, out: set):
    if isinstance(node, dict):
        for key, value in node.items():
            if key in ('camera', 'device') and isinstance(value, str):
                out.add(value)
            collect_codes(value, out)
    elif isinstance(node, list):
        for item in node:
            collect_codes(item, out)


def test_danh_sach_camera_khop_fixture_hai_chieu(ai_fixtures_dir):
    codes = set()
    for f in sorted(ai_fixtures_dir.glob('*.json')):
        collect_codes(json.loads(f.read_text(encoding='utf-8')), codes)
    assert codes, 'khong tim thay ma camera nao trong fixture AI'
    assert codes <= set(CAMERAS), f'fixture co ma camera la: {codes - set(CAMERAS)}'
    assert set(CAMERAS) <= codes, f'ma camera khong co trong fixture: {set(CAMERAS) - codes}'
