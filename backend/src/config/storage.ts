import {
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';

export interface StoragePaths {
  root: string;
  snapshots: string;
  tmp: string;
}

// Spec backend 2.2 / hop dong 2.4: kiem tao/ghi duoc, xoa file tam cua lan chay truoc.
export function ensureStorage(root: string): StoragePaths {
  const paths = {
    root,
    snapshots: join(root, 'snapshots'),
    tmp: join(root, 'tmp'),
  };
  for (const dir of [paths.snapshots, paths.tmp]) {
    try {
      mkdirSync(dir, { recursive: true });
      const probe = join(dir, `.probe-${process.pid}`);
      writeFileSync(probe, '');
      unlinkSync(probe);
    } catch (e) {
      throw new Error(
        `Khong tao/ghi duoc thu muc ${dir}: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`,
      );
    }
  }
  for (const f of readdirSync(paths.tmp))
    rmSync(join(paths.tmp, f), { recursive: true, force: true });
  return paths;
}
