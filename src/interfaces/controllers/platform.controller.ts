import { Controller, Get, Param } from '@nestjs/common';
import { PlatformService } from '../../application/services/platform.service';
import { Verification } from '../../infrastructure/stellar/contract-bindings';

@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('get-score/:wallet')
  async getScore(@Param('wallet') wallet: string): Promise<{ score?: number; success: boolean; message: string }> {
    return this.platformService.getScore(wallet);
  }

  @Get('get-verifications/:wallet')
  async getVerifications(@Param('wallet') wallet: string): Promise<{ verifications?: Verification[]; success: boolean; message: string }> {
    return this.platformService.getVerifications(wallet);
  }

  @Get('is-human/:wallet')
  async isHuman(@Param('wallet') wallet: string): Promise<{ isHuman?: boolean; score?: number; success: boolean; message: string }> {
    return this.platformService.isHuman(wallet);
  }
}
