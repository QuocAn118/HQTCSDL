// Sinh client Prisma rieng cho backend (CommonJS) tu schema cua database-core; khong sua file cua database-core.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const src = readFileSync('../database/prisma/schema.prisma', 'utf8');
const generator = 'generator client {\n  provider     = "prisma-client"\n  output       = "../src/generated/prisma"\n  moduleFormat = "cjs"\n}';
const out = src.replace(/generator client \{[\s\S]*?\n\}/, generator);
if (out === src) throw new Error('Khong tim thay khoi generator client trong schema database-core');
mkdirSync('prisma', { recursive: true });
writeFileSync('prisma/schema.prisma', '// FILE SINH TU DONG tu database/prisma/schema.prisma - khong sua tay.\n' + out);
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'generate', '--schema', 'prisma/schema.prisma'], { stdio: 'inherit', shell: process.platform === 'win32' });
