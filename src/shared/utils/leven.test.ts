import leven from './leven';

describe('leven', () => {
  test('returns 0 for identical strings', () => {
    expect(leven('abc', 'abc')).toBe(0);
  });

  test('returns 0 for empty strings', () => {
    expect(leven('', '')).toBe(0);
  });

  test('returns the length of the other string when one is empty', () => {
    expect(leven('', 'abc')).toBe(3);
    expect(leven('abc', '')).toBe(3);
  });

  test('returns 1 for a single character difference', () => {
    expect(leven('abc', 'abd')).toBe(1);
  });

  test('returns the correct distance for insertions', () => {
    expect(leven('abc', 'abcd')).toBe(1);
  });

  test('returns the correct distance for deletions', () => {
    expect(leven('abcd', 'abc')).toBe(1);
  });

  test('is symmetric', () => {
    expect(leven('kitten', 'sitting')).toBe(leven('sitting', 'kitten'));
  });

  test('classic example: kitten → sitting', () => {
    expect(leven('kitten', 'sitting')).toBe(3);
  });

  test('handles completely different strings', () => {
    expect(leven('abc', 'xyz')).toBe(3);
  });
});
