import { Global, Module } from '@nestjs/common';
import { AuthProvider } from '../../application/auth/auth-provider';
import { RoleReader } from '../../application/common/role-reader';
import { SessionFactory } from '../../application/common/session';
import { REPOSITORIES, REPOSITORY_TOKENS } from './repositories';
import { SupabaseAuthProvider } from './supabase-auth.provider';
import { SupabaseRoleReader } from './supabase-role.reader';
import { SupabaseSessionFactory } from './supabase-session';
import { SupabaseService } from './supabase.service';

/** Global: imported once in AppModule; every module can inject the ports below without importing this. */
@Global()
@Module({
  providers: [
    SupabaseService,
    { provide: SessionFactory, useClass: SupabaseSessionFactory },
    { provide: AuthProvider, useClass: SupabaseAuthProvider },
    { provide: RoleReader, useClass: SupabaseRoleReader },
    ...REPOSITORIES,
  ],
  exports: [SupabaseService, SessionFactory, AuthProvider, RoleReader, ...REPOSITORY_TOKENS],
})
export class SupabaseModule {}
