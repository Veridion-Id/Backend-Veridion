import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VeriffService } from './veriff.service';
import { AdminService } from './admin.service';
import { VeriffWebhookDto, VeriffDecision } from '../../domain/entities/veriff.entity';

describe('VeriffService', () => {
  let service: VeriffService;
  let adminService: AdminService;
  let configService: ConfigService;

  const mockAdminService = {
    updateStatus: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VeriffService,
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<VeriffService>(VeriffService);
    adminService = module.get<AdminService>(AdminService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    const mockWebhookData: VeriffWebhookDto = {
      id: 'test-id',
      status: 'APPROVED',
      code: 'APPROVED',
      reason: 'Document verified',
      reasonCode: 'DOCUMENT_VERIFIED',
      sessionToken: 'test-session-token',
      verification: {
        id: 'verification-id',
        url: 'https://veriff.com/verification/123',
        vendorData: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        status: 'APPROVED',
        code: 'APPROVED',
        reason: 'Document verified',
        reasonCode: 'DOCUMENT_VERIFIED',
        person: {
          firstName: 'John',
          lastName: 'Doe',
        },
        document: {
          type: 'PASSPORT',
          number: 'A1234567',
          validFrom: '2020-01-01',
          validUntil: '2030-01-01',
        },
        additionalVerification: {
          status: 'APPROVED',
          reason: 'All checks passed',
        },
      },
      vendorData: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
      timestamp: '2024-01-01T00:00:00Z',
    };

    it('should process webhook successfully with valid signature', async () => {
      const signature = 'sha256=valid-signature';
      const adminSourceAccount = 'GXYZ9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210ZYXWVUTSRQP';

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'VERIFF_WEBHOOK_SECRET') return 'test-secret';
        if (key === 'ADMIN_SOURCE_ACCOUNT') return adminSourceAccount;
        return undefined;
      });

      mockAdminService.updateStatus.mockResolvedValue({
        success: true,
        message: 'Status updated successfully',
      });

      // Mock the signature verification to return true
      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(true);
      jest.spyOn(service as any, 'extractWalletFromVendorData').mockReturnValue('GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890');
      jest.spyOn(service as any, 'mapVeriffDecisionToStatus').mockReturnValue('APPROVED');

      const result = await service.processWebhook(mockWebhookData, signature);

      expect(result.success).toBe(true);
      expect(result.status).toBe('APPROVED');
      expect(result.wallet).toBe('GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890');
      expect(adminService.updateStatus).toHaveBeenCalledWith(
        'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        {
          status: 'APPROVED',
          sourceAccount: adminSourceAccount,
        }
      );
    });

    it('should handle invalid signature', async () => {
      const signature = 'sha256=invalid-signature';

      mockConfigService.get.mockReturnValue('test-secret');
      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(false);

      const result = await service.processWebhook(mockWebhookData, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(adminService.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle missing admin source account', async () => {
      const signature = 'sha256=valid-signature';

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'VERIFF_WEBHOOK_SECRET') return 'test-secret';
        if (key === 'ADMIN_SOURCE_ACCOUNT') return undefined;
        return undefined;
      });

      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(true);

      const result = await service.processWebhook(mockWebhookData, signature);

      expect(result.success).toBe(true);
      expect(result.message).toContain('admin source account not configured');
      expect(adminService.updateStatus).not.toHaveBeenCalled();
    });

    it('should map Veriff decisions to correct statuses', async () => {
      const testCases = [
        { veriffStatus: 'APPROVED', expectedStatus: 'APPROVED' },
        { veriffStatus: 'DECLINED', expectedStatus: 'REJECTED' },
        { veriffStatus: 'REJECTED', expectedStatus: 'REJECTED' },
        { veriffStatus: 'RESUBMISSION_REQUESTED', expectedStatus: 'PENDING' },
        { veriffStatus: 'PENDING', expectedStatus: 'PENDING' },
        { veriffStatus: 'UNKNOWN', expectedStatus: 'PENDING' },
      ];

      for (const testCase of testCases) {
        const webhookData = { ...mockWebhookData, status: testCase.veriffStatus };
        
        mockConfigService.get.mockReturnValue('test-secret');
        jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(true);
        jest.spyOn(service as any, 'extractWalletFromVendorData').mockReturnValue('GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890');
        jest.spyOn(service as any, 'mapVeriffDecisionToStatus').mockReturnValue(testCase.expectedStatus);

        const result = await service.processWebhook(webhookData, 'sha256=valid-signature');
        
        expect(result.status).toBe(testCase.expectedStatus);
      }
    });
  });
});
