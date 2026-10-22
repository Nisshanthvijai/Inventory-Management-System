import { Global, Module } from '@nestjs/common';
import { AuthProvider } from '../../application/auth/auth-provider';
import { DbFactory } from '../../application/common/db-factory';
import { RoleReader } from '../../application/common/role-reader';
import { SupabaseAuthProvider } from './supabase-auth.provider';
import { SupabaseRoleReader } from './supabase-role.reader';
import { SupabaseService } from './supabase.service';

/** Global: imported once in AppModule; every module can inject the ports below without importing this. */
@Global()
@Module({
  providers: [
    SupabaseService,
    { provide: DbFactory, useExisting: SupabaseService },
    { provide: AuthProvider, useClass: SupabaseAuthProvider },
    { provide: RoleReader, useClass: SupabaseRoleReader },
  ],
  exports: [SupabaseService, DbFactory, AuthProvider, RoleReader],
})
export class SupabaseModule {}
