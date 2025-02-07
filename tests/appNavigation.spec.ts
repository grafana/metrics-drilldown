import { expect, test } from './fixtures';
import { ROUTES } from '../src/constants';
import { TEST_IDS, UI_TEXT } from '../src/constants/ui';

test.describe('Metrics Drilldown', () => {
  test('home page renders with core elements', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Home}`);

    // Verify main container and title
    const container = page.getByTestId(TEST_IDS.HOME.CONTAINER);
    await expect(container).toBeVisible();
    await expect(page.getByText(UI_TEXT.HOME.TITLE)).toBeVisible();
    await expect(page.getByText(UI_TEXT.HOME.SUBTITLE)).toBeVisible();

    // Verify start button
    const startButton = page.getByTestId(TEST_IDS.HOME.START_BUTTON);
    await expect(startButton).toBeVisible();
    await expect(startButton).toContainText(UI_TEXT.HOME.START_BUTTON);
  });

  test('start button navigates to trail page', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Home}`);
    await page.getByTestId(TEST_IDS.HOME.START_BUTTON).click();
    await expect(page.getByText(UI_TEXT.SEARCH.TITLE)).toBeVisible();
  });

  test('bookmarks state persists', async ({ gotoPage, page }) => {
    // Only run if bookmarks exist
    await gotoPage(`/${ROUTES.Home}`);
    const bookmarksToggle = page.getByTestId(TEST_IDS.HOME.BOOKMARKS_TOGGLE);

    if (await bookmarksToggle.isVisible()) {
      // Toggle bookmarks
      await bookmarksToggle.click();
      const bookmarksList = page.getByTestId(TEST_IDS.HOME.BOOKMARKS_LIST);
      await expect(bookmarksList).toBeVisible();

      // Refresh page
      await page.reload();

      // Verify bookmarks remain expanded
      await expect(bookmarksList).toBeVisible();
    }
  });

  test('trail page navigation and search', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Trail}`);
    await expect(page.getByText(UI_TEXT.SEARCH.TITLE)).toBeVisible();
  });
});

test.describe('navigating app', () => {
  test('trail page should render successfully', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Trail}`);
    await expect(page.getByText('Search metrics')).toBeVisible();
  });
});
