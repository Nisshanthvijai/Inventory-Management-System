import { Global, Module } from '@nestjs/common';
import { PermissionService } from '../../application/common/permission.service';

/** Global: application services shared by every feature module (registered once in AppModule). */
@Global()
@Module({
  providers: [PermissionService],
  exports: [PermissionService],
})
export class CommonModule {}
