import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { AdminService } from '../../application/services/admin.service';
import { PlatformService } from '../../application/services/platform.service';
import { CreatePassDto, UpdateProfileDto, GetPassResponse } from '../../domain/entities/pass.entity';
import { SubmitSignedTransactionDto } from '../../domain/entities/admin.entity';
import { mapPassportError } from '../../domain/entities/passport-error.mapper';

@ApiTags('pass')
@Controller('pass')
export class PassController {
  constructor(
    private readonly adminService: AdminService,
    private readonly platformService: PlatformService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Passport route group status' })
  @ApiResponse({ status: 200, description: 'Pass route group is available' })
  getPassInfo() {
    return {
      group: 'pass',
      status: 'available',
      message: 'Identity endpoints are available',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':wallet')
  @ApiOperation({ summary: 'Get aggregated identity object' })
  @ApiParam({ name: 'wallet', description: 'Stellar wallet address' })
  @ApiResponse({ status: 200, description: 'Identity retrieved' })
  async getPass(@Param('wallet') wallet: string): Promise<GetPassResponse> {
    try {
      const [scoreRes, verRes, statusRes] = await Promise.all([
        this.platformService.getScore(wallet),
        this.platformService.getVerifications(wallet),
        this.adminService.getStatus(wallet),
      ]);

      if (!scoreRes.success || !verRes.success) {
        const errMsg = (scoreRes.message || '') + (verRes.message || '');
        if (errMsg.includes('NotRegistered')) {
          return { registered: false };
        }
        throw mapPassportError(new Error(errMsg));
      }

      return {
        registered: true,
        wallet,
        name: (verRes as any).user?.name || '',
        surnames: (verRes as any).user?.surnames || '',
        score: scoreRes.score,
        verifications: verRes.verifications,
        status: statusRes.status,
      };
    } catch (error) {
      if ((error as Error)?.message?.includes('NotRegistered')) {
        return { registered: false };
      }
      throw mapPassportError(error);
    }
  }

  @Put(':wallet/profile')
  @ApiOperation({ summary: 'Update user profile on-chain' })
  @ApiParam({ name: 'wallet', description: 'Stellar wallet address' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Param('wallet') wallet: string, @Body() dto: UpdateProfileDto) {
    const result = await this.adminService.updateProfile({ ...dto, wallet });
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_GATEWAY);
    }
    return {
      success: true,
      transactionHash: result.transactionHash,
      message: 'Profile updated successfully',
    };
  }

  @Post('create')
  @ApiOperation({ summary: 'Register a wallet identity on-chain (admin-sponsored)' })
  @ApiResponse({ status: 201, description: 'Identity registered on-chain' })
  @ApiResponse({ status: 409, description: 'Wallet already registered' })
  @ApiResponse({ status: 502, description: 'On-chain registration failed (dead-lettered for retry)' })
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

  @Get(':wallet/score')
  @ApiOperation({ summary: 'Get user score' })
  async getScore(@Param('wallet') wallet: string) {
    return this.platformService.getScore(wallet);
  }

  @Get(':wallet/verifications')
  @ApiOperation({ summary: 'Get user verifications' })
  async getVerifications(@Param('wallet') wallet: string) {
    return this.platformService.getVerifications(wallet);
  }

  @Get(':wallet/is-human')
  @ApiOperation({ summary: 'Check if user is human' })
  async isHuman(@Param('wallet') wallet: string) {
    return this.platformService.isHuman(wallet);
  }

  @Get(':wallet/is-human-ns')
  @ApiOperation({ summary: 'Check if user is human (no score)' })
  async isHumanNS(@Param('wallet') wallet: string) {
    return this.platformService.isHumanNS(wallet);
  }
}
