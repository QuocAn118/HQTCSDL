"""Vach dem: cho DUY NHAT dung sv.LineZone va anh xa chieu sang 'in'/'out' cua hop dong (spec 3.4)."""
import supervision as sv

# Chieu 'in' cua supervision tuong ung chieu nao cua hop dong. CHI SUA O DAY.
# Khoa bang tests/test_counting.py: start ben trai, end ben phai -> bay len la 'out'.
# supervision 0.30.9 (chay thu 17/10/2026): 'in' cua supervision = chim bay LEN = 'out' cua hop dong.
SV_IN_MEANS = 'out'
_OTHER = {'in': 'out', 'out': 'in'}


class LineCounter:
    def __init__(self, start: tuple[float, float], end: tuple[float, float], frame_w: int, frame_h: int):
        self._zone = sv.LineZone(
            start=sv.Point(start[0] * frame_w, start[1] * frame_h),
            end=sv.Point(end[0] * frame_w, end[1] * frame_h),
            triggering_anchors=(sv.Position.CENTER,),
        )

    def update(self, dets: sv.Detections) -> list[tuple[str, int]]:
        if len(dets) == 0:
            return []
        crossed_in, crossed_out = self._zone.trigger(dets)
        events = []
        for i in range(len(dets)):
            track_id = int(dets.tracker_id[i])
            if crossed_in[i]:
                events.append((SV_IN_MEANS, track_id))
            if crossed_out[i]:
                events.append((_OTHER[SV_IN_MEANS], track_id))
        return events
