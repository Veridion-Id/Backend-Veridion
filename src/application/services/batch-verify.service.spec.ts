import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BatchVerifyService } from './batch-verify.service';
import { IDENTITY_READ_PORT } from '../../domain/ports/identity-read.port';

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_WALLET_A = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB';
const VALID_WALLET_B = 'GDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890DE';
const INVALID_WALLET = 'not-a-stellar-address';

function buildModule(
  overrides: {
    getScore?: jest.Mock;
    validateWalletAddress?: jest.Mock;
    threshold?: number;
    maxWallets?: number;
  } = {},
) {
  const mockIdentityRead = {
    getScore: overrides.getScore ?? jest.fn(),
    validateWalletAddress:
      overrides.validateWalletAddress ??
      jest.fn((w: string) => w !== INVALID_WALLET),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'BATCH_VERIFY_HUMAN_THRESHOLD') {
        return overrides.threshold ?? 35;
      }
      if (key === 'BATCH_VERIFY_MAX_WALLETS') {
        return overrides.maxWallets ?? 25;
      }
      return defaultValue;
    }),
  };

  return Test.createTestingModule({
    providers: [
      BatchVerifyService,
      { provide: IDENTITY_READ_PORT, useValue: mockIdentityRead },
      { provide: ConfigService, useValue: mockConfigService },
    ],
  }).compile();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BatchVerifyService', () => {
  let service: BatchVerifyService;
  let identityRead: { getScore: jest.Mock; validateWalletAddress: jest.Mock };

  beforeEach(async () => {
    const getScore = jest.fn();
    const validateWalletAddress = jest.fn((w: string) => w !== INVALID_WALLET);

    const module: TestingModule = await (
      await buildModule({ getScore, validateWalletAddress })
    );

    service = module.get<BatchVerifyService>(BatchVerifyService);
    identityRead = module.get(IDENTITY_READ_PORT);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('verifyBatch — happy path', () => {
    it('returns isHuman: true for a wallet with score above threshold', async () => {
      identityRead.getScore.mockResolvedValue(50);

      const result = await service.verifyBatch([VALID_WALLET_A]);

      expect(result.processed).toBe(1);
      expect(result.invalid).toBe(0);
      expect(result.threshold).toBe(35);
      expect(result.results[0]).toEqual({
        wallet: VALID_WALLET_A,
        registered: true,
        score: 50,
        isHuman: true,
      });
    });

    it('returns isHuman: false for a wallet with score below threshold', async () => {
      identityRead.getScore.mockResolvedValue(10);

      const result = await service.verifyBatch([VALID_WALLET_A]);

      expect(result.results[0].isHuman).toBe(false);
    });

    it('returns isHuman: true when score equals the threshold exactly', async () => {
      identityRead.getScore.mockResolvedValue(35);

      const result = await service.verifyBatch([VALID_WALLET_A]);

      expect(result.results[0].isHuman).toBe(true);
    });

    it('processes multiple wallets and returns all results', async () => {
      identityRead.getScore
        .mockResolvedValueOnce(50)  // wallet A — human
        .mockResolvedValueOnce(10); // wallet B — not human

      const result = await service.verifyBatch([VALID_WALLET_A, VALID_WALLET_B]);

      expect(result.processed).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].isHuman).toBe(true);
      expect(result.results[1].isHuman).toBe(false);
    });
  });

  // ── Unregistered wallets ───────────────────────────────────────────────────

  describe('verifyBatch — unregistered wallets', () => {
    it('returns registered: false without throwing when contract says not registered', async () => {
      identityRead.getScore.mockRejectedValue(
        new Error('Contract error: User is not registered'),
      );

      const result = await service.verifyBatch([VALID_WALLET_A]);

      expect(result.results[0]).toEqual({
        wallet: VALID_WALLET_A,
        registered: false,
        score: 0,
        isHuman: false,
      });
    });

    it('handles NotRegistered error variant', async () => {
      identityRead.getScore.mockRejectedValue(
        new Error('NotRegistered'),
      );

      const result = await service.verifyBatch([VALID_WALLET_A]);

      expect(result.results[0].registered).toBe(false);
    });

    it('processes a mix of registered and unregistered wallets', async () => {
      identityRead.getScore
        .mockResolvedValueOnce(42)
        .mockRejectedValueOnce(new Error('User is not registered'));

      const result = await service.verifyBatch([VALID_WALLET_A, VALID_WALLET_B]);

      expect(result.processed).toBe(2);
      expect(result.results[0].registered).toBe(true);
      expect(result.results[1].registered).toBe(false);
    });
  });

  // ── Invalid addresses ──────────────────────────────────────────────────────

  describe('verifyBatch — invalid wallet addresses', () => {
    it('skips invalid addresses and counts them in invalid', async () => {
      identityRead.getScore.mockResolvedValue(50);

      const result = await service.verifyBatch([VALID_WALLET_A, INVALID_WALLET]);

      expect(result.processed).toBe(1);
      expect(result.invalid).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].wallet).toBe(VALID_WALLET_A);
    });

    it('does not call getScore for invalid addresses', async () => {
      identityRead.validateWalletAddress.mockReturnValue(false);

      await expect(
        service.verifyBatch([INVALID_WALLET]),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(identityRead.getScore).not.toHaveBeenCalled();
    });

    it('throws 422 when all addresses are invalid', async () => {
      identityRead.validateWalletAddress.mockReturnValue(false);

      await expect(
        service.verifyBatch([INVALID_WALLET, 'also-bad']),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  // ── Batch size validation ──────────────────────────────────────────────────

  describe('verifyBatch — size limits', () => {
    it('throws 400 when wallets array exceeds maxWallets', async () => {
      const tooMany = Array.from({ length: 26 }, (_, i) => `wallet-${i}`);

      await expect(service.verifyBatch(tooMany)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws 400 for an empty wallets array', async () => {
      await expect(service.verifyBatch([])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts exactly maxWallets wallets without throwing', async () => {
      // All invalid so we just check it gets past the size guard
      identityRead.validateWalletAddress.mockReturnValue(true);
      identityRead.getScore.mockResolvedValue(0);

      const exactly25 = Array.from({ length: 25 }, (_, i) => `G${'A'.repeat(55)}${i}`.slice(0, 56));
      // Will throw 422 if all invalid — but we mocked validateWalletAddress to return true
      const result = await service.verifyBatch(exactly25);
      expect(result.processed).toBe(25);
    });
  });

  // ── Config-driven threshold ────────────────────────────────────────────────

  describe('verifyBatch — configurable threshold', () => {
    it('uses threshold from ConfigService', async () => {
      const module: TestingModule = await buildModule({ threshold: 50 });
      const svc = module.get<BatchVerifyService>(BatchVerifyService);
      const port = module.get(IDENTITY_READ_PORT);
      (port.getScore as jest.Mock).mockResolvedValue(45);

      const result = await svc.verifyBatch([VALID_WALLET_A]);

      // 45 < 50 → not human
      expect(result.results[0].isHuman).toBe(false);
      expect(result.threshold).toBe(50);
    });

    it('uses maxWallets from ConfigService', async () => {
      const module: TestingModule = await buildModule({ maxWallets: 3 });
      const svc = module.get<BatchVerifyService>(BatchVerifyService);

      const tooMany = [VALID_WALLET_A, VALID_WALLET_B, 'G3', 'G4'];

      await expect(svc.verifyBatch(tooMany)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // ── Unexpected errors ──────────────────────────────────────────────────────

  describe('verifyBatch — unexpected errors', () => {
    it('re-throws unexpected contract errors', async () => {
      identityRead.getScore.mockRejectedValue(new Error('RPC timeout'));

      await expect(service.verifyBatch([VALID_WALLET_A])).rejects.toThrow(
        'RPC timeout',
      );
    });
  });
});
