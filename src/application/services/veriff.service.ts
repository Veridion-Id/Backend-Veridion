import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { 
  VeriffWebhookDto, 
  VeriffWebhookResponse, 
  VeriffConfig 
} from '../../domain/entities/veriff.entity';
import { StatusType } from '../../domain/entities/admin.entity';
import {
  VeriffWebhookEvent,
  VeriffWebhookOutcome,
} from '../../domain/entities/veriff-webhook-event.entity';
import { VeriffWebhookEventRepository } from '../../infrastructure/firebase/veriff-webhook-event.repository';
import * as crypto from 'crypto';

const TERMINAL_OUTCOMES: ReadonlySet<VeriffWebhookOutcome> = new Set([
  'PROCESSED',
  'REJECTED_NO_WALLET',
  'REJECTED_STALE',
]);

@Injectable()
export class VeriffService {
  private readonly logger = new Logger(VeriffService.name);
  private readonly veriffConfig: VeriffConfig;
  private readonly maxAgeSeconds: number;
  private readonly clockSkewSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly adminService: AdminService,
    private readonly veriffWebhookEventRepository: VeriffWebhookEventRepository,
  ) {
    this.veriffConfig = {
      webhookSecret: this.configService.get<string>('VERIFF_WEBHOOK_SECRET') || '',
      baseUrl: this.configService.get<string>('VERIFF_BASE_URL') || 'https://stationapi.veriff.com',
      apiKey: this.configService.get<string>('VERIFF_API_KEY') || ''
    };
    this.maxAgeSeconds =
      Number(this.configService.get('VERIFF_WEBHOOK_MAX_AGE_SECONDS')) || 300;
    this.clockSkewSeconds =
      Number(this.configService.get('VERIFF_WEBHOOK_CLOCK_SKEW_SECONDS')) || 60;
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

      const payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(webhookData))
        .digest('hex');

      const existing =
        await this.veriffWebhookEventRepository.findByPayloadHash(payloadHash);

      if (existing && TERMINAL_OUTCOMES.has(existing.outcome)) {
        this.logger.log(
          `Duplicate/replay Veriff webhook served from cache payloadHash=${payloadHash} outcome=${existing.outcome} session=${webhookData.sessionToken}`,
        );
        return existing.responseSnapshot as unknown as VeriffWebhookResponse;
      }

      // Freshness check only for brand-new events (not FAILED_UPDATE reprocessing)
      if (!existing) {
        const staleResponse = this.checkWebhookFreshness(webhookData);
        if (staleResponse) {
          await this.persistAuditEvent(null, {
            payloadHash,
            sessionToken: webhookData.sessionToken,
            veriffEventId: webhookData.id,
            outcome: 'REJECTED_STALE',
            responseSnapshot: staleResponse as unknown as Record<string, unknown>,
            receivedAt: new Date(),
            attempts: 1,
          });
          return staleResponse;
        }
      }

      // Extract wallet address from vendorData
      const wallet = this.extractWalletFromVendorData(webhookData.vendorData);
      if (!wallet) {
        this.logger.warn(`No wallet found in vendorData for session: ${webhookData.sessionToken}`);
        const decision = this.mapVeriffDecisionToStatus(webhookData);
        const response: VeriffWebhookResponse = {
          success: false,
          message: 'No wallet address found in vendor data',
          error: 'Missing wallet address'
        };
        await this.persistAuditEvent(existing, {
          payloadHash,
          sessionToken: webhookData.sessionToken,
          veriffEventId: webhookData.id,
          decision,
          outcome: 'REJECTED_NO_WALLET',
          responseSnapshot: response as unknown as Record<string, unknown>,
          receivedAt: new Date(),
          processedAt: new Date(),
          attempts: 1,
        });
        return response;
      }

      // Map Veriff decision to our status
      const status = this.mapVeriffDecisionToStatus(webhookData);
      
      this.logger.log(`Mapped Veriff decision to status: ${status} for wallet: ${wallet}`);

      // Update user status using admin service
      const adminSourceAccount = this.configService.get<string>('ADMIN_SOURCE_ACCOUNT');
      
      if (!adminSourceAccount) {
        this.logger.warn(`Admin source account not configured. Status update required: ${status} for wallet: ${wallet}`);
        const response: VeriffWebhookResponse = {
          success: true,
          message: `Webhook processed successfully. Status update required: ${status} (admin source account not configured)`,
          status: status,
          wallet: wallet
        };
        await this.persistAuditEvent(existing, {
          payloadHash,
          sessionToken: webhookData.sessionToken,
          veriffEventId: webhookData.id,
          wallet,
          decision: status,
          outcome: 'PROCESSED',
          responseSnapshot: response as unknown as Record<string, unknown>,
          receivedAt: new Date(),
          processedAt: new Date(),
          attempts: 1,
        });
        return response;
      }

      // Update user status
      const updateResult = await this.adminService.updateStatus(
        wallet,
        {
          status: status,
          sourceAccount: adminSourceAccount,
        },
        { sessionToken: webhookData.sessionToken },
      );

      if (!updateResult.success) {
        this.logger.error(`Failed to update status for wallet: ${wallet}, error: ${updateResult.error}`);
        const response: VeriffWebhookResponse = {
          success: false,
          message: `Webhook processed but status update failed: ${updateResult.error}`,
          error: updateResult.error,
          status: status,
          wallet: wallet
        };
        await this.persistAuditEvent(existing, {
          payloadHash,
          sessionToken: webhookData.sessionToken,
          veriffEventId: webhookData.id,
          wallet,
          decision: status,
          outcome: 'FAILED_UPDATE',
          responseSnapshot: response as unknown as Record<string, unknown>,
          receivedAt: new Date(),
          processedAt: new Date(),
          attempts: 1,
        });
        return response;
      }

      this.logger.log(`Status updated successfully for wallet: ${wallet}, status: ${status}`);

      const response: VeriffWebhookResponse = {
        success: true,
        message: `Webhook processed successfully. Status: ${status}`,
        status: status,
        wallet: wallet
      };
      await this.persistAuditEvent(existing, {
        payloadHash,
        sessionToken: webhookData.sessionToken,
        veriffEventId: webhookData.id,
        wallet,
        decision: status,
        outcome: 'PROCESSED',
        responseSnapshot: response as unknown as Record<string, unknown>,
        transactionHash: updateResult.transactionHash,
        receivedAt: new Date(),
        processedAt: new Date(),
        attempts: 1,
      });
      return response;

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
   * Returns a rejection response if the webhook timestamp is outside the acceptable window,
   * or null if the event is fresh enough to process.
   */
  private checkWebhookFreshness(
    webhookData: VeriffWebhookDto,
  ): VeriffWebhookResponse | null {
    const parsedTimestamp = new Date(webhookData.timestamp);
    if (Number.isNaN(parsedTimestamp.getTime())) {
      this.logger.warn(
        `Invalid webhook timestamp for session: ${webhookData.sessionToken}`,
      );
      return {
        success: false,
        message: 'Webhook timestamp is invalid',
        error: 'Stale webhook',
      };
    }

    const ageSeconds = (Date.now() - parsedTimestamp.getTime()) / 1000;
    if (ageSeconds > this.maxAgeSeconds || ageSeconds < -this.clockSkewSeconds) {
      this.logger.warn(
        `Stale webhook rejected for session: ${webhookData.sessionToken}, ageSeconds=${ageSeconds}`,
      );
      return {
        success: false,
        message: 'Webhook timestamp outside acceptable window',
        error: 'Stale webhook',
      };
    }

    return null;
  }

  /**
   * Persist (or update) the webhook audit trail. Firestore failures are logged and
   * swallowed so they never change the response already computed for Veriff.
   */
  private async persistAuditEvent(
    existingFailed: VeriffWebhookEvent | null,
    record: Omit<VeriffWebhookEvent, 'id'>,
  ): Promise<void> {
    try {
      if (existingFailed) {
        await this.veriffWebhookEventRepository.updateOutcome(existingFailed.id, {
          incrementAttempts: true,
          outcome: record.outcome,
          wallet: record.wallet,
          decision: record.decision,
          responseSnapshot: record.responseSnapshot,
          transactionHash: record.transactionHash,
          processedAt: record.processedAt,
        });
      } else {
        await this.veriffWebhookEventRepository.create(record);
      }
    } catch (persistError) {
      this.logger.error(
        `Failed to persist Veriff webhook audit event payloadHash=${record.payloadHash} outcome=${record.outcome}`,
        persistError,
      );
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
