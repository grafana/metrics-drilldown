import { buildServiceFilter, JOB_LABEL, parseServicesFromJobs } from '../serviceMatchers';

describe('parseServicesFromJobs', () => {
  test('returns an empty list when there are no jobs', () => {
    expect(parseServicesFromJobs([])).toEqual([]);
  });

  test('takes the service name after the namespace', () => {
    expect(parseServicesFromJobs(['shop/checkout'])).toEqual([{ service: 'checkout', jobs: ['shop/checkout'] }]);
  });

  test('uses a job without a namespace as the service name', () => {
    expect(parseServicesFromJobs(['prometheus'])).toEqual([{ service: 'prometheus', jobs: ['prometheus'] }]);
  });

  test('groups the jobs of one service across namespaces', () => {
    expect(parseServicesFromJobs(['staging/checkout', 'prod/checkout', 'checkout'])).toEqual([
      { service: 'checkout', jobs: ['checkout', 'prod/checkout', 'staging/checkout'] },
    ]);
  });

  test('sorts the services by name', () => {
    const groups = parseServicesFromJobs(['shop/payments', 'shop/cart', 'shop/checkout']);

    expect(groups.map((group) => group.service)).toEqual(['cart', 'checkout', 'payments']);
  });

  test('splits on the first slash only', () => {
    expect(parseServicesFromJobs(['ns/a/b'])).toEqual([{ service: 'a/b', jobs: ['ns/a/b'] }]);
  });

  test('keeps the whole job as the service when the part after the slash is empty', () => {
    expect(parseServicesFromJobs(['ns/'])).toEqual([{ service: 'ns/', jobs: ['ns/'] }]);
  });

  test('treats a leading slash as an empty namespace', () => {
    expect(parseServicesFromJobs(['/checkout'])).toEqual([{ service: 'checkout', jobs: ['/checkout'] }]);
  });

  test('ignores empty jobs and duplicates', () => {
    expect(parseServicesFromJobs(['', 'shop/cart', 'shop/cart'])).toEqual([{ service: 'cart', jobs: ['shop/cart'] }]);
  });
});

describe('buildServiceFilter', () => {
  test('returns null when there is no value', () => {
    expect(buildServiceFilter(JOB_LABEL, [])).toBeNull();
  });

  test('returns null when every value is empty', () => {
    expect(buildServiceFilter(JOB_LABEL, ['', ''])).toBeNull();
  });

  test('builds a regex matcher for one value', () => {
    expect(buildServiceFilter(JOB_LABEL, ['checkout'])).toEqual({
      key: 'job',
      operator: '=~',
      value: 'checkout',
    });
  });

  test('joins several values with an alternation', () => {
    expect(buildServiceFilter(JOB_LABEL, ['cart', 'checkout'])).toEqual({
      key: 'job',
      operator: '=~',
      value: 'cart|checkout',
    });
  });

  test('escapes regex metacharacters so each value matches exactly', () => {
    expect(buildServiceFilter(JOB_LABEL, ['a.b', 'c+d', 'e|f', '(g)'])?.value).toBe('a\\.b|c\\+d|e\\|f|\\(g\\)');
  });

  test('removes duplicate values', () => {
    expect(buildServiceFilter(JOB_LABEL, ['cart', 'cart'])?.value).toBe('cart');
  });

  test('builds the job matcher from exact job values', () => {
    expect(buildServiceFilter(JOB_LABEL, ['prod/checkout', 'checkout'])).toEqual({
      key: 'job',
      operator: '=~',
      value: 'prod/checkout|checkout',
    });
  });
});
