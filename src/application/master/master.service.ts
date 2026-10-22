import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../domain/common/auth-user';
import { NotFound } from '../../domain/common/errors';
import { PermissionService } from '../common/permission.service';
import { Session } from '../common/session';
import { MasterRepository } from './master.repository';
import { MasterKey, masterResource } from './master.resources';

/** Generic list / create / update for every master-data resource. */
@Injectable()
export class MasterService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly master: MasterRepository,
  ) {}

  async list(session: Session, user: AuthUser, key: MasterKey): Promise<unknown[]> {
    const r = masterResource(key);
    if (r.readPermission) await this.permissions.require(session, user, r.readPermission, r.label);
    return this.master.list(session, key);
  }

  async create(session: Session, user: AuthUser, key: MasterKey, dto: object): Promise<unknown> {
    await this.permissions.require(session, user, 'master.write', masterResource(key).label);
    return this.master.create(session, key, dto);
  }

  async update(session: Session, user: AuthUser, key: MasterKey, id: string, dto: object): Promise<unknown> {
    const { label } = masterResource(key);
    await this.permissions.require(session, user, 'master.write', label);
    const row = await this.master.update(session, key, id, dto);
    if (row === null) throw new NotFound(`${capitalise(label)} not found`);
    return row;
  }
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
