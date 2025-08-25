import { jest } from '@jest/globals';

export const logger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
