import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { FirebaseService } from '../../infrastructure/firebase/firebase.adapter';
import { User, UserStatus, CreateUserDto, UpdateUserStatusDto } from '../../domain/entities/user.entity';

describe('UserService', () => {
  let service: UserService;
  let firebaseService: jest.Mocked<FirebaseService>;

  const mockFirestore = {
    collection: jest.fn(),
  };

  const mockDoc = {
    set: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockCollection = {
    doc: jest.fn(),
    orderBy: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const mockFirebaseService = {
      getFirestore: jest.fn(() => mockFirestore),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: FirebaseService,
          useValue: mockFirebaseService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    firebaseService = module.get(FirebaseService);

    // Reset mocks
    jest.clearAllMocks();
    mockFirestore.collection.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDoc);
    mockCollection.orderBy.mockReturnValue(mockCollection);
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const createUserDto: CreateUserDto = {
        walletAddress: '0x1234567890abcdef',
        name: 'John Doe',
      };

      const expectedUser: User = {
        walletAddress: '0x1234567890abcdef',
        name: 'John Doe',
        status: UserStatus.PENDING,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };

      mockDoc.set.mockResolvedValue(undefined);

      const result = await service.create(createUserDto);

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.doc).toHaveBeenCalledWith('0x1234567890abcdef');
      expect(mockDoc.set).toHaveBeenCalledWith(expectedUser);
      expect(result).toEqual(expectedUser);
    });

    it('should throw error when Firebase operation fails', async () => {
      const createUserDto: CreateUserDto = {
        walletAddress: '0x1234567890abcdef',
        name: 'John Doe',
      };

      const error = new Error('Firebase error');
      mockDoc.set.mockRejectedValue(error);

      await expect(service.create(createUserDto)).rejects.toThrow('Firebase error');
    });
  });

  describe('findByWalletAddress', () => {
    it('should return user when found', async () => {
      const walletAddress = '0x1234567890abcdef';
      const mockUserData = {
        walletAddress: '0x1234567890abcdef',
        name: 'John Doe',
        status: UserStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDocSnapshot = {
        exists: true,
        data: () => mockUserData,
      };

      mockDoc.get.mockResolvedValue(mockDocSnapshot);

      const result = await service.findByWalletAddress(walletAddress);

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.doc).toHaveBeenCalledWith(walletAddress);
      expect(result).toEqual(mockUserData);
    });

    it('should return null when user not found', async () => {
      const walletAddress = '0x1234567890abcdef';
      const mockDocSnapshot = {
        exists: false,
      };

      mockDoc.get.mockResolvedValue(mockDocSnapshot);

      const result = await service.findByWalletAddress(walletAddress);

      expect(result).toBeNull();
    });

    it('should throw error when Firebase operation fails', async () => {
      const walletAddress = '0x1234567890abcdef';
      const error = new Error('Firebase error');
      mockDoc.get.mockRejectedValue(error);

      await expect(service.findByWalletAddress(walletAddress)).rejects.toThrow('Firebase error');
    });
  });

  describe('findAll', () => {
    it('should return all users ordered by createdAt desc', async () => {
      const mockUsers = [
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

      const mockQuerySnapshot = {
        docs: mockUsers.map(user => ({
          data: () => user,
        })),
      };

      mockCollection.get.mockResolvedValue(mockQuerySnapshot);

      const result = await service.findAll();

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(result).toEqual(mockUsers);
    });

    it('should throw error when Firebase operation fails', async () => {
      const error = new Error('Firebase error');
      mockCollection.get.mockRejectedValue(error);

      await expect(service.findAll()).rejects.toThrow('Firebase error');
    });
  });

  describe('updateStatus', () => {
    it('should update user status successfully', async () => {
      const walletAddress = '0x1234567890abcdef';
      const updateUserStatusDto: UpdateUserStatusDto = {
        status: UserStatus.VERIFIED,
      };

      const existingUser: User = {
        walletAddress: '0x1234567890abcdef',
        name: 'John Doe',
        status: UserStatus.PENDING,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      const updatedUser: User = {
        ...existingUser,
        status: UserStatus.VERIFIED,
        updatedAt: expect.any(Date),
      };

      mockDoc.update.mockResolvedValue(undefined);
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => updatedUser,
      });

      const result = await service.updateStatus(walletAddress, updateUserStatusDto);

      expect(mockDoc.update).toHaveBeenCalledWith({
        status: UserStatus.VERIFIED,
        updatedAt: expect.any(Date),
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw error when user not found after update', async () => {
      const walletAddress = '0x1234567890abcdef';
      const updateUserStatusDto: UpdateUserStatusDto = {
        status: UserStatus.VERIFIED,
      };

      mockDoc.update.mockResolvedValue(undefined);
      mockDoc.get.mockResolvedValue({
        exists: false,
      });

      await expect(service.updateStatus(walletAddress, updateUserStatusDto)).rejects.toThrow('User not found after update');
    });

    it('should throw error when Firebase operation fails', async () => {
      const walletAddress = '0x1234567890abcdef';
      const updateUserStatusDto: UpdateUserStatusDto = {
        status: UserStatus.VERIFIED,
      };

      const error = new Error('Firebase error');
      mockDoc.update.mockRejectedValue(error);

      await expect(service.updateStatus(walletAddress, updateUserStatusDto)).rejects.toThrow('Firebase error');
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      const walletAddress = '0x1234567890abcdef';

      mockDoc.delete.mockResolvedValue(undefined);

      await service.delete(walletAddress);

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.doc).toHaveBeenCalledWith(walletAddress);
      expect(mockDoc.delete).toHaveBeenCalled();
    });

    it('should throw error when Firebase operation fails', async () => {
      const walletAddress = '0x1234567890abcdef';
      const error = new Error('Firebase error');
      mockDoc.delete.mockRejectedValue(error);

      await expect(service.delete(walletAddress)).rejects.toThrow('Firebase error');
    });
  });
});
