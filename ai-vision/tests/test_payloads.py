from datetime import datetime, timedelta, timezone

import pytest

from shapes import shape_problems
from swiftletcare_ai.payloads import counts_payload, heartbeat_payload, predator_metadata

UTC = timezone.utc
WS = datetime(2026, 10, 12, 10, 5, 0, tzinfo=UTC)
AT = datetime(2026, 10, 12, 10, 40, 7, 123456, tzinfo=UTC)


def test_counts_payload():
    assert counts_payload('H1-F0-CAMERA', [(WS, 5, 1)]) == [
        {'camera': 'H1-F0-CAMERA', 'windowStart': '2026-10-12T10:05:00Z', 'in': 5, 'out': 1}]


@pytest.mark.parametrize('items', [
    [(WS, -1, 0)],
    [(WS, 0, -1)],
    [(WS, 1.5, 0)],
    [(WS, True, 0)],
    [(WS + timedelta(minutes=1), 1, 0)],
    [(WS.replace(tzinfo=None), 1, 0)],
    [(WS, 0, 0)] * 501,
])
def test_counts_payload_tu_choi(items):
    with pytest.raises(ValueError):
        counts_payload('H1-F0-CAMERA', items)


def test_counts_payload_camera_la():
    with pytest.raises(ValueError):
        counts_payload('H9-F0-CAMERA', [(WS, 1, 0)])


def test_predator_metadata():
    assert predator_metadata('H1-F0-CAMERA', 'snake', 0.8749, AT) == {
        'camera': 'H1-F0-CAMERA', 'class': 'snake', 'confidence': 0.87, 'at': '2026-10-12T10:40:07Z'}


@pytest.mark.parametrize('cls,conf', [('cat', 0.9), ('swiftlet', 0.9), ('Snake', 0.9), ('snake', 1.2), ('snake', -0.1)])
def test_predator_metadata_tu_choi(cls, conf):
    with pytest.raises(ValueError):
        predator_metadata('H1-F0-CAMERA', cls, conf, AT)


def test_predator_metadata_tu_choi_gio_khong_utc():
    with pytest.raises(ValueError):
        predator_metadata('H1-F0-CAMERA', 'snake', 0.9, AT.astimezone(timezone(timedelta(hours=7))))


def test_heartbeat_payload():
    assert heartbeat_payload('H2-F0-CAMERA', AT) == {'device': 'H2-F0-CAMERA', 'at': '2026-10-12T10:40:07Z'}


def test_shape_problems_tu_kiem():
    assert shape_problems({'a': '{{now}}'}, {'a': '2026-10-12T10:40:07Z'}) == []
    assert shape_problems({'a': '{{now-1m}}'}, {'a': '2026-10-12T10:40:07+07:00'})
    assert shape_problems({'a': '{{window}}'}, {'a': '2026-10-12T10:41:00Z'})
    assert shape_problems({'a': '{{la}}'}, {'a': 'x'})
    assert shape_problems({'a': 1}, {'a': 1, 'b': 2})
    assert shape_problems({'a': 0.87}, {'a': 1}) == []
    assert shape_problems({'a': 0.87}, {'a': True})
