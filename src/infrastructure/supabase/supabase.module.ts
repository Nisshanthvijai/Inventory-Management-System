import { Global, Module } from '@nestjs/common';
import { AuthProvider } from '../../application/auth/auth-provider';
import { DbFactory } from '../../application/common/db-factory';
import { SupabaseAuthProvider } from './supabase-auth.provider';
import { SupabaseService } from './supabase.service';

/** Global: imported once in AppModule; every module can inject DbFactory and AuthProvider without importing this. */
@Global()
@Module({
  providers: [
    SupabaseService,
    { provide: DbFactory, useExisting: SupabaseService },
    { provide: AuthProvider, useClass: SupabaseAuthProvider },
  ],
  exports: [SupabaseService, DbFactory, AuthProvider],
})
export class SupabaseModule {}
