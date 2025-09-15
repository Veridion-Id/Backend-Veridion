import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { Verification } from '../../infrastructure/stellar/contract-bindings';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

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
      const verifications = await this.stellarService.getVerifications(wallet);

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
}
