import { type Scope } from '@grafana/data';

import { getGrafanaUrl, getGrafanaVersion } from '../config/playwright.config.common';
import { expect, test } from '../fixtures';

test.describe('Scopes', () => {
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(
    getGrafanaVersion('major')?.startsWith('11') ?? true,
    'Scopes are not supported in Grafana v11.x, skipping the test suite.'
  );

  test.use({
    // Instead of our regular Grafana instance, we'll use the Grafana instance with scopes enabled
    baseURL: getGrafanaUrl({ withScopes: true }),
  });

  // eslint-disable-next-line playwright/expect-expect
  test('Scopes filters are applied', async ({ metricsReducerView }) => {
    const testScope: Scope = {
      metadata: {
        name: 'test-scope',
      },
      spec: {
        title: 'Test Scope',
        type: 'app',
        description: 'Test Scope',
        category: 'test',
        filters: [
          {
            key: 'method',
            operator: 'equals',
            value: 'GET',
          },
        ],
      },
    };

    // Mock the scope API endpoint
    await metricsReducerView.page.route(
      `**/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/${testScope.metadata.name}`,
      async (route) => {
        await route.fulfill({ json: testScope });
      }
    );

    await metricsReducerView.goto(new URLSearchParams({ scopes: testScope.metadata.name }));

    await expect(metricsReducerView.getByLabel(/select scopes/i)).toHaveValue(testScope.spec.title);
    await metricsReducerView.appControls.assertAdHocFilter('method', '=', 'GET');

    await metricsReducerView.assertMetricsList();
  });
});
