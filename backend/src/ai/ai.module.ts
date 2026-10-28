import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { AiController } from './ai.controller';
import { PredatorService } from './predator.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [APP_CONFIG],
      // memoryStorage: moi request giu <= SNAPSHOT_MAX_BYTES trong bo nho; 1 file (spec backend 5.7).
      useFactory: (cfg: AppConfig) => ({
        storage: memoryStorage(),
        limits: { fileSize: cfg.snapshotMaxBytes, files: 1 },
      }),
    }),
  ],
  controllers: [AiController],
  providers: [PredatorService],
})
export class AiModule {}
