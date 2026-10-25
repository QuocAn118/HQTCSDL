import { Global, Module } from '@nestjs/common';
import { DB_HEALTH } from '../common/errors';
import { DbService } from './db.service';
import { SpService } from './sp';

@Global()
@Module({
  providers: [
    DbService,
    SpService,
    { provide: DB_HEALTH, useExisting: DbService },
  ],
  exports: [DbService, SpService, DB_HEALTH],
})
export class DbModule {}
