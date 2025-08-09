import { type BrowserContext } from '@playwright/test';

/**
 * Sets up mocking for Grafana scopes API endpoints
 * @param context - The Playwright browser context
 */
export async function setupScopesMocking(context: BrowserContext) {
  // Mock the specific scope endpoint
  await context.route('**/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/test-scope', async (route) => {
    const mockResponse = {
      metadata: {
        name: 'test-scope',
      },
      spec: {
        title: 'Test Scope',
        filters: [
          {
            key: 'method',
            operator: 'equals',
            value: 'GET',
          },
        ],
      },
    };
    await route.fulfill({ json: mockResponse });
  });
}
