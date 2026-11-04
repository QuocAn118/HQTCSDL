"""Fixture hop le: payload cua AI dung hinh dang. Invalid nhom 'AI tu tranh': ham tao payload khong the sinh dang do (spec 7.3)."""
from datetime import datetime, timedelta, timezone

import pytest

from shapes import load_fixture, shape_problems
from swiftletcare_ai.payloads import counts_payload, heartbeat_payload, predator_metadata
from swiftletcare_ai.timeutil import window_start

NOW = datetime.now(timezone.utc)

AI_FILES = {
    'bird-counts.json', 'bird-counts.resend-smaller.json', 'predator-detection.json',
    'predator-detection.cooldown.json', 'predator-detection.low-confidence.json', 'heartbeat.cut.json',
    'bird-counts.invalid-window-not-aligned.json', 'bird-counts.invalid-negative.json',
    'bird-counts.invalid-missing-z.json', 'predator-detection.invalid-class.json',
    'predator-detection.invalid-offset.json', 'predator-detection.invalid-not-jpeg.json',
    'ai.invalid-service-key.json',
}


def test_bo_fixture_ai_dung_ban_doi_chieu(ai_fixtures_dir):
    assert {p.name for p in ai_fixtures_dir.glob('*.json')} == AI_FILES
    assert (ai_fixtures_dir / 'snake.jpg').is_file() and (ai_fixtures_dir / 'not-jpeg.png').is_file()


@pytest.mark.parametrize('name', ['bird-counts.json', 'bird-counts.resend-smaller.json'])
def test_bird_counts_hinh_dang(ai_fixtures_dir, name):
    f = load_fixture(ai_fixtures_dir, name)
    assert (f['method'], f['path']) == ('POST', '/api/ai/bird-counts')
    assert set(f['headers']) == {'X-Service-Key'}
    item = f['body'][0]
    payload = counts_payload(item['camera'], [(window_start(NOW), item['in'], item['out'])])
    assert shape_problems(f['body'], payload) == []


@pytest.mark.parametrize('name', [
    'predator-detection.json', 'predator-detection.cooldown.json', 'predator-detection.low-confidence.json',
])
def test_predator_hinh_dang(ai_fixtures_dir, name):
    f = load_fixture(ai_fixtures_dir, name)
    assert (f['method'], f['path']) == ('POST', '/api/ai/predator-detections')
    assert set(f['body']) == {'metadata', 'image'}
    m = f['body']['metadata']
    payload = predator_metadata(m['camera'], m['class'], m['confidence'], NOW - timedelta(minutes=1))
    assert shape_problems(m, payload) == []


def test_heartbeat_hinh_dang(ai_fixtures_dir):
    f = load_fixture(ai_fixtures_dir, 'heartbeat.cut.json')
    assert (f['method'], f['path']) == ('POST', '/api/ai/heartbeat')
    assert shape_problems(f['body'], heartbeat_payload(f['body']['device'], NOW)) == []


# ---- invalid nhom "AI tu tranh" ----

def test_invalid_negative_khong_sinh_duoc(ai_fixtures_dir):
    item = load_fixture(ai_fixtures_dir, 'bird-counts.invalid-negative.json')['body'][0]
    with pytest.raises(ValueError):
        counts_payload(item['camera'], [(window_start(NOW), item['in'], item['out'])])


def test_invalid_class_khong_sinh_duoc(ai_fixtures_dir):
    m = load_fixture(ai_fixtures_dir, 'predator-detection.invalid-class.json')['body']['metadata']
    with pytest.raises(ValueError):
        predator_metadata(m['camera'], m['class'], m['confidence'], NOW)


@pytest.mark.parametrize('name,placeholder', [
    ('bird-counts.invalid-window-not-aligned.json', '{{window+1m}}'),
    ('bird-counts.invalid-missing-z.json', '{{window:noZ}}'),
])
def test_invalid_cua_so_ham_cua_so_luon_tron_va_co_z(ai_fixtures_dir, name, placeholder):
    assert load_fixture(ai_fixtures_dir, name)['body'][0]['windowStart'] == placeholder
    for s in range(0, 7200, 13):
        ws = counts_payload('H1-F0-CAMERA', [(window_start(NOW + timedelta(seconds=s)), 0, 0)])[0]['windowStart']
        assert ws.endswith('Z') and ws[14:16] in {f'{m:02d}' for m in range(0, 60, 5)} and ws[17:19] == '00'


def test_invalid_offset_ham_thoi_diem_luon_co_z(ai_fixtures_dir):
    m = load_fixture(ai_fixtures_dir, 'predator-detection.invalid-offset.json')['body']['metadata']
    assert m['at'] == '{{now:+07:00}}'
    at = predator_metadata('H1-F0-CAMERA', 'snake', 0.9, NOW)['at']
    assert at.endswith('Z') and '+' not in at
