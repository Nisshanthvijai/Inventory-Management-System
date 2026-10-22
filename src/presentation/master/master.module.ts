import { Module } from '@nestjs/common';
import { MASTER_RESOURCES } from '../../application/master/master.resources';
import { MasterService } from '../../application/master/master.service';
import { masterController } from './master.controller';
import { MASTER_PATHS } from './master.routes';

@Module({
  controllers: MASTER_RESOURCES.map((r) => masterController(r, MASTER_PATHS[r.key])),
  providers: [MasterService],
})
export class MasterModule {}
