"""Weight integrity checks without network access or model dependencies."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'download_weights.py'


class WeightTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('download_weights', SCRIPT)
        self.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.mod)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.dest = self.root / 'best.pt'

    def test_hash_reads_binary_content(self):
        self.dest.write_bytes(b'weights\x00\xff')
        self.assertEqual(self.mod.sha256_file(self.dest), hashlib.sha256(self.dest.read_bytes()).hexdigest())

    def response(self, content, error=None):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def raise_for_status(self):
                if error: raise error
            def iter_content(self, size): yield content
        return Response()

    def test_download_validates_before_replacing(self):
        self.dest.write_bytes(b'old')
        with patch.object(self.mod.requests, 'get', return_value=self.response(b'new')):
            self.mod.download('https://example.org/best.pt', self.dest, hashlib.sha256(b'new').hexdigest())
        self.assertEqual(self.dest.read_bytes(), b'new')
        self.assertFalse(self.dest.with_suffix('.pt.part').exists())

    def test_bad_download_keeps_existing_weights(self):
        self.dest.write_bytes(b'old')
        with patch.object(self.mod.requests, 'get', return_value=self.response(b'bad')):
            with self.assertRaises(ValueError):
                self.mod.download('https://example.org/best.pt', self.dest, '0' * 64)
        self.assertEqual(self.dest.read_bytes(), b'old')
        self.assertFalse(self.dest.with_suffix('.pt.part').exists())

    def test_http_failure_cleans_partial_file(self):
        self.dest.with_suffix('.pt.part').write_bytes(b'partial')
        error = self.mod.requests.HTTPError('failed')
        with patch.object(self.mod.requests, 'get', return_value=self.response(b'', error)):
            with self.assertRaises(self.mod.requests.HTTPError):
                self.mod.download('https://example.org/best.pt', self.dest, '0' * 64)
        self.assertFalse(self.dest.with_suffix('.pt.part').exists())

    def metadata(self, digest):
        path = self.root / 'weights.json'
        path.write_text(json.dumps({'url': None, 'sha256': digest, 'ultralytics': 'test'}), encoding='utf-8')
        return path

    def test_verify_local_file_needs_no_published_url(self):
        self.dest.write_bytes(b'local')
        meta = self.metadata(hashlib.sha256(b'local').hexdigest())
        with patch.object(self.mod, 'META', meta), patch.object(self.mod, 'DEST', self.dest), patch.object(self.mod, 'load_and_check') as load, patch.object(self.mod.requests, 'get') as get:
            self.assertEqual(self.mod.main(['--verify-only']), 0)
        load.assert_called_once_with(self.dest)
        get.assert_not_called()

    def test_corrupt_file_is_never_loaded(self):
        self.dest.write_bytes(b'corrupt')
        meta = self.metadata('0' * 64)
        with patch.object(self.mod, 'META', meta), patch.object(self.mod, 'DEST', self.dest), patch.object(self.mod, 'load_and_check') as load:
            self.assertEqual(self.mod.main(['--verify-only']), 1)
        load.assert_not_called()
        self.assertTrue(self.dest.exists())

    def test_unpublished_download_fails_without_network(self):
        meta = self.metadata('0' * 64)
        with patch.object(self.mod, 'META', meta), patch.object(self.mod.requests, 'get') as get:
            self.assertEqual(self.mod.main([]), 1)
        get.assert_not_called()

    def test_classes_reject_missing_extra_and_wrong_case(self):
        self.mod.require_classes({0: 'owl', 1: 'rat', 2: 'snake', 3: 'swiftlet'})
        for names in ({0: 'owl'}, {0: 'Owl', 1: 'rat', 2: 'snake', 3: 'swiftlet'}, {0: 'owl', 1: 'rat', 2: 'snake', 3: 'swiftlet', 4: 'cat'}):
            with self.assertRaises(ValueError):
                self.mod.require_classes(names)


if __name__ == '__main__':
    unittest.main()
