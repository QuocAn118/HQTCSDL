import { DynamicModule, Module, Type } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import type { AppConfig } from './config/config';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MqttModule } from './mqtt/mqtt.module';
import { ControlLoopModule } from './control-loop/control-loop.module';
import { ControlModule } from './control/control.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UsersModule } from './users/users.module';
import { HousesModule } from './houses/houses.module';
import { ReadingsModule } from './readings/readings.module';
import { BirdsModule } from './birds/birds.module';
import { AlertsModule } from './alerts/alerts.module';
import { DbReadyGuard } from './common/guards/db-ready.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { OwnershipGuard } from './auth/ownership.guard';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { SerializeInterceptor } from './common/serialize.interceptor';
import { validationPipe } from './common/validation';

// Moi task sau them module cua minh vao day.
const FEATURE_MODULES: Type[] = [
  MqttModule,
  ControlLoopModule,
  ControlModule,
  HealthModule,
  RealtimeModule,
  UsersModule,
  HousesModule,
  ReadingsModule,
  BirdsModule,
  AlertsModule,
];

@Module({})
export class AppModule {
  static register(cfg: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(cfg),
        DbModule,
        AuthModule,
        ...FEATURE_MODULES,
      ],
      providers: [
        // Thu tu guard toan cuc = thu tu chay: san sang CSDL -> JWT -> vai tro -> so huu.
        { provide: APP_GUARD, useExisting: DbReadyGuard },
        DbReadyGuard,
        { provide: APP_GUARD, useExisting: JwtAuthGuard },
        { provide: APP_GUARD, useExisting: RolesGuard },
        { provide: APP_GUARD, useExisting: OwnershipGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: SerializeInterceptor },
        { provide: APP_PIPE, useFactory: validationPipe },
      ],
    };
  }
}
