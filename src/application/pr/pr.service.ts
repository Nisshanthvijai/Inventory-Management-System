import { Injectable } from '@nestjs/common';
import { NotFound } from '../../domain/common/errors';
import { Session } from '../common/session';
import { CreatePrDto } from './pr.dto';
import { PrRepository } from './pr.repository';
import { PrCreated, PrDetail, PrSummary } from './pr.types';

@Injectable()
export class PrService {
  constructor(private readonly prs: PrRepository) {}

  /** Quantity rules and who may create a PR are enforced by the database (create_pr, RLS). */
  create(session: Session, dto: CreatePrDto): Promise<PrCreated> {
    return this.prs.create(session, dto);
  }

  list(session: Session): Promise<PrSummary[]> {
    return this.prs.list(session);
  }

  async get(session: Session, id: string): Promise<PrDetail> {
    const header = await this.prs.findById(session, id);
    // RLS hides PRs the caller may not see, so "not yours" looks the same as "not there".
    if (!header) throw new NotFound('PR not found');
    const lines = await this.prs.findLines(session, id);
    return { ...header, lines };
  }
}
