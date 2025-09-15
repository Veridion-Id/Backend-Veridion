import { Controller, Get, Param } from '@nestjs/common';
import { PlatformService } from '../../application/services/platform.service';

@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('get-score/:wallet')
  async getScore(@Param('wallet') wallet: string): Promise<{ score?: number; success: boolean; message: string }> {
    return this.platformService.getScore(wallet);
  }
}
