from datetime import datetime, timedelta, timezone

import pytest

from swiftletcare_ai.timeutil import ISO_Z, WINDOW, FakeClock, SystemClock, parse_utc, utc_iso, window_start

UTC = timezone.utc


def dt(s: str) -> datetime:
    return datetime.strptime(s, '%Y-%m-%dT%H:%M:%S').replace(tzinfo=UTC)


@pytest.mark.parametrize('at,expected', [
    ('2026-10-12T10:04:59', '2026-10-12T10:00:00Z'),
    ('2026-10-12T10:05:00', '2026-10-12T10:05:00Z'),
    ('2026-10-12T10:09:59', '2026-10-12T10:05:00Z'),
    ('2026-10-12T23:59:59', '2026-10-12T23:55:00Z'),
    ('2026-10-13T00:00:00', '2026-10-13T00:00:00Z'),
])
def test_window_start_lam_tron_xuong(at, expected):
    assert utc_iso(window_start(dt(at))) == expected


def test_window_start_bo_phan_le_giay():
    at = dt('2026-10-12T10:07:30') + timedelta(microseconds=999_999)
    assert utc_iso(window_start(at)) == '2026-10-12T10:05:00Z'


def test_window_start_doi_mui_gio_ve_utc():
    at = datetime(2026, 10, 13, 6, 3, 0, tzinfo=timezone(timedelta(hours=7)))
    assert utc_iso(window_start(at)) == '2026-10-12T23:00:00Z'


def test_moi_cua_so_trong_mot_ngay_deu_tron_5_phut_va_co_z():
    start = dt('2026-10-12T00:00:00')
    for s in range(0, 86400, 37):
        text = utc_iso(window_start(start + timedelta(seconds=s)))
        assert ISO_Z.match(text)
        assert text[14:16] in {f'{m:02d}' for m in range(0, 60, 5)} and text[17:19] == '00'


def test_utc_iso_cat_phan_le_va_co_z():
    assert utc_iso(dt('2026-10-12T10:40:07') + timedelta(microseconds=500_000)) == '2026-10-12T10:40:07Z'


def test_utc_iso_tu_choi_datetime_khong_mui_gio():
    with pytest.raises(ValueError):
        utc_iso(datetime(2026, 10, 12, 10, 0, 0))


def test_utc_iso_tu_choi_mui_gio_khac_utc():
    with pytest.raises(ValueError):
        utc_iso(datetime(2026, 10, 12, 17, 0, 0, tzinfo=timezone(timedelta(hours=7))))


@pytest.mark.parametrize('bad', ['2026-10-12T10:00:00', '2026-10-12T10:00:00+07:00', '2026-10-12 10:00:00Z', ''])
def test_parse_utc_chi_nhan_z(bad):
    with pytest.raises(ValueError):
        parse_utc(bad)


def test_parse_utc_hop_le():
    assert parse_utc('2026-10-12T10:40:07Z') == dt('2026-10-12T10:40:07')


def test_fake_clock():
    c = FakeClock(dt('2026-10-12T10:00:00'))
    c.sleep(1.5)
    assert c.now() == dt('2026-10-12T10:00:01') + timedelta(milliseconds=500)
    assert c.monotonic() == 1.5
    c.jump(-120)
    assert c.now() == dt('2026-10-12T09:58:01') + timedelta(milliseconds=500)
    assert c.monotonic() == 1.5


@pytest.mark.parametrize('bad', [
    '2026-10-12T10:00:00Z\n', '2026-02-30T10:00:00Z',
    '2026-10-12T24:00:00Z', '2026-10-12T10:00:00.000Z',
])
def test_parse_utc_tu_choi_ngay_sai_va_ky_tu_thua(bad):
    with pytest.raises(ValueError):
        parse_utc(bad)


def test_window_start_tu_choi_gio_khong_mui_gio():
    with pytest.raises(ValueError):
        window_start(datetime(2026, 10, 12, 10))


def test_fake_clock_advance_va_jump_doc_lap():
    start = dt('2026-10-12T23:59:59')
    clock = FakeClock(start)
    clock.advance(2)
    assert clock.now() == start + timedelta(seconds=2)
    assert clock.monotonic() == 2
    clock.jump(-3600)
    assert clock.now() == start + timedelta(seconds=2, hours=-1)
    assert clock.monotonic() == 2


def test_fake_clock_chuan_hoa_gio_vn_ve_utc():
    start = datetime(2026, 10, 12, 17, tzinfo=timezone(timedelta(hours=7)))
    clock = FakeClock(start)
    assert clock.now().tzinfo == UTC
    assert utc_iso(clock.now()) == '2026-10-12T10:00:00Z'


def test_fake_clock_tu_choi_gio_khong_mui_gio():
    with pytest.raises(ValueError):
        FakeClock(datetime(2026, 10, 12, 10))


def test_system_clock_dung_utc_va_monotonic_khong_giam():
    clock = SystemClock()
    assert clock.now().utcoffset() == timedelta(0)
    first = clock.monotonic()
    clock.sleep(0)
    assert clock.monotonic() >= first
    assert WINDOW == timedelta(minutes=5)
