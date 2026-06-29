import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDENTITY_READ_PORT, IdentityReadPort } from '../../domain/ports/identity-read.port';
import { BatchVerifyResult, WalletResult } from '../../domain/entities/batch-verify.entity';

@Injectable()
export class BatchVerifyService {
  private readonly logger = new Logger(BatchVerifyService.name);

  private readonly threshold: number;
  private readonly maxWallets: number;

  constructor(
    @Inject(IDENTITY_READ_PORT)
    private readonly identityRead: IdentityReadPort,
    private readonly configService: ConfigService,
  ) {
    this.threshold = this.configService.get<number>(
      'BATCH_VERIFY_HUMAN_THRESHOLD',
      35,
    );
    this.maxWallets = this.configService.get<number>(
      'BATCH_VERIFY_MAX_WALLETS',
      25,
    );
  }

  /**
   * Verify a batch of Stellar wallet addresses.
   *
   * Rules:
   *  - Empty array or count > maxWallets → 400
   *  - Invalid address format → skipped, counted in `invalid`
   *  - All addresses invalid → 422
   *  - Unregistered wallet → { registered: false, score: 0, isHuman: false }
   *  - Registered wallet → score fetched from contract, isHuman = score >= threshold
   */
  async verifyBatch(wallets: string[]): Promise<BatchVerifyResult> {
    if (!wallets || wallets.length === 0) {
      throw new BadRequestException('wallets array must not be empty.');
    }

    if (wallets.length > this.maxWallets) {
      throw new BadRequestException(
        `Batch size ${wallets.length} exceeds the maximum of ${this.maxWallets} wallets per request.`,
      );
    }

    const results: WalletResult[] = [];
    let invalidCount = 0;

    for (const wallet of wallets) {
      if (!this.identityRead.validateWalletAddress(wallet)) {
        this.logger.debug(`Skipping invalid wallet address: ${wallet}`);
        invalidCount++;
        continue;
      }

      const result = await this.resolveWallet(wallet);
      results.push(result);
    }

    if (results.length === 0) {
      throw new UnprocessableEntityException(
        'All provided wallet addresses are invalid. No wallets were processed.',
      );
    }

    this.logger.log(
      `Batch verify complete: ${results.length} processed, ${invalidCount} invalid`,
    );

    return {
      results,
      threshold: this.threshold,
      processed: results.length,
      invalid: invalidCount,
    };
  }

  /**
   * Resolve a single (already-validated) wallet address to a WalletResult.
   * Unregistered wallets are handled gracefully rather than surfacing as errors.
   */
  private async resolveWallet(wallet: string): Promise<WalletResult> {
    try {
      const score = await this.identityRead.getScore(wallet);
      return {
        wallet,
        registered: true,
        score,
        isHuman: score >= this.threshold,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('User is not registered') || message.includes('NotRegistered')) {
        this.logger.debug(`Wallet not registered: ${wallet}`);
        return {
          wallet,
          registered: false,
          score: 0,
          isHuman: false,
        };
      }

      // Re-throw unexpected errors so the caller gets a 500 with context.
      this.logger.error(`Unexpected error resolving wallet ${wallet}: ${message}`);
      throw error;
    }
  }
}
