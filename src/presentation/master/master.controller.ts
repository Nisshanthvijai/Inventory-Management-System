import { Body, Controller, Get, Param, Patch, Post, Type } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session } from '../../application/common/session';
import { MasterResource } from '../../application/master/master.resources';
import { MasterService } from '../../application/master/master.service';
import { AuthUser } from '../../domain/common/auth-user';
import { PERMISSIONS } from '../../domain/common/permissions';
import { ApiZodBody } from '../common/api-zod-body';
import { CurrentSession, CurrentUser } from '../common/current.decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { ZodPipe } from '../common/zod.pipe';

/**
 * A controller factory: called once per resource, it returns a new decorated class.
 * Same routes for every resource:  GET /<path>,  POST /<path>,  PATCH /<path>/:id.
 */
export function masterController(r: MasterResource, path: string): Type<unknown> {
  const readers = r.readPermission ? PERMISSIONS[r.readPermission].roles.join('/') : 'any user';

  @ApiTags('master data')
  @ApiBearerAuth()
  @Controller(path)
  class ResourceController {
    constructor(readonly master: MasterService) {}

    @Get()
    @ApiOperation({ summary: `List ${r.label}s (${readers})` })
    list(@CurrentSession() session: Session, @CurrentUser() user: AuthUser) {
      return this.master.list(session, user, r.key);
    }

    @Post()
    @ApiOperation({ summary: `Create a ${r.label} (admin)` })
    @ApiZodBody(r.create)
    create(
      @CurrentSession() session: Session,
      @CurrentUser() user: AuthUser,
      @Body(new ZodPipe(r.create)) dto: object,
    ) {
      return this.master.create(session, user, r.key, dto);
    }

    @Patch(':id')
    @ApiOperation({ summary: `Update a ${r.label} (admin). Retire with is_active: false.` })
    @ApiZodBody(r.update)
    update(
      @CurrentSession() session: Session,
      @CurrentUser() user: AuthUser,
      @Param('id', new UuidPipe()) id: string,
      @Body(new ZodPipe(r.update)) dto: object,
    ) {
      return this.master.update(session, user, r.key, id, dto);
    }
  }

  // A readable name in Nest's logs, e.g. "BrandsController".
  const name = path.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());
  Object.defineProperty(ResourceController, 'name', { value: `${name}Controller` });
  return ResourceController;
}
