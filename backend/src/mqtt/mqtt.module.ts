import { Global, Module } from '@nestjs/common';
import { MqttStatus } from '../common/status';
import { MqttService } from './mqtt.service';

@Global()
@Module({
  providers: [MqttService, { provide: MqttStatus, useExisting: MqttService }],
  exports: [MqttService, MqttStatus],
})
export class MqttModule {}
