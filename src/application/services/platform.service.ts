import { Injectable, Logger } from '@nestjs/common';
import { StellarService, StatusType, StatusUpdateResponse, StatusResponse } from './stellar.service';
import { Verification } from '../../infrastructure/stellar/contract-bindings';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);
  private readonly HUMAN_THRESHOLD = 35; // Threshold score to determine if user is human
  // TODO: This should be configurable by the user

  constructor(private readonly stellarService: StellarService) {}

  /**
   * Get user score from the smart contract
   * The contract returns a u32 value directly
   */
  async getScore(wallet: string): Promise<{ score?: number; success: boolean; message: string }> {
    try {
      this.logger.log(`Getting score for wallet: ${wallet}`);

      // Validate wallet address format
      if (!this.stellarService.validateWalletAddress(wallet)) {
        return {
          success: false,
          message: 'Invalid wallet address format'
        };
      }

      // Call the Stellar smart contract - returns u32 directly
      const score = await this.stellarService.getScore(wallet);

      // Ensure score is a number
      if (typeof score !== 'number') {
        throw new Error(`Invalid score type: expected number, got ${typeof score}`);
      }

      this.logger.log(`Score retrieved successfully for wallet: ${wallet}, score: ${score}`);
      return {
        score,
        success: true,
        message: 'Score retrieved successfully'
      };

    } catch (error) {
      this.logger.error(`Failed to get score for wallet: ${wallet}`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle specific contract errors more gracefully
      if (errorMessage.includes('User is not registered')) {
        return {
          success: true,
          score: 0,
          message: 'User is not registered. Score is 0.'
        };
      }
      
      return {
        success: false,
        message: `Failed to get score: ${errorMessage}`
      };
    }
  }

  /**
   * Get user verifications from the smart contract
   * The contract returns a Vec<Verification>
   */
  async getVerifications(wallet: string): Promise<{ verifications?: Verification[]; success: boolean; message: string }> {
    try {
      this.logger.log(`Getting verifications for wallet: ${wallet}`);

      // Validate wallet address format
      if (!this.stellarService.validateWalletAddress(wallet)) {
        return {
          success: false,
          message: 'Invalid wallet address format'
        };
      }

      // Call the Stellar smart contract - returns Vec<Verification>
      const stellarVerifications = await this.stellarService.getVerifications(wallet);

      // Convert new Verification format to old format for backward compatibility
      const verifications = stellarVerifications.map(verification => ({
        type: this.convertVerificationTypeToString(verification.vtype),
        points: verification.points,
        timestamp: verification.timestamp.toString()
      }));

      this.logger.log(`Verifications retrieved successfully for wallet: ${wallet}, there were ${verifications.length} verifications`);
      return {
        verifications,
        success: true,
        message: 'Verifications retrieved successfully'
      };

    } catch (error) {
      this.logger.error(`Failed to get verifications for wallet: ${wallet}`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle specific contract errors more gracefully
      if (errorMessage.includes('User is not registered')) {
        return {
          success: true,
          verifications: [],
          message: 'User is not registered. No verifications found.'
        };
      }
      
      return {
        success: false,
        message: `Failed to get verifications: ${errorMessage}`
      };
    }
  }

  /**
   * Check if a user is human based on their score
   * Uses the score from the smart contract and compares it against the human threshold
   * The contract returns an unsigned 32-bit integer (u32)
   */
  async isHuman(wallet: string): Promise<{ isHuman?: boolean; score?: number; success: boolean; message: string }> {
    try {
      this.logger.log(`Checking if wallet is human: ${wallet}`);

      // Validate wallet address format
      if (!this.stellarService.validateWalletAddress(wallet)) {
        return {
          success: false,
          message: 'Invalid wallet address format'
        };
      }

      // Get the user's score from the Stellar smart contract
      const score = await this.stellarService.getScore(wallet);

      // Ensure score is a number
      if (typeof score !== 'number') {
        throw new Error(`Invalid score type: expected number, got ${typeof score}`);
      }

      // Determine if the user is human based on the threshold
      const isHuman = score >= this.HUMAN_THRESHOLD;

      this.logger.log(`Human check completed for wallet: ${wallet}, score: ${score}, isHuman: ${isHuman}, threshold: ${this.HUMAN_THRESHOLD}`);
      
      return {
        isHuman,
        score,
        success: true,
        message: `Human verification completed. Score: ${score}, Threshold: ${this.HUMAN_THRESHOLD}, Result: ${isHuman ? 'Human' : 'Not Human'}`
      };

    } catch (error) {
      this.logger.error(`Failed to check if wallet is human: ${wallet}`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle specific contract errors more gracefully
      if (errorMessage.includes('User is not registered')) {
        return {
          isHuman: false,
          score: 0,
          success: true,
          message: 'User is not registered. Score is 0, not human.'
        };
      }
      
      return {
        success: false,
        message: `Failed to verify if human: ${errorMessage}`
      };
    }
  }

  async isHumanNS(wallet: string): Promise<{ isHuman?: boolean; success: boolean; message: string }> {
    try {
      this.logger.log(`Checking if wallet is human (no score): ${wallet}`);

      // Validate wallet address format
      if (!this.stellarService.validateWalletAddress(wallet)) {
        return {
          success: false,
          message: 'Invalid wallet address format'
        };
      }

      // Get the user's score from the Stellar smart contract
      const score = await this.stellarService.getScore(wallet);

      // Determine if the user is human based on the threshold
      const isHuman = score >= this.HUMAN_THRESHOLD;

      this.logger.log(`Human check completed for wallet (no score): ${wallet}, isHuman: ${isHuman}, threshold: ${this.HUMAN_THRESHOLD}`);
      
      return {
        isHuman,
        success: true,
        message: `Human verification completed. Threshold: ${this.HUMAN_THRESHOLD}, Result: ${isHuman ? 'Human' : 'Not Human'}`
      };

    } catch (error) {
      this.logger.error(`Failed to check if wallet is human (no score): ${wallet}`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle specific contract errors more gracefully
      if (errorMessage.includes('User is not registered')) {
        return {
          isHuman: false,
          success: true,
          message: 'User is not registered. Not human.'
        };
      }
      
      return {
        success: false,
        message: `Failed to verify if human: ${errorMessage}`
      };
    }
  }

  /**
   * Convert VerificationType to string for backward compatibility
   */
  private convertVerificationTypeToString(vtype: any): string {
    if (typeof vtype === 'object' && vtype !== null && 'tag' in vtype) {
      switch (vtype.tag) {
        case 'Over18':
          return 'over18';
        case 'Twitter':
          return 'twitter';
        case 'GitHub':
          return 'github';
        case 'Custom':
          return vtype.values && vtype.values[0] ? vtype.values[0] : 'custom';
        default:
          return 'unknown';
      }
    }
    return 'unknown';
  }

  /**
   * Update user status (approved, rejected, pending)
   * Uses the stellar service to build a transaction for status update
   */
  async updateStatus(
    wallet: string,
    status: StatusType,
    sourceAccount: string
  ): Promise<StatusUpdateResponse> {
    try {
      this.logger.log(`Updating status for wallet: ${wallet}, status: ${status}`);

      // Validate wallet address format
      if (!this.stellarService.validateWalletAddress(wallet)) {
        return {
          success: false,
          message: 'Invalid wallet address format',
          error: 'Invalid wallet address format'
        };
      }

      // Validate status type
      if (!['approved', 'rejected', 'pending'].includes(status)) {
        return {
          success: false,
          message: 'Invalid status type. Must be approved, rejected, or pending',
          error: 'Invalid status type'
        };
      }

      // Call the stellar service to build the transaction
      const result = await this.stellarService.buildUpdateStatusTransaction(
        wallet,
        status,
        sourceAccount
      );

      if (result.success) {
        this.logger.log(`Status update transaction built successfully for wallet: ${wallet}, status: ${status}`);
        return {
          success: true,
          message: `Status update transaction built successfully for ${status}`,
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
      this.logger.error(`Failed to update status for wallet: ${wallet}, status: ${status}`, error);
      return {
        success: false,
        message: `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user status (approved, rejected, pending)
   * Searches through user verifications to find the current status
   */
  async getStatus(wallet: string): Promise<StatusResponse> {
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

      // Call the stellar service to get the status
      const result = await this.stellarService.getStatus(wallet);

      if (result.success) {
        this.logger.log(`Status retrieved successfully for wallet: ${wallet}, status: ${result.status}`);
        return {
          success: true,
          status: result.status,
          message: `Status retrieved successfully: ${result.status}`
        };
      } else {
        return {
          success: false,
          message: `Failed to get status: ${result.error}`,
          error: result.error
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
}

