import { Injectable } from '@nestjs/common';
import { Unauthenticated } from '../common/errors';
import { AuthProvider } from './auth-provider';
import { LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly provider: AuthProvider) {}

  async login(dto: LoginDto) {
    const result = await this.provider.signIn(dto.email, dto.password);
    if (!result) throw new Unauthenticated('Invalid email or password');
    return result;
  }
}
