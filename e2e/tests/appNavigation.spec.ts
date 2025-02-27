import { expect, test } from './fixtures';
import { testIds } from '../../src/App/testIds';
import { ROUTES } from '../../src/constants';
import { UI_TEXT } from '../../src/constants/ui';

test.describe('Metrics Drilldown', () => {
  test('home page renders with core elements', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Home}`);

    // Verify main container and title
    const container = page.getByTestId(testIds.pageHome.container);
    await expect(container).toBeVisible();
    await expect(page.getByText(UI_TEXT.HOME.TITLE)).toBeVisible();
    await expect(page.getByText(UI_TEXT.HOME.SUBTITLE)).toBeVisible();

    // Verify start button
    const startButton = page.getByTestId(testIds.pageHome.startButton);
    await expect(startButton).toBeVisible();
    await expect(startButton).toContainText(UI_TEXT.HOME.START_BUTTON);
  });

  test('start button navigates to trail page', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Home}`);
    await page.getByTestId(testIds.pageHome.startButton).click();
    await expect(page.getByText(UI_TEXT.SEARCH.TITLE)).toBeVisible();
  });

  test('bookmarks state persists', async ({ gotoPage, page }) => {
    // Only run if bookmarks exist
    await gotoPage(`/${ROUTES.Home}`);
    const bookmarksToggle = page.getByTestId(testIds.pageHome.bookmarksToggle);

    if (await bookmarksToggle.isVisible()) {
      // Toggle bookmarks
      await bookmarksToggle.click();
      const bookmarksList = page.getByTestId(testIds.pageHome.bookmarksList);
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
    await expect(page.getByText(UI_TEXT.SEARCH.TITLE)).toBeVisible();

    await expect(page.getByTestId('scene-body')).toBeVisible();
    await expect(page.getByTestId('scene')).toHaveScreenshot({
      stylePath: './e2e/fixtures/css/hide-app-controls.css',
    });
  });
});
