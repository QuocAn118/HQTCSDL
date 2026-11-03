from datetime import datetime, timedelta, timezone

import pytest

from swiftletcare_ai.windows import MAX_BATCH, CountQueue, WindowCounter

UTC = timezone.utc
T = datetime(2026, 10, 12, 10, 0, 0, tzinfo=UTC)


def at(minutes: float) -> datetime:
    return T + timedelta(minutes=minutes)


def test_dem_trong_mot_cua_so():
    closed = []
    w = WindowCounter(lambda *a: closed.append(a))
    w.add('out', at(0.5))
    w.add('out', at(1))
    w.add('in', at(4.9))
    assert w.current() == (at(0), 1, 2)
    assert closed == []


def test_sang_cua_so_moi_thi_dong_cua_so_cu_va_bat_dau_tu_0():
    closed = []
    w = WindowCounter(lambda *a: closed.append(a))
    w.add('in', at(4))
    w.observe(at(5))
    assert closed == [(at(0), 1, 0)]
    assert w.current() == (at(5), 0, 0)


def test_cua_so_khong_co_chim_van_co_tong_0_0():
    w = WindowCounter(lambda *a: None)
    w.observe(at(2))
    assert w.current() == (at(0), 0, 0)


def test_chua_quan_sat_thi_current_none():
    assert WindowCounter(lambda *a: None).current() is None


def test_chieu_la_bi_tu_choi():
    with pytest.raises(ValueError):
        WindowCounter(lambda *a: None).add('up', at(0))


def test_dong_ho_nhay_lui_tong_trong_hang_doi_khong_giam():
    q = CountQueue()
    w = WindowCounter(q.put)
    for _ in range(5):
        w.add('out', at(6))           # cua so 10:05, 5 out
    w.add('in', at(3))                # dong ho lui ve cua so 10:00 -> dong 10:05
    w.observe(at(7))                  # dong ho tien lai -> dong 10:00, mo lai 10:05 tu 0
    w.add('out', at(7))
    q.put(*w.current())
    assert dict((ws, (i, o)) for ws, i, o in q.pending()) == {at(0): (1, 0), at(5): (0, 5)}


def test_hang_doi_tong_moi_ghi_de_va_khong_giam():
    q = CountQueue()
    q.put(at(0), 3, 1)
    q.put(at(0), 5, 1)
    q.put(at(0), 4, 2)
    assert q.pending() == [(at(0), 5, 2)]


def test_hang_doi_tu_choi_so_am():
    with pytest.raises(ValueError):
        CountQueue().put(at(0), -1, 0)


def test_batch_cu_truoc_toi_da_500():
    q = CountQueue()
    for i in range(MAX_BATCH + 3):
        q.put(T - timedelta(minutes=5 * i), i, 0)
    b = q.batch()
    assert len(b) == MAX_BATCH == 500
    assert b == sorted(b)
    assert b[0][0] == T - timedelta(minutes=5 * (MAX_BATCH + 2))


def test_ack_khong_xoa_cua_so_co_tong_moi_trong_luc_gui():
    q = CountQueue()
    q.put(at(0), 3, 1)
    q.put(at(5), 0, 0)
    sent = q.batch()
    q.put(at(5), 1, 0)                # tong moi den trong luc dang gui
    q.ack(sent)
    assert q.pending() == [(at(5), 1, 0)]


def test_expire_bo_cua_so_dong_qua_60_phut():
    q = CountQueue()
    q.put(at(0), 2, 3)                # dong luc 10:05
    q.put(at(10), 1, 1)
    assert q.expire(at(65)) == []     # 10:05 + 60 phut = 11:05, chua qua
    assert q.expire(at(65.01)) == [(at(0), 2, 3)]
    assert q.pending() == [(at(10), 1, 1)]


def test_len():
    q = CountQueue()
    q.put(at(0), 0, 0)
    assert len(q) == 1


def test_ack_roi_dong_ho_nhay_lui_khong_gui_tong_nho_hon():
    q = CountQueue()
    q.put(at(5), 0, 5)
    sent = q.batch()
    q.ack(sent)
    assert q.pending() == []
    # The counter revisits this window after a clock correction and restarts at 1.
    q.put(at(5), 0, 1)
    assert q.batch() == [(at(5), 0, 5)]


def test_ack_khong_lam_giam_tung_cot_da_gui():
    q = CountQueue()
    q.put(at(0), 5, 2)
    q.ack(q.batch())
    q.put(at(0), 3, 4)
    assert q.batch() == [(at(0), 5, 4)]


def test_moc_tong_lon_nhat_het_han_cung_cua_so():
    q = CountQueue()
    q.put(at(0), 5, 0)
    q.ack(q.batch())
    q.expire(at(65))
    q.put(at(0), 1, 0)
    assert q.batch() == [(at(0), 5, 0)]
    q.ack(q.batch())
    q.expire(at(65.01))
    q.put(at(0), 1, 0)
    assert q.expire(at(65.01)) == [(at(0), 1, 0)]
