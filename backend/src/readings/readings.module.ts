import { Module } from '@nestjs/common';
import { ReadingsController } from './readings.controller';

@Module({ controllers: [ReadingsController] })
export class ReadingsModule {}
