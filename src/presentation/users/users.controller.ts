import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session } from '../../application/common/session';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiZodBody } from '../common/api-zod-body';
import { CurrentSession, CurrentUser } from '../common/current.decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { type UpdateUserDto, updateUserSchema } from '../../application/users/users.dto';
import { UsersService } from '../../application/users/users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Declared before any `:id` route, or Nest would read "me" as an id.
  @Get('me')
  @ApiOperation({ summary: 'The signed-in user: profile, role and email' })
  me(@CurrentSession() session: Session, @CurrentUser() user: AuthUser) {
    return this.users.me(session, user);
  }

  @Get()
  @ApiOperation({ summary: 'List users (manager/admin). Users are created in the Supabase dashboard.' })
  list(@CurrentSession() session: Session, @CurrentUser() user: AuthUser) {
    return this.users.list(session, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Rename yourself; admins can rename anyone and change role / is_active (never their own)',
  })
  @ApiZodBody(updateUserSchema)
  update(
    @CurrentSession() session: Session,
    @CurrentUser() user: AuthUser,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodPipe(updateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.users.update(session, user, id, dto);
  }
}
