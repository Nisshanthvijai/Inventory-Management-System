import { Module } from '@nestjs/common';
import { masterController } from './master.controller';
import { MASTER_RESOURCES } from '../../application/master/master.resources';
import { MasterService } from '../../application/master/master.service';

@Module({
  controllers: MASTER_RESOURCES.map(masterController),
  providers: [MasterService],
})
export class MasterModule {}
