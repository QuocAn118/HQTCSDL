import csv
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import zipfile

import numpy as np
from PIL import Image, PngImagePlugin

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'prepare_test_sources.py'


def image_bytes(seed, metadata=False, jpeg=False):
    pixels = np.random.default_rng(seed).integers(0, 256, (64, 64, 3), dtype=np.uint8)
    image = Image.fromarray(pixels)
    stream = io.BytesIO()
    info = PngImagePlugin.PngInfo()
    if metadata:
        info.add_text('comment', 'different encoding, same pixels')
    image.save(stream, format='JPEG' if jpeg else 'PNG', **({'quality': 90} if jpeg else {'pnginfo': info}))
    return stream.getvalue()


class PrepareTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SCRIPT.is_file():
            raise AssertionError('Missing preparation script: cannot validate new test sources')
        spec = importlib.util.spec_from_file_location('prepare_test_sources', SCRIPT)
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def test_bbox_and_polygon_are_mapped_to_canonical_class(self):
        normal, count = self.module.normalize_labels('2 0.5 0.5 0.2 0.4\n', 3, 0)
        self.assertEqual(normal, '0 0.5 0.5 0.2 0.4\n')
        self.assertEqual(count, 1)
        normal, count = self.module.normalize_labels('0 0.1 0.2 0.7 0.2 0.7 0.8 0.1 0.8\n', 1, 3)
        self.assertEqual(normal, '3 0.4 0.5 0.6 0.6\n')

    def test_invalid_labels_are_rejected_and_background_is_retained(self):
        self.assertEqual(self.module.normalize_labels('', 1, 1), ('', 0))
        for label in ('1 0.5 0.5 0.1 0.1', '0 nan 0.5 0.1 0.1',
                      '0 0.5 0.5 -0.1 0.1', '0 1.2 0.5 0.1 0.1',
                      '0 0.1 0.2 0.3 0.4 0.5', '0 0.95 0.5 0.2 0.2'):
            with self.subTest(label=label), self.assertRaises(ValueError):
                self.module.normalize_labels(label, 1, 1)

    def test_reencoded_pixels_and_jpeg_variants_are_detected(self):
        original = self.module.fingerprint(image_bytes(1))
        same = self.module.fingerprint(image_bytes(1, metadata=True))
        self.assertNotEqual(original['sha256'], same['sha256'])
        self.assertEqual(self.module.match_image(same, [original])[0], 'pixel')
        compressed = self.module.fingerprint(image_bytes(1, jpeg=True))
        self.assertEqual(self.module.match_image(compressed, [original])[0], 'near')
        independent = self.module.fingerprint(image_bytes(7))
        self.assertIsNone(self.module.match_image(independent, [original]))

    def test_audit_quarantines_overlapping_source_and_prepares_clean_source(self):
        with tempfile.TemporaryDirectory(prefix='swiftlet-prepare-') as temp:
            root = Path(temp)
            sources = root / 'sources'
            for source, seed in [('R02', 1), ('R07', 1), ('R06', 9)]:
                directory = sources / source
                directory.mkdir(parents=True)
                with zipfile.ZipFile(directory / 'source.zip', 'w') as z:
                    z.writestr('data.yaml', "nc: 1\nnames: ['animal']\n")
                    z.writestr('train/images/item.png', image_bytes(seed, metadata=source == 'R07'))
                    z.writestr('train/labels/item.txt', '0 0.5 0.5 0.2 0.2\n')
            out = root / 'audit'
            result = self.module.prepare(sources, out, {'R06': ('owl', 0), 'R07': ('rat', 1)})
            self.assertEqual(result['sources']['R07']['status'], 'quarantined_overlap')
            self.assertEqual(result['sources']['R06']['status'], 'accepted')
            self.assertEqual(result['sources']['R06']['accepted_images'], 1)
            self.assertFalse((out / 'prepared/R07').exists())
            labels = list((out / 'prepared/R06').rglob('*.txt'))
            self.assertEqual(labels[0].read_text(), '0 0.5 0.5 0.2 0.2\n')
            with (out / 'overlaps.csv').open(encoding='utf-8') as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(rows[0]['reference_source'], 'R02')
            with self.assertRaises(FileExistsError):
                self.module.prepare(sources, out, {'R06': ('owl', 0)})

    def test_assemble_preserves_old_inputs_and_retains_new_source_identity(self):
        with tempfile.TemporaryDirectory(prefix='swiftlet-assemble-') as temp:
            root = Path(temp)
            for name, source in [('old', 'R02'), ('prepared', 'R07')]:
                base = root/name
                (base/'train/images').mkdir(parents=True)
                (base/'train/labels').mkdir()
                image = base/'train/images/one.png'
                image.write_bytes(image_bytes(1 if name == 'old' else 7))
                (base/'train/labels/one.txt').write_text('1 0.5 0.5 0.2 0.2\n')
                with (base/'image_review.csv').open('w', newline='') as stream:
                    writer = csv.DictWriter(stream, fieldnames=['image','source_id','source_group','sha256','objects'])
                    writer.writeheader()
                    writer.writerow(dict(image='train/images/one.png', source_id=source,
                        source_group='rat', sha256=self.module.fingerprint(image.read_bytes())['sha256'], objects=1))
            before = (root/'old/image_review.csv').read_bytes()
            self.module.assemble(root/'old', root/'prepared', root/'combined')
            with (root/'combined/image_review.csv').open(encoding='utf-8') as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual([row['source_id'] for row in rows], ['R02', 'R07'])
            for row in rows:
                self.assertTrue((root/'combined'/row['image']).is_file())
                label = root/'combined'/Path(row['image']).parent.parent/'labels'/(Path(row['image']).stem+'.txt')
                self.assertEqual(label.read_text(), '1 0.5 0.5 0.2 0.2\n')
            self.assertEqual((root/'old/image_review.csv').read_bytes(), before)
            with self.assertRaises(FileExistsError):
                self.module.assemble(root/'old', root/'prepared', root/'combined')

    def test_reviewed_release_excludes_matched_images_and_checks_archive_hash(self):
        with tempfile.TemporaryDirectory(prefix='swiftlet-release-') as temp:
            root = Path(temp)
            sources = root/'sources'
            for source in ['R04', 'R06']:
                directory = sources/source
                directory.mkdir(parents=True)
                with zipfile.ZipFile(directory/'source.zip', 'w') as z:
                    z.writestr('data.yaml', "nc: 1\nnames: ['owl']\n")
                    z.writestr('train/images/shared.png', image_bytes(1))
                    z.writestr('train/labels/shared.txt', '0 0.5 0.5 0.2 0.2\n')
                    if source == 'R06':
                        z.writestr('train/images/clean.png', image_bytes(12))
                        z.writestr('train/labels/clean.txt', '0 0.5 0.5 0.2 0.2\n')
            audit = root/'audit'
            self.module.prepare(sources, audit, {'R06': ('owl', 0)})
            released = root/'released'
            rows = self.module.release_reviewed_source(sources, audit, 'R06', released)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['original_image'], 'train/images/clean.png')
            self.assertEqual(rows[0]['source_id'], 'R06')
            with zipfile.ZipFile(sources/'R06/source.zip', 'a') as z:
                z.writestr('changed.txt', 'changed after audit')
            with self.assertRaisesRegex(ValueError, 'changed'):
                self.module.release_reviewed_source(sources, audit, 'R06', root/'changed')

    def test_audit_cannot_accept_test_data_without_old_reference_images(self):
        with tempfile.TemporaryDirectory(prefix='swiftlet-no-reference-') as temp:
            root = Path(temp)
            directory = root/'sources/R06'
            directory.mkdir(parents=True)
            with zipfile.ZipFile(directory/'source.zip', 'w') as z:
                z.writestr('data.yaml', "nc: 1\nnames: ['owl']\n")
                z.writestr('train/images/one.png', image_bytes(1))
                z.writestr('train/labels/one.txt', '0 0.5 0.5 0.2 0.2\n')
            with self.assertRaisesRegex(ValueError, 'No reference images'):
                self.module.prepare(root/'sources', root/'audit', {'R06': ('owl', 0)})


if __name__ == '__main__':
    unittest.main()
