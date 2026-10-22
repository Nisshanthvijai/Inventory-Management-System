import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/api-zod-body';
import { Public } from '../common/public.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { type LoginDto, loginSchema } from '../../application/auth/auth.dto';
import { AuthService } from '../../application/auth/auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in; returns the access_token to use as Bearer token' })
  @ApiZodBody(loginSchema)
  login(@Body(new ZodPipe(loginSchema)) dto: LoginDto) {
    return this.auth.login(dto);
  }
}
