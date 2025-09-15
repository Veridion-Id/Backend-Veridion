import { Controller, Post, Body, ValidationPipe, UsePipes } from '@nestjs/common';
import { AdminService } from '../../application/services/admin.service';
import { 
  BuildRegisterTransactionDto,
  BuildRegisterTransactionResponse,
  SubmitSignedTransactionDto,
  SubmitSignedTransactionResponse
} from '../../domain/entities/admin.entity';

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
}
