import { Global, Module } from '@nestjs/common';
import { ControlCache } from './cache.service';
import { ControlLoopService } from './control-loop.service';

@Global()
@Module({
  providers: [ControlCache, ControlLoopService],
  exports: [ControlCache, ControlLoopService],
})
export class ControlLoopModule {}
