import { Module } from '@nestjs/common';
import { AdminController } from '../interfaces/controllers/admin.controller';
import { AdminService } from '../application/services/admin.service';
import { StellarService } from '../application/services/stellar.service';
import { ContractBindings } from '../infrastructure/stellar/contract-bindings';

@Module({
  controllers: [AdminController],
  providers: [AdminService, StellarService, ContractBindings],
  exports: [AdminService, StellarService],
})
export class AdminModule {}
