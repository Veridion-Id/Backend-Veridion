import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { 
  BuildRegisterTransactionDto,
  BuildRegisterTransactionResponse,
  SubmitSignedTransactionDto,
  SubmitSignedTransactionResponse
} from '../../domain/entities/admin.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly stellarService: StellarService) {}


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

}