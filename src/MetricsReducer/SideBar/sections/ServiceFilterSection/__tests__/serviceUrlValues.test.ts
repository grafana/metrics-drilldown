import { joinUrlValues, splitUrlValues } from '../serviceUrlValues';

describe('joinUrlValues', () => {
  test('separates the values with commas', () => {
    expect(joinUrlValues(['cart', 'checkout'])).toBe('cart,checkout');
  });

  test('writes values without a comma or a backslash as they are, including slashes and pipes', () => {
    expect(joinUrlValues(['prod/payments', 'a|b', 'my service'])).toBe('prod/payments,a|b,my service');
  });

  test('escapes a comma inside a value', () => {
    expect(joinUrlValues(['a,b', 'c'])).toBe('a\\,b,c');
  });

  test('escapes a backslash inside a value', () => {
    expect(joinUrlValues(['a\\b'])).toBe('a\\\\b');
  });

  test('writes an empty selection as an empty text', () => {
    expect(joinUrlValues([])).toBe('');
  });
});

describe('splitUrlValues', () => {
  test('reads values that were written without escaping, as older URLs have them', () => {
    expect(splitUrlValues('cart,checkout')).toEqual(['cart', 'checkout']);
  });

  test('reads an escaped comma as part of the value', () => {
    expect(splitUrlValues('a\\,b,c')).toEqual(['a,b', 'c']);
  });

  test('reads an escaped backslash as one backslash', () => {
    expect(splitUrlValues('a\\\\b,c')).toEqual(['a\\b', 'c']);
  });

  test('treats the comma after an escaped backslash as a separator', () => {
    expect(splitUrlValues('a\\\\,b')).toEqual(['a\\', 'b']);
  });

  test('keeps spaces around a value', () => {
    expect(splitUrlValues(' cart ,checkout')).toEqual([' cart ', 'checkout']);
  });

  test('drops empty values', () => {
    expect(splitUrlValues('')).toEqual([]);
    expect(splitUrlValues(',')).toEqual([]);
    expect(splitUrlValues('a,,b,')).toEqual(['a', 'b']);
  });

  test('keeps a backslash at the end of the text, which has nothing to escape', () => {
    expect(splitUrlValues('a,b\\')).toEqual(['a', 'b\\']);
  });
});

describe('writing then reading', () => {
  test.each([
    [['cart', 'checkout']],
    [['a,b']],
    [['a,b', 'c,,d', ',']],
    [['a\\b', '\\', '\\\\', 'x\\']],
    [['a\\,b']],
    [['prod/payments', 'a|b', 'a.b', '(x)', '[y]']],
    [[' leading', 'trailing ', 'in side']],
    [['100%', 'a&b=c', 'q?x#y', 'ünï/çødé']],
  ])('returns the same values for %j', (values) => {
    expect(splitUrlValues(joinUrlValues(values))).toEqual(values);
  });

  test('returns the same values after the text went through the URL of the page', () => {
    const values = ['a,b', 'c\\d', 'prod/payments|x'];
    const params = new URLSearchParams();
    params.set('filters-service', joinUrlValues(values));

    const reread = new URLSearchParams(params.toString());

    expect(splitUrlValues(reread.get('filters-service') ?? '')).toEqual(values);
  });
});
