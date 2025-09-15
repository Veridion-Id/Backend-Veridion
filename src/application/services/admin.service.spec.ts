import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { StellarService } from './stellar.service';
import { PlatformService } from './platform.service';
import { 
  BuildRegisterTransactionDto,
  SubmitSignedTransactionDto,
  BuildCreateVerificationTransactionDto
} from '../../domain/entities/admin.entity';

describe('AdminService', () => {
  let service: AdminService;
  let stellarService: jest.Mocked<StellarService>;
  let platformService: jest.Mocked<PlatformService>;

  beforeEach(async () => {
    const mockStellarService = {
      buildRegisterTransaction: jest.fn(),
      submitSignedTransaction: jest.fn(),
      buildCreateVerificationTransaction: jest.fn(),
    };

    const mockPlatformService = {
      isHuman: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
        {
          provide: PlatformService,
          useValue: mockPlatformService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    stellarService = module.get(StellarService);
    platformService = module.get(PlatformService);

    jest.clearAllMocks();
  });

  describe('buildRegisterTransaction', () => {
    it('should build register transaction successfully', async () => {
      const buildDto: BuildRegisterTransactionDto = {
        wallet: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        name: 'John',
        surnames: 'Doe',
        sourceAccount: 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP',
      };

      const mockStellarResult = {
        success: true,
        xdr: 'mock-xdr-string',
        sourceAccount: buildDto.sourceAccount,
        sequence: '12345',
        fee: '100',
        timebounds: {
          minTime: '1000',
          maxTime: '2000',
        },
        footprint: 'mock-footprint',
      };

      stellarService.buildRegisterTransaction.mockResolvedValue(mockStellarResult);

      const result = await service.buildRegisterTransaction(buildDto);

      expect(stellarService.buildRegisterTransaction).toHaveBeenCalledWith(
        buildDto.wallet,
        buildDto.name,
        buildDto.surnames,
        buildDto.sourceAccount
      );
      expect(result).toEqual({
        success: true,
        message: 'Transaction built successfully',
        xdr: mockStellarResult.xdr,
        sourceAccount: mockStellarResult.sourceAccount,
        sequence: mockStellarResult.sequence,
        fee: mockStellarResult.fee,
        timebounds: mockStellarResult.timebounds,
        footprint: mockStellarResult.footprint,
      });
    });

    it('should handle stellar service failure', async () => {
      const buildDto: BuildRegisterTransactionDto = {
        wallet: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        name: 'John',
        surnames: 'Doe',
        sourceAccount: 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP',
      };

      const mockStellarResult = {
        success: false,
        error: 'Stellar service error',
      };

      stellarService.buildRegisterTransaction.mockResolvedValue(mockStellarResult);

      const result = await service.buildRegisterTransaction(buildDto);

      expect(result).toEqual({
        success: false,
        message: 'Failed to build transaction: Stellar service error',
        error: 'Stellar service error',
      });
    });

    it('should handle unexpected errors', async () => {
      const buildDto: BuildRegisterTransactionDto = {
        wallet: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        name: 'John',
        surnames: 'Doe',
        sourceAccount: 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP',
      };

      stellarService.buildRegisterTransaction.mockRejectedValue(new Error('Unexpected error'));

      const result = await service.buildRegisterTransaction(buildDto);

      expect(result).toEqual({
        success: false,
        message: 'Failed to build transaction: Unexpected error',
        error: 'Unexpected error',
      });
    });
  });

  describe('submitSignedTransaction', () => {
    it('should submit signed transaction successfully', async () => {
      const submitDto: SubmitSignedTransactionDto = {
        signedXdr: 'mock-signed-xdr',
      };

      const mockStellarResult = {
        success: true,
        transactionHash: 'mock-hash',
        resultMeta: 'mock-result-meta',
      };

      stellarService.submitSignedTransaction.mockResolvedValue(mockStellarResult);

      const result = await service.submitSignedTransaction(submitDto);

      expect(stellarService.submitSignedTransaction).toHaveBeenCalledWith(submitDto.signedXdr);
      expect(result).toEqual({
        success: true,
        message: 'Transaction submitted successfully',
        transactionHash: mockStellarResult.transactionHash,
        resultMeta: mockStellarResult.resultMeta,
      });
    });

    it('should handle stellar service failure', async () => {
      const submitDto: SubmitSignedTransactionDto = {
        signedXdr: 'mock-signed-xdr',
      };

      const mockStellarResult = {
        success: false,
        error: 'Transaction failed',
      };

      stellarService.submitSignedTransaction.mockResolvedValue(mockStellarResult);

      const result = await service.submitSignedTransaction(submitDto);

      expect(result).toEqual({
        success: false,
        message: 'Failed to submit transaction: Transaction failed',
        error: 'Transaction failed',
      });
    });

    it('should handle unexpected errors', async () => {
      const submitDto: SubmitSignedTransactionDto = {
        signedXdr: 'mock-signed-xdr',
      };

      stellarService.submitSignedTransaction.mockRejectedValue(new Error('Network error'));

      const result = await service.submitSignedTransaction(submitDto);

      expect(result).toEqual({
        success: false,
        message: 'Failed to submit transaction: Network error',
        error: 'Network error',
      });
    });
  });

  describe('buildCreateVerificationTransaction', () => {
    it('should build create verification transaction successfully', async () => {
      const buildDto: BuildCreateVerificationTransactionDto = {
        wallet: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        verificationType: 'email',
        points: 10,
        sourceAccount: 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP',
      };

      const mockStellarResult = {
        success: true,
        xdr: 'mock-verification-xdr',
        sourceAccount: buildDto.sourceAccount,
        sequence: '54321',
        fee: '200',
        timebounds: {
          minTime: '2000',
          maxTime: '3000',
        },
        footprint: 'mock-verification-footprint',
      };

      stellarService.buildCreateVerificationTransaction.mockResolvedValue(mockStellarResult);

      const result = await service.buildCreateVerificationTransaction(buildDto);

      expect(stellarService.buildCreateVerificationTransaction).toHaveBeenCalledWith(
        buildDto.wallet,
        { type: buildDto.verificationType, points: buildDto.points },
        buildDto.sourceAccount
      );
      expect(result).toEqual({
        success: true,
        message: 'Transaction built successfully',
        xdr: mockStellarResult.xdr,
        sourceAccount: mockStellarResult.sourceAccount,
        sequence: mockStellarResult.sequence,
        fee: mockStellarResult.fee,
        timebounds: mockStellarResult.timebounds,
        footprint: mockStellarResult.footprint,
      });
    });

    it('should handle stellar service failure', async () => {
      const buildDto: BuildCreateVerificationTransactionDto = {
        wallet: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        verificationType: 'email',
        points: 10,
        sourceAccount: 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP',
      };

      const mockStellarResult = {
        success: false,
        error: 'Verification creation failed',
      };

      stellarService.buildCreateVerificationTransaction.mockResolvedValue(mockStellarResult);

      const result = await service.buildCreateVerificationTransaction(buildDto);

      expect(result).toEqual({
        success: false,
        message: 'Failed to build transaction: Verification creation failed',
        error: 'Verification creation failed',
      });
    });
  });

  describe('generateApiKey', () => {
    it('should generate API key successfully', async () => {
      const result = await service.generateApiKey();

      expect(result.success).toBe(true);
      expect(result.message).toBe('API key generated successfully');
      expect(result.apiKey).toMatch(/^veridion_[a-f0-9]{64}$/);
      expect(result.error).toBeUndefined();
    });

    it('should handle crypto generation errors', async () => {
      // Mock crypto to throw an error
      const originalCrypto = require('crypto');
      jest.doMock('crypto', () => ({
        randomBytes: jest.fn(() => {
          throw new Error('Crypto error');
        }),
      }));

      const result = await service.generateApiKey();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to generate API key');
      expect(result.error).toBe('Crypto error');

      // Restore original crypto
      jest.dontMock('crypto');
    });
  });

  describe('generateApiKeyForHuman', () => {
    it('should generate API key for human-verified user', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      
      const mockHumanCheck = {
        success: true,
        isHuman: true,
        score: 45,
        message: 'Human verification successful',
      };

      platformService.isHuman.mockResolvedValue(mockHumanCheck);

      const result = await service.generateApiKeyForHuman(wallet);

      expect(platformService.isHuman).toHaveBeenCalledWith(wallet);
      expect(result.success).toBe(true);
      expect(result.message).toBe('API key generated successfully for human-verified user');
      expect(result.apiKey).toMatch(/^veridion_hm_[a-f0-9]{64}$/);
      expect(result.isHuman).toBe(true);
      expect(result.score).toBe(45);
    });

    it('should reject API key generation for non-human user', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      
      const mockHumanCheck = {
        success: true,
        isHuman: false,
        score: 20,
        message: 'User is not human',
      };

      platformService.isHuman.mockResolvedValue(mockHumanCheck);

      const result = await service.generateApiKeyForHuman(wallet);

      expect(platformService.isHuman).toHaveBeenCalledWith(wallet);
      expect(result.success).toBe(false);
      expect(result.message).toBe('User is not human verified. API key generation denied.');
      expect(result.isHuman).toBe(false);
      expect(result.score).toBe(20);
      expect(result.error).toBe('User does not meet human verification requirements');
    });

    it('should handle human verification failure', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      
      const mockHumanCheck = {
        success: false,
        message: 'Verification service unavailable',
      };

      platformService.isHuman.mockResolvedValue(mockHumanCheck);

      const result = await service.generateApiKeyForHuman(wallet);

      expect(platformService.isHuman).toHaveBeenCalledWith(wallet);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Human verification failed: Verification service unavailable');
      expect(result.error).toBe('Verification service unavailable');
    });

    it('should handle unexpected errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      
      platformService.isHuman.mockRejectedValue(new Error('Network error'));

      const result = await service.generateApiKeyForHuman(wallet);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to generate API key: Network error');
      expect(result.error).toBe('Network error');
    });
  });
});
