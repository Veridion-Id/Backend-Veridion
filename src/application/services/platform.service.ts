import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from './stellar.service';
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

      this.logger.log(`Score retrieved successfully for wallet: ${wallet}, score: ${score}`);
      return {
        score,
        success: true,
        message: 'Score retrieved successfully'
      };

    } catch (error) {
      this.logger.error(`Failed to get score for wallet: ${wallet}`, error);
      return {
        success: false,
        message: `Failed to get score: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      return {
        success: false,
        message: `Failed to get verifications: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      return {
        success: false,
        message: `Failed to verify if human: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      return {
        success: false,
        message: `Failed to verify if human: ${error instanceof Error ? error.message : 'Unknown error'}`
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
}

