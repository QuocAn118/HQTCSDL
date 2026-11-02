import threading
from datetime import datetime, timedelta, timezone

import numpy as np

from swiftletcare_ai.config import PredatorCfg
from swiftletcare_ai.predators import Blocked, Box, Confirmed, PredatorConfirmer

T = datetime(2026, 10, 12, 10, 0, 0, tzinfo=timezone.utc)
CFG = PredatorCfg(confidence=0.5, confirm_frames=3, confirm_seconds=2, cooldown_seconds=300)


def s(seconds: float) -> datetime:
    return T + timedelta(seconds=seconds)


def frame(tag: int) -> np.ndarray:
    return np.full((4, 4, 3), tag, dtype=np.uint8)


def feed(c, cls, items):
    """items: [(giay, confidence)] -> danh sach ket qua khac None"""
    out = []
    for sec, conf in items:
        r = c.observe(cls, s(sec), conf, frame(round(conf * 100)), [Box(cls, conf, (0, 0, 1, 1))])
        if r is not None:
            out.append(r)
    return out


def test_3_khung_trong_2_giay_thi_xac_nhan():
    r = feed(PredatorConfirmer(CFG), 'snake', [(0, 0.6), (1, 0.9), (2.0, 0.7)])
    assert len(r) == 1 and isinstance(r[0], Confirmed)
    assert r[0].cls == 'snake'


def test_3_khung_trai_2_1_giay_thi_khong():
    assert feed(PredatorConfirmer(CFG), 'snake', [(0, 0.6), (1.05, 0.9), (2.1, 0.7)]) == []


def test_anh_la_khung_tin_cay_cao_nhat_trong_cac_khung_xac_nhan():
    r = feed(PredatorConfirmer(CFG), 'rat', [(0, 0.95), (3, 0.6), (3.5, 0.87), (4, 0.7)])[0]
    assert r.at == s(3.5)
    assert r.confidence == 0.87
    assert int(r.frame[0, 0, 0]) == 87
    assert r.boxes == [Box('rat', 0.87, (0, 0, 1, 1))]


def test_confidence_lam_tron_2_chu_so():
    r = feed(PredatorConfirmer(CFG), 'owl', [(0, 0.876), (0.5, 0.6), (1, 0.6)])[0]
    assert r.confidence == 0.88


def test_hai_lop_doc_lap():
    c = PredatorConfirmer(CFG)
    r = feed(c, 'rat', [(0, 0.6), (0.5, 0.6)]) + feed(c, 'snake', [(0.6, 0.6), (0.7, 0.6)])
    assert r == []
    r = feed(c, 'rat', [(1, 0.6)]) + feed(c, 'snake', [(1.1, 0.6)])
    assert [x.cls for x in r] == ['rat', 'snake']
    assert all(isinstance(x, Confirmed) for x in r)


def test_cooldown_chan_dung_300_giay_theo_at_va_moi_lan_xac_nhan_bi_chan_tra_1_blocked():
    c = PredatorConfirmer(CFG)
    feed(c, 'snake', [(0, 0.6), (1, 0.6), (2, 0.6)])                 # xac nhan luc 2 s, chan toi 302 s
    r = feed(c, 'snake', [(100, 0.6), (100.5, 0.6), (101, 0.6), (101.5, 0.6), (102, 0.6), (102.5, 0.6)])
    assert r == [Blocked('snake', s(101), 201), Blocked('snake', s(102.5), 200)]
    r = feed(c, 'snake', [(300, 0.6), (301, 0.6), (301.9, 0.6)])
    assert r == [Blocked('snake', s(301.9), 1)]
    r = feed(c, 'snake', [(302, 0.6), (302.5, 0.6), (303, 0.6)])
    assert len(r) == 1 and isinstance(r[0], Confirmed)


def test_cooldown_rieng_tung_lop():
    c = PredatorConfirmer(CFG)
    feed(c, 'snake', [(0, 0.6), (1, 0.6), (2, 0.6)])
    r = feed(c, 'owl', [(3, 0.6), (3.5, 0.6), (4, 0.6)])
    assert isinstance(r[0], Confirmed)


def test_release_nha_cooldown():
    c = PredatorConfirmer(CFG)
    feed(c, 'snake', [(0, 0.6), (1, 0.6), (2, 0.6)])
    c.release('snake')
    r = feed(c, 'snake', [(10, 0.6), (11, 0.6), (12, 0.6)])
    assert isinstance(r[0], Confirmed)


def test_release_tu_luong_khac_khong_loi():
    c = PredatorConfirmer(CFG)
    feed(c, 'snake', [(0, 0.6), (1, 0.6), (2, 0.6)])
    t = threading.Thread(target=c.release, args=('snake',))
    t.start()
    t.join()
    assert isinstance(feed(c, 'snake', [(10, 0.6), (11, 0.6), (12, 0.6)])[0], Confirmed)


def test_bo_nho_co_tran_so_khung_cho():
    c = PredatorConfirmer(CFG)
    feed(c, 'snake', [(i * 0.9, 0.6) for i in range(1000)])
    assert len(c._hits['snake']) < CFG.confirm_frames
