import { ConfigError, loadConfig } from './config';

const KEY = 'k'.repeat(32);
const base: NodeJS.ProcessEnv = {
  HOST: '0.0.0.0',
  PORT: '3000',
  CORS_ORIGINS: 'http://localhost:3001, http://192.168.1.5:3001',
  DB_SERVER: 'localhost',
  DB_PORT: '1433',
  DB_NAME: 'SwiftletCare_Dev',
  DB_USER: 'swiftlet_dev',
  DB_PASSWORD: 'p@ss;word{}',
  MQTT_URL: 'mqtt://localhost:1883',
  MQTT_USERNAME: 'backend',
  MQTT_PASSWORD: 'mq',
  JWT_SECRET: KEY,
  AI_SERVICE_KEY: KEY,
  SNAPSHOT_MAX_BYTES: '2097152',
  INGEST_RETRY_MAX_ITEMS: '10000',
  DEMO_TOOLS: 'false',
  ANOMALY_SCHEDULER: 'on',
};

function errorOf(env: NodeJS.ProcessEnv): string {
  try {
    loadConfig(env, 'C:/x/storage');
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return (e as Error).message;
  }
  throw new Error('mong ConfigError');
}

describe('loadConfig', () => {
  it('doc dung moi bien, tach CORS_ORIGINS, giu nguyen mat khau co ky tu dac biet', () => {
    const c = loadConfig(base, 'C:/x/storage');
    expect(c.port).toBe(3000);
    expect(c.corsOrigins).toEqual([
      'http://localhost:3001',
      'http://192.168.1.5:3001',
    ]);
    expect(c.db).toEqual({
      server: 'localhost',
      port: 1433,
      database: 'SwiftletCare_Dev',
      user: 'swiftlet_dev',
      password: 'p@ss;word{}',
    });
    expect(c.demoTools).toBe(false);
    expect(c.anomalyScheduler).toBe(true);
    expect(c.snapshotMaxBytes).toBe(2097152);
    expect(c.storageRoot).toBe('C:/x/storage');
  });

  it('bao moi bien sai cung luc, chi neu TEN bien, khong in gia tri', () => {
    const msg = errorOf({
      ...base,
      JWT_SECRET: 'ngan-qua',
      ANOMALY_SCHEDULER: 'maybe',
      DEMO_TOOLS: 'yes',
      PORT: '-1',
      DB_PASSWORD: '',
    });
    expect(msg).toContain('JWT_SECRET');
    expect(msg).toContain('ANOMALY_SCHEDULER');
    expect(msg).toContain('DEMO_TOOLS');
    expect(msg).toContain('PORT');
    expect(msg).toContain('DB_PASSWORD');
    expect(msg).not.toContain('ngan-qua');
    expect(msg).not.toContain('maybe');
  });

  it('AI_SERVICE_KEY < 32 ky tu -> loi; so khong phai so nguyen duong -> loi', () => {
    expect(errorOf({ ...base, AI_SERVICE_KEY: 'x' })).toContain(
      'AI_SERVICE_KEY',
    );
    expect(errorOf({ ...base, SNAPSHOT_MAX_BYTES: '2MB' })).toContain(
      'SNAPSHOT_MAX_BYTES',
    );
    expect(errorOf({ ...base, INGEST_RETRY_MAX_ITEMS: '0' })).toContain(
      'INGEST_RETRY_MAX_ITEMS',
    );
  });

  it('thieu bien bat buoc -> loi neu ten', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { MQTT_URL, ...rest } = base;
    expect(errorOf(rest)).toContain('MQTT_URL');
  });
});
