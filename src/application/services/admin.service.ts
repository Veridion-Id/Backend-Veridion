import { Injectable, Logger } from '@nestjs/common';
import { StellarService, StatusType as StellarStatusType, StatusUpdateResponse, StatusResponse } from './stellar.service';
import { PlatformService } from './platform.service';
import { 
  BuildRegisterTransactionDto,
  BuildRegisterTransactionResponse,
  SubmitSignedTransactionDto,
  SubmitSignedTransactionResponse,
  BuildCreateVerificationTransactionDto,
  BuildCreateVerificationTransactionResponse,
  ApiKeyResponse,
  StatusType,
  GetStatusResponse,
  UpdateStatusDto,
  UpdateStatusResponse
} from '../../domain/entities/admin.entity';
import { ApiKeyRequestDto, ApiKeyResponse as HumanApiKeyResponse } from '../../domain/entities/api-key.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly stellarService: StellarService,
    private readonly platformService: PlatformService
  ) {}


  /**
   * Build a transaction for user registration (BUILD phase)
   * Creates an unsigned XDR transaction that the client can sign
   */
  async buildRegisterTransaction(
    buildDto: BuildRegisterTransactionDto
  ): Promise<BuildRegisterTransactionResponse> {
    try {
      this.logger.log(`Building register transaction for wallet: ${buildDto.wallet}, source account: ${buildDto.sourceAccount}`);

      // Call the stellar service to build the transaction
      const result = await this.stellarService.buildRegisterTransaction(
        buildDto.wallet,
        buildDto.name,
        buildDto.surnames,
        buildDto.sourceAccount
      );
      this.logger.log(buildDto);
      if (result.success) {
        this.logger.log(`Transaction built successfully for wallet: ${buildDto.wallet}`);
        return {
          success: true,
          message: 'Transaction built successfully',
          xdr: result.xdr,
          sourceAccount: result.sourceAccount,
          sequence: result.sequence,
          fee: result.fee,
          timebounds: result.timebounds,
          footprint: result.footprint
        };
      } else {
        return {
          success: false,
          message: `Failed to build transaction: ${result.error}`,
          error: result.error
        };
      }

    } catch (error) {
      this.logger.error(`Failed to build register transaction for wallet: ${buildDto.wallet}`, error);
      return {
        success: false,
        message: `Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Submit a signed transaction (SUBMIT phase)
   * Submits the signed XDR to the network
   */
  async submitSignedTransaction(
    submitDto: SubmitSignedTransactionDto
  ): Promise<SubmitSignedTransactionResponse> {
    try {
      this.logger.log('Submitting signed transaction');

      // Call the stellar service to submit the transaction
      const result = await this.stellarService.submitSignedTransaction(submitDto.signedXdr);

      if (result.success) {
        this.logger.log(`Transaction submitted successfully. Hash: ${result.transactionHash}`);
        return {
          success: true,
          message: 'Transaction submitted successfully',
          transactionHash: result.transactionHash,
          resultMeta: result.resultMeta
        };
      } else {
        // Provide helpful error message for sequence issues
        const message = result.error?.includes('sequence') && result.error?.includes('outdated')
          ? `Failed to submit transaction: ${result.error}. Please call the build endpoint again to get a new transaction with the current sequence number.`
          : `Failed to submit transaction: ${result.error}`;
        
        return {
          success: false,
          message: message,
          error: result.error,
          rebuiltXdr: result.rebuiltXdr // Pass through the rebuilt XDR if available
        };
      }

    } catch (error) {
      this.logger.error('Failed to submit signed transaction', error);
      return {
        success: false,
        message: `Failed to submit transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build a transaction for creating verification (BUILD phase)
   * Creates an unsigned XDR transaction that the client can sign
   */
  async buildCreateVerificationTransaction(
    buildDto: BuildCreateVerificationTransactionDto
  ): Promise<BuildCreateVerificationTransactionResponse> {
    try {
      this.logger.log(`Building create verification transaction for wallet: ${buildDto.wallet}, source account: ${buildDto.sourceAccount}`);

      // Create a verification object compatible with the new interface
      const verification = {
        issuer: 'admin', // Default issuer for admin-created verifications
        points: buildDto.points,
        timestamp: BigInt(Date.now()),
        vtype: this.convertToVerificationType(buildDto.verificationType)
      };

      // Call the stellar service to build the transaction
      const result = await this.stellarService.buildCreateVerificationTransaction(
        buildDto.wallet,
        verification,
        buildDto.sourceAccount
      );

      if (result.success) {
        this.logger.log(`Transaction built successfully for wallet: ${buildDto.wallet}`);
        return {
          success: true,
          message: 'Transaction built successfully',
          xdr: result.xdr,
          sourceAccount: result.sourceAccount,
          sequence: result.sequence,
          fee: result.fee,
          timebounds: result.timebounds,
          footprint: result.footprint
        };
      } else {
        return {
          success: false,
          message: `Failed to build transaction: ${result.error}`,
          error: result.error
        };
      }

    } catch (error) {
      this.logger.error(`Failed to build create verification transaction for wallet: ${buildDto.wallet}`, error);
      return {
        success: false,
        message: `Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate a new API key for hackathon participants
   * Returns a simple API key that can be used for authentication
   */
  async generateApiKey(): Promise<ApiKeyResponse> {
    try {
      this.logger.log('Generating new API key for hackathon participant');

      // Generate a simple API key using crypto
      const crypto = require('crypto');
      const apiKey = `veridion_${crypto.randomBytes(32).toString('hex')}`;

      this.logger.log('API key generated successfully');
      return {
        success: true,
        message: 'API key generated successfully',
        apiKey: apiKey
      };

    } catch (error) {
      this.logger.error('Failed to generate API key', error);
      return {
        success: false,
        message: `Failed to generate API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate an API key for human-verified users
   * Checks if the user is human via their wallet address and score
   */
  async generateApiKeyForHuman(wallet: string): Promise<HumanApiKeyResponse> {
    try {
      this.logger.log(`Generating API key for human-verified wallet: ${wallet}`);

      // Check if the user is human verified
      const humanCheck = await this.platformService.isHuman(wallet);

      if (!humanCheck.success) {
        this.logger.warn(`Human verification failed for wallet: ${wallet}, error: ${humanCheck.message}`);
        return {
          success: false,
          message: `Human verification failed: ${humanCheck.message}`,
          error: humanCheck.message
        };
      }

      if (!humanCheck.isHuman) {
        this.logger.warn(`User is not human verified for wallet: ${wallet}, score: ${humanCheck.score}`);
        return {
          success: false,
          message: 'User is not human verified. API key generation denied.',
          isHuman: false,
          score: humanCheck.score,
          error: 'User does not meet human verification requirements'
        };
      }

      // Generate API key for verified human user
      const crypto = require('crypto');
      const apiKey = `veridion_hm_${crypto.randomBytes(32).toString('hex')}`;

      this.logger.log(`API key generated successfully for human-verified wallet: ${wallet}, score: ${humanCheck.score}`);
      return {
        success: true,
        message: 'API key generated successfully for human-verified user',
        apiKey: apiKey,
        isHuman: true,
        score: humanCheck.score
      };

    } catch (error) {
      this.logger.error(`Failed to generate API key for wallet: ${wallet}`, error);
      return {
        success: false,
        message: `Failed to generate API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert string verification type to VerificationType enum
   */
  private convertToVerificationType(type: string): any {
    switch (type.toLowerCase()) {
      case 'over18':
        return { tag: 'Over18', values: undefined };
      case 'twitter':
        return { tag: 'Twitter', values: undefined };
      case 'github':
        return { tag: 'GitHub', values: undefined };
      default:
        // For custom types, wrap in Custom
        return { tag: 'Custom', values: [type] };
    }
  }

  /**
   * Get the current sequence number for an account
   */
  async getAccountSequence(accountId: string): Promise<{ sequence: string; success: boolean; error?: string }> {
    return this.stellarService.getAccountSequence(accountId);
  }


  /**
   * Build a client-based register transaction (BUILD phase)
   * Uses the createClient method for building transactions
   */
  async buildClientRegisterTransaction(
    buildDto: BuildRegisterTransactionDto
  ): Promise<BuildRegisterTransactionResponse> {
    try {
      this.logger.log(`Building client register transaction for wallet: ${buildDto.wallet}`);

      // Call the stellar service to build the transaction using the client method
      const result = await this.stellarService.createClientAndBuildRegisterTransaction(
        buildDto.wallet,
        buildDto.name,
        buildDto.surnames
      );

      if (result.success) {
        this.logger.log(`Client transaction built successfully for wallet: ${buildDto.wallet}`);
        return {
          success: true,
          message: 'Client transaction built successfully',
          xdr: result.xdr,
          sourceAccount: result.sourceAccount,
          sequence: result.sequence,
          fee: result.fee,
          timebounds: result.timebounds,
          footprint: result.footprint,
          authEntries: result.authEntries
        };
      } else {
        this.logger.error(`Failed to build client transaction for wallet: ${buildDto.wallet}, error: ${result.error}`);
        return {
          success: false,
          message: `Failed to build client transaction: ${result.error}`,
          error: result.error
        };
      }

    } catch (error) {
      this.logger.error(`Failed to build client register transaction for wallet: ${buildDto.wallet}`, error);
      return {
        success: false,
        message: `Failed to build client transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user status from verifications
   * Searches through user verifications to find Custom verification with status
   */
  async getStatus(wallet: string): Promise<GetStatusResponse> {
    try {
      this.logger.log(`Getting status for wallet: ${wallet}`);

      // Validate wallet address format
      if (!this.stellarService.validateWalletAddress(wallet)) {
        return {
          success: false,
          message: 'Invalid wallet address format',
          error: 'Invalid wallet address format'
        };
      }

      // Get all verifications for the user
      const verifications = await this.stellarService.getVerifications(wallet);

      // Look for Custom verification with status (most recent one)
      let latestStatus: StatusType | null = null;
      let latestTimestamp = BigInt(0);

      for (const verification of verifications) {
        if (verification.vtype.tag === 'Custom' && verification.vtype.values[0]) {
          const customValue = verification.vtype.values[0];
          // Check if it's a status verification
          if (['APPROVED', 'PENDING', 'REJECTED'].includes(customValue)) {
            const status = customValue as StatusType;
            if (verification.timestamp > latestTimestamp) {
              latestStatus = status;
              latestTimestamp = verification.timestamp;
            }
          }
        }
      }

      if (latestStatus) {
        this.logger.log(`Status found for wallet: ${wallet}, status: ${latestStatus}`);
        return {
          success: true,
          status: latestStatus,
          message: `Status retrieved successfully: ${latestStatus}`
        };
      } else {
        this.logger.log(`No status found for wallet: ${wallet}, defaulting to PENDING`);
        return {
          success: true,
          status: 'PENDING',
          message: 'No status found, defaulting to PENDING'
        };
      }

    } catch (error) {
      this.logger.error(`Failed to get status for wallet: ${wallet}`, error);
      return {
        success: false,
        message: `Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update user status by creating a Custom verification
   * Creates a verification with Custom type containing the status
   */
  async updateStatus(wallet: string, updateDto: UpdateStatusDto): Promise<UpdateStatusResponse> {
    try {
      this.logger.log(`Updating status for wallet: ${wallet}, status: ${updateDto.status}, source: ${updateDto.sourceAccount}`);

      // Validate wallet address format
      if (!this.stellarService.validateWalletAddress(wallet)) {
        return {
          success: false,
          message: 'Invalid wallet address format',
          error: 'Invalid wallet address format'
        };
      }

      // Validate source account format
      if (!this.stellarService.validateWalletAddress(updateDto.sourceAccount)) {
        return {
          success: false,
          message: 'Invalid source account format',
          error: 'Invalid source account format'
        };
      }

      // Validate status type
      if (!['APPROVED', 'PENDING', 'REJECTED'].includes(updateDto.status)) {
        return {
          success: false,
          message: 'Invalid status type. Must be APPROVED, PENDING, or REJECTED',
          error: 'Invalid status type'
        };
      }

      // Create a verification object with Custom type containing the status
      const verification = {
        issuer: 'admin', // Default issuer for admin-created verifications
        points: 0, // Status verifications don't need points
        timestamp: BigInt(Date.now()),
        vtype: { tag: 'Custom', values: [updateDto.status] } as any
      };

      // Call the stellar service to build the transaction
      const result = await this.stellarService.buildCreateVerificationTransaction(
        wallet,
        verification,
        updateDto.sourceAccount
      );

      if (result.success) {
        this.logger.log(`Status update transaction built successfully for wallet: ${wallet}, status: ${updateDto.status}`);
        return {
          success: true,
          message: `Status update transaction built successfully for ${updateDto.status}`,
          xdr: result.xdr,
          sourceAccount: result.sourceAccount,
          sequence: result.sequence,
          fee: result.fee,
          timebounds: result.timebounds,
          footprint: result.footprint
        };
      } else {
        return {
          success: false,
          message: `Failed to build status update transaction: ${result.error}`,
          error: result.error
        };
      }

    } catch (error) {
      this.logger.error(`Failed to build status update transaction for wallet: ${wallet}, status: ${updateDto.status}`, error);
      return {
        success: false,
        message: `Failed to build status update transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

}