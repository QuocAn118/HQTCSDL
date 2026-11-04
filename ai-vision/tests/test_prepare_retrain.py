import csv
import hashlib
import json
from pathlib import Path
import sys

from PIL import Image
import pytest

from swiftletcare_ai.config import AI_DIR

sys.path.insert(0, str(AI_DIR / 'scripts'))
from prepare_retrain import prepare


def image(path, colour):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new('RGB', (20, 20), colour).save(path)


def inputs(tmp_path):
    base, negatives, val = (tmp_path / name for name in ['base', 'negatives', 'val'])
    records = []
    for i in range(10):
        name = f'R01_{i}.jpg'
        image(base / 'train/images' / name, (i*10, 20, 30))
        p = base / 'train/labels' / (Path(name).stem + '.txt')
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text('3 .5 .5 .2 .2\n')
        records.append({'image': 'train/images/'+name, 'label': 'train/labels/'+p.name, 'split': 'train', 'source_id': 'R01'})
    with (base / 'split_manifest.csv').open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(records[0])); w.writeheader(); w.writerows(records)
    decisions = tmp_path / 'decisions.csv'
    decisions.write_text('image,decision\ntrain/images/R01_0.jpg,quarantine_v4_only\n')
    image(negatives / 'images/V01_0010.jpg', (5, 250, 10))
    (negatives / 'labels').mkdir()
    (negatives / 'labels/V01_0010.txt').write_text('')
    selected = []
    for cls, name in enumerate(['owl', 'rat', 'snake', 'swiftlet']):
        filename = f'R10_{name}_{cls}.jpg'
        image(val / 'review' / filename, (210, cls*30, 200))
        (val / 'labels').mkdir(exist_ok=True)
        (val / 'labels' / (Path(filename).stem+'.txt')).write_text(f'{cls} .5 .5 .5 .5\n')
        selected.append({'reviewImage': filename, 'reviewSha256': hashlib.sha256((val/'review'/filename).read_bytes()).hexdigest(),
                         'class': name, 'license': 'CC BY 4.0', 'pageUrl': 'https://example.org/'+filename})
    (val / 'selected_annotations.json').write_text(json.dumps({'selected': selected}))
    return base, decisions, negatives, val


def test_prepare_preserves_base_quarantines_only_new_version_and_keeps_class_ids(tmp_path):
    args = inputs(tmp_path)
    result = prepare(*args, tmp_path / 'v4')
    assert result['trainImages'] == 10 and result['valImages'] == 4
    assert (args[0] / 'train/images/R01_0.jpg').exists()
    assert not (tmp_path / 'v4/train/images/R01_0.jpg').exists()
    assert (tmp_path / 'v4/train/labels/V01_0010.txt').read_text() == ''
    assert result['backgroundRatio'] == .1
    assert not (tmp_path / 'v4/test').exists()


def test_prepare_refuses_missing_val_class_before_creating_output(tmp_path):
    args = inputs(tmp_path)
    p = args[3] / 'selected_annotations.json'
    j = json.loads(p.read_text()); j['selected'].pop(); p.write_text(json.dumps(j))
    with pytest.raises(ValueError, match='four classes'):
        prepare(*args, tmp_path / 'v4')
    assert not (tmp_path / 'v4').exists()


def test_prepare_refuses_existing_output_and_nonempty_negative_label(tmp_path):
    args = inputs(tmp_path)
    out = tmp_path / 'v4'; out.mkdir()
    with pytest.raises(FileExistsError):
        prepare(*args, out)
    out.rmdir()
    (args[2] / 'labels/V01_0010.txt').write_text('1 .5 .5 .2 .2')
    with pytest.raises(ValueError, match='negative'):
        prepare(*args, out)


def test_prepare_refuses_train_val_duplicate_image(tmp_path):
    args = inputs(tmp_path)
    target = args[3] / 'review/R10_owl_0.jpg'
    target.write_bytes((args[0] / 'train/images/R01_1.jpg').read_bytes())
    p = args[3] / 'selected_annotations.json'; j = json.loads(p.read_text())
    j['selected'][0]['reviewSha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    p.write_text(json.dumps(j))
    with pytest.raises(ValueError, match='duplicate'):
        prepare(*args, tmp_path / 'v4')


def test_prepare_enforces_explicit_source_split_mapping(tmp_path):
    args = inputs(tmp_path)
    splits = tmp_path / 'splits.csv'
    splits.write_text('nguon,tap\nR01,train\nV01,train\nR10,train\n')
    with pytest.raises(ValueError, match='mapping'):
        prepare(*args, tmp_path / 'v4', splits=splits)
    assert not (tmp_path / 'v4').exists()
