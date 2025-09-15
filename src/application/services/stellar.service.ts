import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  Keypair, 
  TransactionBuilder, 
  Networks, 
  Operation,
  Asset,
  BASE_FEE,
  Horizon
} from '@stellar/stellar-sdk';
import { 
  ContractBindings, 
  BuildTransactionResponse, 
  SubmitTransactionResponse,
  Verification
} from '../../infrastructure/stellar/contract-bindings';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: Horizon.Server;
  private networkPassphrase: string;
  private contractId: string;
  private adminKeypair: Keypair;

  constructor(
    private configService: ConfigService,
    private contractBindings: ContractBindings
  ) {
    // Initialize Stellar server and configuration
    const network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
    
    this.server = new Horizon.Server('https://horizon-testnet.stellar.org'); //testnet

    // Contract ID and admin keypair from environment variables
    this.contractId = this.configService.get<string>('STELLAR_CONTRACT_ID', '');
    const adminSecretKey = this.configService.get<string>('STELLAR_ADMIN_SECRET_KEY', '');
    
    if (adminSecretKey) {
      this.adminKeypair = Keypair.fromSecret(adminSecretKey);
    } else {
      this.logger.warn('STELLAR_ADMIN_SECRET_KEY not provided, using mock mode'); //created a mock mode if there is no env variables or no contract yet
    }
  }


  /**
   * Get user score from the Stellar smart contract
   * Uses mock bindings until real bindings are available
   * The contract returns a u32 value directly
   */
  async getScore(wallet: string): Promise<number> {
    try {
      this.logger.log(`Attempting to get score for wallet: ${wallet}`);

      // Use the contract bindings (mock for now)
      // The contract returns a u32 value directly
      const score = await this.contractBindings.get_score({ wallet });

      this.logger.log(`Score retrieved successfully for wallet: ${wallet}, score: ${score}`);
      return score;

    } catch (error) {
      this.logger.error('Error getting score from Stellar:', error);
      throw new Error(`Failed to get score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user verifications from the Stellar smart contract
   * Uses mock bindings until real bindings are available
   * The contract returns a Vec<Verification>
   */
  async getVerifications(wallet: string): Promise<Verification[]> {
    try {
      this.logger.log(`Attempting to get verifications for wallet: ${wallet}`);

      // Validate wallet address format
      if (!this.validateWalletAddress(wallet)) {
        throw new Error('Invalid wallet address format');
      }

      // Use the contract bindings (mock for now)
      // The contract returns a Vec<Verification>
      const verifications = await this.contractBindings.get_verifications(wallet);

      this.logger.log(`Verifications retrieved successfully for wallet: ${wallet}, count: ${verifications.length}`);
      return verifications;

    } catch (error) {
      this.logger.error('Error getting verifications from Stellar:', error);
      throw new Error(`Failed to get verifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build a transaction for user registration (BUILD phase)
   * Creates an unsigned XDR transaction that the client can sign
   */
  async buildRegisterTransaction(
    wallet: string,
    name: string,
    surnames: string,
    sourceAccount: string
  ): Promise<BuildTransactionResponse> {
    try {
      this.logger.log(`Building register transaction for wallet: ${wallet}, source: ${sourceAccount}`);

      // Validate wallet address format
      if (!this.validateWalletAddress(wallet)) {
        throw new Error('Invalid wallet address format');
      }

      // Validate source account format
      if (!this.validateWalletAddress(sourceAccount)) {
        throw new Error('Invalid source account format');
      }

      // Use contract bindings to build the transaction
      const result = await this.contractBindings.buildRegisterTransaction(
        { wallet, name, surnames },
        sourceAccount,
        this.networkPassphrase,
        this.contractId
      );

      if (result.success) {
        this.logger.log(`Transaction built successfully for wallet: ${wallet}`);
        return result;
      } else {
        throw new Error(result.error || 'Failed to build transaction');
      }

    } catch (error) {
      this.logger.error('Error building register transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Submit a signed transaction (SUBMIT phase)
   * Submits the signed XDR to the network
   */
  async submitSignedTransaction(signedXdr: string): Promise<SubmitTransactionResponse> {
    try {
      this.logger.log('Submitting signed transaction');

      // Use contract bindings to submit the transaction
      const result = await this.contractBindings.submitSignedTransaction(
        signedXdr,
        this.networkPassphrase
      );

      if (result.success) {
        this.logger.log(`Transaction submitted successfully. Hash: ${result.transactionHash}`);
        return result;
      } else {
        throw new Error(result.error || 'Failed to submit transaction');
      }

    } catch (error) {
      this.logger.error('Error submitting signed transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }


  /**
   * Validate a Stellar wallet address
   * TODO: actually use this function for wallet address validation
   */
  validateWalletAddress(wallet: string): boolean {
    try {
      Keypair.fromPublicKey(wallet);
      return true;
    } catch {
      return false;
    }
  }
}