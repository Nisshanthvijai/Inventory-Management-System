import { Body, Controller, Get, Param, Patch, Post, Type } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Db } from '../../application/common/db';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiZodBody } from '../common/api-zod-body';
import { CurrentDb, CurrentUser } from '../common/current.decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { MasterResource } from '../../application/master/master.resources';
import { MasterService } from '../../application/master/master.service';

/**
 * A controller factory: called once per resource, it returns a new decorated class.
 * Same routes for every table:  GET /<path>,  POST /<path>,  PATCH /<path>/:id.
 */
export function masterController(r: MasterResource): Type<unknown> {
  const readers = r.readRole === 'manager' ? 'manager/admin' : 'any user';

  @ApiTags('master data')
  @ApiBearerAuth()
  @Controller(r.path)
  class ResourceController {
    constructor(readonly master: MasterService) {}

    @Get()
    @ApiOperation({ summary: `List ${r.label}s (${readers})` })
    list(@CurrentDb() db: Db, @CurrentUser() user: AuthUser) {
      return this.master.list(db, user, r);
    }

    @Post()
    @ApiOperation({ summary: `Create a ${r.label} (admin)` })
    @ApiZodBody(r.create)
    create(
      @CurrentDb() db: Db,
      @CurrentUser() user: AuthUser,
      @Body(new ZodPipe(r.create)) dto: object,
    ) {
      return this.master.create(db, user, r, dto);
    }

    @Patch(':id')
    @ApiOperation({ summary: `Update a ${r.label} (admin). Retire with is_active: false.` })
    @ApiZodBody(r.update)
    update(
      @CurrentDb() db: Db,
      @CurrentUser() user: AuthUser,
      @Param('id', new UuidPipe()) id: string,
      @Body(new ZodPipe(r.update)) dto: object,
    ) {
      return this.master.update(db, user, r, id, dto);
    }
  }

  // A readable name in Nest's logs, e.g. "BrandsController".
  const name = r.path.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());
  Object.defineProperty(ResourceController, 'name', { value: `${name}Controller` });
  return ResourceController;
}
