import cv2
import numpy as np
import pytest

from swiftletcare_ai.predators import Box
from swiftletcare_ai.snapshot import draw_boxes, encode_snapshot, encode_within, shrink_jpeg

JPEG_MAGIC = b'\xff\xd8\xff'


def noisy(h=720, w=1280) -> np.ndarray:
    return np.random.default_rng(1).integers(0, 255, (h, w, 3), dtype=np.uint8)


def decode(data: bytes) -> np.ndarray:
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)


def test_anh_snake_cua_hop_dong_ra_jpeg_du_nho(ai_fixtures_dir):
    # OpenCV imread cannot open this repository's Vietnamese Windows path.
    frame = cv2.imdecode(np.frombuffer((ai_fixtures_dir / 'snake.jpg').read_bytes(), np.uint8), cv2.IMREAD_COLOR)
    assert frame is not None
    data = encode_snapshot(frame, [Box('snake', 0.87, (2, 2, 30, 30))], 2097152)
    assert data[:3] == JPEG_MAGIC and len(data) <= 2097152


def test_gioi_han_nho_thi_thu_nho_toi_khi_du():
    frame = noisy()
    full = encode_within(frame, 10**9)
    data = encode_within(frame, len(full) // 5)
    assert data[:3] == JPEG_MAGIC and len(data) <= len(full) // 5
    h, w = decode(data).shape[:2]
    assert w < 1280 and h < 720


def test_khong_the_thu_nho_du_thi_bao_loi():
    with pytest.raises(ValueError):
        encode_within(noisy(), 50)


def test_draw_boxes_khong_sua_khung_goc_va_co_ve():
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    out = draw_boxes(frame, [Box('rat', 0.91, (10, 10, 60, 60))])
    assert frame.sum() == 0
    assert out.sum() > 0


def test_shrink_jpeg_nho_hon_ban_dau():
    first = encode_within(noisy(), 10**9)
    again = shrink_jpeg(first, 10**9)
    assert again[:3] == JPEG_MAGIC
    assert decode(again).shape[1] == int(1280 * 0.75)
