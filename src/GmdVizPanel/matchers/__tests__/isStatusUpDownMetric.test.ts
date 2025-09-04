import { isStatusUpDownMetric } from '../isStatusUpDownMetric';

describe('isStatusUpDownMetric(metric)', () => {
  describe('status up/down metrics (ending with _count, _total or _sum)', () => {
    test.each([['up'], ['memcached_up']])('returns true (%s)', (metric) => {
      expect(isStatusUpDownMetric(metric)).toBe(true);
    });
  });

  describe('other metrics (not being "up" ending with "_up")', () => {
    test.each(['server_uptime', 'up_timestamp', 'upstream'])('returns false (%s)', (metric) => {
      expect(isStatusUpDownMetric(metric)).toBe(false);
    });
  });
});
