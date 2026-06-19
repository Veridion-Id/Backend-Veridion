import {
  Controller,
  Post,
  Param,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from '../../application/services/admin.service';
import { RetryStellarTxResponse } from '../../domain/entities/failed-stellar-tx.entity';

@ApiTags('Admin - Stellar')
@Controller('admin/stellar')
export class StellarAdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('retry/:id')
  @ApiOperation({
    summary: 'Retry a failed Stellar transaction',
    description:
      'Re-enqueues a dead-letter record from stellar_failed_txs and submits it on-chain',
  })
  @ApiParam({ name: 'id', description: 'Dead-letter record ID' })
  @ApiResponse({ status: 200, description: 'Retry submitted successfully' })
  @ApiResponse({ status: 404, description: 'Dead-letter record not found' })
  @ApiResponse({ status: 409, description: 'Record already resolved' })
  async retryFailedTransaction(
    @Param('id') id: string,
  ): Promise<RetryStellarTxResponse> {
    const result = await this.adminService.retryFailedStellarTx(id);

    if (result.error === 'NOT_FOUND') {
      throw new NotFoundException(result.message);
    }

    if (result.error === 'ALREADY_RESOLVED') {
      throw new ConflictException(result.message);
    }

    return result;
  }
}
