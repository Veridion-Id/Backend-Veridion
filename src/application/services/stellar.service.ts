import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  Keypair, 
  TransactionBuilder, 
  Networks, 
  Operation,
  Asset,
  BASE_FEE,
  Horizon,
  Address,
  rpc,
  Account,
  contract
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
  rebuiltXdr?: string; // New XDR with updated sequence number
}

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: Horizon.Server;
  private rpcServer: rpc.Server;
  private networkPassphrase: string;
  private contractId: string;
  private adminKeypair: Keypair | null;
  private stellarPassportClient: StellarPassportClient;
  private rpcUrl: string;

  constructor(
    private configService: ConfigService
  ) {
    // Initialize Stellar server and configuration
    const network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
    
    // Set the appropriate Horizon server based on network
    const horizonUrl = network === 'testnet' 
      ? 'https://horizon-testnet.stellar.org' 
      : 'https://horizon.stellar.org';
    this.server = new Horizon.Server(horizonUrl);
    
    // Set the appropriate RPC server based on network
    this.rpcUrl = network === 'testnet' 
      ? 'https://soroban-testnet.stellar.org' 
      : 'https://soroban.stellar.org';
    this.rpcServer = new rpc.Server(this.rpcUrl, { allowHttp: true });
    
    this.logger.log(`Initialized Stellar service for ${network} network`);
    this.logger.log(`Horizon URL: ${horizonUrl}`);
    this.logger.log(`RPC URL: ${this.rpcUrl}`);
    this.logger.log(`Network passphrase: ${this.networkPassphrase}`);

    // Contract ID and admin keypair from environment variables
    this.contractId = this.configService.get<string>('STELLAR_CONTRACT_ID', networks.testnet.contractId);
    const adminSecretKey = this.configService.get<string>('STELLAR_ADMIN_SECRET_KEY', '');
    
    if (adminSecretKey && adminSecretKey.trim() !== '') {
      try {
        this.adminKeypair = Keypair.fromSecret(adminSecretKey);
        this.logger.log('Stellar admin keypair initialized successfully');
      } catch (error) {
        this.logger.error(`Invalid STELLAR_ADMIN_SECRET_KEY format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.logger.warn('Using mock mode due to invalid admin secret key');
        this.adminKeypair = null;
      }
    } else {
      this.logger.warn('STELLAR_ADMIN_SECRET_KEY not provided, using mock mode'); //created a mock mode if there is no env variables or no contract yet
      this.adminKeypair = null;
    }

    // Initialize Stellar Passport client
    this.stellarPassportClient = new StellarPassportClient({
      contractId: this.contractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl: this.rpcUrl,
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
      
      this.logger.debug(`Raw result from get_score:`, JSON.stringify(result, null, 2));
      
      if (result.result) {
        const resultValue = result.result;
        // Check if result is an error object
        if (resultValue && typeof resultValue === 'object' && 'error' in (resultValue as any)) {
          const errorResult = resultValue as any;
          throw new Error(`Contract error: ${errorResult.error instanceof Error ? errorResult.error.message : errorResult.error?.message || 'Unknown contract error'}`);
        }
        
        const score = resultValue as number;
        this.logger.log(`Score retrieved successfully for wallet: ${wallet}, score: ${score}`);
        return score;
      } else {
        throw new Error('No result returned from contract');
      }

    } catch (error) {
      this.logger.error('Error getting score from Stellar:', error);
      
      // Parse contract errors for better user experience
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const contractError = this.parseContractError(errorMessage);
      
      if (contractError) {
        throw new Error(`Contract error: ${contractError}`);
      }
      
      throw new Error(`Failed to get score: ${errorMessage}`);
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
      
      this.logger.debug(`Raw result from get_verifications:`, JSON.stringify(result, null, 2));
      
      if (result.result) {
        const resultValue = result.result;
        // Check if result is an error object
        if (resultValue && typeof resultValue === 'object' && 'error' in (resultValue as any)) {
          const errorResult = resultValue as any;
          throw new Error(`Contract error: ${errorResult.error instanceof Error ? errorResult.error.message : errorResult.error?.message || 'Unknown contract error'}`);
        }
        
        // Ensure result is an array
        if (!Array.isArray(resultValue)) {
          this.logger.warn(`Expected array but got: ${typeof resultValue}`, resultValue);
          return []; // Return empty array if not an array
        }
        
        const verifications = resultValue as Verification[];
        this.logger.log(`Verifications retrieved successfully for wallet: ${wallet}, count: ${verifications.length}`);
        return verifications;
      } else {
        throw new Error('No result returned from contract');
      }

    } catch (error) {
      this.logger.error('Error getting verifications from Stellar:', error);
      
      // Parse contract errors for better user experience
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const contractError = this.parseContractError(errorMessage);
      
      if (contractError) {
        throw new Error(`Contract error: ${contractError}`);
      }
      
      throw new Error(`Failed to get verifications: ${errorMessage}`);
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
      this.logger.log(`Building register tx for wallet: ${wallet}, source: ${sourceAccount}`);

      // No validation due to passkey

      // 1) Check if user is already registered to prevent function_trapped error
      try {
        const existingScore = await this.getScore(wallet);
        if (existingScore !== null && existingScore !== undefined) {
          this.logger.warn(`User ${wallet} is already registered with score: ${existingScore}`);
          return {
            success: false,
            error: 'User is already registered. Registration is not allowed for existing users.'
          };
        }
      } catch (scoreError) {
        // If getScore fails, it might mean the user is not registered, which is what we want
        this.logger.log(`User ${wallet} appears to be not registered (getScore failed), proceeding with registration`);
      }

      // 2) Get latest sequence from HORIZON for logging/debugging
      const acc = await this.server.loadAccount(sourceAccount);
      const currentSeqStr = acc.sequence;
      const currentSeq = BigInt(currentSeqStr);
      this.logger.log(`Horizon seq for ${sourceAccount}: ${currentSeqStr}`);

      // 3) Create a new client instance with the source account
      // This ensures the client uses the correct account for sequence management
      const clientWithSource = new StellarPassportClient({
        contractId: this.contractId,
        networkPassphrase: this.networkPassphrase,
        rpcUrl: this.rpcUrl,
        publicKey: sourceAccount, // This is the key fix!
      });

      // 4) Use the client with the correct source account
      const assembled = await clientWithSource.register(
        { wallet, name, surnames },
        { timeoutInSeconds: 120 }
      );

      // 5) Simulate the transaction to prepare it
      await assembled.simulate();

      // 6) Get the XDR and check sequence
      const xdrString = assembled.toXDR();
      const parsedTx = TransactionBuilder.fromXDR(xdrString, this.networkPassphrase);
      const txSequence = 'sequence' in parsedTx ? BigInt(parsedTx.sequence) : 1n;
      
      // 7) If sequence is wrong, provide helpful error message
      if (txSequence !== currentSeq + 1n) {
        this.logger.error(`Transaction sequence (${txSequence}) is wrong. Expected: ${(currentSeq + 1n).toString()}.`);
        this.logger.error('The stellar-passport client is not properly fetching the current sequence.');
        
        return {
          success: false,
          error: `Transaction sequence mismatch. Built with sequence ${txSequence}, but expected ${(currentSeq + 1n).toString()}. The stellar-passport client may not be properly configured with the source account. Please check your client configuration or try using a different approach.`
        };
      }

      // 8) Use the original transaction if sequence is correct
      const finalSeq = 'sequence' in parsedTx ? parsedTx.sequence : (currentSeq + 1n).toString();
      const fee = parsedTx.fee;
      const tb = 'timeBounds' in parsedTx ? parsedTx.timeBounds : undefined;

      this.logger.log(`Transaction built with correct sequence: ${finalSeq}`);

      return {
        success: true,
        xdr: xdrString,
        sourceAccount,
        sequence: finalSeq.toString(),
        fee: String(fee),
        timebounds: tb ? { minTime: tb.minTime.toString(), maxTime: tb.maxTime.toString() } : undefined,
        footprint: undefined,
      };

    } catch (error) {
      this.logger.error('Error building register transaction:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Build a transaction for creating verification (BUILD phase)
   * Creates an unsigned XDR transaction that the client can sign
   * Uses the new Soroban transaction flow with proper sequence handling
   */
  async buildCreateVerificationTransaction(
    wallet: string,
    verification: Verification,
    sourceAccount: string
  ): Promise<BuildTransactionResponse> {
    try {
      this.logger.log(`Building create verification transaction for wallet: ${wallet}, source: ${sourceAccount}`);

      // 0) Input validation
      if (!this.validateWalletAddress(wallet)) {
        throw new Error('Invalid wallet address format');
      }
      if (!this.validateWalletAddress(sourceAccount)) {
        throw new Error('Invalid source account format');
      }

      // 1) Fetch current sequence for diagnostics
      const seqRes = await this.getAccountSequence(sourceAccount);
      if (!seqRes.success) {
        throw new Error(`Failed to get account sequence: ${seqRes.error}`);
      }
      const currentSeqStr = seqRes.sequence; // string
      const currentSeq = BigInt(currentSeqStr);

      this.logger.log(`Current account sequence for ${sourceAccount}: ${currentSeqStr}`);

      // Convert the verification to the expected format for the contract
      const verificationType: VerificationType = this.convertToVerificationType(verification.vtype);

      // 2) Create a new client instance with the source account
      // This ensures the client uses the correct account for sequence management
      const clientWithSource = new StellarPassportClient({
        contractId: this.contractId,
        networkPassphrase: this.networkPassphrase,
        rpcUrl: this.rpcUrl,
        publicKey: sourceAccount, // This is the key fix!
      });

      // 3) Assemble using stellar-passport bindings with proper timeout
      const assembledTx = await clientWithSource.upsert_verification(
        { wallet, vtype: verificationType, points: verification.points },
        {
          timeoutInSeconds: 120, // gives timebounds to reduce staleness
        }
      );

      // 4) Simulate the transaction to prepare it for XDR extraction
      await assembledTx.simulate();

      // 5) Extract details for the client
      const xdrString = assembledTx.toXDR();
      
      // Parse the XDR to get transaction details
      const parsedTransaction = TransactionBuilder.fromXDR(xdrString, this.networkPassphrase);
      const sequence = 'sequence' in parsedTransaction ? parsedTransaction.sequence : '0';
      const fee = parsedTransaction.fee;
      const timebounds = 'timeBounds' in parsedTransaction ? parsedTransaction.timeBounds : undefined;

      // 6) Correct sequence sanity-check:
      //    A valid tx will have sequence == currentSeq + 1
      if (BigInt(sequence) !== currentSeq + 1n) {
        this.logger.warn(
          `Tx sequence (${sequence}) should equal current+1 (${(currentSeq + 1n).toString()}). ` +
          `Current network seq: ${currentSeqStr}.`
        );
      }

      this.logger.log(`Transaction built successfully for wallet: ${wallet}`);
      this.logger.log(`Tx seq: ${sequence}, fee: ${fee}, account current seq: ${currentSeqStr}`);

      return {
        success: true,
        xdr: xdrString,
        sourceAccount,
        sequence,
        fee: String(fee),
        timebounds: timebounds
          ? { minTime: timebounds.minTime.toString(), maxTime: timebounds.maxTime.toString() }
          : undefined,
        // If you want to expose parts of the footprint, you can pick them out of `sim` as needed
        footprint: undefined,
      };
    } catch (error) {
      this.logger.error('Error building create verification transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Submit a signed transaction (SUBMIT phase)
   * Submits the signed XDR to the network
   */
  async submitSignedTransaction(signedXdr: string): Promise<SubmitTransactionResponse> {
    try {
      this.logger.log('Submitting signed transaction to Horizon');
      
      // Parse and submit the signed transaction
      const transaction = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
      const result = await this.server.submitTransaction(transaction);
      
      this.logger.log(`Transaction submitted successfully. Hash: ${result.hash}`);
      return {
        success: true,
        transactionHash: result.hash,
        resultMeta: undefined
      };
    } catch (error) {
      this.logger.error('Error submitting transaction:', error);
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

  /**
   * Get the current sequence number for an account
   */
  async getAccountSequence(accountId: string): Promise<{ sequence: string; success: boolean; error?: string }> {
    try {
      this.logger.log(`Getting sequence number for account: ${accountId}`);
      
      const account = await this.server.loadAccount(accountId);
      const sequence = account.sequenceNumber();
      
      this.logger.log(`Account ${accountId} current sequence: ${sequence}`);
      
      return {
        sequence,
        success: true
      };
    } catch (error) {
      this.logger.error(`Error getting sequence for account ${accountId}:`, error);
      return {
        sequence: '0',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Rebuild a transaction with the current account sequence
   * This is useful when a transaction fails due to outdated sequence number
   */
  async rebuildTransactionWithCurrentSequence(
    originalXdr: string,
    sourceAccount: string
  ): Promise<{ success: boolean; xdr?: string; error?: string }> {
    try {
      this.logger.log(`Rebuilding transaction with current sequence for account: ${sourceAccount}`);

      // Parse the original transaction to extract operation details
      const originalTransaction = TransactionBuilder.fromXDR(originalXdr, this.networkPassphrase);
      
      // Get the current account sequence
      const accountSequenceResult = await this.getAccountSequence(sourceAccount);
      if (!accountSequenceResult.success) {
        throw new Error(`Failed to get account sequence: ${accountSequenceResult.error}`);
      }

      // Load the account with current sequence
      const account = await this.server.loadAccount(sourceAccount);
      
      // Create a new transaction builder with the current account
      const newTransaction = new TransactionBuilder(account, {
        fee: originalTransaction.fee,
        networkPassphrase: this.networkPassphrase,
      });

      // Copy operations from the original transaction
      for (const operation of originalTransaction.operations) {
        newTransaction.addOperation(operation as any);
      }

      // Copy timebounds if they exist
      if ('timeBounds' in originalTransaction && originalTransaction.timeBounds) {
        const timeoutSeconds = Number(originalTransaction.timeBounds.maxTime) - Number(originalTransaction.timeBounds.minTime);
        newTransaction.setTimeout(timeoutSeconds);
      } else {
        newTransaction.setTimeout(30); // Default 30 seconds
      }

      // Build the new transaction
      const rebuiltTransaction = newTransaction.build();
      const newXdr = rebuiltTransaction.toXDR();

      this.logger.log(`Transaction rebuilt successfully with sequence: ${accountSequenceResult.sequence}`);

      return {
        success: true,
        xdr: newXdr
      };

    } catch (error) {
      this.logger.error('Error rebuilding transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse Soroban contract errors from Horizon error response
   */
  private parseSorobanContractError(errorData: any): string | null {
    try {
      // Check if this is a transaction failed error with function_trapped
      if (errorData.type === 'https://stellar.org/horizon-errors/transaction_failed' &&
          errorData.extras?.result_codes?.operations?.includes('function_trapped')) {
        
        this.logger.log('Detected function_trapped error, attempting to decode contract error');
        
        // Try to decode the result_xdr to get the specific contract error
        const resultXdr = errorData.extras?.result_xdr;
        if (resultXdr) {
          try {
            const contractError = this.decodeContractErrorFromXdr(resultXdr);
            if (contractError) {
              return contractError;
            }
          } catch (xdrError) {
            this.logger.warn('Failed to decode XDR error, using fallback message:', xdrError);
          }
        }
        
        // If we can't decode the specific error, provide a generic message
        return 'Contract function execution failed (function_trapped). This typically means: 1) User is already registered, 2) Invalid parameters provided, 3) Contract authorization failed, or 4) Contract encountered an unexpected error. Please check if the user is already registered or verify the input parameters.';
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error parsing Soroban contract error:', error);
      return null;
    }
  }

  /**
   * Decode contract error from result XDR
   */
  private decodeContractErrorFromXdr(resultXdr: string): string | null {
    try {
      // Import xdr for decoding
      const { xdr } = require('@stellar/stellar-sdk');
      
      // Decode the result XDR
      const result = xdr.TransactionResult.fromXDR(resultXdr, 'base64');
      
      // Get the operation results
      const operationResults = result.result().results();
      if (operationResults && operationResults.length > 0) {
        const firstResult = operationResults[0];
        
        // Check if it's an invoke host function result
        if (firstResult.tr().invokeHostFunctionResult()) {
          const invokeResult = firstResult.tr().invokeHostFunctionResult();
          
          // Check if it's a success or error
          if (invokeResult.success()) {
            // Success case - this shouldn't happen if we got function_trapped
            return 'Contract execution succeeded but transaction failed for unknown reason';
          } else {
            // Error case - try to get the error
            // The error() method might not exist, so we need to access it differently
            try {
              // Try to access the error property directly
              const error = invokeResult.error;
              if (error) {
                // Try to decode the error
                const errorCode = this.extractContractErrorCode(error);
                if (errorCode !== null) {
                  return this.mapContractErrorCode(errorCode);
                }
              }
            } catch (errorAccessError) {
              this.logger.debug('Could not access error property directly:', errorAccessError);
            }
            
            // If we can't access the error, try to get more information from the invoke result
            this.logger.debug('Invoke result details:', {
              success: invokeResult.success(),
              // Log the invoke result structure for debugging
              resultType: typeof invokeResult,
              resultKeys: Object.keys(invokeResult)
            });
          }
        }
      }
      
      return 'Contract execution failed with unknown error';
    } catch (error) {
      this.logger.error('Error decoding contract error from XDR:', error);
      return null;
    }
  }

  /**
   * Extract contract error code from XDR error
   */
  private extractContractErrorCode(error: any): number | null {
    try {
      // This is a simplified approach - in practice, you might need more sophisticated XDR parsing
      // The error structure depends on how your contract defines errors
      
      // For now, we'll return null and let the generic error message be used
      // In a real implementation, you'd parse the XDR structure to extract the error code
      return null;
    } catch (error) {
      this.logger.error('Error extracting contract error code:', error);
      return null;
    }
  }

  /**
   * Map contract error codes to user-friendly messages
   */
  private mapContractErrorCode(errorCode: number): string {
    switch (errorCode) {
      case 1:
        return 'User is already registered';
      case 2:
        return 'User is not registered. Please register first.';
      case 3:
        return 'Unauthorized access';
      case 4:
        return 'Invalid points value';
      case 5:
        return 'Points overflow error';
      case 6:
        return 'Too many verifications';
      default:
        return `Contract error #${errorCode}`;
    }
  }

  /**
   * Parse contract errors to provide user-friendly messages (legacy method)
   */
  private parseContractError(errorMessage: string): string | null {
    // Look for contract error patterns like "Error(Contract, #2)"
    const contractErrorMatch = errorMessage.match(/Error\(Contract,\s*#(\d+)\)/);
    
    if (contractErrorMatch) {
      const errorCode = parseInt(contractErrorMatch[1], 10);
      return this.mapContractErrorCode(errorCode);
    }
    
    return null;
  }
}