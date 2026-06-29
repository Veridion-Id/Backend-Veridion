import {
  Controller,
  Get,
  Post,
  Body,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AdminService } from '../../application/services/admin.service';
import { CreatePassDto } from '../../domain/entities/pass.entity';
import { SubmitSignedTransactionDto } from '../../domain/entities/admin.entity';

@ApiTags('pass')
@Controller('pass')
export class PassController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'Passport route group status' })
  @ApiResponse({
    status: 200,
    description: 'Pass route group is available',
  })
  getPassInfo() {
    return {
      group: 'pass',
      status: 'available',
      message: 'Identity endpoints will be available in upcoming releases',
      timestamp: new Date().toISOString(),
    }
  }

  @Post('create')
  @ApiOperation({ summary: 'Register a wallet identity on-chain (admin-sponsored)' })
  @ApiResponse({ status: 201, description: 'Identity registered on-chain' })
  @ApiResponse({ status: 409, description: 'Wallet already registered' })
  @ApiResponse({
    status: 502,
    description: 'On-chain registration failed (dead-lettered for retry)',
  })
  @ApiBody({ type: CreatePassDto })
  async createPass(@Body() dto: CreatePassDto) {
    const result = await this.adminService.createPass(dto);

    if (result.alreadyRegistered) {
      throw new ConflictException(result.message);
    }

    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_GATEWAY);
    }

    return result;
  }

  @Post('create/build')
  @ApiOperation({ summary: 'Build an unsigned register transaction (client-signed)' })
  @ApiResponse({ status: 201 })
  @ApiBody({ type: CreatePassDto })
  async buildCreatePass(@Body() dto: CreatePassDto) {
    return this.adminService.buildRegisterTransaction(dto);
  }

  @Post('create/submit')
  @ApiOperation({ summary: 'Submit a signed register transaction' })
  @ApiResponse({ status: 201 })
  @ApiBody({ type: SubmitSignedTransactionDto })
  async submitCreatePass(@Body() dto: SubmitSignedTransactionDto) {
    return this.adminService.submitSignedTransaction(dto);
  }
}
