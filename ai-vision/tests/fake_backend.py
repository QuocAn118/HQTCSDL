"""Backend gia cho test: http.server cua thu vien chuan, ghi lai moi request.
Doc multipart bang email.parser (khong dung cgi - da bo khoi Python 3.13, spec 7.4)."""
import email.parser
import email.policy
import json
import threading
import time
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULTS = {
    '/api/ai/bird-counts': (200, {'windowsUpserted': 1, 'windowsUnchanged': 0}),
    '/api/ai/predator-detections': (200, {'created': True, 'alertId': 1, 'skipReason': None}),
    '/api/ai/heartbeat': (200, {'accepted': 1, 'rejected': 0}),
}


@dataclass
class Recorded:
    method: str
    path: str
    headers: dict
    body: bytes
    json: object = None
    parts: dict = field(default_factory=dict)


def parse_multipart(content_type: str, body: bytes) -> dict:
    msg = email.parser.BytesParser(policy=email.policy.default).parsebytes(
        b'Content-Type: ' + content_type.encode('ascii') + b'\r\n\r\n' + body)
    return {
        part.get_param('name', header='content-disposition'): (part.get_content_type(), part.get_content())
        for part in msg.iter_parts()
    }


class _Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        backend = self.server.backend
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        ct = self.headers.get('Content-Type', '')
        rec = Recorded('POST', self.path, dict(self.headers), body)
        if ct.startswith('application/json'):
            rec.json = json.loads(body)
        elif ct.startswith('multipart/form-data'):
            rec.parts = parse_multipart(ct, body)
        status, payload, delay = backend.next_response(self.path)
        backend.requests.append(rec)
        if delay:
            time.sleep(delay)
        data = payload.encode('utf-8') if isinstance(payload, str) else json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'text/plain' if isinstance(payload, str) else 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # Expected when testing client-side request deadlines.

    def log_message(self, *args):
        pass


class FakeBackend:
    def __init__(self):
        self.requests: list[Recorded] = []
        self._script: dict[str, list] = {}
        self._lock = threading.Lock()
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), _Handler)
        self.server.backend = self
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}'
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def respond(self, path: str, *responses) -> None:
        self._script[path] = [r if len(r) == 3 else (r[0], r[1], 0) for r in responses]

    def next_response(self, path: str):
        with self._lock:
            queue = self._script.get(path)
            if not queue:
                status, body = DEFAULTS.get(path, (404, {'message': f'Cannot POST {path}'}))
                return status, body, 0
            return queue.pop(0) if len(queue) > 1 else queue[0]

    def to(self, path: str) -> list[Recorded]:
        return [r for r in self.requests if r.path == path]

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
