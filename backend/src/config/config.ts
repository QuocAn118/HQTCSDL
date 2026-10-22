import { join } from 'node:path';

export const APP_CONFIG = 'APP_CONFIG';

export interface AppConfig {
  host: string;
  port: number;
  corsOrigins: string[];
  db: {
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  mqtt: { url: string; username: string; password: string };
  jwtSecret: string;
  aiServiceKey: string;
  snapshotMaxBytes: number;
  ingestRetryMaxItems: number;
  demoTools: boolean;
  anomalyScheduler: boolean;
  storageRoot: string;
}

export class ConfigError extends Error {}

// Spec backend 2.3: loi chi neu TEN bien va ly do, khong bao gio in gia tri.
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  storageRoot = join(__dirname, '..', '..', 'storage'),
): AppConfig {
  const problems: string[] = [];
  const str = (name: string): string => {
    const v = env[name]?.trim();
    if (!v) problems.push(`${name}: thieu hoac rong`);
    return v ?? '';
  };
  const int = (name: string): number => {
    const raw = str(name);
    const n = Number(raw);
    if (raw && !(Number.isInteger(n) && n > 0))
      problems.push(`${name}: phai la so nguyen duong`);
    return n;
  };
  const oneOf = <T>(name: string, map: Record<string, T>): T => {
    const raw = str(name);
    if (raw && !(raw in map))
      problems.push(`${name}: chi nhan ${Object.keys(map).join(' | ')}`);
    return map[raw];
  };
  const secret = (name: string): string => {
    const v = str(name);
    if (v && v.length < 32) problems.push(`${name}: can it nhat 32 ky tu`);
    return v;
  };

  const cfg: AppConfig = {
    host: str('HOST'),
    port: int('PORT'),
    corsOrigins: str('CORS_ORIGINS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    db: {
      server: str('DB_SERVER'),
      port: int('DB_PORT'),
      database: str('DB_NAME'),
      user: str('DB_USER'),
      password: env.DB_PASSWORD ?? '',
    },
    mqtt: {
      url: str('MQTT_URL'),
      username: str('MQTT_USERNAME'),
      password: str('MQTT_PASSWORD'),
    },
    jwtSecret: secret('JWT_SECRET'),
    aiServiceKey: secret('AI_SERVICE_KEY'),
    snapshotMaxBytes: int('SNAPSHOT_MAX_BYTES'),
    ingestRetryMaxItems: int('INGEST_RETRY_MAX_ITEMS'),
    demoTools: oneOf('DEMO_TOOLS', { true: true, false: false }),
    anomalyScheduler: oneOf('ANOMALY_SCHEDULER', { on: true, off: false }),
    storageRoot,
  };
  // Mat khau giu nguyen (khong trim): co the co khoang trang/ky tu dac biet; chi kiem khong rong.
  if (!cfg.db.password) problems.push('DB_PASSWORD: thieu hoac rong');
  if (problems.length) throw new ConfigError(problems.join('; '));
  return cfg;
}
