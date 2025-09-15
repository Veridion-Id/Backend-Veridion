import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from '../../application/services/admin.service';
import { 
  BuildRegisterTransactionDto,
  SubmitSignedTransactionDto
} from '../../domain/entities/admin.entity';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: AdminService;

  const mockAdminService = {
    buildRegisterTransaction: jest.fn(),
    submitSignedTransaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('buildRegisterTransaction', () => {
    it('should build a register transaction successfully', async () => {
      const buildDto: BuildRegisterTransactionDto = {
        wallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ',
        name: 'John',
        surnames: 'Doe',
        sourceAccount: 'GZYXWVUTSRQPONMLKJIHGFEDCBAZYXWVUTSRQPONMLKJIHGFEDCBA'
      };

      const expectedResponse = {
        success: true,
        message: 'Transaction built successfully',
        xdr: 'mock-xdr-string',
        sourceAccount: buildDto.sourceAccount,
        sequence: '123456789',
        fee: '100',
        timebounds: {
          minTime: '1640995200',
          maxTime: '1640995230'
        },
        footprint: undefined
      };

      mockAdminService.buildRegisterTransaction.mockResolvedValue(expectedResponse);

      const result = await controller.buildRegisterTransaction(buildDto);

      expect(result).toEqual(expectedResponse);
      expect(adminService.buildRegisterTransaction).toHaveBeenCalledWith(buildDto);
    });

    it('should handle build transaction failure', async () => {
      const buildDto: BuildRegisterTransactionDto = {
        wallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ',
        name: 'John',
        surnames: 'Doe',
        sourceAccount: 'INVALID_ACCOUNT'
      };

      const expectedResponse = {
        success: false,
        message: 'Failed to build transaction: Invalid source account',
        error: 'Invalid source account'
      };

      mockAdminService.buildRegisterTransaction.mockResolvedValue(expectedResponse);

      const result = await controller.buildRegisterTransaction(buildDto);

      expect(result).toEqual(expectedResponse);
      expect(adminService.buildRegisterTransaction).toHaveBeenCalledWith(buildDto);
    });
  });

  describe('submitSignedTransaction', () => {
    it('should submit a signed transaction successfully', async () => {
      const submitDto: SubmitSignedTransactionDto = {
        signedXdr: 'mock-signed-xdr-string'
      };

      const expectedResponse = {
        success: true,
        message: 'Transaction submitted successfully',
        transactionHash: 'mock-transaction-hash-456',
        resultMeta: undefined
      };

      mockAdminService.submitSignedTransaction.mockResolvedValue(expectedResponse);

      const result = await controller.submitSignedTransaction(submitDto);

      expect(result).toEqual(expectedResponse);
      expect(adminService.submitSignedTransaction).toHaveBeenCalledWith(submitDto);
    });

    it('should handle submit transaction failure', async () => {
      const submitDto: SubmitSignedTransactionDto = {
        signedXdr: 'invalid-xdr'
      };

      const expectedResponse = {
        success: false,
        message: 'Failed to submit transaction: Invalid XDR format',
        error: 'Invalid XDR format'
      };

      mockAdminService.submitSignedTransaction.mockResolvedValue(expectedResponse);

      const result = await controller.submitSignedTransaction(submitDto);

      expect(result).toEqual(expectedResponse);
      expect(adminService.submitSignedTransaction).toHaveBeenCalledWith(submitDto);
    });
  });
});
