"""Exercise the pinned real tracker and line counter, without video files."""
import numpy as np
import supervision as sv

from swiftletcare_ai.app import make_tracker
from swiftletcare_ai.counting import LineCounter


def test_bytetrack_that_giu_id_va_dem_mot_lan_qua_vach():
    tracker = make_tracker(10)
    line = LineCounter((0.1, 0.55), (0.9, 0.55), 100, 100)
    ids, events = set(), []
    for y in range(80, 29, -2):
        detection = sv.Detections(
            xyxy=np.array([[40., y - 10., 60., y + 10.]]),
            confidence=np.array([0.9]), class_id=np.array([3]),
        )
        tracked = tracker.update_with_detections(detection)
        ids.update(tracked.tracker_id.tolist())
        events.extend(line.update(tracked))
    assert len(ids) == 1
    assert events == [('out', next(iter(ids)))]
    empty = tracker.update_with_detections(sv.Detections.empty())
    assert len(empty) == 0
