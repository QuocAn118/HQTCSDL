/// <reference types="node" />

import {
  existsSync,
  readFileSync,
} from 'node:fs';

import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const MOBILE = join(__dirname, '..');

const pkg = JSON.parse(
  readFileSync(
    join(MOBILE, 'package.json'),
    'utf8'
  )
);

describe('quy tac repo mobile (spec mobile 1.2-1.4)', () => {
  it('cac phien ban duoc ghim chinh xac', () => {
    const dependencies = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    for (const [name, version] of Object.entries(dependencies)) {
      expect(version, name).toMatch(
        /^\d+\.\d+\.\d+$/
      );
    }

    expect(
      pkg.dependencies['socket.io-client']
    ).toBe('4.8.3');

    expect(pkg.devDependencies.vitest).toBe('5.0.5');

    expect(pkg.dependencies.expo).toMatch(/^58\./);

    expect(pkg.main).toBe('expo-router/entry');
  });

  it('.env.example dung dinh dang', () => {
    const env = readFileSync(
      join(MOBILE, '.env.example'),
      'utf8'
    ).trim();

    expect(env).toBe(
      'EXPO_PUBLIC_API_URL=http://192.168.1.10:3000'
    );
  });

  it('khong con cac file template cu', () => {
    for (const file of [
      'App.tsx',
      'index.ts',
      'AGENTS.md',
      'CLAUDE.md',
      '.git',
      '.claude',
    ]) {
      expect(
        existsSync(join(MOBILE, file)),
        file
      ).toBe(false);
    }
  });

  it('.gitignore goc co cac dong mobile', () => {
    const lines = readFileSync(
      join(MOBILE, '..', '.gitignore'),
      'utf8'
    ).split(/\r?\n/);

    for (const line of [
      'mobile/.env',
      'mobile/node_modules/',
      'mobile/.expo/',
      'mobile/dist/',
      'mobile/expo-env.d.ts',
    ]) {
      expect(lines).toContain(line);
    }
  });
});