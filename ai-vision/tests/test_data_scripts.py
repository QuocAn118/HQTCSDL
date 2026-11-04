import functools
import hashlib
import json
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import pytest
import yaml

from swiftletcare_ai.config import AI_DIR
from test_repo_rules import read_pins

sys.path.insert(0, str(AI_DIR / 'scripts'))
import download_weights  # noqa: E402
import split_dataset  # noqa: E402


def make_export(root, files: dict[str, str]):
    """files: 'train/V01_0001_jpg.rf.ab.jpg' -> noi dung nhan YOLO ('' = anh nen)."""
    for rel, label in files.items():
        split, name = rel.split('/')
        (root / split / 'images').mkdir(parents=True, exist_ok=True)
        (root / split / 'labels').mkdir(parents=True, exist_ok=True)
        (root / split / 'images' / name).write_bytes(b'jpg')
        (root / split / 'labels' / (name.rsplit('.', 1)[0] + '.txt')).write_text(label, encoding='utf-8')
    (root / 'data.yaml').write_text(yaml.safe_dump({'names': ['owl', 'rat', 'snake', 'swiftlet'], 'nc': 4}), encoding='utf-8')


def test_source_of_lay_ma_nguon_dau_ten():
    assert split_dataset.source_of('V01_000123.jpg') == 'V01'
    assert split_dataset.source_of('R02_15_jpg.rf.9f8e.jpg') == 'R02'


def test_read_splits(tmp_path):
    p = tmp_path / 'splits.csv'
    p.write_text('nguon,tap\nV01,train\nV02,val\nR01,test\n', encoding='utf-8')
    assert split_dataset.read_splits(p) == {'V01': 'train', 'V02': 'val', 'R01': 'test'}


def test_read_splits_tap_la(tmp_path):
    p = tmp_path / 'splits.csv'
    p.write_text('nguon,tap\nV01,training\n', encoding='utf-8')
    with pytest.raises(ValueError, match='training'):
        split_dataset.read_splits(p)


def test_assign_theo_nguon_khong_theo_thu_muc_export(tmp_path):
    a, b = tmp_path / 'valid/images/V01_1.jpg', tmp_path / 'train/images/R01_7.jpg'
    assert split_dataset.assign([a, b], {'V01': 'train', 'R01': 'test'}) == {a: 'train', b: 'test'}


def test_assign_nguon_khong_co_trong_splits_thi_bao_loi(tmp_path):
    with pytest.raises(ValueError, match='X09'):
        split_dataset.assign([tmp_path / 'train/images/X09_1.jpg'], {'V01': 'train'})


def test_background_ratio(tmp_path):
    labels = []
    for i, text in enumerate(['0 0.5 0.5 0.1 0.1\n', '', '1 0.2 0.2 0.1 0.1\n', '']):
        p = tmp_path / f'{i}.txt'
        p.write_text(text, encoding='utf-8')
        labels.append(p)
    labels.append(tmp_path / 'khong-co.txt')       # khong co file nhan = anh nen
    assert split_dataset.background_ratio(labels) == pytest.approx(3 / 5)


def test_main_chia_lai_theo_nguon_va_ghi_data_yaml(tmp_path):
    export, out = tmp_path / 'export', tmp_path / 'dataset'
    make_export(export, {
        'train/V01_1_jpg.rf.a.jpg': '3 0.5 0.5 0.1 0.1\n',
        'train/R01_1_jpg.rf.b.jpg': '1 0.5 0.5 0.1 0.1\n',
        'valid/V01_2_jpg.rf.c.jpg': '',
        'test/V02_1_jpg.rf.d.jpg': '3 0.4 0.4 0.1 0.1\n',
    })
    splits = tmp_path / 'splits.csv'
    splits.write_text('nguon,tap\nV01,train\nR01,test\nV02,val\n', encoding='utf-8')
    assert split_dataset.main(['--export', str(export), '--out', str(out), '--splits', str(splits)]) == 0
    assert sorted(p.name for p in (out / 'train' / 'images').iterdir()) == ['V01_1_jpg.rf.a.jpg', 'V01_2_jpg.rf.c.jpg']
    assert [p.name for p in (out / 'test' / 'images').iterdir()] == ['R01_1_jpg.rf.b.jpg']
    assert (out / 'test' / 'labels' / 'R01_1_jpg.rf.b.txt').read_text(encoding='utf-8') == '1 0.5 0.5 0.1 0.1\n'
    data = yaml.safe_load((out / 'data.yaml').read_text(encoding='utf-8'))
    assert data['names'] == ['owl', 'rat', 'snake', 'swiftlet']
    assert (data['train'], data['val'], data['test']) == ('train/images', 'val/images', 'test/images')


def test_main_lop_export_khac_4_lop_thi_dung(tmp_path):
    export = tmp_path / 'export'
    make_export(export, {'train/V01_1.jpg': ''})
    (export / 'data.yaml').write_text(yaml.safe_dump({'names': ['bird', 'rat']}), encoding='utf-8')
    splits = tmp_path / 'splits.csv'
    splits.write_text('nguon,tap\nV01,train\n', encoding='utf-8')
    assert split_dataset.main(['--export', str(export), '--out', str(tmp_path / 'o'), '--splits', str(splits)]) != 0


@pytest.fixture
def file_server(tmp_path):
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(tmp_path))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{server.server_address[1]}'
    server.shutdown()
    server.server_close()


def test_download_dung_sha(tmp_path, file_server):
    (tmp_path / 'best.pt').write_bytes(b'trong-so')
    dest = tmp_path / 'out' / 'best.pt'
    download_weights.download(f'{file_server}/best.pt', dest, hashlib.sha256(b'trong-so').hexdigest())
    assert dest.read_bytes() == b'trong-so'


def test_download_lech_sha_thi_xoa_va_bao_loi(tmp_path, file_server):
    (tmp_path / 'best.pt').write_bytes(b'trong-so')
    dest = tmp_path / 'out' / 'best.pt'
    with pytest.raises(ValueError, match='SHA-256'):
        download_weights.download(f'{file_server}/best.pt', dest, '0' * 64)
    assert not dest.exists() and not dest.with_suffix('.pt.part').exists()


def test_weights_json_du_khoa():
    data = json.loads((AI_DIR / 'weights.json').read_text(encoding='utf-8'))
    # Core metadata is required; trial status/limitations are retained as well.
    assert {'url', 'sha256', 'roboflowVersion', 'epochs', 'imgsz', 'seed', 'backgroundRatio', 'ultralytics', 'torch', 'localPython'} <= set(data)


def test_notebook_ghim_trung_requirements():
    pins = read_pins(AI_DIR / 'requirements.txt')
    nb = json.loads((AI_DIR / 'train' / 'train.ipynb').read_text(encoding='utf-8'))
    text = '\n'.join(''.join(c['source']) for c in nb['cells'])
    assert f"ultralytics=={pins['ultralytics']}" in text
    assert f"supervision=={pins['supervision']}" in text
    assert 'torch==' not in text            # Colab dung torch co san (spec 2.5)


def test_read_splits_khong_ghi_de_nguon_trung(tmp_path):
    p = tmp_path / 'splits.csv'
    p.write_text('nguon,tap\nV01,train\nV01,test\n', encoding='utf-8')
    with pytest.raises(ValueError, match='V01'):
        split_dataset.read_splits(p)


def test_khong_ghi_de_dau_ra_da_co(tmp_path):
    export, out = tmp_path / 'export', tmp_path / 'dataset'
    make_export(export, {'train/V01_1.jpg': ''})
    out.mkdir()
    marker = out / 'keep.txt'
    marker.write_text('keep', encoding='utf-8')
    splits = tmp_path / 'splits.csv'
    splits.write_text('nguon,tap\nV01,train\n', encoding='utf-8')
    assert split_dataset.main(['--export', str(export), '--out', str(out), '--splits', str(splits)]) == 1
    assert marker.read_text() == 'keep'
    assert list(out.iterdir()) == [marker]


def test_trung_ten_anh_o_hai_thu_muc_export_thi_dung(tmp_path):
    export, out = tmp_path / 'export', tmp_path / 'dataset'
    make_export(export, {'train/V01_1.jpg': '', 'valid/V01_1.jpg': '3 0.5 0.5 0.1 0.1'})
    splits = tmp_path / 'splits.csv'
    splits.write_text('nguon,tap\nV01,train\n', encoding='utf-8')
    assert split_dataset.main(['--export', str(export), '--out', str(out), '--splits', str(splits)]) == 1
    assert not out.exists()


def test_export_rong_khong_tao_bo_chia_gia(tmp_path):
    export = tmp_path / 'export'
    export.mkdir()
    (export / 'data.yaml').write_text(yaml.safe_dump({'names': ['owl', 'rat', 'snake', 'swiftlet']}), encoding='utf-8')
    splits = tmp_path / 'splits.csv'
    splits.write_text('nguon,tap\nV01,train\n', encoding='utf-8')
    assert split_dataset.main(['--export', str(export), '--out', str(tmp_path / 'out'), '--splits', str(splits)]) == 1


def test_data_yaml_duong_dan_tuyet_doi_khong_phu_thuoc_cwd(tmp_path):
    export, out = tmp_path / 'export', tmp_path / 'dataset'
    make_export(export, {'train/V01_1.jpg': ''})
    splits = tmp_path / 'splits.csv'
    splits.write_text('nguon,tap\nV01,train\n', encoding='utf-8')
    assert split_dataset.main(['--export', str(export), '--out', str(out), '--splits', str(splits)]) == 0
    config = yaml.safe_load((out / 'data.yaml').read_text(encoding='utf-8'))
    assert config['path'] == out.resolve().as_posix()
