import { fetchFiringAlertRuleSignals } from '../../MetricsSorter/fetchers/fetchFiringAlertMetrics';
import { fetchSloMetricSignals } from '../../MetricsSorter/fetchers/fetchSloMetricSignals';
import { MetricsSorter } from '../../MetricsSorter/MetricsSorter';

jest.mock('../../MetricsSorter/fetchers/fetchFiringAlertMetrics');
jest.mock('../../MetricsSorter/fetchers/fetchSloMetricSignals');

it('deduplicates in-flight signal reads and refreshes successful snapshots after expiry', async () => {
  const firing = jest.mocked(fetchFiringAlertRuleSignals);
  const slo = jest.mocked(fetchSloMetricSignals);
  firing.mockResolvedValue({ status: 'ready', metricCounts: new Map(), firingSloUuids: new Map(), ruleCount: 0 });
  slo.mockResolvedValue({
    status: 'ready',
    burnStatus: 'ready',
    datasourceUid: 'a',
    trackedMetrics: new Map(),
    activeBurnMetrics: new Set(),
  });
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    const sorter = new MetricsSorter({});
    expect(sorter.peekSloMetricSignals('a')).toBeUndefined();
    await Promise.all([
      sorter.getFiringAlertSignals(),
      sorter.getFiringAlertSignals(),
      sorter.getSloMetricSignals('a'),
      sorter.getSloMetricSignals('a'),
    ]);
    await sorter.getFiringAlertSignals();
    await sorter.getSloMetricSignals('a');
    expect(firing).toHaveBeenCalledTimes(1);
    expect(slo).toHaveBeenCalledTimes(1);
    now.mockReturnValue(62000);
    await sorter.getFiringAlertSignals();
    await sorter.getSloMetricSignals('a');
    expect(firing).toHaveBeenCalledTimes(2);
    expect(slo).toHaveBeenCalledTimes(2);
    await sorter.getSloMetricSignals('b');
    expect(slo).toHaveBeenCalledTimes(3);
  } finally {
    now.mockRestore();
  }
});
