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
  contract,
  authorizeEntry
} from '@stellar/stellar-sdk';
import { 
  Client as StellarPassportClient,
  Verification,
  VerificationType,
  networks
} from '../../../packages/stellar-passport/src';


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
  authEntries?: any[]; // Authorization entries that need to be signed
  error?: string;
}

export interface SubmitTransactionResponse {
  success: boolean;
  transactionHash?: string;
  resultMeta?: string;
  error?: string;
  rebuiltXdr?: string; // New XDR with updated sequence number
}

export type StatusType = 'approved' | 'rejected' | 'pending';

export interface StatusUpdateResponse {
  success: boolean;
  message: string;
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

export interface StatusResponse {
  success: boolean;
  status?: StatusType;
  message: string;
  error?: string;
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
   * Creates a StellarPassportClient with automatic authentication
   * This follows the pattern from your StellarPassportService
   */
  private createClientWithAuth(address: string, signTransactionCallback: (txXdr: string) => Promise<{ signedTxXdr: string }>): StellarPassportClient {
    return new StellarPassportClient({
      contractId: this.contractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl: this.rpcUrl,
      publicKey: address,
      signTransaction: signTransactionCallback,
    });
  }

  /**
   * Crea un cliente configurado para autenticación automática
   */
  private createClient(address: string): StellarPassportClient {
    return new StellarPassportClient({
      contractId: networks.testnet.contractId,
      networkPassphrase: networks.testnet.networkPassphrase,
      rpcUrl: "https://soroban-testnet.stellar.org",
      publicKey: address,
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
   * Creates a transaction with proper Soroban authorization handling
   * Following the pattern from StellarPassportService
   */
  async buildRegisterTransaction(
    wallet: string,
    name: string,
    surnames: string,
    sourceAccount: string
  ): Promise<BuildTransactionResponse> {
    try {
      this.logger.log(`Building register transaction for wallet: ${wallet}, source: ${sourceAccount}`);
      
      const client = this.createClient(wallet);
      const transaction = await client.register({wallet, name, surnames});
      
      // Simulate to get authorization entries and prepare the transaction
      const simulation = await transaction.simulate();

      return {
        success: true,
        sourceAccount: sourceAccount,
        xdr: transaction.toXDR(),
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
   * Submits the signed XDR to the Soroban RPC network
   */
  async submitSignedTransaction(signedXdr: string): Promise<SubmitTransactionResponse> {
    try {
      this.logger.log('Submitting signed transaction to Soroban RPC');
      this.logger.log(`Network passphrase: ${this.networkPassphrase}`);
      this.logger.log(`RPC URL: ${this.rpcUrl}`);
      
      // Validate XDR format first
      if (!signedXdr || typeof signedXdr !== 'string') {
        throw new Error('Invalid XDR: must be a non-empty string');
      }
      
      // Rehydrate the Transaction from its XDR
      const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
      
      // Submit to Soroban RPC instead of Horizon
      const result = await this.rpcServer.sendTransaction(tx);
      
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
   * Update user status using upsert_verification
   * Creates a transaction to update the user's status (approved, rejected, pending)
   */
  async buildUpdateStatusTransaction(
    wallet: string,
    status: StatusType,
    sourceAccount: string
  ): Promise<StatusUpdateResponse> {
    try {
      this.logger.log(`Building update status transaction for wallet: ${wallet}, status: ${status}, source: ${sourceAccount}`);

      // Input validation
      if (!this.validateWalletAddress(wallet)) {
        return {
          success: false,
          message: 'Invalid wallet address format',
          error: 'Invalid wallet address format'
        };
      }

      if (!this.validateStatusType(status)) {
        return {
          success: false,
          message: 'Invalid status type. Must be approved, rejected, or pending',
          error: 'Invalid status type'
        };
      }

      // Convert status to verification type
      const verificationType = this.statusToVerificationType(status);
      
      // Create verification object for status update
      const verification: Verification = {
        issuer: 'system', // System-issued status
        points: 0, // Status doesn't contribute to points
        timestamp: BigInt(Date.now()),
        vtype: verificationType
      };

      // Build the transaction using existing method
      const result = await this.buildCreateVerificationTransaction(wallet, verification, sourceAccount);

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
      this.logger.error(`Failed to build status update transaction for wallet: ${wallet}, status: ${status}`, error);
      return {
        success: false,
        message: `Failed to build status update transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user status from verifications
   * Searches through user verifications to find the current status
   */
  async getStatus(wallet: string): Promise<StatusResponse> {
    try {
      this.logger.log(`Getting status for wallet: ${wallet}`);

      // Input validation
      if (!this.validateWalletAddress(wallet)) {
        return {
          success: false,
          message: 'Invalid wallet address format',
          error: 'Invalid wallet address format'
        };
      }

      // Get all verifications for the user
      const verifications = await this.getVerifications(wallet);

      // Look for status verification (most recent one)
      let latestStatus: StatusType | null = null;
      let latestTimestamp = BigInt(0);

      for (const verification of verifications) {
        const status = this.verificationTypeToStatus(verification.vtype);
        if (status && verification.timestamp > latestTimestamp) {
          latestStatus = status;
          latestTimestamp = verification.timestamp;
        }
      }

      if (latestStatus) {
        this.logger.log(`Status found for wallet: ${wallet}, status: ${latestStatus}`);
        return {
          success: true,
          status: latestStatus,
          message: `Status retrieved successfully: ${latestStatus}`
        };
      } else {
        this.logger.log(`No status found for wallet: ${wallet}, defaulting to pending`);
        return {
          success: true,
          status: 'pending',
          message: 'No status found, defaulting to pending'
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
   * Convert status type to custom verification type
   */
  private statusToVerificationType(status: StatusType): VerificationType {
    return { tag: 'Custom', values: [`status_${status}`] };
  }

  /**
   * Extract status from verification type
   */
  private verificationTypeToStatus(vtype: VerificationType): StatusType | null {
    if (vtype.tag === 'Custom' && vtype.values[0]?.startsWith('status_')) {
      const status = vtype.values[0].replace('status_', '') as StatusType;
      if (['approved', 'rejected', 'pending'].includes(status)) {
        return status;
      }
    }
    return null;
  }

  /**
   * Validate status type
   */
  private validateStatusType(status: string): status is StatusType {
    return ['approved', 'rejected', 'pending'].includes(status);
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

  /**
   * Create a client and build a register transaction
   * This demonstrates how to use the createClient method
   */
  async createClientAndBuildRegisterTransaction(
    wallet: string,
    name: string,
    surnames: string
  ): Promise<BuildTransactionResponse> {
    try {
      this.logger.log(`Creating client and building register transaction for wallet: ${wallet}`);

      // Create a client using the new createClient method
      const client = this.createClient(wallet);

      // Build the register transaction
      const transaction = await client.register({ wallet, name, surnames });

      // Simulate to get authorization entries and prepare the transaction
      const simulation = await transaction.simulate();
      this.logger.log(`Simulation completed. Auth entries: ${(simulation as any).auth?.length || 0}`);

      // Get the latest ledger for proper expiration
      const latestLedger = await this.rpcServer.getLatestLedger();
      const expirationLedger = latestLedger.sequence + 1000;

      // Handle authorization entries if they exist
      let authEntries = [];
      const simulationAuth = (simulation as any).auth;
      if (simulationAuth && simulationAuth.length > 0) {
        this.logger.log(`Found ${simulationAuth.length} authorization entries`);
        
        // Prepare auth entries with proper expiration ledger
        authEntries = simulationAuth.map(entry => ({
          ...entry,
          credentials: {
            ...entry.credentials,
            address: {
              ...entry.credentials.address,
              signature_expiration_ledger: expirationLedger
            }
          }
        }));
        
        this.logger.log(`Prepared ${authEntries.length} auth entries with expiration ledger: ${expirationLedger}`);
      }

      // Get the transaction XDR
      const xdrString = transaction.toXDR();
      const parsedTx = TransactionBuilder.fromXDR(xdrString, this.networkPassphrase);
      const fee = parsedTx.fee;
      const tb = 'timeBounds' in parsedTx ? parsedTx.timeBounds : undefined;
      const sequence = 'sequence' in parsedTx ? parsedTx.sequence : '0';

      this.logger.log(`Transaction built successfully. Sequence: ${sequence}, Auth entries: ${authEntries.length}`);
      
      if (authEntries.length > 0) {
        this.logger.log(`IMPORTANT: This transaction has ${authEntries.length} authorization entries that need to be signed manually.`);
        this.logger.log(`Use Stellar Lab or another tool to sign the authorization entries before submitting.`);
        this.logger.log(`Authorization entries require signing by: ${wallet}`);
      }

      return {
        success: true,
        xdr: xdrString,
        sourceAccount: wallet,
        sequence,
        fee: String(fee),
        timebounds: tb ? { minTime: tb.minTime.toString(), maxTime: tb.maxTime.toString() } : undefined,
        footprint: undefined,
        authEntries: authEntries
      };

    } catch (error) {
      this.logger.error('Error creating client and building register transaction:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}