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
  Client as StellarPassportClient,
  Verification,
  VerificationType,
  networks
} from 'stellar-passport';

export interface BuildTransactionResponse {
  success: boolean;
  xdr?: string;
  sourceAccount?: string;
  sequence?: string;
  fee?: string;
  timebounds?: {
    minTime: string;
    maxTime: string;
  };
  footprint?: string;
  error?: string;
}

export interface SubmitTransactionResponse {
  success: boolean;
  transactionHash?: string;
  resultMeta?: string;
  error?: string;
}

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: Horizon.Server;
  private networkPassphrase: string;
  private contractId: string;
  private adminKeypair: Keypair;
  private stellarPassportClient: StellarPassportClient;

  constructor(
    private configService: ConfigService
  ) {
    // Initialize Stellar server and configuration
    const network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
    
    this.server = new Horizon.Server('https://horizon-testnet.stellar.org'); //testnet

    // Contract ID and admin keypair from environment variables
    this.contractId = this.configService.get<string>('STELLAR_CONTRACT_ID', networks.testnet.contractId);
    const adminSecretKey = this.configService.get<string>('STELLAR_ADMIN_SECRET_KEY', '');
    
    if (adminSecretKey) {
      this.adminKeypair = Keypair.fromSecret(adminSecretKey);
    } else {
      this.logger.warn('STELLAR_ADMIN_SECRET_KEY not provided, using mock mode'); //created a mock mode if there is no env variables or no contract yet
    }

    // Initialize Stellar Passport client
    this.stellarPassportClient = new StellarPassportClient({
      contractId: this.contractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl: 'https://soroban-testnet.stellar.org',
    });
  }


  /**
   * Get user score from the Stellar smart contract
   * Uses actual stellar-passport bindings
   * The contract returns a u32 value directly
   */
  async getScore(wallet: string): Promise<number> {
    try {
      this.logger.log(`Attempting to get score for wallet: ${wallet}`);

      // Use the actual contract bindings from stellar-passport
      const assembledTransaction = await this.stellarPassportClient.get_score({ wallet });
      
      // Execute the transaction to get the result
      const result = await assembledTransaction.simulate();
      
      if (result.result) {
        const score = result.result as number;
        this.logger.log(`Score retrieved successfully for wallet: ${wallet}, score: ${score}`);
        return score;
      } else {
        throw new Error('No result returned from contract');
      }

    } catch (error) {
      this.logger.error('Error getting score from Stellar:', error);
      throw new Error(`Failed to get score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user verifications from the Stellar smart contract
   * Uses actual stellar-passport bindings
   * The contract returns a Vec<Verification>
   */
  async getVerifications(wallet: string): Promise<Verification[]> {
    try {
      this.logger.log(`Attempting to get verifications for wallet: ${wallet}`);

      // Validate wallet address format
      if (!this.validateWalletAddress(wallet)) {
        throw new Error('Invalid wallet address format');
      }

      // Use the actual contract bindings from stellar-passport
      const assembledTransaction = await this.stellarPassportClient.get_verifications({ wallet });
      
      // Execute the transaction to get the result
      const result = await assembledTransaction.simulate();
      
      if (result.result) {
        const verifications = result.result as Verification[];
        this.logger.log(`Verifications retrieved successfully for wallet: ${wallet}, count: ${verifications.length}`);
        return verifications;
      } else {
        throw new Error('No result returned from contract');
      }

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

      // Use actual contract bindings to build the transaction
      const assembledTransaction = await this.stellarPassportClient.register(
        { wallet, name, surnames },
        { simulate: false } // Don't simulate, just build
      );

      // Get the transaction details
      const xdrString = assembledTransaction.toXDR();
      // Note: AssembledTransaction doesn't expose sequence, fee, timeBounds directly
      // These would need to be extracted from the transaction if needed
      const sequence = '0'; // Placeholder - would need to extract from transaction
      const fee = '100'; // Placeholder - would need to extract from transaction
      const timebounds = undefined; // Placeholder - would need to extract from transaction

      this.logger.log(`Transaction built successfully for wallet: ${wallet}`);

      return {
        success: true,
        xdr: xdrString,
        sourceAccount: sourceAccount,
        sequence: sequence,
        fee: fee.toString(),
        timebounds: timebounds ? {
          minTime: timebounds.minTime.toString(),
          maxTime: timebounds.maxTime.toString()
        } : undefined,
        footprint: undefined // TODO: Add proper Soroban footprint when available
      };

    } catch (error) {
      this.logger.error('Error building register transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build a transaction for creating verification (BUILD phase)
   * Creates an unsigned XDR transaction that the client can sign
   */
  async buildCreateVerificationTransaction(
    wallet: string,
    verification: Verification,
    sourceAccount: string
  ): Promise<BuildTransactionResponse> {
    try {
      this.logger.log(`Building create verification transaction for wallet: ${wallet}, source: ${sourceAccount}`);

      // Validate wallet address format
      if (!this.validateWalletAddress(wallet)) {
        throw new Error('Invalid wallet address format');
      }

      // Validate source account format
      if (!this.validateWalletAddress(sourceAccount)) {
        throw new Error('Invalid source account format');
      }

      // Convert the verification to the expected format for the contract
      const verificationType: VerificationType = this.convertToVerificationType(verification.vtype);

      // Use actual contract bindings to build the transaction
      const assembledTransaction = await this.stellarPassportClient.upsert_verification(
        { wallet, vtype: verificationType, points: verification.points },
        { simulate: false } // Don't simulate, just build
      );

      // Get the transaction details
      const xdrString = assembledTransaction.toXDR();
      // Note: AssembledTransaction doesn't expose sequence, fee, timeBounds directly
      // These would need to be extracted from the transaction if needed
      const sequence = '0'; // Placeholder - would need to extract from transaction
      const fee = '100'; // Placeholder - would need to extract from transaction
      const timebounds = undefined; // Placeholder - would need to extract from transaction

      this.logger.log(`Transaction built successfully for wallet: ${wallet}`);

      return {
        success: true,
        xdr: xdrString,
        sourceAccount: sourceAccount,
        sequence: sequence,
        fee: fee.toString(),
        timebounds: timebounds ? {
          minTime: timebounds.minTime.toString(),
          maxTime: timebounds.maxTime.toString()
        } : undefined,
        footprint: undefined // TODO: Add proper Soroban footprint when available
      };

    } catch (error) {
      this.logger.error('Error building create verification transaction:', error);
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

      // Parse the signed transaction
      const transaction = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);

      // Submit to Horizon
      const result = await this.server.submitTransaction(transaction);

      this.logger.log(`Transaction submitted successfully. Hash: ${result.hash}`);

      return {
        success: true,
        transactionHash: result.hash,
        resultMeta: undefined // TODO: Add proper result meta when available
      };

    } catch (error) {
      this.logger.error('Error submitting signed transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }


  /**
   * Convert string verification type to VerificationType enum
   */
  private convertToVerificationType(type: string | VerificationType): VerificationType {
    // If it's already a VerificationType, return it
    if (typeof type === 'object' && type !== null && 'tag' in type) {
      return type as VerificationType;
    }
    
    // Convert string to VerificationType
    const typeStr = (type as string).toLowerCase();
    switch (typeStr) {
      case 'over18':
        return { tag: 'Over18', values: undefined };
      case 'twitter':
        return { tag: 'Twitter', values: undefined };
      case 'github':
        return { tag: 'GitHub', values: undefined };
      default:
        // For custom types, wrap in Custom
        return { tag: 'Custom', values: [typeStr] };
    }
  }

  /**
   * Validate a Stellar wallet address
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