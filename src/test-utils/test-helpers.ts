import { Test, TestingModule } from '@nestjs/testing'

export class TestHelpers {
  static async createTestingModule(moduleMetadata: any): Promise<TestingModule> {
    return Test.createTestingModule(moduleMetadata).compile()
  }

  static mockLogger() {
    return {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    }
  }
}
