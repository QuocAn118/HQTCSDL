import sys

import pytest

from swiftletcare_ai.config import AI_DIR

sys.path.insert(0, str(AI_DIR / 'scripts'))
from review_labels import parse_boxes, box_stats


def test_parse_boxes_rejects_wrong_class_and_outside_image():
    boxes, errors = parse_boxes('4 .5 .5 .2 .2\n0 .95 .5 .2 .2\n1 .5 .5 .2 .2', 4)
    assert len(boxes) == 1 and boxes[0][0] == 1
    assert [e['line'] for e in errors] == [1, 2]


@pytest.mark.parametrize('text', ['0 nan .5 .1 .1', '0 .5 .5 -1 .1', '0 .5 .5 .1', '0.5 .5 .5 .1 .1'])
def test_parse_boxes_rejects_nonfinite_or_malformed(text):
    assert parse_boxes(text, 4)[1]


def test_background_and_pixel_stats_do_not_change_labels():
    assert parse_boxes('', 4) == ([], [])
    stat = box_stats((3, .5, .5, .1, .2), 100, 200)
    assert stat['min_side_px'] == pytest.approx(10)
    assert stat['area_fraction'] == pytest.approx(.02)
    assert stat['aspect_ratio'] == pytest.approx(4)
