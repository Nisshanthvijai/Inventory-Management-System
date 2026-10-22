import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../domain/common/auth-user';
import { PermissionService } from '../common/permission.service';
import { Session } from '../common/session';
import { CreateGrnDto } from './grn.dto';
import { GrnRepository } from './grn.repository';
import { GrnCreated, GrnListItem } from './grn.types';

@Injectable()
export class GrnService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly grns: GrnRepository,
  ) {}

  async create(session: Session, user: AuthUser, dto: CreateGrnDto): Promise<GrnCreated> {
    // The database also requires a requestor to have a line on the PO; requestors cannot read
    // the PO tables, so the quantity and status rules are left to the database too.
    await this.permissions.require(session, user, 'grn.create');
    return this.grns.create(session, dto);
  }

  list(session: Session): Promise<GrnListItem[]> {
    return this.grns.list(session);
  }
}
