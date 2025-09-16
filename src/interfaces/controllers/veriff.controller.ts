import { 
  Controller, 
  Post, 
  Body, 
  Headers, 
  HttpCode, 
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { VeriffService } from '../../application/services/veriff.service';
import { 
  VeriffWebhookDto, 
  VeriffWebhookResponse 
} from '../../domain/entities/veriff.entity';

@ApiTags('KYC - Veriff Webhooks')
@Controller('kyc/veriff')
export class VeriffController {
  private readonly logger = new Logger(VeriffController.name);

  constructor(private readonly veriffService: VeriffService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ 
    summary: 'Handle Veriff webhook notifications',
    description: 'Processes webhook notifications from Veriff for KYC decision updates (approve, decline, resubmission)'
  })
  @ApiHeader({
    name: 'X-Veriff-Signature',
    description: 'HMAC signature for webhook verification',
    required: true
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook processed successfully',
    type: Object
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid webhook data or signature'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - invalid signature'
  })
  async handleWebhook(
    @Body() webhookData: VeriffWebhookDto,
    @Headers('x-veriff-signature') signature: string
  ): Promise<VeriffWebhookResponse> {
    this.logger.log(`Received Veriff webhook for session: ${webhookData.sessionToken}`);

    if (!signature) {
      this.logger.warn('Missing X-Veriff-Signature header');
      return {
        success: false,
        message: 'Missing signature header',
        error: 'Unauthorized'
      };
    }

    const result = await this.veriffService.processWebhook(webhookData, signature);
    
    if (result.success) {
      this.logger.log(`Webhook processed successfully for wallet: ${result.wallet}, status: ${result.status}`);
    } else {
      this.logger.error(`Webhook processing failed: ${result.error}`);
    }

    return result;
  }

  @Post('webhook/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test webhook endpoint',
    description: 'Test endpoint for webhook functionality (development only)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Test webhook processed successfully'
  })
  async testWebhook(
    @Body() testData: any
  ): Promise<{ success: boolean; message: string; received: any }> {
    this.logger.log('Test webhook endpoint called');
    
    return {
      success: true,
      message: 'Test webhook received successfully',
      received: testData
    };
  }
}
