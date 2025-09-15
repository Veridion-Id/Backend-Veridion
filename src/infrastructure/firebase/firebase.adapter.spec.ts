import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from './firebase.adapter';

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    createCustomToken: jest.fn(),
  })),
  firestore: jest.fn(() => ({
    collection: jest.fn(),
  })),
}));

describe('FirebaseService', () => {
  let service: FirebaseService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue({
        projectId: 'test-project',
        privateKey: 'test-private-key',
        clientEmail: 'test@test.com',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<FirebaseService>(FirebaseService);
    configService = module.get(ConfigService);
  });

  describe('initialization', () => {
    it('should initialize Firebase with correct configuration', () => {
      // Service is already initialized in beforeEach with valid config
      expect(service).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('firebase');
    });

    it('should throw error when Firebase configuration is incomplete', () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue({
          projectId: 'test-project',
          // Missing privateKey and clientEmail
        }),
      };

      expect(() => new FirebaseService(mockConfigService as any)).toThrow('Firebase configuration is incomplete');
    });

    it('should throw error when projectId is missing', () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue({
          privateKey: 'test-private-key',
          clientEmail: 'test@test.com',
          // Missing projectId
        }),
      };

      expect(() => new FirebaseService(mockConfigService as any)).toThrow('Firebase configuration is incomplete');
    });

    it('should throw error when privateKey is missing', () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue({
          projectId: 'test-project',
          clientEmail: 'test@test.com',
          // Missing privateKey
        }),
      };

      expect(() => new FirebaseService(mockConfigService as any)).toThrow('Firebase configuration is incomplete');
    });

    it('should throw error when clientEmail is missing', () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue({
          projectId: 'test-project',
          privateKey: 'test-private-key',
          // Missing clientEmail
        }),
      };

      expect(() => new FirebaseService(mockConfigService as any)).toThrow('Firebase configuration is incomplete');
    });
  });

  describe('getAuth', () => {
    it('should return auth instance', () => {
      const auth = service.getAuth();
      expect(auth).toBeDefined();
    });
  });

  describe('getFirestore', () => {
    it('should return firestore instance', () => {
      const firestore = service.getFirestore();
      expect(firestore).toBeDefined();
    });
  });
});
