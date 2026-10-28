import { existsSync, readFileSync } from 'node:fs';

export function readEnvFile(path) {
  if (!existsSync(path)) throw new Error(`Thieu ${path}: chep tu ${path}.example roi dien gia tri`);
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return env;
}

// Chi doc .env.test, khong bao gio .env (spec backend 7.2).
export function loadTestEnv(path = '.env.test') {
  const env = readEnvFile(path);
  if (!/^[A-Za-z0-9_]+_Test$/.test(env.DB_NAME ?? '')) throw new Error('DB_NAME trong .env.test phai ket thuc bang _Test');
  const need = ['DB_SERVER', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'PORT', 'MQTT_URL', 'JWT_SECRET', 'AI_SERVICE_KEY', 'DEV_SEED_PASSWORD', 'SIM_MQTT_USERNAME', 'SIM_MQTT_PASSWORD'];
  for (const k of need) if (!env[k]) throw new Error(`Thieu ${k} trong .env.test`);
  return env;
}
