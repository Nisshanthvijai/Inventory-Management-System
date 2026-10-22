import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './infrastructure/supabase/supabase.module';
import { AuthModule } from './presentation/auth/auth.module';
import { CommonModule } from './presentation/common/common.module';
import { GrnModule } from './presentation/grn/grn.module';
import { HealthModule } from './presentation/health/health.module';
import { MasterModule } from './presentation/master/master.module';
import { PoLinesModule } from './presentation/po-lines/po-lines.module';
import { PoModule } from './presentation/po/po.module';
import { PrLinesModule } from './presentation/pr-lines/pr-lines.module';
import { PrModule } from './presentation/pr/pr.module';
import { StockModule } from './presentation/stock/stock.module';
import { UsersModule } from './presentation/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.local' }),
    SupabaseModule,
    CommonModule,
    HealthModule,
    AuthModule,
    StockModule,
    PrModule,
    PrLinesModule,
    PoModule,
    PoLinesModule,
    GrnModule,
    MasterModule,
    UsersModule,
  ],
})
export class AppModule {}
  