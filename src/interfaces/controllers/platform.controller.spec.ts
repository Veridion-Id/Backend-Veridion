import { Test, TestingModule } from '@nestjs/testing';
import { PlatformController } from './platform.controller';
import { PlatformService } from '../../application/services/platform.service';

describe('PlatformController', () => {
  let controller: PlatformController;
  let platformService: PlatformService;

  const mockPlatformService = {
    getScore: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformController],
      providers: [
        {
          provide: PlatformService,
          useValue: mockPlatformService,
        },
      ],
    }).compile();

    controller = module.get<PlatformController>(PlatformController);
    platformService = module.get<PlatformService>(PlatformService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getScore', () => {
    it('should get user score successfully', async () => {
      const wallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const expectedResponse = {
        score: 742,
        success: true,
        message: 'Score retrieved successfully',
      };

      mockPlatformService.getScore.mockResolvedValue(expectedResponse);

      const result = await controller.getScore(wallet);

      expect(result).toEqual(expectedResponse);
      expect(platformService.getScore).toHaveBeenCalledWith(wallet);
    });

    it('should handle get score failure', async () => {
      const wallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const expectedResponse = {
        success: false,
        message: 'Invalid wallet address format',
      };

      mockPlatformService.getScore.mockResolvedValue(expectedResponse);

      const result = await controller.getScore(wallet);

      expect(result).toEqual(expectedResponse);
      expect(platformService.getScore).toHaveBeenCalledWith(wallet);
    });
  });
});
