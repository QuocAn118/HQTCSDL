import { Global, Module } from '@nestjs/common';
import { MqttStatus } from '../common/status';
import { IngestService } from './ingest.service';
import { MqttService } from './mqtt.service';

@Global()
@Module({
  providers: [
    MqttService,
    { provide: MqttStatus, useExisting: MqttService },
    IngestService,
  ],
  exports: [MqttService, MqttStatus, IngestService],
})
export class MqttModule {}
