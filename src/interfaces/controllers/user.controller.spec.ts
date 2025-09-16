import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from '../../application/services/user.service';
import { User, UserStatus, CreateUserDto, UpdateUserStatusDto } from '../../domain/entities/user.entity';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const mockUserService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByWalletAddress: jest.fn(),
      updateStatus: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);

    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        walletAddress: '0x1234567890abcdef',
        name: 'John Doe',
      };

      const expectedUser: User = {
        walletAddress: '0x1234567890abcdef',
        name: 'John Doe',
        status: UserStatus.PENDING,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      userService.create.mockResolvedValue(expectedUser);

      const result = await controller.createUser(createUserDto);

      expect(userService.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(expectedUser);
    });

    it('should throw error when service fails', async () => {
      const createUserDto: CreateUserDto = {
        walletAddress: '0x1234567890abcdef',
        name: 'John Doe',
      };

      const error = new Error('Service error');
      userService.create.mockRejectedValue(error);

      await expect(controller.createUser(createUserDto)).rejects.toThrow('Service error');
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const expectedUsers: User[] = [
        {
          walletAddress: '0x1111111111111111',
          name: 'User 1',
          status: UserStatus.VERIFIED,
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
        },
        {
          walletAddress: '0x2222222222222222',
          name: 'User 2',
          status: UserStatus.PENDING,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
        },
      ];

      userService.findAll.mockResolvedValue(expectedUsers);

      const result = await controller.getAllUsers();

      expect(userService.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedUsers);
    });

    it('should throw error when service fails', async () => {
      const error = new Error('Service error');
      userService.findAll.mockRejectedValue(error);

      await expect(controller.getAllUsers()).rejects.toThrow('Service error');
    });
  });

  describe('getUserByWallet', () => {
    it('should return user when found', async () => {
      const walletAddress = '0x1234567890abcdef';
      const expectedUser: User = {
        walletAddress: '0x1234567890abcdef',
        name: 'John Doe',
        status: UserStatus.PENDING,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      userService.findByWalletAddress.mockResolvedValue(expectedUser);

      const result = await controller.getUserByWallet(walletAddress);

      expect(userService.findByWalletAddress).toHaveBeenCalledWith(walletAddress);
      expect(result).toEqual(expectedUser);
    });

    it('should throw error when user not found', async () => {
      const walletAddress = '0x1234567890abcdef';

      userService.findByWalletAddress.mockResolvedValue(null);

      await expect(controller.getUserByWallet(walletAddress)).rejects.toThrow('User not found');
    });

    it('should throw error when service fails', async () => {
      const walletAddress = '0x1234567890abcdef';
      const error = new Error('Service error');
      userService.findByWalletAddress.mockRejectedValue(error);

      await expect(controller.getUserByWallet(walletAddress)).rejects.toThrow('Service error');
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status successfully', async () => {
      const walletAddress = '0x1234567890abcdef';
      const updateUserStatusDto: UpdateUserStatusDto = {
        status: UserStatus.VERIFIED,
      };

      const updatedUser: User = {
        walletAddress: '0x1234567890abcdef',
        name: 'John Doe',
        status: UserStatus.VERIFIED,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      };

      userService.updateStatus.mockResolvedValue(updatedUser);

      const result = await controller.updateUserStatus(walletAddress, updateUserStatusDto);

      expect(userService.updateStatus).toHaveBeenCalledWith(walletAddress, updateUserStatusDto);
      expect(result).toEqual(updatedUser);
    });

    it('should throw error when service fails', async () => {
      const walletAddress = '0x1234567890abcdef';
      const updateUserStatusDto: UpdateUserStatusDto = {
        status: UserStatus.VERIFIED,
      };

      const error = new Error('Service error');
      userService.updateStatus.mockRejectedValue(error);

      await expect(controller.updateUserStatus(walletAddress, updateUserStatusDto)).rejects.toThrow('Service error');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const walletAddress = '0x1234567890abcdef';

      userService.delete.mockResolvedValue(undefined);

      const result = await controller.deleteUser(walletAddress);

      expect(userService.delete).toHaveBeenCalledWith(walletAddress);
      expect(result).toEqual({ message: 'User deleted successfully' });
    });

    it('should throw error when service fails', async () => {
      const walletAddress = '0x1234567890abcdef';
      const error = new Error('Service error');
      userService.delete.mockRejectedValue(error);

      await expect(controller.deleteUser(walletAddress)).rejects.toThrow('Service error');
    });
  });
});
