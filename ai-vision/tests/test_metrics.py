import csv
import json
import sys

import pytest

from swiftletcare_ai.config import AI_DIR
from swiftletcare_ai.metrics import counting_summary, event_metrics, false_alarms, offline_vs_live, segment_counts

sys.path.insert(0, str(AI_DIR / 'scripts'))
import evaluate  # noqa: E402


def test_event_metrics_theo_su_kien():
    gt = [('T01', 'snake', 10, 20), ('T01', 'snake', 50, 60), ('T02', 'rat', 0, 5)]
    events = [('T01', 'snake', 12), ('T01', 'snake', 15), ('T01', 'snake', 40), ('T02', 'rat', 3), ('T02', 'owl', 3)]
    m = event_metrics(events, gt)
    assert m['snake'] == {'n_events': 3, 'tp_events': 2, 'precision': pytest.approx(2 / 3),
                          'n_segments': 2, 'detected': 1, 'recall': 0.5}
    assert m['rat']['precision'] == 1.0 and m['rat']['recall'] == 1.0
    assert m['owl'] == {'n_events': 1, 'tp_events': 0, 'precision': 0.0, 'n_segments': 0, 'detected': 0, 'recall': None}


def test_event_metrics_su_kien_khac_video_khong_tinh():
    m = event_metrics([('T02', 'snake', 12)], [('T01', 'snake', 10, 20)])
    assert m['snake']['tp_events'] == 0 and m['snake']['detected'] == 0


def test_false_alarms():
    lines = [{'type': 'predator.confirmed', 'class': 'rat'}] * 3 + [{'type': 'predator.cooldown_blocked', 'class': 'rat'}] * 9 \
        + [{'type': 'counts.sent'}]
    fa = false_alarms(lines, hours=1.5)
    assert fa['rat'] == {'confirmed': 3, 'blocked': 9, 'per_hour_cooldown': 2.0, 'per_hour_raw': 8.0}
    assert fa['owl'] == {'confirmed': 0, 'blocked': 0, 'per_hour_cooldown': 0.0, 'per_hour_raw': 0.0}


@pytest.mark.parametrize('hours', [0, -1, float('nan'), float('inf')])
def test_false_alarms_tu_choi_thoi_luong_sai(hours):
    with pytest.raises(ValueError):
        false_alarms([], hours)


def test_segment_counts_nua_khoang():
    crossings = [(0.0, 'out'), (59.9, 'in'), (60.0, 'out'), (61.0, 'out')]
    assert segment_counts(crossings, 0, 60) == (1, 1)
    assert segment_counts(crossings, 60, 120) == (0, 2)


def test_counting_summary():
    rows = [{'tay_in': 10, 'tay_out': 4, 'ai_in': 8, 'ai_out': 5},
            {'tay_in': 0, 'tay_out': 6, 'ai_in': 1, 'ai_out': 6}]
    s = counting_summary(rows)
    assert s['in'] == {'tong_tay': 10, 'tong_ai': 9, 'mae': 1.5, 'sai_so_tuong_doi': 0.3, 'sai_lech_co_dau': -0.1}
    assert s['out'] == {'tong_tay': 10, 'tong_ai': 11, 'mae': 0.5, 'sai_so_tuong_doi': 0.1, 'sai_lech_co_dau': 0.1}


def test_counting_summary_tong_tay_0():
    s = counting_summary([{'tay_in': 0, 'tay_out': 0, 'ai_in': 2, 'ai_out': 0}])
    assert s['in']['sai_so_tuong_doi'] is None and s['in']['sai_lech_co_dau'] is None


def test_offline_vs_live_lay_lan_gui_200_cuoi():
    live = [
        {'type': 'counts.sent', 'status': 200, 'windows': [{'windowStart': '2026-10-12T10:00:00Z', 'in': 1, 'out': 2}]},
        {'type': 'counts.sent', 'status': 503, 'windows': [{'windowStart': '2026-10-12T10:00:00Z', 'in': 9, 'out': 9}]},
        {'type': 'counts.sent', 'status': 200, 'windows': [{'windowStart': '2026-10-12T10:00:00Z', 'in': 3, 'out': 4}]},
    ]
    offline = [{'windowStart': '2026-10-12T10:00:00Z', 'in': '5', 'out': '4'},
               {'windowStart': '2026-10-12T10:05:00Z', 'in': '1', 'out': '0'}]
    assert offline_vs_live(live, offline) == [
        {'windowStart': '2026-10-12T10:00:00Z', 'live_in': 3, 'live_out': 4, 'offline_in': 5, 'offline_out': 4, 'lech_in': -2, 'lech_out': 0},
        {'windowStart': '2026-10-12T10:05:00Z', 'live_in': None, 'live_out': None, 'offline_in': 1, 'offline_out': 0, 'lech_in': None, 'lech_out': None},
    ]


def test_evaluate_counting_ghi_csv(tmp_path):
    run = tmp_path / 'V05'
    run.mkdir()
    (run / 'crossings.csv').write_text(
        'at,chieu,track_id\n2000-01-01T00:00:05Z,out,1\n2000-01-01T00:00:30Z,in,2\n2000-01-01T00:01:10Z,out,3\n', encoding='utf-8')
    seg = tmp_path / 'segments.csv'
    seg.write_text('video,doan,bat_dau_s,ket_thuc_s,tay_in,tay_out\nV05,1,0,60,1,2\nV05,2,60,120,0,1\n', encoding='utf-8')
    out = tmp_path / 'res'
    assert evaluate.main(['counting', '--segments', str(seg), '--runs', str(run), '--t0', '2000-01-01T00:00:00Z', '--out', str(out)]) == 0
    with (out / 'counting.csv').open(encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
    assert [(r['doan'], r['ai_in'], r['ai_out']) for r in rows] == [('1', '1', '1'), ('2', '0', '1')]
    assert (out / 'counting_summary.csv').is_file()
