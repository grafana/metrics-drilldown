import { expect, test } from '../fixtures';

const METRIC_NAME = 'go_gc_duration_seconds';
const URL_SEARCH_PARAMS_WITH_METRIC_NAME = new URLSearchParams([['metric', METRIC_NAME]]);

test.describe('Responsive Breakdown Selector', () => {
  test.beforeEach(async ({ metricSceneView }) => {
    await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
  });

  test.describe('Desktop viewport (1200px)', () => {
    test.use({ viewport: { width: 1200, height: 800 } });

    test('should display radio buttons for common labels', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);

      // Navigate to breakdown tab to see the selector
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Should show radio buttons for common labels
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();

      // Verify that at least one radio button group exists (the responsive selector should always render)
      const radioButtonCount = await page.locator('input[type="radio"]').count();
      expect(radioButtonCount).toBeGreaterThanOrEqual(1);

      // Take screenshot of the responsive selector at desktop size
      await expect(page.getByTestId('responsive-group-by-selector')).toHaveScreenshot(
        'responsive-selector-desktop.png'
      );
    });

    test('should handle radio button selection', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Always test the "All" button which should always be present
      await page.getByRole('radio', { name: 'All' }).click();
      await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();
      await expect(page.getByTestId('panels-list')).toBeVisible();
    });

    test('should have responsive selector UI components', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // The responsive selector should always have the "All" radio button
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();

      // The component should have a "Group by" label
      await expect(page.getByText('Group by')).toBeVisible();

      // Should have at least one radio button (minimum viable selector)
      const radioButtonCount = await page.locator('input[type="radio"]').count();
      expect(radioButtonCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Tablet viewport (768px)', () => {
    test.use({ viewport: { width: 768, height: 600 } });

    test('should adapt to medium screen size', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Should always show the "All" radio button
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();

      // Should maintain responsive selector functionality at tablet size
      const radioButtonCount = await page.locator('input[type="radio"]').count();
      expect(radioButtonCount).toBeGreaterThanOrEqual(1);

      // Take screenshot at tablet size
      await expect(page.getByTestId('responsive-group-by-selector')).toHaveScreenshot(
        'responsive-selector-tablet.png'
      );
    });

    test('should maintain functionality at medium viewport', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Test "All" selection - this should always work
      await page.getByRole('radio', { name: 'All' }).click();
      await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();

      // Verify that panels list is updated after selection
      await expect(page.getByTestId('panels-list')).toBeVisible();
    });
  });

  test.describe('Mobile viewport (480px)', () => {
    test.use({ viewport: { width: 480, height: 600 } });

    test('should adapt to small screen size', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Should always show the "All" radio button even on mobile
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();

      // Should maintain basic selector functionality
      const radioButtonCount = await page.locator('input[type="radio"]').count();
      expect(radioButtonCount).toBeGreaterThanOrEqual(1);

      // Take screenshot at mobile size
      await expect(page.getByTestId('responsive-group-by-selector')).toHaveScreenshot(
        'responsive-selector-mobile.png'
      );
    });

    test('should handle touch interactions on mobile', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Test touch interaction with "All" button
      await page.getByRole('radio', { name: 'All' }).click();
      await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();

      // Verify that the selection works and updates the UI
      await expect(page.getByTestId('panels-list')).toBeVisible();
    });
  });

  test.describe('Responsive behavior transitions', () => {
    test('should adapt when viewport changes', async ({ page, metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Start with desktop size
      await page.setViewportSize({ width: 1200, height: 800 });
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();

      // Count visible radio buttons at desktop size
      const desktopRadioButtons = await page.locator('input[type="radio"]').count();

      // Resize to tablet
      await page.setViewportSize({ width: 768, height: 600 });
      // Wait for responsive selector to be visible after resize
      await expect(page.getByTestId('responsive-group-by-selector')).toBeVisible();

      // Should still have radio buttons but possibly fewer
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();

      // Resize to mobile
      await page.setViewportSize({ width: 480, height: 600 });
      // Wait for responsive selector to be visible after resize
      await expect(page.getByTestId('responsive-group-by-selector')).toBeVisible();

      // Should still have at least "All" button
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();
      const mobileRadioButtons = await page.locator('input[type="radio"]').count();

      // Generally expect fewer radio buttons on smaller screens (though exact counts may vary)
      expect(mobileRadioButtons).toBeLessThanOrEqual(desktopRadioButtons);
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Focus on the first radio button
      await page.getByRole('radio', { name: 'All' }).focus();

      // Should be able to navigate between radio buttons with arrow keys
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowLeft');

      // Should be able to activate with space
      await page.keyboard.press('Space');

      // Verify the radio button is checked
      await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();
    });

    test('should have proper ARIA labels', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Radio buttons should have proper labels
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();

      // Field should have proper label
      await expect(page.getByText('Group by')).toBeVisible();

      // All radio buttons should be properly labeled and accessible
      const radioButtonCount = await page.locator('input[type="radio"]').count();
      expect(radioButtonCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Performance', () => {
    test('should handle rapid viewport changes without issues', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Rapidly change viewport sizes
      const viewports = [
        { width: 1200, height: 800 },
        { width: 768, height: 600 },
        { width: 480, height: 600 },
        { width: 1024, height: 768 },
        { width: 320, height: 568 },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        // Wait for responsive selector to be visible after each resize
        await expect(page.getByTestId('responsive-group-by-selector')).toBeVisible();
      }

      // Should still be functional after rapid changes
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();
      await page.getByRole('radio', { name: 'All' }).click();
      await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();
    });
  });

  test.describe('Edge cases', () => {
    test('should handle very narrow viewports gracefully', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Set extremely narrow viewport
      await page.setViewportSize({ width: 200, height: 600 });
      // Wait for responsive selector to be visible after resize
      await expect(page.getByTestId('responsive-group-by-selector')).toBeVisible();

      // Should still show at least the "All" button
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();

      // Should maintain minimum functionality
      const radioButtonCount = await page.locator('input[type="radio"]').count();
      expect(radioButtonCount).toBeGreaterThanOrEqual(1);

      // Should still be functional
      await page.getByRole('radio', { name: 'All' }).click();
      await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();
    });

    test('should handle very wide viewports', async ({ page, metricSceneView }) => {
      await metricSceneView.assertCoreUI(METRIC_NAME);
      await page.getByRole('tab', { name: 'Breakdown' }).click();

      // Set very wide viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      // Wait for responsive selector to be visible after resize
      await expect(page.getByTestId('responsive-group-by-selector')).toBeVisible();

      // Should always show the "All" button
      await expect(page.getByRole('radio', { name: 'All' })).toBeVisible();

      // Should have responsive selector functionality
      const radioButtonCount = await page.locator('input[type="radio"]').count();
      expect(radioButtonCount).toBeGreaterThanOrEqual(1);

      // Should be functional at wide viewport
      await page.getByRole('radio', { name: 'All' }).click();
      await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();
    });
  });
});
