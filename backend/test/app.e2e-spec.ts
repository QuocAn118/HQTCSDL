import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { tmpdir } from 'node:os';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config/config';

const KEY = 'k'.repeat(32);
const env = {
  HOST: '127.0.0.1',
  PORT: '3999',
  CORS_ORIGINS: 'http://localhost:3001',
  DB_SERVER: '127.0.0.1',
  DB_PORT: '1',
  DB_NAME: 'X_Test',
  DB_USER: 'u',
  DB_PASSWORD: 'p',
  MQTT_URL: 'mqtt://127.0.0.1:1',
  MQTT_USERNAME: 'b',
  MQTT_PASSWORD: 'p',
  JWT_SECRET: KEY,
  AI_SERVICE_KEY: KEY,
  SNAPSHOT_MAX_BYTES: '2097152',
  INGEST_RETRY_MAX_ITEMS: '100',
  DEMO_TOOLS: 'false',
  ANOMALY_SCHEDULER: 'off',
};

describe('Khung ung dung (khong CSDL, khong MQTT)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule.register(loadConfig(env, tmpdir()))],
    }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(() => app.close());

  it('route khong ton tai -> 404 dung dinh dang loi', async () => {
    const r = await request(app.getHttpServer() as App).get('/api/khong-co');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: expect.any(String) as string,
        sqlNumber: null,
        details: null,
      },
    });
  });

  it('health khi CSDL chua san sang -> 503 body spec 3.5', async () => {
    const r = await request(app.getHttpServer() as App).get('/api/health');
    expect(r.status).toBe(503);
    expect(r.body).toEqual({
      status: 'error',
      db: 'down',
      mqtt: 'disconnected',
    });
  });

  it('route can CSDL khi chua san sang -> 503 RETRY_LATER truoc ca kiem token', async () => {
    const r = await request(app.getHttpServer() as App)
      .post('/api/auth/login')
      .send({ username: 'owner1', password: 'x' });
    expect(r.status).toBe(503);
    expect((r.body as { error: { code: string } }).error.code).toBe(
      'RETRY_LATER',
    );
  });
});
