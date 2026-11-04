import numpy as np
import supervision as sv

from swiftletcare_ai.counting import LineCounter

W = H = 1000
START, END = (0.10, 0.55), (0.90, 0.55)  # nhu vi du YAML spec 3.4: vach ngang y = 550


def det(track_id: int, y: float, x: float = 500.0) -> sv.Detections:
    return sv.Detections(
        xyxy=np.array([[x - 10, y - 10, x + 10, y + 10]], dtype=float),
        confidence=np.array([0.9]),
        class_id=np.array([0]),
        tracker_id=np.array([track_id]),
    )


def run(counter: LineCounter, steps: list[tuple[int, float]]) -> list[tuple[str, int]]:
    out = []
    for track_id, y in steps:
        out += counter.update(det(track_id, y))
    return out


def totals(events):
    return sum(1 for d, _ in events if d == 'in'), sum(1 for d, _ in events if d == 'out')


def test_bay_len_qua_vach_la_out():
    events = run(LineCounter(START, END, W, H), [(1, y) for y in (700, 650, 600, 500, 450, 400)])
    assert events == [('out', 1)]


def test_bay_xuong_qua_vach_la_in():
    events = run(LineCounter(START, END, W, H), [(1, y) for y in (400, 450, 500, 600, 650, 700)])
    assert events == [('in', 1)]


def test_hoan_doi_start_end_thi_dao_chieu():
    events = run(LineCounter(END, START, W, H), [(1, y) for y in (700, 650, 600, 500, 450, 400)])
    assert events == [('in', 1)]


def test_hai_track_doc_lap():
    c = LineCounter(START, END, W, H)
    steps = [(1, 700), (2, 400), (1, 600), (2, 500), (1, 500), (2, 600), (1, 400), (2, 700)]
    assert totals(run(c, steps)) == (1, 1)


def test_khung_rong_khong_loi():
    assert LineCounter(START, END, W, H).update(sv.Detections.empty()) == []


# Hai test duoi KHOA hanh vi that cua supervision (spec 7.1). Gia thuyet ban dau ghi o day;
# chay ma khac thi doi assert theo ket qua that, ghi S20 va spec 4.2 (Step 5).
def test_track_mat_roi_hien_lai_voi_id_moi():
    # id 1 bay tu duoi toi sat vach roi mat; id 2 xuat hien phia tren vach va bay tiep len.
    steps = [(1, 700), (1, 650), (1, 600), (2, 500), (2, 450), (2, 400)]
    assert totals(run(LineCounter(START, END, W, H), steps)) == (0, 0)


def test_luon_qua_lai_tren_vach():
    # bat dau duoi vach, len - xuong - len qua vach
    steps = [(1, y) for y in (600, 500, 600, 500)]
    assert totals(run(LineCounter(START, END, W, H), steps)) == (1, 2)
