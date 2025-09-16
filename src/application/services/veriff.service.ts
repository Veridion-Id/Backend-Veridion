import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { 
  VeriffWebhookDto, 
  VeriffWebhookResponse, 
  VeriffDecision,
  VeriffConfig 
} from '../../domain/entities/veriff.entity';
import { StatusType } from '../../domain/entities/admin.entity';
import * as crypto from 'crypto';

@Injectable()
export class VeriffService {
  private readonly logger = new Logger(VeriffService.name);
  private readonly veriffConfig: VeriffConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly adminService: AdminService
  ) {
    this.veriffConfig = {
      webhookSecret: this.configService.get<string>('VERIFF_WEBHOOK_SECRET') || '',
      baseUrl: this.configService.get<string>('VERIFF_BASE_URL') || 'https://stationapi.veriff.com',
      apiKey: this.configService.get<string>('VERIFF_API_KEY') || ''
    };
  }

  /**
   * Process Veriff webhook and update user status
   * Maps Veriff decisions to our status system
   */
  async processWebhook(
    webhookData: VeriffWebhookDto,
    signature: string
  ): Promise<VeriffWebhookResponse> {
    try {
      this.logger.log(`Processing Veriff webhook for session: ${webhookData.sessionToken}`);

      // Verify webhook signature
      if (!this.verifyWebhookSignature(webhookData, signature)) {
        this.logger.warn(`Invalid webhook signature for session: ${webhookData.sessionToken}`);
        return {
          success: false,
          message: 'Invalid webhook signature',
          error: 'Unauthorized'
        };
      }

      // Extract wallet address from vendorData
      const wallet = this.extractWalletFromVendorData(webhookData.vendorData);
      if (!wallet) {
        this.logger.warn(`No wallet found in vendorData for session: ${webhookData.sessionToken}`);
        return {
          success: false,
          message: 'No wallet address found in vendor data',
          error: 'Missing wallet address'
        };
      }

      // Map Veriff decision to our status
      const status = this.mapVeriffDecisionToStatus(webhookData);
      
      this.logger.log(`Mapped Veriff decision to status: ${status} for wallet: ${wallet}`);

      // Update user status using admin service
      const adminSourceAccount = this.configService.get<string>('ADMIN_SOURCE_ACCOUNT');
      
      if (!adminSourceAccount) {
        this.logger.warn(`Admin source account not configured. Status update required: ${status} for wallet: ${wallet}`);
        return {
          success: true,
          message: `Webhook processed successfully. Status update required: ${status} (admin source account not configured)`,
          status: status,
          wallet: wallet
        };
      }

      // Update user status
      const updateResult = await this.adminService.updateStatus(wallet, {
        status: status,
        sourceAccount: adminSourceAccount
      });

      if (!updateResult.success) {
        this.logger.error(`Failed to update status for wallet: ${wallet}, error: ${updateResult.error}`);
        return {
          success: false,
          message: `Webhook processed but status update failed: ${updateResult.error}`,
          error: updateResult.error,
          status: status,
          wallet: wallet
        };
      }

      this.logger.log(`Status updated successfully for wallet: ${wallet}, status: ${status}`);

      return {
        success: true,
        message: `Webhook processed successfully. Status: ${status}`,
        status: status,
        wallet: wallet
      };

    } catch (error) {
      this.logger.error(`Failed to process Veriff webhook for session: ${webhookData.sessionToken}`, error);
      return {
        success: false,
        message: `Failed to process webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify webhook signature using HMAC
   */
  private verifyWebhookSignature(webhookData: VeriffWebhookDto, signature: string): boolean {
    try {
      if (!this.veriffConfig.webhookSecret) {
        this.logger.warn('Veriff webhook secret not configured, skipping signature verification');
        return true; // Allow in development if secret not configured
      }

      // Create payload string (Veriff typically sends JSON)
      const payload = JSON.stringify(webhookData);
      
      // Calculate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', this.veriffConfig.webhookSecret)
        .update(payload)
        .digest('hex');

      // Compare signatures
      const providedSignature = signature.replace('sha256=', '');
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );

      return isValid;

    } catch (error) {
      this.logger.error('Failed to verify webhook signature', error);
      return false;
    }
  }

  /**
   * Extract wallet address from vendorData
   * Assumes vendorData contains the wallet address
   */
  private extractWalletFromVendorData(vendorData: string): string | null {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(vendorData);
      if (parsed.wallet) {
        return parsed.wallet;
      }
    } catch {
      // If not JSON, assume vendorData is the wallet address directly
      if (this.isValidWalletAddress(vendorData)) {
        return vendorData;
      }
    }

    return null;
  }

  /**
   * Validate wallet address format (Stellar format)
   */
  private isValidWalletAddress(address: string): boolean {
    // Basic Stellar address validation (56 characters, starts with G)
    return /^G[A-Z0-9]{55}$/.test(address);
  }

  /**
   * Map Veriff decision to our status system
   */
  private mapVeriffDecisionToStatus(webhookData: VeriffWebhookDto): StatusType {
    const status = webhookData.status.toUpperCase();
    const code = webhookData.code.toUpperCase();

    // Map Veriff statuses to our status system
    switch (status) {
      case 'APPROVED':
        return 'APPROVED';
      
      case 'DECLINED':
      case 'REJECTED':
        return 'REJECTED';
      
      case 'RESUBMISSION_REQUESTED':
      case 'PENDING':
        return 'PENDING';
      
      default:
        this.logger.warn(`Unknown Veriff status: ${status}, defaulting to PENDING`);
        return 'PENDING';
    }
  }

  /**
   * Get Veriff configuration
   */
  getConfig(): Partial<VeriffConfig> {
    return {
      baseUrl: this.veriffConfig.baseUrl,
      // Don't expose sensitive data
    };
  }
}
