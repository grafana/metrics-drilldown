import { test } from '../fixtures';

const METRIC_NAME = 'handler_duration_seconds_count';
const URL_SEARCH_PARAMS_WITH_METRIC_NAME = new URLSearchParams([['metric', METRIC_NAME]]);

test.describe('Metrics Scene view', () => {
  test.beforeEach(async ({ metricSceneView }) => {
    await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
  });

  test('Core UI elements', async ({ metricSceneView }) => {
    await metricSceneView.assertCoreUI(METRIC_NAME);
  });
});
