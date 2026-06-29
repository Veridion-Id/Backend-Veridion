import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BatchVerifyService } from '../../application/services/batch-verify.service';
import {
  BatchVerifyRequestDto,
  BatchVerifyResponseDto,
} from '../dto/batch-verify.dto';
import { IntegratorApiKeyGuard } from '../guards/integrator-api-key.guard';

@ApiTags('pass')
@Controller('pass/verify')
export class BatchVerifyController {
  constructor(private readonly batchVerifyService: BatchVerifyService) {}

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(IntegratorApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Batch wallet verification',
    description:
      'Verify up to BATCH_VERIFY_MAX_WALLETS (default 25) Stellar wallets in a single request. ' +
      'Invalid address formats are skipped and counted. Unregistered wallets return registered: false.',
  })
  @ApiResponse({
    status: 200,
    description: 'Per-wallet verification results.',
    type: BatchVerifyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Empty wallets array or batch size exceeds the maximum.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid Authorization: Bearer <INTEGRATOR_API_KEY> header.',
  })
  @ApiResponse({
    status: 422,
    description: 'All provided wallet addresses are invalid; no wallets were processed.',
  })
  async verifyBatch(
    @Body() dto: BatchVerifyRequestDto,
  ): Promise<BatchVerifyResponseDto> {
    return this.batchVerifyService.verifyBatch(dto.wallets);
  }
}
