import { expect, test } from '../fixtures';

// Inlined to avoid importing from src/ which pulls in @grafana/runtime (requires browser window)
const SAVED_SEARCHES_KEY = 'grafana-metricsdrilldown-app.savedSearches';

interface SavedSearch {
  description: string;
  dsUid: string;
  query: string;
  timestamp: number;
  title: string;
  uid: string;
}

const METRIC_NAME = 'go_gc_duration_seconds';
const URL_SEARCH_PARAMS_WITH_METRIC_NAME = new URLSearchParams([['metric', METRIC_NAME]]);

const SEED_SEARCH_1: SavedSearch = {
  description: 'A test search',
  dsUid: 'gdev-prometheus',
  query: 'go_gc_duration_seconds',
  timestamp: 1700000000000,
  title: 'My first saved search',
  uid: '11111111-1111-1111-1111-111111111111',
};

const SEED_SEARCH_2: SavedSearch = {
  description: '',
  dsUid: 'gdev-prometheus',
  query: 'go_gc_duration_seconds{quantile="0.5"}',
  timestamp: 1700000001000,
  title: 'My second saved search',
  uid: '22222222-2222-2222-2222-222222222222',
};

test.describe('Saved queries', () => {
  test.describe('Save', () => {
    test('Buttons are visible; load button disabled when no searches exist', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await expect(metricSceneView.getSaveSearchButton()).toBeVisible();
      await expect(metricSceneView.getLoadSearchButton()).toBeVisible();
      await expect(metricSceneView.getLoadSearchButton()).toBeDisabled();
    });

    test('Opens save modal showing current PromQL query', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openSaveModal();
      const modal = metricSceneView.getSaveModal();

      await expect(modal.locator('code')).toHaveText(METRIC_NAME);
    });

    test('Saves a search and verifies it appears in load modal', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.saveSearch('My e2e search', 'Created during e2e test');

      // Load button should now be enabled
      await expect(metricSceneView.getLoadSearchButton()).toBeEnabled();

      // Open load modal and verify the saved search appears
      await metricSceneView.openLoadModal();
      await metricSceneView.assertLoadModalDetails({
        title: 'My e2e search',
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
        { key: SAVED_SEARCHES_KEY, data: [SEED_SEARCH_1, SEED_SEARCH_2] }
      );
    });

    test('Lists saved searches with default selection and details', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openLoadModal();

      // SEED_SEARCH_2 is newer so it appears first and is selected by default
      await metricSceneView.assertLoadModalDetails({
        title: SEED_SEARCH_2.title,
        query: SEED_SEARCH_2.query,
      });
    });

    test('Clicking a different search updates the detail panel', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openLoadModal();
      await metricSceneView.selectSavedSearchInList(SEED_SEARCH_1.title);

      await metricSceneView.assertLoadModalDetails({
        title: SEED_SEARCH_1.title,
        query: SEED_SEARCH_1.query,
        description: SEED_SEARCH_1.description,
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
        { key: SAVED_SEARCHES_KEY, data: [SEED_SEARCH_1, SEED_SEARCH_2] }
      );
    });

    test('Removes a search and shows next search', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openLoadModal();
      // Default selection is SEED_SEARCH_2 (newer)
      await metricSceneView.deleteSelectedSearch();

      // After deleting, SEED_SEARCH_1 should be shown
      await metricSceneView.assertLoadModalDetails({
        title: SEED_SEARCH_1.title,
        query: SEED_SEARCH_1.query,
        description: SEED_SEARCH_1.description,
      });
    });

    test('Removing all searches shows empty state', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);

      await metricSceneView.openLoadModal();

      // Delete first (SEED_SEARCH_2, default selection)
      await metricSceneView.deleteSelectedSearch();
      // Delete second (SEED_SEARCH_1, now only remaining)
      await metricSceneView.deleteSelectedSearch();

      await metricSceneView.assertLoadModalEmpty();
    });
  });

  test.describe('Duplicate detection', () => {
    test('Shows warning when saving a query that already exists', async ({ metricSceneView }) => {
      // Seed a search matching the current metric
      await metricSceneView.page.addInitScript(
        ({ key, data }) => {
          window.localStorage.setItem(key, JSON.stringify(data));
        },
        { key: SAVED_SEARCHES_KEY, data: [SEED_SEARCH_1] }
      );

      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
      await metricSceneView.openSaveModal();

      // SEED_SEARCH_1 query matches METRIC_NAME, so a warning should appear
      const modal = metricSceneView.getSaveModal();
      await expect(modal.getByText(/previously saved search with the same query/)).toBeVisible();
    });
  });
});
