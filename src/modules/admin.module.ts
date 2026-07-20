import { Module } from '@nestjs/common';
import { AdminController } from '../interfaces/controllers/admin.controller';
import { StellarAdminController } from '../interfaces/controllers/stellar-admin.controller';
import { AdminService } from '../application/services/admin.service';
import { PlatformModule } from './platform.module';
import { UserModule } from './user.module';

@Module({
  imports: [PlatformModule, UserModule],
  controllers: [AdminController, StellarAdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
