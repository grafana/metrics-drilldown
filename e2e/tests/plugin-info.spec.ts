import { expect, test } from '../fixtures';
import { METRICS_DATASOURCE_UID } from '../config/constants';

test.describe('Plugin info', () => {
  test('shows Elasticsearch icon for Elasticsearch build info', async ({ metricsReducerView }) => {
    await metricsReducerView.route(
      `**/api/datasources/uid/${METRICS_DATASOURCE_UID}/resources/api/v1/status/buildinfo*`,
      async (route) => {
        await route.fulfill({
          json: {
            status: 'success',
            data: {
              application: 'Elasticsearch',
              version: '9.5.0',
              revision: 'abc123',
              branch: 'main',
              buildDate: '20260603T00:40:02.0385-33-65',
              buildUser: 'elastic',
              repository: 'https://github.com/elastic/elasticsearch',
            },
          },
        });
      }
    );

    await metricsReducerView.goto();
    await metricsReducerView.appControls.getPluginInfoButton().click();

    const buildInfoItem = metricsReducerView.getByRole('menuitem', { name: /Elasticsearch 9\.5\.0/ });
    await expect(buildInfoItem).toBeVisible();
    await expect(buildInfoItem).toContainText('Elasticsearch 9.5.0 (2026-06-03)');
    await expect(buildInfoItem.getByTestId('elasticsearch-build-info-icon')).toBeVisible();
  });
});
