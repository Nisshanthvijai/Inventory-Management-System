import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../domain/common/auth-user';
import { Conflict, NotFound } from '../../domain/common/errors';
import { assertPoLineAllowed } from '../../domain/po/po-line-rules';
import { assertPoCancellable } from '../../domain/po/po-rules';
import { PermissionService } from '../common/permission.service';
import { Session } from '../common/session';
import { CreatePoDto } from './po.dto';
import { PoRepository } from './po.repository';
import { PoCreated, PoDetail, PoSummary } from './po.types';

@Injectable()
export class PoService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly pos: PoRepository,
  ) {}

  async list(session: Session, user: AuthUser): Promise<PoSummary[]> {
    // RLS alone would give a requestor an empty list; a clear 403 says why.
    await this.permissions.require(session, user, 'po.view');
    return this.pos.list(session);
  }

  async get(session: Session, user: AuthUser, id: string): Promise<PoDetail> {
    await this.permissions.require(session, user, 'po.view');
    const header = await this.pos.findSummary(session, id);
    if (!header) throw new NotFound('PO not found');
    const lines = await this.pos.findLines(session, id);
    return { ...header, lines };
  }

  async cancel(session: Session, user: AuthUser, id: string): Promise<PoSummary | null> {
    await this.permissions.require(session, user, 'po.cancel');

    const po = await this.pos.findForCancel(session, id);
    if (!po) throw new NotFound('PO not found');
    assertPoCancellable(po.po_no, po.status);

    const cancelled = await this.pos.cancelIfOpen(session, id);
    if (!cancelled) throw new Conflict('The PO changed while cancelling; reload it and try again');

    return this.pos.findSummary(session, id);
  }

  async create(session: Session, user: AuthUser, dto: CreatePoDto): Promise<PoCreated> {
    await this.permissions.require(session, user, 'po.create');

    const order = await this.pos.loadOrderContext(
      session,
      dto.lines.map((l) => l.pr_line_id),
    );

    for (const line of dto.lines) {
      const pr = order.prLines.find((p) => p.id === line.pr_line_id);
      if (!pr) throw new NotFound(`PR line not found: ${line.pr_line_id}`);

      const variant = order.variants.find((v) => v.variant_id === pr.variant_id);
      if (!variant) throw new NotFound(`Item variant not found for PR line ${line.pr_line_id}`);

      assertPoLineAllowed({
        name: variant.code,
        prStatus: pr.status,
        approved: Number(pr.approved_quantity),
        unitsPerPurchase: Number(variant.units_per_purchase),
        stockUnit: variant.stock_unit,
        purchaseUnit: variant.purchase_unit,
        alreadyOrderedStock: order.orderedStockByPrLine.get(line.pr_line_id) ?? 0,
        quantity: line.quantity,
      });
    }

    return this.pos.create(session, dto);
  }
}
