import { Module } from '@nestjs/common';
import { GrnController } from './grn.controller';
import { GrnService } from '../../application/grn/grn.service';

@Module({
  controllers: [GrnController],
  providers: [GrnService],
})
export class GrnModule {}
