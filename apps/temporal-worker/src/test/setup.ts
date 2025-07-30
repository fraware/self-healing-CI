import { jest } from '@jest/globals';

// Global test setup
beforeAll(() => {
  // Set up any global test configuration
  (process.env as any).NODE_ENV = 'test';
});

afterAll(() => {
  // Clean up after all tests
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
});
