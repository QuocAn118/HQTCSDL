import {
  existsSync,
  mkdtempSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureStorage } from './storage';

describe('ensureStorage', () => {
  it('tao snapshots/ va tmp/, xoa file con sot trong tmp/, giu snapshots/', () => {
    const root = mkdtempSync(join(tmpdir(), 'sc-storage-'));
    mkdirSync(join(root, 'tmp'), { recursive: true });
    mkdirSync(join(root, 'snapshots'), { recursive: true });
    writeFileSync(join(root, 'tmp', 'old.jpg'), 'x');
    writeFileSync(join(root, 'snapshots', 'keep.jpg'), 'y');
    const p = ensureStorage(root);
    expect(existsSync(p.snapshots)).toBe(true);
    expect(readdirSync(p.tmp)).toEqual([]);
    expect(readdirSync(p.snapshots)).toEqual(['keep.jpg']);
  });

  it('khong tao duoc -> Error neu thu muc', () => {
    const root = mkdtempSync(join(tmpdir(), 'sc-storage-'));
    writeFileSync(join(root, 'snapshots'), 'la file, khong phai thu muc');
    expect(() => ensureStorage(root)).toThrow(/snapshots/);
  });
});
