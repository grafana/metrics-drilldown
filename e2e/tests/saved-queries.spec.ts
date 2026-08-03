import { expect, test } from '../fixtures';

// Inlined to avoid importing from src/ which pulls in @grafana/runtime (requires browser window)
const SAVED_QUERIES_KEY = 'grafana-metricsdrilldown-app.savedQueries';

interface SavedQuery {
  description: string;
  dsUid: string;
  query: string;
  timestamp: number;
  title: string;
  uid: string;
}

const METRIC_NAME = 'go_gc_duration_seconds';
const URL_SEARCH_PARAMS_WITH_METRIC_NAME = new URLSearchParams([['metric', METRIC_NAME]]);

const SEED_QUERY_1: SavedQuery = {
  description: 'A test query',
  dsUid: 'gdev-prometheus',
  query: 'go_gc_duration_seconds',
  timestamp: 1700000000000,
  title: 'My first saved query',
  uid: '11111111-1111-1111-1111-111111111111',
};

const SEED_QUERY_2: SavedQuery = {
  description: '',
  dsUid: 'gdev-prometheus',
  query: 'go_gc_duration_seconds{quantile="0.5"}',
  timestamp: 1700000001000,
  title: 'My second saved query',
  uid: '22222222-2222-2222-2222-222222222222',
};

test.describe('Saved queries', () => {
  test.describe('Save', () => {
    test('Buttons are visible; load button disabled when no queries exist', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await expect(metricSceneView.getSaveQueryButton()).toBeVisible();
      await expect(metricSceneView.getLoadQueryButton()).toBeVisible();
      await expect(metricSceneView.getLoadQueryButton()).toBeDisabled();
    });

    test('Opens save modal showing current PromQL query', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openSaveModal();
      const modal = metricSceneView.getSaveModal();

      await expect(modal.locator('code')).toHaveText(METRIC_NAME);
    });

    test('Saves a query and verifies it appears in load modal', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.saveQuery('My e2e query', 'Created during e2e test');

      // Load button should now be enabled
      await expect(metricSceneView.getLoadQueryButton()).toBeEnabled();

      // Open load modal and verify the saved query appears
      await metricSceneView.openLoadModal();
      await metricSceneView.assertLoadModalDetails({
        title: 'My e2e query',
        query: METRIC_NAME,
        description: 'Created during e2e test',
      });
    });
  });

  test.describe('Load', () => {
    test.beforeEach(async ({ metricSceneView }) => {
      await metricSceneView.page.addInitScript(
        ({ key, data }) => {
          window.localStorage.setItem(key, JSON.stringify(data));
        },
        { key: SAVED_QUERIES_KEY, data: [SEED_QUERY_1, SEED_QUERY_2] }
      );
    });

    test('Lists saved queries with default selection and details', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openLoadModal();

      // SEED_QUERY_2 is newer so it appears first and is selected by default
      await metricSceneView.assertLoadModalDetails({
        title: SEED_QUERY_2.title,
        query: SEED_QUERY_2.query,
      });
    });

    test('Clicking a different query updates the detail panel', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openLoadModal();
      await metricSceneView.selectSavedQueryInList(SEED_QUERY_1.title);

      await metricSceneView.assertLoadModalDetails({
        title: SEED_QUERY_1.title,
        query: SEED_QUERY_1.query,
        description: SEED_QUERY_1.description,
      });
    });

    test('Select link has correct drilldown href', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openLoadModal();

      const selectLink = metricSceneView.getLoadModalSelectLink();
      await expect(selectLink).toBeVisible();
      const href = await selectLink.getAttribute('href');
      expect(href).toContain('metric=go_gc_duration_seconds');
    });
  });

  test.describe('Delete', () => {
    test.beforeEach(async ({ metricSceneView }) => {
      await metricSceneView.page.addInitScript(
        ({ key, data }) => {
          window.localStorage.setItem(key, JSON.stringify(data));
        },
        { key: SAVED_QUERIES_KEY, data: [SEED_QUERY_1, SEED_QUERY_2] }
      );
    });

    test('Removes a query and shows next query', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openLoadModal();
      // Default selection is SEED_QUERY_2 (newer)
      await metricSceneView.deleteSelectedQuery();

      // After deleting, SEED_QUERY_1 should be shown
      await metricSceneView.assertLoadModalDetails({
        title: SEED_QUERY_1.title,
        query: SEED_QUERY_1.query,
        description: SEED_QUERY_1.description,
      });
    });

    test('Removing all queries shows empty state', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openLoadModal();

      // Delete first (SEED_QUERY_2, default selection)
      await metricSceneView.deleteSelectedQuery();
      // Delete second (SEED_QUERY_1, now only remaining)
      await metricSceneView.deleteSelectedQuery();

      await metricSceneView.assertLoadModalEmpty();
    });
  });

  test.describe('Duplicate detection', () => {
    test('Shows warning when saving a query that already exists', async ({ metricSceneView }) => {
      // Seed a query matching the current metric
      await metricSceneView.page.addInitScript(
        ({ key, data }) => {
          window.localStorage.setItem(key, JSON.stringify(data));
        },
        { key: SAVED_QUERIES_KEY, data: [SEED_QUERY_1] }
      );

      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
      await metricSceneView.openSaveModal();

      // SEED_QUERY_1 query matches METRIC_NAME, so a warning should appear
      const modal = metricSceneView.getSaveModal();
      await expect(modal.getByText(/previously saved query with the same expression/)).toBeVisible();
    });
  });
});
