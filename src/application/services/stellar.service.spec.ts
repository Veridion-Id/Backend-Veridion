import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StellarService } from './stellar.service';
import { 
  BuildTransactionResponse, 
  SubmitTransactionResponse
} from './stellar.service';
import { 
  Verification,
  VerificationType
} from 'stellar-passport';

describe('StellarService', () => {
  let service: StellarService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          STELLAR_NETWORK: 'testnet',
          STELLAR_CONTRACT_ID: 'mock-contract-id',
          STELLAR_ADMIN_SECRET_KEY: '',
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
  });

  describe('getScore', () => {
    it('should get score successfully', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const expectedScore = 45;

      contractBindings.get_score.mockResolvedValue(expectedScore);

      const result = await service.getScore(wallet);

      expect(contractBindings.get_score).toHaveBeenCalledWith({ wallet });
      expect(result).toBe(expectedScore);
    });

    it('should handle contract bindings errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const error = new Error('Contract error');

      contractBindings.get_score.mockRejectedValue(error);

      await expect(service.getScore(wallet)).rejects.toThrow('Failed to get score: Contract error');
    });

    it('should handle unexpected errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';

      contractBindings.get_score.mockRejectedValue('Unexpected error');

      await expect(service.getScore(wallet)).rejects.toThrow('Failed to get score: Unknown error');
    });
  });

  describe('getVerifications', () => {
    it('should get verifications successfully for valid wallet', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      
      // Mock the validateWalletAddress to return true for this test
      jest.spyOn(service, 'validateWalletAddress').mockReturnValue(true);
      const expectedVerifications: Verification[] = [
        {
          type: 'email',
          points: 10,
        },
        {
          type: 'phone',
          points: 15,
        },
      ];

      contractBindings.get_verifications.mockResolvedValue(expectedVerifications);

      const result = await service.getVerifications(wallet);

      expect(contractBindings.get_verifications).toHaveBeenCalledWith(wallet);
      expect(result).toEqual(expectedVerifications);
    });

    it('should handle invalid wallet address', async () => {
      const wallet = 'invalid-wallet-address';

      await expect(service.getVerifications(wallet)).rejects.toThrow('Invalid wallet address format');
      expect(contractBindings.get_verifications).not.toHaveBeenCalled();
    });

    it('should handle contract bindings errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const error = new Error('Contract not found');

      // Mock the validateWalletAddress to return true for this test
      jest.spyOn(service, 'validateWalletAddress').mockReturnValue(true);
      contractBindings.get_verifications.mockRejectedValue(error);

      await expect(service.getVerifications(wallet)).rejects.toThrow('Failed to get verifications: Contract not found');
    });

    it('should handle empty verifications array', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const expectedVerifications: Verification[] = [];

      // Mock the validateWalletAddress to return true for this test
      jest.spyOn(service, 'validateWalletAddress').mockReturnValue(true);
      contractBindings.get_verifications.mockResolvedValue(expectedVerifications);

      const result = await service.getVerifications(wallet);

      expect(result).toEqual(expectedVerifications);
    });
  });

  describe('buildRegisterTransaction', () => {
    it('should build register transaction successfully', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const name = 'John';
      const surnames = 'Doe';
      const sourceAccount = 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP';

      // Mock the validateWalletAddress to return true for this test
      jest.spyOn(service, 'validateWalletAddress').mockReturnValue(true);

      const mockResult: BuildTransactionResponse = {
        success: true,
        xdr: 'mock-xdr-string',
        sourceAccount: sourceAccount,
        sequence: '12345',
        fee: '100',
        timebounds: {
          minTime: '1000',
          maxTime: '2000',
        },
        footprint: 'mock-footprint',
      };

      contractBindings.buildRegisterTransaction.mockResolvedValue(mockResult);

      const result = await service.buildRegisterTransaction(wallet, name, surnames, sourceAccount);

      expect(contractBindings.buildRegisterTransaction).toHaveBeenCalledWith(
        { wallet, name, surnames },
        sourceAccount,
        expect.any(String), // networkPassphrase
        'mock-contract-id'  // contractId
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle invalid wallet address', async () => {
      const wallet = 'invalid-wallet';
      const name = 'John';
      const surnames = 'Doe';
      const sourceAccount = 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP';

      const result = await service.buildRegisterTransaction(wallet, name, surnames, sourceAccount);

      expect(result).toEqual({
        success: false,
        error: 'Invalid wallet address format',
      });
      expect(contractBindings.buildRegisterTransaction).not.toHaveBeenCalled();
    });

    it('should handle invalid source account', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const name = 'John';
      const surnames = 'Doe';
      const sourceAccount = 'invalid-source';

      // Mock the validateWalletAddress to return true for wallet but false for sourceAccount
      jest.spyOn(service, 'validateWalletAddress')
        .mockReturnValueOnce(true)  // for wallet
        .mockReturnValueOnce(false); // for sourceAccount

      const result = await service.buildRegisterTransaction(wallet, name, surnames, sourceAccount);

      expect(result).toEqual({
        success: false,
        error: 'Invalid source account format',
      });
      expect(contractBindings.buildRegisterTransaction).not.toHaveBeenCalled();
    });

    it('should handle contract bindings failure', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const name = 'John';
      const surnames = 'Doe';
      const sourceAccount = 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP';

      // Mock the validateWalletAddress to return true for this test
      jest.spyOn(service, 'validateWalletAddress').mockReturnValue(true);

      const mockResult: BuildTransactionResponse = {
        success: false,
        error: 'Contract build failed',
      };

      contractBindings.buildRegisterTransaction.mockResolvedValue(mockResult);

      const result = await service.buildRegisterTransaction(wallet, name, surnames, sourceAccount);

      expect(result).toEqual({
        success: false,
        error: 'Contract build failed',
      });
    });

    it('should handle contract bindings errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const name = 'John';
      const surnames = 'Doe';
      const sourceAccount = 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP';

      // Mock the validateWalletAddress to return true for this test
      jest.spyOn(service, 'validateWalletAddress').mockReturnValue(true);
      contractBindings.buildRegisterTransaction.mockRejectedValue(new Error('Network error'));

      const result = await service.buildRegisterTransaction(wallet, name, surnames, sourceAccount);

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      });
    });
  });

  describe('buildCreateVerificationTransaction', () => {
    it('should build create verification transaction successfully', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const verification: Verification = {
        issuer: 'test-issuer',
        points: 10,
        timestamp: BigInt(Date.now()),
        vtype: { tag: 'Custom' as const, values: ['email'] as const },
      };
      const sourceAccount = 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP';

      // Mock the validateWalletAddress to return true for this test
      jest.spyOn(service, 'validateWalletAddress').mockReturnValue(true);

      const mockResult: BuildTransactionResponse = {
        success: true,
        xdr: 'mock-verification-xdr',
        sourceAccount: sourceAccount,
        sequence: '54321',
        fee: '200',
        timebounds: {
          minTime: '2000',
          maxTime: '3000',
        },
        footprint: 'mock-verification-footprint',
      };

      contractBindings.buildCreateVerificationTransaction.mockResolvedValue(mockResult);

      const result = await service.buildCreateVerificationTransaction(wallet, verification, sourceAccount);

      expect(contractBindings.buildCreateVerificationTransaction).toHaveBeenCalledWith(
        { wallet, verification },
        sourceAccount,
        expect.any(String), // networkPassphrase
        'mock-contract-id'  // contractId
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle invalid wallet address', async () => {
      const wallet = 'invalid-wallet';
      const verification: Verification = {
        issuer: 'test-issuer',
        points: 10,
        timestamp: BigInt(Date.now()),
        vtype: { tag: 'Custom' as const, values: ['email'] as const },
      };
      const sourceAccount = 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP';

      const result = await service.buildCreateVerificationTransaction(wallet, verification, sourceAccount);

      expect(result).toEqual({
        success: false,
        error: 'Invalid wallet address format',
      });
      expect(contractBindings.buildCreateVerificationTransaction).not.toHaveBeenCalled();
    });

    it('should handle invalid source account', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const verification: Verification = {
        issuer: 'test-issuer',
        points: 10,
        timestamp: BigInt(Date.now()),
        vtype: { tag: 'Custom' as const, values: ['email'] as const },
      };
      const sourceAccount = 'invalid-source';

      // Mock the validateWalletAddress to return true for wallet but false for sourceAccount
      jest.spyOn(service, 'validateWalletAddress')
        .mockReturnValueOnce(true)  // for wallet
        .mockReturnValueOnce(false); // for sourceAccount

      const result = await service.buildCreateVerificationTransaction(wallet, verification, sourceAccount);

      expect(result).toEqual({
        success: false,
        error: 'Invalid source account format',
      });
      expect(contractBindings.buildCreateVerificationTransaction).not.toHaveBeenCalled();
    });

    it('should handle contract bindings failure', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const verification: Verification = {
        issuer: 'test-issuer',
        points: 10,
        timestamp: BigInt(Date.now()),
        vtype: { tag: 'Custom' as const, values: ['email'] as const },
      };
      const sourceAccount = 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP';

      // Mock the validateWalletAddress to return true for this test
      jest.spyOn(service, 'validateWalletAddress').mockReturnValue(true);

      const mockResult: BuildTransactionResponse = {
        success: false,
        error: 'Verification creation failed',
      };

      contractBindings.buildCreateVerificationTransaction.mockResolvedValue(mockResult);

      const result = await service.buildCreateVerificationTransaction(wallet, verification, sourceAccount);

      expect(result).toEqual({
        success: false,
        error: 'Verification creation failed',
      });
    });

    it('should handle contract bindings errors', async () => {
      const wallet = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const verification: Verification = {
        issuer: 'test-issuer',
        points: 10,
        timestamp: BigInt(Date.now()),
        vtype: { tag: 'Custom' as const, values: ['email'] as const },
      };
      const sourceAccount = 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP';

      // Mock the validateWalletAddress to return true for this test
      jest.spyOn(service, 'validateWalletAddress').mockReturnValue(true);
      contractBindings.buildCreateVerificationTransaction.mockRejectedValue(new Error('Timeout error'));

      const result = await service.buildCreateVerificationTransaction(wallet, verification, sourceAccount);

      expect(result).toEqual({
        success: false,
        error: 'Timeout error',
      });
    });
  });

  describe('submitSignedTransaction', () => {
    it('should submit signed transaction successfully', async () => {
      const signedXdr = 'mock-signed-xdr-string';

      const mockResult: SubmitTransactionResponse = {
        success: true,
        transactionHash: 'mock-hash-123',
        resultMeta: 'mock-result-meta',
      };

      contractBindings.submitSignedTransaction.mockResolvedValue(mockResult);

      const result = await service.submitSignedTransaction(signedXdr);

      expect(contractBindings.submitSignedTransaction).toHaveBeenCalledWith(
        signedXdr,
        expect.any(String) // networkPassphrase
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle contract bindings failure', async () => {
      const signedXdr = 'mock-signed-xdr-string';

      const mockResult: SubmitTransactionResponse = {
        success: false,
        error: 'Transaction submission failed',
      };

      contractBindings.submitSignedTransaction.mockResolvedValue(mockResult);

      const result = await service.submitSignedTransaction(signedXdr);

      expect(result).toEqual({
        success: false,
        error: 'Transaction submission failed',
      });
    });

    it('should handle contract bindings errors', async () => {
      const signedXdr = 'mock-signed-xdr-string';

      contractBindings.submitSignedTransaction.mockRejectedValue(new Error('Network timeout'));

      const result = await service.submitSignedTransaction(signedXdr);

      expect(result).toEqual({
        success: false,
        error: 'Network timeout',
      });
    });

    it('should handle unexpected errors', async () => {
      const signedXdr = 'mock-signed-xdr-string';

      contractBindings.submitSignedTransaction.mockRejectedValue('Unexpected error');

      const result = await service.submitSignedTransaction(signedXdr);

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
      });
    });
  });

  describe('validateWalletAddress', () => {
    it('should return false for invalid wallet address', () => {
      const invalidWallets = [
        'invalid-wallet',
        '1234567890',
        'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456789', // too short
        'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678901', // too long
        '',
        null,
        undefined,
      ];

      invalidWallets.forEach(wallet => {
        const result = service.validateWalletAddress(wallet as any);
        expect(result).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      // Test with special characters
      expect(service.validateWalletAddress('GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456789!')).toBe(false);
      
      // Test with spaces
      expect(service.validateWalletAddress('GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456789 ')).toBe(false);
    });
  });

  describe('constructor and initialization', () => {
    it('should handle missing admin secret key', () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          STELLAR_NETWORK: 'testnet',
          STELLAR_CONTRACT_ID: 'mock-contract-id',
          STELLAR_ADMIN_SECRET_KEY: '', // Empty secret key
        };
        return config[key] || defaultValue;
      });

      // Create a new instance to test the constructor behavior
      const newService = new StellarService(configService);
      
      // Should not throw an error and should handle missing secret key gracefully
      expect(newService).toBeDefined();
    });
  });
});
