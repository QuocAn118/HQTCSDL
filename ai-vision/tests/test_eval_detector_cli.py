import sys
from types import SimpleNamespace

from swiftletcare_ai.config import AI_DIR

sys.path.insert(0, str(AI_DIR / 'scripts'))
import eval_detector


def test_ultralytics_metrics_do_not_overwrite_fixed_threshold_results(tmp_path, monkeypatch):
    results = tmp_path / 'results'
    results.mkdir()
    fixed = results / 'detector.csv'
    fixed.write_text('frozen fixed-threshold results\n')
    calls = []
    box = SimpleNamespace(ap_class_index=[0], class_result=lambda i: (.8, .7, .6, .5))

    class Model:
        def __init__(self, weights):
            pass

        def val(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(box=box, names={0: 'owl'})

    monkeypatch.setattr(eval_detector, 'AI_DIR', tmp_path)
    monkeypatch.setattr(eval_detector, 'YOLO', Model)
    assert eval_detector.main(['--data', str(tmp_path / 'data.yaml'), '--imgsz', '640']) == 0
    assert fixed.read_text() == 'frozen fixed-threshold results\n'
    assert (results / 'detector_ultralytics.csv').is_file()
    assert calls[0]['device'] == 'cpu'
