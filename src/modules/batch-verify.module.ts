import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule } from './platform.module';
import { BatchVerifyController } from '../interfaces/controllers/batch-verify.controller';
import { BatchVerifyService } from '../application/services/batch-verify.service';
import { IdentityReadAdapter } from '../infrastructure/stellar/identity-read.adapter';
import { IntegratorApiKeyGuard } from '../interfaces/guards/integrator-api-key.guard';
import { IDENTITY_READ_PORT } from '../domain/ports/identity-read.port';

@Module({
  imports: [
    ConfigModule, // ensures ConfigService is available (already global, but explicit for clarity)
    PlatformModule, // re-uses the exported StellarService — no duplicate Soroban client
  ],
  controllers: [BatchVerifyController],
  providers: [
    BatchVerifyService,
    IdentityReadAdapter,
    IntegratorApiKeyGuard,
    {
      provide: IDENTITY_READ_PORT,
      useExisting: IdentityReadAdapter,
    },
  ],
})
export class BatchVerifyModule {}
