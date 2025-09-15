import { Test, TestingModule } from '@nestjs/testing';
import { PlatformService } from './platform.service';
import { StellarService } from './stellar.service';

describe('PlatformService', () => {
  let service: PlatformService;
  let stellarService: jest.Mocked<StellarService>;

  beforeEach(async () => {
    const mockStellarService = {
      validateWalletAddress: jest.fn(),
      getScore: jest.fn(),
      getVerifications: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformService,
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
      ],
    }).compile();

    service = module.get<PlatformService>(PlatformService);
    stellarService = module.get(StellarService);

    jest.clearAllMocks();
  });

  describe('getScore', () => {
    it('should get score successfully for valid wallet', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const expectedScore = 45;

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockResolvedValue(expectedScore);

      const result = await service.getScore(wallet);

      expect(stellarService.validateWalletAddress).toHaveBeenCalledWith(wallet);
      expect(stellarService.getScore).toHaveBeenCalledWith(wallet);
      expect(result).toEqual({
        score: expectedScore,
        success: true,
        message: 'Score retrieved successfully',
      });
    });

    it('should return error for invalid wallet address', async () => {
      const wallet = 'invalid-wallet-address';

      stellarService.validateWalletAddress.mockReturnValue(false);

      const result = await service.getScore(wallet);

      expect(stellarService.validateWalletAddress).toHaveBeenCalledWith(wallet);
      expect(stellarService.getScore).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        message: 'Invalid wallet address format',
      });
    });

    it('should handle stellar service errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockRejectedValue(new Error('Stellar network error'));

      const result = await service.getScore(wallet);

      expect(result).toEqual({
        success: false,
        message: 'Failed to get score: Stellar network error',
      });
    });

    it('should handle unexpected errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockRejectedValue('Unexpected error');

      const result = await service.getScore(wallet);

      expect(result).toEqual({
        success: false,
        message: 'Failed to get score: Unknown error',
      });
    });
  });

  describe('getVerifications', () => {
    it('should get verifications successfully for valid wallet', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const expectedVerifications = [
        {
          type: 'email',
          points: 10,
          timestamp: '2023-01-01T00:00:00Z',
        },
        {
          type: 'phone',
          points: 15,
          timestamp: '2023-01-02T00:00:00Z',
        },
      ];

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getVerifications.mockResolvedValue(expectedVerifications);

      const result = await service.getVerifications(wallet);

      expect(stellarService.validateWalletAddress).toHaveBeenCalledWith(wallet);
      expect(stellarService.getVerifications).toHaveBeenCalledWith(wallet);
      expect(result).toEqual({
        verifications: expectedVerifications,
        success: true,
        message: 'Verifications retrieved successfully',
      });
    });

    it('should return error for invalid wallet address', async () => {
      const wallet = 'invalid-wallet-address';

      stellarService.validateWalletAddress.mockReturnValue(false);

      const result = await service.getVerifications(wallet);

      expect(stellarService.validateWalletAddress).toHaveBeenCalledWith(wallet);
      expect(stellarService.getVerifications).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        message: 'Invalid wallet address format',
      });
    });

    it('should handle stellar service errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getVerifications.mockRejectedValue(new Error('Contract error'));

      const result = await service.getVerifications(wallet);

      expect(result).toEqual({
        success: false,
        message: 'Failed to get verifications: Contract error',
      });
    });

    it('should handle empty verifications array', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const expectedVerifications: any[] = [];

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getVerifications.mockResolvedValue(expectedVerifications);

      const result = await service.getVerifications(wallet);

      expect(result).toEqual({
        verifications: expectedVerifications,
        success: true,
        message: 'Verifications retrieved successfully',
      });
    });
  });

  describe('isHuman', () => {
    it('should return true for human-verified user (score >= threshold)', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const score = 50; // Above threshold of 35

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockResolvedValue(score);

      const result = await service.isHuman(wallet);

      expect(stellarService.validateWalletAddress).toHaveBeenCalledWith(wallet);
      expect(stellarService.getScore).toHaveBeenCalledWith(wallet);
      expect(result).toEqual({
        isHuman: true,
        score: score,
        success: true,
        message: `Human verification completed. Score: ${score}, Threshold: 35, Result: Human`,
      });
    });

    it('should return false for non-human user (score < threshold)', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const score = 20; // Below threshold of 35

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockResolvedValue(score);

      const result = await service.isHuman(wallet);

      expect(result).toEqual({
        isHuman: false,
        score: score,
        success: true,
        message: `Human verification completed. Score: ${score}, Threshold: 35, Result: Not Human`,
      });
    });

    it('should return true for user with exact threshold score', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const score = 35; // Exactly at threshold

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockResolvedValue(score);

      const result = await service.isHuman(wallet);

      expect(result).toEqual({
        isHuman: true,
        score: score,
        success: true,
        message: `Human verification completed. Score: ${score}, Threshold: 35, Result: Human`,
      });
    });

    it('should return error for invalid wallet address', async () => {
      const wallet = 'invalid-wallet-address';

      stellarService.validateWalletAddress.mockReturnValue(false);

      const result = await service.isHuman(wallet);

      expect(stellarService.validateWalletAddress).toHaveBeenCalledWith(wallet);
      expect(stellarService.getScore).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        message: 'Invalid wallet address format',
      });
    });

    it('should handle stellar service errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockRejectedValue(new Error('Network timeout'));

      const result = await service.isHuman(wallet);

      expect(result).toEqual({
        success: false,
        message: 'Failed to verify if human: Network timeout',
      });
    });

    it('should handle unexpected errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockRejectedValue('Unexpected error');

      const result = await service.isHuman(wallet);

      expect(result).toEqual({
        success: false,
        message: 'Failed to verify if human: Unknown error',
      });
    });
  });

  describe('isHumanNS', () => {
    it('should return true for human-verified user without score details', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const score = 50; // Above threshold of 35

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockResolvedValue(score);

      const result = await service.isHumanNS(wallet);

      expect(stellarService.validateWalletAddress).toHaveBeenCalledWith(wallet);
      expect(stellarService.getScore).toHaveBeenCalledWith(wallet);
      expect(result).toEqual({
        isHuman: true,
        success: true,
        message: 'Human verification completed. Threshold: 35, Result: Human',
      });
    });

    it('should return false for non-human user without score details', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const score = 20; // Below threshold of 35

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockResolvedValue(score);

      const result = await service.isHumanNS(wallet);

      expect(result).toEqual({
        isHuman: false,
        success: true,
        message: 'Human verification completed. Threshold: 35, Result: Not Human',
      });
    });

    it('should return error for invalid wallet address', async () => {
      const wallet = 'invalid-wallet-address';

      stellarService.validateWalletAddress.mockReturnValue(false);

      const result = await service.isHumanNS(wallet);

      expect(stellarService.validateWalletAddress).toHaveBeenCalledWith(wallet);
      expect(stellarService.getScore).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        message: 'Invalid wallet address format',
      });
    });

    it('should handle stellar service errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';

      stellarService.validateWalletAddress.mockReturnValue(true);
      stellarService.getScore.mockRejectedValue(new Error('Contract not found'));

      const result = await service.isHumanNS(wallet);

      expect(result).toEqual({
        success: false,
        message: 'Failed to verify if human: Contract not found',
      });
    });
  });

  describe('HUMAN_THRESHOLD', () => {
    it('should have correct human threshold value', () => {
      // Access the private property through the service instance
      const threshold = (service as any).HUMAN_THRESHOLD;
      expect(threshold).toBe(35);
    });
  });
});
