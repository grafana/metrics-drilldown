import { getEnvironment } from '../getEnvironment';

describe('getEnvironment()', () => {
  test.each([
    // edge cases
    ['unknownhost', null],
    // local
    ['localhost', 'local'],
    // dev
    ['grafana-dev.net', 'dev'],
    ['test.grafana-dev.net', 'dev'],
    // ops
    ['foobar.grafana-ops.net', 'ops'],
    ['grafana-ops.net', 'ops'],
    // prod
    ['foobar.grafana.net', 'prod'],
    ['grafana.net', 'prod'],
  ])('when the host is "%s" → %s', (host, expectedEnvironment) => {
    __setWindowLocation({ host });

    expect(getEnvironment()).toBe(expectedEnvironment);
  });

  test('when the host is empty → null', () => {
    __setWindowLocation('about:blank');

    expect(getEnvironment()).toBe(null);
  });
});
