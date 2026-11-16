import { randomUUID } from 'node:crypto';

import { expect, test } from '../fixtures';

const QUERIES_API_URL = '/apis/queries.grafana.app/v1/namespaces/default/queries';

test.describe('Query Library', () => {
  test('should open Query Library with the current query and datasource', async ({ metricSceneView }) => {
    await metricSceneView.goto(
      new URLSearchParams({
        metric: 'go_gc_duration_seconds',
        'var-filters': 'quantile|=|0.5',
      })
    );

    await metricSceneView.openSaveModal();

    const modal = metricSceneView.getSavedQueriesModal();
    await expect(modal.locator('code')).toHaveText('go_gc_duration_seconds{quantile="0.5"}');
    await expect(modal.getByRole('textbox', { name: 'Data source', exact: true })).toHaveValue('gdev-prometheus');
    await expect(modal.getByRole('button', { name: 'Save and close', exact: true })).toBeEnabled();
  });

  test.describe('Load', () => {
    const queryName = `metrics-drilldown-e2e-${randomUUID()}`;

    test.beforeEach(async ({ page }) => {
      const response = await page.request.post(QUERIES_API_URL, {
        data: {
          metadata: { name: queryName },
          spec: {
            title: queryName,
            isVisible: true,
            targets: [
              {
                properties: {
                  refId: 'A',
                  datasource: { type: 'prometheus', uid: 'gdev-prometheus' },
                  expr: 'go_gc_duration_seconds{quantile="0.5"}',
                },
              },
            ],
          },
        },
      });
      expect(response.status()).toBe(201);
    });

    test.afterEach(async ({ page }) => {
      const response = await page.request.delete(`${QUERIES_API_URL}/${queryName}`);
      expect(response.ok()).toBe(true);
    });

    test('should load a saved query into Metrics Drilldown', async ({ metricSceneView, page }) => {
      await metricSceneView.goto(new URLSearchParams({ metric: 'go_goroutines' }));
      await metricSceneView.openLoadModal();

      const modal = metricSceneView.getSavedQueriesModal();
      await modal.getByRole('radio', { name: queryName }).click();
      await modal.getByRole('button', { name: 'Select query', exact: true }).click();

      await expect(modal).toBeHidden();
      await metricSceneView.assertMainViz('go_gc_duration_seconds');
      await expect(page).toHaveURL((url) => url.searchParams.get('var-ds') === 'gdev-prometheus');
      await expect(page).toHaveURL((url) => url.searchParams.get('var-filters') === 'quantile|=|0.5');
    });
  });
});
