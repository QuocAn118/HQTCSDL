from swiftletcare_ai.metrics import frame_counts


def test_frame_counts_mot_gt_chi_khop_mot_prediction_va_dung_lop():
    gt = [(0, (0, 0, 10, 10)), (1, (20, 20, 30, 30))]
    pred = [(0, .9, (0, 0, 10, 10)), (0, .8, (0, 0, 10, 10)),
            (2, .9, (20, 20, 30, 30))]
    assert frame_counts(pred, gt, 3) == [(1, 1, 0), (0, 0, 1), (0, 1, 0)]


def test_frame_counts_nguong_iou_va_khung_khong_co_gt():
    assert frame_counts([(0, .8, (0, 0, 5, 10))], [(0, (0, 0, 10, 10))], 1) == [(1, 0, 0)]
    assert frame_counts([(0, .8, (0, 0, 4, 10))], [(0, (0, 0, 10, 10))], 1) == [(0, 1, 1)]
    assert frame_counts([(0, .8, (0, 0, 5, 10))], [], 1) == [(0, 1, 0)]


def test_frame_counts_uu_tien_confidence_cao():
    # Prediction thap hon khop ca hai GT; prediction cao chi khop GT dau.
    gt = [(0, (0, 0, 10, 10)), (0, (5, 0, 15, 10))]
    pred = [(0, .6, (2, 0, 13, 10)), (0, .9, (0, 0, 10, 10))]
    assert frame_counts(pred, gt, 1) == [(2, 0, 0)]
