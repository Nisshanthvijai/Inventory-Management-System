import { Module } from '@nestjs/common';
import { PrLinesController } from './pr-lines.controller';
import { PrLinesService } from '../../application/pr-lines/pr-lines.service';

@Module({
  controllers: [PrLinesController],
  providers: [PrLinesService],
})
export class PrLinesModule {}
