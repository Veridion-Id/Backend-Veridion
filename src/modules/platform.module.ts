import { Module } from '@nestjs/common';
import { PlatformController } from '../interfaces/controllers/platform.controller';
import { PlatformService } from '../application/services/platform.service';
import { StellarService } from '../infrastructure/stellar/stellar.service';
import { StellarTransactionQueue } from '../application/services/stellar-transaction-queue.service';
import { FailedStellarTxRepository } from '../infrastructure/firebase/failed-stellar-tx.repository';
import { FirebaseModule } from './firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [PlatformController],
  providers: [
    PlatformService,
    StellarService,
    StellarTransactionQueue,
    FailedStellarTxRepository,
  ],
  exports: [
    PlatformService,
    StellarService,
    StellarTransactionQueue,
    FailedStellarTxRepository,
  ],
})
export class PlatformModule {}
