import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const MOBILE = fileURLToPath(new URL('..', import.meta.url));
const WEB = join(MOBILE, '..', 'web');

export const PAIRS = [
  'lib/time.ts',
  'lib/merge.ts',
  'lib/errors.ts',
  'lib/types.ts',
  'lib/socket.ts',
  'test/time.test.ts',
  'test/merge.test.ts',
  'test/errors.test.ts',
];

export const hashText = (text) =>
  createHash('sha256')
    .update(text.replace(/\r\n/g, '\n'))
    .digest('hex');

export function diffCopies(mobileDir, webDir) {
  if (!existsSync(webDir)) return null;

  return PAIRS.filter((rel) => {
    const a = join(mobileDir, rel);
    const b = join(webDir, rel);

    if (!existsSync(a) || !existsSync(b)) {
      return true;
    }

    return (
      hashText(readFileSync(a, 'utf8')) !==
      hashText(readFileSync(b, 'utf8'))
    );
  });
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  const diff = diffCopies(MOBILE, WEB);

  if (diff === null) {
    console.log('Chua co thu muc web/: bo qua kiem ban sao');
  } else if (diff.length) {
    console.warn(
      `CANH BAO: ban sao lech voi web/: ${diff.join(', ')}`
    );
  } else {
    console.log(`Ban sao khop web/ (${PAIRS.length} file)`);
  }
}