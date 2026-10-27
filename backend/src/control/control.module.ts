import { Module } from '@nestjs/common';
import { ControlController } from './control.controller';

@Module({ controllers: [ControlController] })
export class ControlModule {}
