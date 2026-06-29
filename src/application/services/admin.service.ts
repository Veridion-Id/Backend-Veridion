import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  StellarService,
  StatusType as StellarStatusType,
  StatusUpdateResponse,
  StatusResponse,
} from '../../infrastructure/stellar/stellar.service'
import { PlatformService } from './platform.service';
import { UserService } from './user.service';
import { StellarTransactionQueue } from './stellar-transaction-queue.service';
import { FailedStellarTxRepository } from '../../infrastructure/firebase/failed-stellar-tx.repository';
import { 
  BuildRegisterTransactionDto,
  BuildRegisterTransactionResponse,
  SubmitSignedTransactionDto,
  SubmitSignedTransactionResponse,
  BuildCreateVerificationTransactionDto,
  BuildCreateVerificationTransactionResponse,
  ApiKeyResponse,
  StatusType,
  GetStatusResponse,
  UpdateStatusDto,
  UpdateStatusResponse,
  UpdateStatusOptions
} from '../../domain/entities/admin.entity';
import { ApiKeyRequestDto, ApiKeyResponse as HumanApiKeyResponse } from '../../domain/entities/api-key.entity';
import { RetryStellarTxResponse } from '../../domain/entities/failed-stellar-tx.entity';
import { CreatePassDto, CreatePassResponse, CreatePassOptions } from '../../domain/entities/pass.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly stellarService: StellarService,
    private readonly platformService: PlatformService,
    private readonly stellarQueue: StellarTransactionQueue,
    private readonly failedTxRepository: FailedStellarTxRepository,
    private readonly userService: UserService,
  ) {}


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
      this.logger.log(buildDto);
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
        // Provide helpful error message for sequence issues
        const message = result.error?.includes('sequence') && result.error?.includes('outdated')
          ? `Failed to submit transaction: ${result.error}. Please call the build endpoint again to get a new transaction with the current sequence number.`
          : `Failed to submit transaction: ${result.error}`;
        
        return {
          success: false,
          message: message,
          error: result.error,
          rebuiltXdr: result.rebuiltXdr // Pass through the rebuilt XDR if available
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

  /**
   * Build a transaction for creating verification (BUILD phase)
   * Creates an unsigned XDR transaction that the client can sign
   */
  async buildCreateVerificationTransaction(
    buildDto: BuildCreateVerificationTransactionDto
  ): Promise<BuildCreateVerificationTransactionResponse> {
    try {
      this.logger.log(`Building create verification transaction for wallet: ${buildDto.wallet}, source account: ${buildDto.sourceAccount}`);

      // Create a verification object compatible with the new interface
      const verification = {
        issuer: 'admin', // Default issuer for admin-created verifications
        points: buildDto.points,
        timestamp: BigInt(Date.now()),
        vtype: this.convertToVerificationType(buildDto.verificationType)
      };

      // Call the stellar service to build the transaction
      const result = await this.stellarService.buildCreateVerificationTransaction(
        buildDto.wallet,
        verification,
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
      this.logger.error(`Failed to build create verification transaction for wallet: ${buildDto.wallet}`, error);
      return {
        success: false,
        message: `Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate a new API key for hackathon participants
   * Returns a simple API key that can be used for authentication
   */
  async generateApiKey(): Promise<ApiKeyResponse> {
    try {
      this.logger.log('Generating new API key for hackathon participant');

      // Generate a simple API key using crypto
      const crypto = require('crypto');
      const apiKey = `veridion_${crypto.randomBytes(32).toString('hex')}`;

      this.logger.log('API key generated successfully');
      return {
        success: true,
        message: 'API key generated successfully',
        apiKey: apiKey
      };

    } catch (error) {
      this.logger.error('Failed to generate API key', error);
      return {
        success: false,
        message: `Failed to generate API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate an API key for human-verified users
   * Checks if the user is human via their wallet address and score
   */
  async generateApiKeyForHuman(wallet: string): Promise<HumanApiKeyResponse> {
    try {
      this.logger.log(`Generating API key for human-verified wallet: ${wallet}`);

      // Check if the user is human verified
      const humanCheck = await this.platformService.isHuman(wallet);

      if (!humanCheck.success) {
        this.logger.warn(`Human verification failed for wallet: ${wallet}, error: ${humanCheck.message}`);
        return {
          success: false,
          message: `Human verification failed: ${humanCheck.message}`,
          error: humanCheck.message
        };
      }

      if (!humanCheck.isHuman) {
        this.logger.warn(`User is not human verified for wallet: ${wallet}, score: ${humanCheck.score}`);
        return {
          success: false,
          message: 'User is not human verified. API key generation denied.',
          isHuman: false,
          score: humanCheck.score,
          error: 'User does not meet human verification requirements'
        };
      }

      // Generate API key for verified human user
      const crypto = require('crypto');
      const apiKey = `veridion_hm_${crypto.randomBytes(32).toString('hex')}`;

      this.logger.log(`API key generated successfully for human-verified wallet: ${wallet}, score: ${humanCheck.score}`);
      return {
        success: true,
        message: 'API key generated successfully for human-verified user',
        apiKey: apiKey,
        isHuman: true,
        score: humanCheck.score
      };

    } catch (error) {
      this.logger.error(`Failed to generate API key for wallet: ${wallet}`, error);
      return {
        success: false,
        message: `Failed to generate API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert string verification type to VerificationType enum
   */
  private convertToVerificationType(type: string): any {
    switch (type.toLowerCase()) {
      case 'over18':
        return { tag: 'Over18', values: undefined };
      case 'twitter':
        return { tag: 'Twitter', values: undefined };
      case 'github':
        return { tag: 'GitHub', values: undefined };
      default:
        // For custom types, wrap in Custom
        return { tag: 'Custom', values: [type] };
    }
  }

  /**
   * Get the current sequence number for an account
   */
  async getAccountSequence(accountId: string): Promise<{ sequence: string; success: boolean; error?: string }> {
    return this.stellarService.getAccountSequence(accountId);
  }


  /**
   * Build a client-based register transaction (BUILD phase)
   * Uses the createClient method for building transactions
   */
  async buildClientRegisterTransaction(
    buildDto: BuildRegisterTransactionDto
  ): Promise<BuildRegisterTransactionResponse> {
    try {
      this.logger.log(`Building client register transaction for wallet: ${buildDto.wallet}`);

      // Call the stellar service to build the transaction using the client method
      const result = await this.stellarService.createClientAndBuildRegisterTransaction(
        buildDto.wallet,
        buildDto.name,
        buildDto.surnames
      );

      if (result.success) {
        this.logger.log(`Client transaction built successfully for wallet: ${buildDto.wallet}`);
        return {
          success: true,
          message: 'Client transaction built successfully',
          xdr: result.xdr,
          sourceAccount: result.sourceAccount,
          sequence: result.sequence,
          fee: result.fee,
          timebounds: result.timebounds,
          footprint: result.footprint,
          authEntries: result.authEntries
        };
      } else {
        this.logger.error(`Failed to build client transaction for wallet: ${buildDto.wallet}, error: ${result.error}`);
        return {
          success: false,
          message: `Failed to build client transaction: ${result.error}`,
          error: result.error
        };
      }

    } catch (error) {
      this.logger.error(`Failed to build client register transaction for wallet: ${buildDto.wallet}`, error);
      return {
        success: false,
        message: `Failed to build client transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user status from verifications
   * Searches through user verifications to find Custom verification with status
   */
  async getStatus(wallet: string): Promise<GetStatusResponse> {
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

      // Get all verifications for the user
      const verifications = await this.stellarService.getVerifications(wallet);

      // Look for Custom verification with status (most recent one)
      let latestStatus: StatusType | null = null;
      let latestTimestamp = BigInt(0);

      for (const verification of verifications) {
        if (verification.vtype.tag === 'Custom' && verification.vtype.values[0]) {
          const customValue = verification.vtype.values[0];
          // Check if it's a status verification
          if (['APPROVED', 'PENDING', 'REJECTED'].includes(customValue)) {
            const status = customValue as StatusType;
            if (verification.timestamp > latestTimestamp) {
              latestStatus = status;
              latestTimestamp = verification.timestamp;
            }
          }
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
        this.logger.log(`No status found for wallet: ${wallet}, defaulting to PENDING`);
        return {
          success: true,
          status: 'PENDING',
          message: 'No status found, defaulting to PENDING'
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
   * Update user status by submitting an upsert_verification transaction on-chain.
   * Routed through the serial Stellar transaction queue with optional idempotency.
   */
  async updateStatus(
    wallet: string,
    updateDto: UpdateStatusDto,
    options?: UpdateStatusOptions,
  ): Promise<UpdateStatusResponse> {
    const operation = 'upsert_verification';

    try {
      this.logger.log(
        `Updating status for wallet: ${wallet}, status: ${updateDto.status}, source: ${updateDto.sourceAccount}`,
      );

      if (!this.stellarService.validateWalletAddress(wallet)) {
        return {
          success: false,
          message: 'Invalid wallet address format',
          error: 'Invalid wallet address format',
        };
      }

      if (!this.stellarService.validateWalletAddress(updateDto.sourceAccount)) {
        return {
          success: false,
          message: 'Invalid source account format',
          error: 'Invalid source account format',
        };
      }

      if (!['APPROVED', 'PENDING', 'REJECTED'].includes(updateDto.status)) {
        return {
          success: false,
          message: 'Invalid status type. Must be APPROVED, PENDING, or REJECTED',
          error: 'Invalid status type',
        };
      }

      const idempotencyKey =
        options?.idempotencyKey ??
        (options?.sessionToken
          ? crypto
              .createHash('sha256')
              .update(`${wallet}:${operation}:${options.sessionToken}`)
              .digest('hex')
          : undefined);

      if (idempotencyKey) {
        if (this.stellarQueue.hasInFlightKey(idempotencyKey)) {
          this.logger.log(
            `Skipping duplicate in-flight submission for key=${idempotencyKey}`,
          );
          return {
            success: true,
            skipped: true,
            message: 'Duplicate submission skipped (already in queue)',
          };
        }

        const unresolved =
          await this.failedTxRepository.findUnresolvedByIdempotencyKey(
            idempotencyKey,
          );
        if (unresolved) {
          this.logger.log(
            `Skipping duplicate submission for unresolved dead-letter key=${idempotencyKey}`,
          );
          return {
            success: true,
            skipped: true,
            message: 'Duplicate submission skipped (unresolved dead-letter exists)',
          };
        }
      }

      const verification = {
        issuer: 'admin',
        points: 0,
        timestamp: BigInt(Date.now()),
        vtype: { tag: 'Custom', values: [updateDto.status] } as any,
      };

      const payload = {
        status: updateDto.status,
        sourceAccount: updateDto.sourceAccount,
        sessionToken: options?.sessionToken,
      };

      const result = await this.stellarQueue.enqueue(
        () =>
          this.stellarService.submitVerificationWithRetry({
            wallet,
            verification,
            sourceAccount: updateDto.sourceAccount,
          }),
        idempotencyKey,
      );

      if (result.success) {
        this.logger.log(
          `Status updated on-chain for wallet: ${wallet}, status: ${updateDto.status}, hash: ${result.transactionHash}`,
        );
        return {
          success: true,
          message: `Status updated on-chain: ${updateDto.status}`,
          transactionHash: result.transactionHash,
          sourceAccount: updateDto.sourceAccount,
        };
      }

      if (idempotencyKey) {
        await this.failedTxRepository.create({
          wallet,
          operation,
          payload,
          idempotencyKey,
          attempts: result.attempts,
          lastError: result.lastError ?? 'Unknown error',
          resolved: false,
          createdAt: new Date(),
        });
      }

      return {
        success: false,
        message: `Failed to submit status update: ${result.lastError}`,
        error: result.lastError,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update status for wallet: ${wallet}, status: ${updateDto.status}`,
        error,
      );
      return {
        success: false,
        message: `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Register a wallet's identity on-chain (admin-sponsored), routed through the
   * serial Stellar transaction queue with retry/backoff and idempotency.
   * On success persists the identity in Firestore (users collection).
   */
  async createPass(
    dto: CreatePassDto,
    options?: CreatePassOptions,
  ): Promise<CreatePassResponse> {
    const operation = 'register';

    try {
      this.logger.log(
        `Creating pass (register) for wallet: ${dto.wallet}, source: ${dto.sourceAccount}`,
      );

      if (!this.stellarService.validateWalletAddress(dto.wallet)) {
        return { success: false, message: 'Invalid wallet address format', error: 'Invalid wallet address format' };
      }
      if (!this.stellarService.validateWalletAddress(dto.sourceAccount)) {
        return { success: false, message: 'Invalid source account format', error: 'Invalid source account format' };
      }

      // A wallet can only register once -> idempotency keyed on wallet:register
      const idempotencyKey =
        options?.idempotencyKey ??
        crypto.createHash('sha256').update(`${dto.wallet}:${operation}`).digest('hex');

      if (this.stellarQueue.hasInFlightKey(idempotencyKey)) {
        this.logger.log(`Skipping duplicate in-flight register for key=${idempotencyKey}`);
        return { success: true, skipped: true, message: 'Duplicate registration skipped (already in queue)' };
      }

      const unresolved = await this.failedTxRepository.findUnresolvedByIdempotencyKey(idempotencyKey);
      if (unresolved) {
        this.logger.log(`Skipping duplicate register for unresolved dead-letter key=${idempotencyKey}`);
        return { success: true, skipped: true, message: 'Duplicate registration skipped (unresolved dead-letter exists)' };
      }

      const payload = {
        name: dto.name,
        surnames: dto.surnames,
        sourceAccount: dto.sourceAccount,
      };

      const result = await this.stellarQueue.enqueue(
        () =>
          this.stellarService.submitRegisterWithRetry({
            wallet: dto.wallet,
            name: dto.name,
            surnames: dto.surnames,
            sourceAccount: dto.sourceAccount,
          }),
        idempotencyKey,
      );

      if (result.alreadyRegistered) {
        this.logger.warn(`Wallet already registered on-chain: ${dto.wallet}`);
        return {
          success: false,
          alreadyRegistered: true,
          message: 'Wallet is already registered',
          error: result.lastError,
        };
      }

      if (result.success) {
        this.logger.log(`Wallet registered on-chain: ${dto.wallet}, hash: ${result.transactionHash}`);

        // Persist identity in Firestore (users collection). On-chain is the source
        // of truth, so a Firestore failure must not fail the request.
        try {
          await this.userService.create({ walletAddress: dto.wallet, name: dto.name });
        } catch (persistError) {
          this.logger.error(
            `On-chain register succeeded but Firestore persist failed for wallet=${dto.wallet}`,
            persistError,
          );
        }

        return {
          success: true,
          message: 'Identity registered on-chain',
          transactionHash: result.transactionHash,
          sourceAccount: dto.sourceAccount,
        };
      }

      // Exhausted retries -> dead-letter for later retry via /admin/stellar/retry/:id
      await this.failedTxRepository.create({
        wallet: dto.wallet,
        operation,
        payload,
        idempotencyKey,
        attempts: result.attempts,
        lastError: result.lastError ?? 'Unknown error',
        resolved: false,
        createdAt: new Date(),
      });

      return {
        success: false,
        message: `Failed to register identity: ${result.lastError}`,
        error: result.lastError,
      };
    } catch (error) {
      this.logger.error(`Failed to create pass for wallet: ${dto.wallet}`, error);
      return {
        success: false,
        message: `Failed to register identity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Re-enqueue a dead-letter Stellar transaction for retry.
   */
  async retryFailedStellarTx(id: string): Promise<RetryStellarTxResponse> {
    const record = await this.failedTxRepository.findById(id);

    if (!record) {
      return {
        success: false,
        message: 'Dead-letter record not found',
        error: 'NOT_FOUND',
      };
    }

    if (record.resolved || record.resolvedAt) {
      return {
        success: false,
        message: 'Dead-letter record already resolved',
        error: 'ALREADY_RESOLVED',
      };
    }

    await this.failedTxRepository.markRetried(id);

    if (record.operation === 'register') {
      const sourceAccount = record.payload.sourceAccount as string;
      const name = record.payload.name as string;
      const surnames = record.payload.surnames as string;

      if (!sourceAccount || name === undefined || surnames === undefined) {
        return {
          success: false,
          message: 'Dead-letter payload missing sourceAccount, name, or surnames',
          error: 'INVALID_PAYLOAD',
        };
      }

      const result = await this.stellarQueue.enqueue(() =>
        this.stellarService.submitRegisterWithRetry({
          wallet: record.wallet,
          name,
          surnames,
          sourceAccount,
        }),
      );

      if (result.success || result.alreadyRegistered) {
        await this.failedTxRepository.markResolved(id, result.transactionHash);
        return {
          success: true,
          message: result.alreadyRegistered
            ? 'Wallet already registered on-chain; dead-letter resolved'
            : 'Dead-letter register retried successfully',
          transactionHash: result.transactionHash,
        };
      }

      return {
        success: false,
        message: `Retry failed: ${result.lastError}`,
        error: result.lastError,
      };
    }

    // Default: upsert_verification (existing behavior)
    const sourceAccount = record.payload.sourceAccount as string;
    const status = record.payload.status as StatusType;

    if (!sourceAccount || !status) {
      return {
        success: false,
        message: 'Dead-letter payload missing sourceAccount or status',
        error: 'INVALID_PAYLOAD',
      };
    }

    const verification = {
      issuer: 'admin',
      points: 0,
      timestamp: BigInt(Date.now()),
      vtype: { tag: 'Custom', values: [status] } as any,
    };

    const result = await this.stellarQueue.enqueue(() =>
      this.stellarService.submitVerificationWithRetry({
        wallet: record.wallet,
        verification,
        sourceAccount,
      }),
    );

    if (result.success) {
      await this.failedTxRepository.markResolved(id, result.transactionHash);
      return {
        success: true,
        message: 'Dead-letter transaction retried successfully',
        transactionHash: result.transactionHash,
      };
    }

    return {
      success: false,
      message: `Retry failed: ${result.lastError}`,
      error: result.lastError,
    };
  }

}