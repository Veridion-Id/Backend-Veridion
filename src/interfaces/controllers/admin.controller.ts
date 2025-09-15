import { Controller, Post, Get, Body, Param, ValidationPipe, UsePipes } from '@nestjs/common';
import { AdminService } from '../../application/services/admin.service';
import { 
  BuildRegisterTransactionDto,
  BuildRegisterTransactionResponse,
  SubmitSignedTransactionDto,
  SubmitSignedTransactionResponse,
  BuildCreateVerificationTransactionDto,
  BuildCreateVerificationTransactionResponse,
  ApiKeyResponse
} from '../../domain/entities/admin.entity';
import { ApiKeyResponse as HumanApiKeyResponse } from '../../domain/entities/api-key.entity';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}


  @Post('register/build')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async buildRegisterTransaction(
    @Body() buildDto: BuildRegisterTransactionDto
  ): Promise<BuildRegisterTransactionResponse> {
    return this.adminService.buildRegisterTransaction(buildDto);
  }

  @Post('register/submit')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async submitSignedTransaction(
    @Body() submitDto: SubmitSignedTransactionDto
  ): Promise<SubmitSignedTransactionResponse> {
    return this.adminService.submitSignedTransaction(submitDto);
  }

  @Post('create-verification')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async buildCreateVerificationTransaction(
    @Body() buildDto: BuildCreateVerificationTransactionDto
  ): Promise<BuildCreateVerificationTransactionResponse> {
    return this.adminService.buildCreateVerificationTransaction(buildDto);
  }

  @Get('api-key')
  async generateApiKey(): Promise<ApiKeyResponse> {
    return this.adminService.generateApiKey();
  }

  @Get('api-key-hm/:wallet')
  async generateApiKeyForHuman(@Param('wallet') wallet: string): Promise<HumanApiKeyResponse> {
    return this.adminService.generateApiKeyForHuman(wallet);
  }
}
