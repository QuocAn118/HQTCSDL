import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8'));

describe('quy tac repo web (spec web 1.2, 1.3)', () => {
  it('phien ban ghim chinh xac', () => {
    expect(pkg.dependencies).toEqual({
      next: '15.5.28', react: '19.3.1', 'react-dom': '19.3.1', 'react-is': '19.3.1',
      recharts: '3.10.1', 'socket.io-client': '4.8.3',
    });
    for (const v of Object.values({ ...pkg.dependencies, ...pkg.devDependencies })) expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies.typescript).toBe('5.9.3');
    expect(pkg.devDependencies.tailwindcss).toBe('4.3.3');
    expect(pkg.devDependencies['@tailwindcss/postcss']).toBe('4.3.3');
    expect(pkg.devDependencies.vitest).toBe('5.0.5');
  });

  it('cong 3001, demo bang build + start', () => {
    expect(pkg.scripts.dev).toBe('next dev -p 3001');
    expect(pkg.scripts.start).toBe('next start -p 3001');
  });

  it('.env.example chi co NEXT_PUBLIC_API_URL', () => {
    expect(readFileSync(join(WEB, '.env.example'), 'utf8').trim()).toBe('NEXT_PUBLIC_API_URL=http://localhost:3000');
  });

  it('.gitignore goc co dong web', () => {
    const lines = readFileSync(join(WEB, '..', '.gitignore'), 'utf8').split(/\r?\n/);
    for (const l of ['web/.env', 'web/.env.local', 'web/node_modules/', 'web/.next/', 'web/next-env.d.ts', 'web/*.tsbuildinfo']) {
      expect(lines).toContain(l);
    }
  });
});
