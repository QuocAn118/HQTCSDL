import { Module } from '@nestjs/common';
import { BirdsController } from './birds.controller';

@Module({ controllers: [BirdsController] })
export class BirdsModule {}
