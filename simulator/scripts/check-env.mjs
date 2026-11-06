import { existsSync } from 'node:fs';

if (!existsSync(new URL('../.env', import.meta.url))) {
  console.error('Chua co simulator/.env, chep tu .env.example');
  process.exit(1);
}