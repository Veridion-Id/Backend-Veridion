import { FirebaseService } from '../infrastructure/firebase/firebase.adapter';

export const createMockFirebaseService = (): jest.Mocked<FirebaseService> => {
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
    doc: jest.fn(() => mockDoc),
    orderBy: jest.fn(() => mockCollection),
    get: jest.fn(),
  };

  mockFirestore.collection.mockReturnValue(mockCollection);

  return {
    getAuth: jest.fn(() => ({
      verifyIdToken: jest.fn(),
      createCustomToken: jest.fn(),
    })),
    getFirestore: jest.fn(() => mockFirestore),
  } as any;
};

export const createMockFirestoreDoc = (data: any, exists = true) => ({
  exists,
  data: () => data,
});

export const createMockFirestoreQuerySnapshot = (docs: any[]) => ({
  docs: docs.map(doc => ({ data: () => doc })),
  empty: docs.length === 0,
});
