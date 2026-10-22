import { Injectable } from '@nestjs/common';
import { ApiError } from '../../domain/common/api-error';
import { AuthProvider } from './auth-provider';
import { LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly provider: AuthProvider) {}

  async login(dto: LoginDto) {
    const result = await this.provider.signIn(dto.email, dto.password);
    if (!result) throw new ApiError(401, 'Invalid email or password');
    return result;
  }
}
