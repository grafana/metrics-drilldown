import { ensureErrorObject } from './errorUtils';

describe('ensureErrorObject', () => {
  it('returns the same Error instance', () => {
    const originalError = new Error('test error');
    const result = ensureErrorObject(originalError, 'default');

    expect(result).toBe(originalError);
    expect(result.message).toBe('test error');
  });

  it('wraps a string in an Error', () => {
    const result = ensureErrorObject('string error', 'default');

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('string error');
  });

  it('creates an Error from an object with a message', () => {
    const errorLike = { message: 'object error' };
    const result = ensureErrorObject(errorLike, 'default');

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('object error');
  });

  it('falls back to default message when no message is present', () => {
    const result = ensureErrorObject(undefined, 'default message');

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('default message');
  });
});
