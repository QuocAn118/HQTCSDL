"""Anh gui kem su kien thien dich: khung goc + khung bao + nhan, JPEG 90, thu nho 75% toi khi du nho (spec 4.4)."""
import cv2
import numpy as np

from .predators import Box

JPEG_QUALITY = 90
SCALE = 0.75
_MIN_SIDE = 16
_COLOR = (0, 0, 255)


def draw_boxes(frame: np.ndarray, boxes: list[Box]) -> np.ndarray:
    img = frame.copy()
    for b in boxes:
        x1, y1, x2, y2 = (int(round(v)) for v in b.xyxy)
        cv2.rectangle(img, (x1, y1), (x2, y2), _COLOR, 2)
        cv2.putText(img, f'{b.cls} {b.confidence:.2f}', (x1, max(y1 - 6, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, _COLOR, 2)
    return img


def _resize(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    nw, nh = int(w * SCALE), int(h * SCALE)
    if nw < _MIN_SIDE or nh < _MIN_SIDE:
        raise ValueError('anh qua nho, khong thu nho them duoc')
    return cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)


def encode_within(img: np.ndarray, max_bytes: int) -> bytes:
    while True:
        ok, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not ok:
            raise ValueError('khong ma hoa duoc JPEG')
        if len(buf) <= max_bytes:
            return buf.tobytes()
        img = _resize(img)


def encode_snapshot(frame: np.ndarray, boxes: list[Box], max_bytes: int) -> bytes:
    return encode_within(draw_boxes(frame, boxes), max_bytes)


def shrink_jpeg(data: bytes, max_bytes: int) -> bytes:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    return encode_within(_resize(img), max_bytes)

_LINE_COLOR = (0, 255, 255)
_SWIFT_COLOR = (0, 200, 0)


def annotate(frame: np.ndarray, boxes: list[Box], line) -> np.ndarray:
    """Khung cho video dau ra: vach dem + moi khung bao (chim mau xanh, thien dich mau do)."""
    img = draw_boxes(frame, [b for b in boxes if b.cls != 'swiftlet'])
    h, w = img.shape[:2]
    p1 = (int(line.start[0] * w), int(line.start[1] * h))
    p2 = (int(line.end[0] * w), int(line.end[1] * h))
    cv2.line(img, p1, p2, _LINE_COLOR, 2)
    for b in boxes:
        if b.cls == 'swiftlet':
            x1, y1, x2, y2 = (int(round(v)) for v in b.xyxy)
            cv2.rectangle(img, (x1, y1), (x2, y2), _SWIFT_COLOR, 1)
    return img
