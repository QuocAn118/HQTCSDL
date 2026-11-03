"""Kiem chung: requests tu sinh boundary; email.parser doc lai duoc (spec 5.6, 7.4)."""
import email.parser
import email.policy
import json

import requests

req = requests.Request(
    'POST', 'http://127.0.0.1/api/ai/predator-detections',
    data={'metadata': json.dumps({'camera': 'H1-F0-CAMERA'})},
    files={'image': ('snapshot.jpg', b'\xff\xd8\xff\xe0abc', 'image/jpeg')},
).prepare()
ct = req.headers['Content-Type']
print('Content-Type', ct)
msg = email.parser.BytesParser(policy=email.policy.default).parsebytes(
    b'Content-Type: ' + ct.encode('ascii') + b'\r\n\r\n' + req.body)
for part in msg.iter_parts():
    name = part.get_param('name', header='content-disposition')
    print(name, part.get_content_type(), repr(part.get_content())[:60])
