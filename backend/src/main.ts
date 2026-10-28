import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { AppModule } from './app.module';
import { ConfigError, loadConfig } from './config/config';
import type { AppConfig } from './config/config';
import { ensureStorage } from './config/storage';
import { DbService } from './db/db.service';
import { IngestService } from './mqtt/ingest.service';
import { MqttService } from './mqtt/mqtt.service';
import { CorsIoAdapter } from './realtime/io.adapter';
import { AnomalyService } from './scheduler/anomaly.service';
import { closeHttpServer, createShutdown } from './shutdown';

async function bootstrap(): Promise<void> {
  const log = new Logger('Khoi dong');
  // Test hop dong chay voi ENV_FILE=.env.test (spec backend 7.2); khong bao gio in gia tri.
  const envFile = process.env.ENV_FILE ?? '.env';
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  let cfg: AppConfig;
  try {
    cfg = loadConfig();
    ensureStorage(cfg.storageRoot);
  } catch (e) {
    log.error(
      e instanceof ConfigError
        ? `Cau hinh sai: ${e.message}`
        : (e as Error).message,
    );
    process.exit(1);
  }
  const app = await NestFactory.create(AppModule.register(cfg));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: cfg.corsOrigins });
  app.useWebSocketAdapter(new CorsIoAdapter(app, cfg.corsOrigins));
  await app.listen(cfg.port, cfg.host);
  log.log(`Lang nghe ${cfg.host}:${cfg.port}, CSDL ${cfg.db.database}`);
  app.get(DbService).start();
  app.get(MqttService).start();
  const stop = createShutdown({
    closeHttp: () => closeHttpServer(app.getHttpServer() as Server),
    stopTimers: () => app.get(AnomalyService).stop(),
    flush: (ms) => app.get(IngestService).flush(ms),
    endMqtt: () => app.get(MqttService).end(),
    closeApp: () => app.close(),
    exit: (code) => process.exit(code),
    log,
  });
  for (const sig of ['SIGINT', 'SIGTERM'])
    process.on(sig, () => {
      stop(sig).catch((e: Error) => {
        log.error(`Tat loi: ${e.message}`);
        process.exit(1);
      });
    });
}
bootstrap().catch((e: Error) => {
  new Logger('Khoi dong').error(e.message);
  process.exit(1);
});
