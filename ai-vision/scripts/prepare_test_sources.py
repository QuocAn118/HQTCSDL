"""Audit new ZIP sources against ALL old source ZIPs; prepare only clean sources.

An overlap quarantines the entire candidate source, not just its matching image.
This conservative check is not proof of provenance or absence of all similar scenes.
"""
import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path, PurePosixPath
import re
import shutil
import zipfile

import numpy as np
from PIL import Image, ImageOps

AI = Path(__file__).resolve().parents[1]
CANDIDATES = {'R06': ('owl', 0), 'R07': ('rat', 1),
              'R08': ('snake', 2), 'R09': ('swiftlet', 3)}
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}
CORRELATION_MIN = 0.97
MAE_MAX = 8.0


def normalize_labels(text, nc, target):
    result = []
    for line in text.splitlines():
        if not line.strip():
            continue
        parts = line.split()
        if not parts[0].isdigit() or not 0 <= int(parts[0]) < nc:
            raise ValueError('Invalid source class')
        coords = [float(x) for x in parts[1:]]
        if any(not math.isfinite(x) or not 0 <= x <= 1 for x in coords):
            raise ValueError('Non-finite or out-of-range coordinates')
        if len(coords) == 4:
            x, y, w, h = coords
        elif len(coords) >= 6 and len(coords) % 2 == 0:
            xs, ys = coords[::2], coords[1::2]
            w, h = max(xs) - min(xs), max(ys) - min(ys)
            x, y = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        else:
            raise ValueError('Invalid bbox or polygon')
        if w <= 0 or h <= 0 or min(x-w/2, y-h/2) < -1e-6 or max(x+w/2, y+h/2) > 1+1e-6:
            raise ValueError('Invalid bbox extent')
        result.append(f'{target} ' + ' '.join(f'{v:.8g}' for v in (x, y, w, h)))
    return ''.join(line + '\n' for line in result), len(result)


def fingerprint(data):
    with Image.open(io.BytesIO(data)) as opened:
        rgb = ImageOps.exif_transpose(opened).convert('RGB')
        width, height = rgb.size
        pixel_sha = hashlib.sha256(f'{width}x{height}:'.encode() + rgb.tobytes()).hexdigest()
        thumb = np.asarray(rgb.resize((16, 16), Image.Resampling.LANCZOS), dtype=np.float32)
    grey = thumb.mean(axis=2).reshape(-1)
    centered = grey - grey.mean()
    norm = float(np.linalg.norm(centered))
    return {'sha256': hashlib.sha256(data).hexdigest(), 'pixel_sha256': pixel_sha,
            'thumb': thumb, 'vector': centered / max(norm, 1e-12),
            'width': width, 'height': height}


class ReferenceIndex:
    def __init__(self, references):
        self.references = references
        self.files = {}
        self.pixels = {}
        for i, ref in enumerate(references):
            self.files.setdefault(ref['sha256'], i)
            self.pixels.setdefault(ref['pixel_sha256'], i)
        self.vectors = np.stack([r['vector'] for r in references]) if references else np.zeros((0, 256), dtype=np.float32)

    def match(self, candidate):
        for key, values, reason in [('sha256', self.files, 'file'), ('pixel_sha256', self.pixels, 'pixel')]:
            if candidate[key] in values:
                return reason, values[candidate[key]], 1.0, 0.0
        for flip in (False, True):
            thumb = candidate['thumb'][:, ::-1] if flip else candidate['thumb']
            grey = thumb.mean(axis=2).reshape(-1)
            vector = grey-grey.mean()
            vector /= max(float(np.linalg.norm(vector)), 1e-12)
            correlations = np.einsum('ij,j->i', self.vectors, vector)
            for i in np.flatnonzero(correlations >= CORRELATION_MIN):
                mae = float(np.abs(thumb-self.references[i]['thumb']).mean())
                if mae <= MAE_MAX:
                    return 'near_mirrored' if flip else 'near', int(i), float(correlations[i]), mae
        return None


def match_image(candidate, references):
    return ReferenceIndex(references).match(candidate)


def write_csv(path, rows, fields):
    with path.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)


def source_archive(directory):
    archives = sorted(directory.glob('*.zip'))
    if len(archives) != 1:
        raise ValueError(f'{directory.name}: expected exactly one ZIP')
    return archives[0]


def image_entries(archive):
    entries = [e for e in archive.infolist() if PurePosixPath(e.filename).suffix.lower() in IMAGE_EXTENSIONS]
    names = [e.filename for e in entries]
    if len(set(names)) != len(names):
        raise ValueError('Duplicate image paths in ZIP')
    return entries


def prepare(sources, out, candidates=None):
    candidates = CANDIDATES if candidates is None else candidates
    out.mkdir(parents=True, exist_ok=False)
    references, overlaps, review, invalid, report = [], [], [], [], {}
    for directory in sorted(sources.iterdir()):
        if not directory.is_dir() or directory.name in candidates:
            continue
        # Only the established R01-R05 are reference sources.
        if directory.name not in {'R01', 'R02', 'R03', 'R04', 'R05'}:
            continue
        with zipfile.ZipFile(source_archive(directory)) as archive:
            for entry in image_entries(archive):
                try:
                    record = fingerprint(archive.read(entry))
                    record.update(source_id=directory.name, image=entry.filename)
                    references.append(record)
                except (OSError, ValueError) as exc:
                    raise ValueError(f'Cannot audit old image {directory.name}/{entry.filename}: {exc}') from exc
        print(f'Indexed {directory.name}: {len(references)} reference images total', flush=True)
    reference_count = len(references)
    if not reference_count:
        raise ValueError('No reference images: cannot check test-source overlap')
    for source_id, (target_class, target_id) in candidates.items():
        index = ReferenceIndex(references)
        records, source_overlaps = [], []
        archive_path = source_archive(sources/source_id)
        with zipfile.ZipFile(archive_path) as archive:
            yamls = [e for e in archive.infolist() if PurePosixPath(e.filename).name == 'data.yaml']
            metadata = archive.read(yamls[0]).decode('utf-8-sig') if yamls else ''
            nc_match = re.search(r'^nc:\s*(\d+)\s*$', metadata, re.MULTILINE)
            if not nc_match:
                raise ValueError(f'{source_id}: missing nc in data.yaml')
            nc = int(nc_match[1])
            seen = set()
            for entry in image_entries(archive):
                path = PurePosixPath(entry.filename)
                if '..' in path.parts or path.is_absolute() or path.parent.name != 'images':
                    raise ValueError('Unsafe or unexpected ZIP image path')
                data = archive.read(entry)
                try:
                    record = fingerprint(data)
                except (OSError, ValueError) as exc:
                    invalid.append(dict(source_id=source_id, image=entry.filename, reason=f'image: {exc}'))
                    continue
                record.update(source_id=source_id, image=entry.filename)
                match = index.match(record)
                if match:
                    reason, ref_index, correlation, mae = match
                    ref = references[ref_index]
                    source_overlaps.append(dict(source_id=source_id, image=entry.filename,
                        reference_source=ref['source_id'], reference_image=ref['image'],
                        method=reason, correlation=correlation, mae=mae))
                label_path = path.parent.parent/'labels'/(path.stem+'.txt')
                try:
                    text = archive.read(str(label_path)).decode('utf-8-sig')
                    label, objects = normalize_labels(text, nc, target_id)
                except (KeyError, ValueError, UnicodeError) as exc:
                    invalid.append(dict(source_id=source_id, image=entry.filename, reason=f'label: {exc}'))
                    continue
                if record['pixel_sha256'] in seen:
                    invalid.append(dict(source_id=source_id, image=entry.filename, reason='duplicate_pixels_within_source'))
                    continue
                seen.add(record['pixel_sha256'])
                records.append((entry.filename, record, label, objects))
            overlaps.extend(source_overlaps)
            status = 'quarantined_overlap' if source_overlaps else ('accepted' if records else 'rejected_empty')
            report[source_id] = dict(status=status, total_images=len(image_entries(archive)),
                overlapping_images=len(source_overlaps), valid_unique_images=len(records),
                accepted_images=len(records) if status == 'accepted' else 0, target_class=target_class,
                zip_sha256=hashlib.sha256(archive_path.read_bytes()).hexdigest())
            if status == 'accepted':
                for i, (name, record, label, objects) in enumerate(records):
                    filename = f'{source_id}_{i:05d}_{PurePosixPath(name).name}'
                    relative = f'{source_id}/images/{filename}'
                    destination = out/'prepared'/relative
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(archive.read(name))
                    label_out = destination.parent.parent/'labels'/(destination.stem+'.txt')
                    label_out.parent.mkdir(parents=True, exist_ok=True)
                    label_out.write_text(label, encoding='utf-8')
                    review.append(dict(image=relative, source_id=source_id, source_group=target_class,
                        sha256=record['sha256'], objects=objects, original_image=name,
                        polygon_conversion='bbox_envelope_if_polygon'))
        # Include even quarantined candidates in subsequent comparisons to expose shared origins.
        references.extend(record for _, record, _, _ in records)
        print(f'{source_id}: {status}, {len(source_overlaps)} overlaps, {len(records)} valid unique images', flush=True)
    write_csv(out/'overlaps.csv', overlaps, ['source_id','image','reference_source','reference_image','method','correlation','mae'])
    write_csv(out/'invalid.csv', invalid, ['source_id','image','reason'])
    write_csv(out/'prepared'/'image_review.csv', review, ['image','source_id','source_group','sha256','objects','original_image','polygon_conversion']) if review else None
    result = dict(sources=report, reference_images=reference_count,
        thresholds=dict(correlation_min=CORRELATION_MIN, rgb_mae_max=MAE_MAX, thumbnail_size=16, horizontal_flip=True),
        policy='Quarantine entire candidate source on any overlap with old raw sources or preceding candidates.',
        limitations='Similarity heuristics do not prove absence of shared scenes, crops, videos or provenance. Manual provenance/scene review remains necessary.')
    (out/'audit_summary.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result


def release_reviewed_source(sources, audit, source_id, out):
    """After visual review, remove confirmed overlaps and normalize the remainder."""
    summary = json.loads((audit/'audit_summary.json').read_text(encoding='utf-8'))
    state = summary['sources'][source_id]
    if state['status'] != 'quarantined_overlap':
        raise ValueError('Source is not awaiting overlap review')
    archive_path = source_archive(sources/source_id)
    if hashlib.sha256(archive_path.read_bytes()).hexdigest() != state['zip_sha256']:
        raise ValueError('Source archive changed after audit')
    with (audit/'overlaps.csv').open(encoding='utf-8', newline='') as stream:
        excluded = {row['image'] for row in csv.DictReader(stream) if row['source_id'] == source_id}
    with (audit/'invalid.csv').open(encoding='utf-8', newline='') as stream:
        excluded.update(row['image'] for row in csv.DictReader(stream) if row['source_id'] == source_id)
    out.mkdir(parents=True, exist_ok=False)
    target_class, target_id = CANDIDATES[source_id]
    review = []
    with zipfile.ZipFile(archive_path) as archive:
        yaml_entry = next(e for e in archive.infolist() if PurePosixPath(e.filename).name == 'data.yaml')
        nc = int(re.search(r'^nc:\s*(\d+)\s*$', archive.read(yaml_entry).decode('utf-8-sig'), re.MULTILINE)[1])
        for i, entry in enumerate(image_entries(archive)):
            if entry.filename in excluded:
                continue
            path = PurePosixPath(entry.filename)
            if '..' in path.parts or path.is_absolute() or path.parent.name != 'images':
                raise ValueError('Unsafe or unexpected ZIP image path')
            data = archive.read(entry)
            label_path = path.parent.parent/'labels'/(path.stem+'.txt')
            label, objects = normalize_labels(archive.read(str(label_path)).decode('utf-8-sig'), nc, target_id)
            relative = f'{source_id}/images/{source_id}_{i:05d}_{path.name}'
            destination = out/relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            label_out = destination.parent.parent/'labels'/(destination.stem+'.txt')
            label_out.parent.mkdir(parents=True, exist_ok=True)
            label_out.write_text(label, encoding='utf-8')
            review.append(dict(image=relative, source_id=source_id, source_group=target_class,
                sha256=hashlib.sha256(data).hexdigest(), objects=objects, original_image=entry.filename))
    write_csv(out/'image_review.csv', review, ['image','source_id','source_group','sha256','objects','original_image'])
    (out/'reviewed_release.json').write_text(json.dumps(dict(source_id=source_id,
        excluded_images=len(excluded), accepted_images=len(review), audit=str(audit),
        policy='Confirmed overlaps removed after visual review; remaining source stays entirely in test.'), indent=2), encoding='utf-8')
    print(f'Reviewed {source_id}: retained {len(review)}, excluded {len(excluded)}', flush=True)
    return review


def assemble(base, prepared, out):
    """Combine clean old inputs with audited/normalized sources; never edit inputs."""
    out.mkdir(parents=True, exist_ok=False)
    combined = []
    hashes = set()
    prepared_dirs = list(prepared) if isinstance(prepared, (list, tuple)) else [prepared]
    for directory in [base, *prepared_dirs]:
        with (directory/'image_review.csv').open(encoding='utf-8-sig', newline='') as stream:
            rows = list(csv.DictReader(stream))
        for i, row in enumerate(rows):
            source = row['source_id']
            if not re.fullmatch(r'[A-Za-z][A-Za-z0-9]*', source):
                raise ValueError('Invalid source code')
            original = (directory/row['image']).resolve()
            if not original.is_relative_to(directory.resolve()):
                raise ValueError('Image outside input directory')
            label = original.parent.parent/'labels'/(original.stem+'.txt')
            data_hash = hashlib.sha256(original.read_bytes()).hexdigest()
            if data_hash != row['sha256'] or data_hash in hashes:
                raise ValueError('Image hash mismatch or duplicate')
            hashes.add(data_hash)
            relative = f'{source}/images/{i:05d}_{original.name}'
            destination = out/relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            label_out = destination.parent.parent/'labels'/(destination.stem+'.txt')
            label_out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(original, destination)
            shutil.copy2(label, label_out)
            if hashlib.sha256(destination.read_bytes()).hexdigest() != data_hash or label.read_bytes() != label_out.read_bytes():
                raise ValueError('Copied image or label differs')
            combined.append(dict(image=relative, source_id=source, source_group=row['source_group'],
                sha256=data_hash, objects=row['objects'], original_image=row['image']))
    write_csv(out/'image_review.csv', combined, ['image','source_id','source_group','sha256','objects','original_image'])
    print(f'Combined {len(combined)} images without changing input datasets', flush=True)
    return combined


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', type=Path, default=AI/'data/raw/sources')
    parser.add_argument('--out', type=Path, default=AI/'data/working/source_audit_v1')
    parser.add_argument('--base', type=Path, help='Assemble mode: old clean input dataset')
    parser.add_argument('--prepared', type=Path, nargs='+', help='Assemble mode: audited prepared directories')
    parser.add_argument('--release-source', choices=CANDIDATES, help='Release mode: source whose overlaps were visually reviewed')
    parser.add_argument('--audit', type=Path, help='Release mode: completed audit directory')
    args = parser.parse_args()
    if args.release_source:
        if not args.audit:
            parser.error('--release-source requires --audit')
        release_reviewed_source(args.sources, args.audit, args.release_source, args.out)
    elif args.base:
        if not args.prepared:
            parser.error('--base requires --prepared')
        assemble(args.base, args.prepared, args.out)
    else:
        prepare(args.sources, args.out)
