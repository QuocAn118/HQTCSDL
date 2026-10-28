import { Global, Module } from '@nestjs/common';
import { AnomalyService } from './anomaly.service';

@Global()
@Module({ providers: [AnomalyService], exports: [AnomalyService] })
export class SchedulerModule {}
