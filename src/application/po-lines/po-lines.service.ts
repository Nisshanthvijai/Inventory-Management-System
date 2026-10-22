import { Injectable } from '@nestjs/common';
import { Session } from '../common/session';
import { PoLinesRepository } from './po-lines.repository';
import { MyPoLine } from './po-lines.types';

@Injectable()
export class PoLinesService {
  constructor(private readonly poLines: PoLinesRepository) {}

  /** The caller's own PO lines, with no prices (requestors never see prices). */
  mine(session: Session): Promise<MyPoLine[]> {
    return this.poLines.mine(session);
  }
}
