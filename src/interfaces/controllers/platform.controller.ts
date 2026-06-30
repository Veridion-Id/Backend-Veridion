import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PlatformService, VerificationView } from '../../application/services/platform.service';

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('get-score/:wallet')
  @ApiOperation({ summary: '[Deprecated] Use GET /pass/:wallet/score', deprecated: true })
  async getScore(@Param('wallet') wallet: string): Promise<{ score?: number; success: boolean; message: string }> {
    return this.platformService.getScore(wallet);
  }

  @Get('get-verifications/:wallet')
  @ApiOperation({ summary: '[Deprecated] Use GET /pass/:wallet/verifications', deprecated: true })
  async getVerifications(@Param('wallet') wallet: string): Promise<{ verifications?: VerificationView[]; success: boolean; message: string }> {
    return this.platformService.getVerifications(wallet);
  }

  @Get('is-human/:wallet')
  @ApiOperation({ summary: '[Deprecated] Use GET /pass/:wallet/is-human', deprecated: true })
  async isHuman(@Param('wallet') wallet: string): Promise<{ isHuman?: boolean; score?: number; success: boolean; message: string }> {
    return this.platformService.isHuman(wallet);
  }

  @Get('is-human-ns/:wallet')
  @ApiOperation({ summary: '[Deprecated] Use GET /pass/:wallet/is-human-ns', deprecated: true })
  async isHumanNS(@Param('wallet') wallet: string): Promise<{ isHuman?: boolean; success: boolean; message: string }> {
    return this.platformService.isHumanNS(wallet);
  }
}
