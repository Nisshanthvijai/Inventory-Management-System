import { Module } from '@nestjs/common';
import { PoLinesController } from './po-lines.controller';
import { PoLinesService } from '../../application/po-lines/po-lines.service';

@Module({
  controllers: [PoLinesController],
  providers: [PoLinesService],
})
export class PoLinesModule {}
