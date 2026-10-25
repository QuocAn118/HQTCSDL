import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_CONFIG } from './config';
import type { AppConfig } from './config';

@Global()
@Module({})
export class ConfigModule {
  static forRoot(cfg: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: cfg }],
      exports: [APP_CONFIG],
    };
  }
}
