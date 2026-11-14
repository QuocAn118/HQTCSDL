/// <reference types="node" />

import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from 'node:fs';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PAIRS,
  diffCopies,
  hashText,
} from '../scripts/check-copies.mjs';

function tree(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'copies-'));

  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }

  return dir;
}

const all = (text: string) =>
  Object.fromEntries(
    PAIRS.map((p) => [p, text])
  );

describe('check-copies (spec mobile 3.2)', () => {
  it('CRLF va LF cho cung bam', () => {
    expect(hashText('a\r\nb\r\n')).toBe(
      hashText('a\nb\n')
    );
  });

  it('khop, lech va thieu web', () => {
    const mobile = tree(all('x\n'));

    expect(
      diffCopies(mobile, tree(all('x\r\n')))
    ).toEqual([]);

    expect(
      diffCopies(
        mobile,
        tree({
          ...all('x\n'),
          'lib/merge.ts': 'y\n',
        })
      )
    ).toEqual(['lib/merge.ts']);

    expect(
      diffCopies(mobile, join(mobile, 'khong-co'))
    ).toBeNull();
  });
});