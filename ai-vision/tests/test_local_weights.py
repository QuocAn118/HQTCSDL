"""Optional integration check using the manually downloaded, trusted weights."""
import importlib.util
import json
from pathlib import Path
import unittest

AI_DIR = Path(__file__).resolve().parents[1]
WEIGHTS = AI_DIR / 'data' / 'weights' / 'best.pt'


@unittest.skipUnless(WEIGHTS.is_file() and importlib.util.find_spec('ultralytics'),
                     'Can best.pt va Ultralytics de kiem tra mo hinh that')
class LocalWeightsTests(unittest.TestCase):
    def test_mo_hinh_that_nap_duoc_va_du_lop(self):
        import hashlib
        from ultralytics import YOLO
        expected = json.loads((AI_DIR / 'weights.json').read_text(encoding='utf-8'))
        self.assertEqual(hashlib.sha256(WEIGHTS.read_bytes()).hexdigest(), expected['sha256'])
        model = YOLO(str(WEIGHTS))
        self.assertEqual(model.names, {0: 'owl', 1: 'rat', 2: 'snake', 3: 'swiftlet'})


if __name__ == '__main__':
    unittest.main()
