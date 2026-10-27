import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module';
import { ConfigError, loadConfig } from './config/config';
import type { AppConfig } from './config/config';
import { ensureStorage } from './config/storage';
import { DbService } from './db/db.service';
import { MqttService } from './mqtt/mqtt.service';
import { CorsIoAdapter } from './realtime/io.adapter';

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
}
void bootstrap();
