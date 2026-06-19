import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Keypair } from '@stellar/stellar-sdk';
import { StellarService } from './stellar.service';
import { StellarTransactionQueue } from './stellar-transaction-queue.service';
import { FailedStellarTxRepository } from '../../infrastructure/firebase/failed-stellar-tx.repository';
import { AdminService } from './admin.service';
import { PlatformService } from './platform.service';
import * as crypto from 'crypto';

describe('StellarService submitVerificationWithRetry', () => {
  let service: StellarService;
  let adminKeypair: Keypair;

  beforeEach(async () => {
    adminKeypair = Keypair.random();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'STELLAR_NETWORK') return 'testnet';
              if (key === 'STELLAR_CONTRACT_ID') return 'CAWLDMLCOUPD4OSXQF3WHMTCXW6MS3QNYNFFCTXT2J3VLDH7AUECDDB3';
              if (key === 'STELLAR_ADMIN_SECRET_KEY') return adminKeypair.secret();
              if (key === 'STELLAR_TX_MAX_RETRIES') return '5';
              if (key === 'STELLAR_TX_BACKOFF_BASE_MS') return '10';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(StellarService);
  });

  it('retries on tx_bad_seq and succeeds on second attempt', async () => {
    const buildSpy = jest
      .spyOn(service as any, 'buildSignAndSubmitVerification')
      .mockRejectedValueOnce(new Error('tx_bad_seq'))
      .mockResolvedValueOnce('hash-retry-success');

    const result = await service.submitVerificationWithRetry({
      wallet: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
      verification: {
        issuer: 'admin',
        points: 0,
        timestamp: BigInt(Date.now()),
        vtype: { tag: 'Custom', values: ['APPROVED'] },
      },
      sourceAccount: adminKeypair.publicKey(),
    });

    expect(result.success).toBe(true);
    expect(result.transactionHash).toBe('hash-retry-success');
    expect(result.attempts).toBe(2);
    expect(buildSpy).toHaveBeenCalledTimes(2);
  });

  it('returns failure after max retries exhausted', async () => {
    jest
      .spyOn(service as any, 'buildSignAndSubmitVerification')
      .mockRejectedValue(new Error('tx_bad_seq'));

    const result = await service.submitVerificationWithRetry({
      wallet: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
      verification: {
        issuer: 'admin',
        points: 0,
        timestamp: BigInt(Date.now()),
        vtype: { tag: 'Custom', values: ['APPROVED'] },
      },
      sourceAccount: adminKeypair.publicKey(),
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(5);
    expect(result.lastError).toContain('tx_bad_seq');
  });

  it('does not retry permanent errors', async () => {
    const buildSpy = jest
      .spyOn(service as any, 'buildSignAndSubmitVerification')
      .mockRejectedValue(new Error('function_trapped'));

    const result = await service.submitVerificationWithRetry({
      wallet: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
      verification: {
        issuer: 'admin',
        points: 0,
        timestamp: BigInt(Date.now()),
        vtype: { tag: 'Custom', values: ['APPROVED'] },
      },
      sourceAccount: adminKeypair.publicKey(),
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(5);
    expect(buildSpy).toHaveBeenCalledTimes(1);
  });
});

describe('AdminService idempotency and queue routing', () => {
  let service: AdminService;
  let stellarService: {
    validateWalletAddress: jest.Mock;
    submitVerificationWithRetry: jest.Mock;
  };
  let stellarQueue: StellarTransactionQueue;
  let failedTxRepository: {
    findUnresolvedByIdempotencyKey: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
    markRetried: jest.Mock;
    markResolved: jest.Mock;
  };

  const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
  const sourceAccount = 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP';

  beforeEach(async () => {
    stellarService = {
      validateWalletAddress: jest.fn().mockReturnValue(true),
      submitVerificationWithRetry: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: 'hash-123',
        attempts: 1,
      }),
    };

    failedTxRepository = {
      findUnresolvedByIdempotencyKey: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      findById: jest.fn(),
      markRetried: jest.fn(),
      markResolved: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        StellarTransactionQueue,
        { provide: StellarService, useValue: stellarService },
        { provide: PlatformService, useValue: { isHuman: jest.fn() } },
        { provide: FailedStellarTxRepository, useValue: failedTxRepository },
      ],
    }).compile();

    service = module.get(AdminService);
    stellarQueue = module.get(StellarTransactionQueue);
  });

  it('skips duplicate idempotency key already in queue', async () => {
    const sessionToken = 'session-1';
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${wallet}:upsert_verification:${sessionToken}`)
      .digest('hex');

    stellarQueue.trackInFlightKey(idempotencyKey);

    const result = await service.updateStatus(
      wallet,
      { status: 'APPROVED', sourceAccount },
      { sessionToken },
    );

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(stellarService.submitVerificationWithRetry).not.toHaveBeenCalled();
  });

  it('skips duplicate key matching unresolved dead-letter', async () => {
    const sessionToken = 'session-2';
    failedTxRepository.findUnresolvedByIdempotencyKey.mockResolvedValue({
      id: 'dl-1',
      resolved: false,
    });

    const result = await service.updateStatus(
      wallet,
      { status: 'APPROVED', sourceAccount },
      { sessionToken },
    );

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(stellarService.submitVerificationWithRetry).not.toHaveBeenCalled();
  });

  it('writes to dead-letter after retries exhausted', async () => {
    stellarService.submitVerificationWithRetry.mockResolvedValue({
      success: false,
      attempts: 5,
      lastError: 'tx_bad_seq',
    });

    const result = await service.updateStatus(
      wallet,
      { status: 'APPROVED', sourceAccount },
      { sessionToken: 'session-3' },
    );

    expect(result.success).toBe(false);
    expect(failedTxRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet,
        operation: 'upsert_verification',
        lastError: 'tx_bad_seq',
        resolved: false,
      }),
    );
  });
});
