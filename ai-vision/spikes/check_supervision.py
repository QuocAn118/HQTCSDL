"""Kiem chung API supervision tren ban cai that (spec 3.4, 4.2, 7.1). Chay: .\\.venv\\Scripts\\python -W default spikes\\check_supervision.py"""
import inspect

import numpy as np
import supervision as sv

print('supervision', sv.__version__)
print('LineZone.__init__', inspect.signature(sv.LineZone.__init__))
print('LineZone.trigger', inspect.signature(sv.LineZone.trigger))
print('co ByteTrack', hasattr(sv, 'ByteTrack'))
if hasattr(sv, 'ByteTrack'):
    tracker = sv.ByteTrack(frame_rate=10)
    print('ByteTrack.__init__ (instance)', inspect.signature(type(tracker).__init__))
    print('co update_with_detections', hasattr(sv.ByteTrack, 'update_with_detections'))
    print('co reset', hasattr(sv.ByteTrack, 'reset'))
    empty = tracker.update_with_detections(sv.Detections.empty())
    print('ByteTrack empty result', len(empty), 'tracker_id', empty.tracker_id.tolist())
print('Position.CENTER', sv.Position.CENTER)
print('co Detections.from_ultralytics', hasattr(sv.Detections, 'from_ultralytics'))
print('co Detections.empty', hasattr(sv.Detections, 'empty'))

# Chim bay tu duoi len qua vach ngang y = 550 (khung 1000 x 1000)
zone = sv.LineZone(start=sv.Point(100, 550), end=sv.Point(900, 550), triggering_anchors=(sv.Position.CENTER,))
for y in (700, 650, 600, 500, 450, 400):
    d = sv.Detections(
        xyxy=np.array([[490.0, y - 10.0, 510.0, y + 10.0]]),
        confidence=np.array([0.9]),
        class_id=np.array([0]),
        tracker_id=np.array([1]),
    )
    crossed_in, crossed_out = zone.trigger(d)
    print('y', y, 'in', crossed_in.tolist(), 'out', crossed_out.tolist(), 'dem', zone.in_count, zone.out_count)
