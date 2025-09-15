import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from './stellar.service';

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
}
