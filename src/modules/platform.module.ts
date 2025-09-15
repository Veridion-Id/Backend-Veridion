import { Module } from '@nestjs/common';
import { PlatformController } from '../interfaces/controllers/platform.controller';
import { PlatformService } from '../application/services/platform.service';
import { StellarService } from '../application/services/stellar.service';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, StellarService],
  exports: [PlatformService, StellarService],
})
export class PlatformModule {}
