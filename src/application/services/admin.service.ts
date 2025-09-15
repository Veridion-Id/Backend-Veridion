import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { PlatformService } from './platform.service';
import { 
  BuildRegisterTransactionDto,
  BuildRegisterTransactionResponse,
  SubmitSignedTransactionDto,
  SubmitSignedTransactionResponse,
  BuildCreateVerificationTransactionDto,
  BuildCreateVerificationTransactionResponse,
  ApiKeyResponse
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
        return {
          success: false,
          message: `Failed to submit transaction: ${result.error}`,
          error: result.error
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

      // Call the stellar service to build the transaction
      const result = await this.stellarService.buildCreateVerificationTransaction(
        buildDto.wallet,
        { type: buildDto.verificationType, points: buildDto.points },
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

}