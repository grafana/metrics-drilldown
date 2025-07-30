import { type getByGrafanaSelectorOptions } from '@grafana/plugin-e2e';
import { expect, type Locator, type Mouse, type Page, type Request, type Route } from '@playwright/test';

import { DOCKED_MENU_DOCKED_LOCAL_STORAGE_KEY, DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY } from '../../config/constants';

export class DrilldownView {
  readonly page: Page;
  readonly mouse: Mouse;

  pathname: string;
  urlParams: URLSearchParams;

  constructor(page: Page, pathname: string, urlParams: URLSearchParams) {
    this.page = page;
    this.mouse = page.mouse;
    this.pathname = pathname;
    this.urlParams = urlParams;
  }

  setPathName(pathname: string) {
    this.pathname = pathname;
  }

  async goto(urlParams: URLSearchParams | undefined = undefined) {
    await this.page.addInitScript(
      (keys) => {
        keys.forEach((key) => {
          window.localStorage.setItem(key, 'false');
        });
      },
      [DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY, DOCKED_MENU_DOCKED_LOCAL_STORAGE_KEY]
    );

    const url =
      urlParams !== undefined
        ? `${this.pathname}?${urlParams.toString()}`
        : `${this.pathname}?${this.urlParams.toString()}`;

    await this.page.goto(url);

    // TODO: add assertion(s) on loading state?
    await this.page.getByTestId('metrics-drilldown-app').waitFor();
    await expect(this.getByRole('alert', { name: /error/i })).not.toBeVisible();
  }

  locator(selector: string, options?: Record<string, unknown>) {
    return this.page.locator(selector, options);
  }

  getByTestId(testId: string | RegExp) {
    return this.page.getByTestId(testId);
  }

  getByLabel(label: string, options?: Record<string, unknown>) {
    return this.page.getByLabel(label, options);
  }

  getByPlaceholder(label: string, options?: Record<string, unknown>) {
    return this.page.getByPlaceholder(label, options);
  }

  getByText(text, options?: Record<string, unknown>) {
    return this.page.getByText(text, options);
  }

  getByRole(role, options?: Record<string, unknown>) {
    return this.page.getByRole(role, options);
  }

  waitForRequest(urlOrPredicate, options?) {
    return this.page.waitForRequest(urlOrPredicate, options);
  }

  waitForResponse(urlOrPredicate, options?) {
    return this.page.waitForResponse(urlOrPredicate, options);
  }

  waitForTimeout(timeout: number) {
    return this.page.waitForTimeout(timeout);
  }

  route(url: string, handler: (route: Route, request: Request) => any, options?: Record<string, any>) {
    return this.page.route(url, handler, options);
  }

  pause() {
    return this.page.pause();
  }

  getByGrafanaSelector(selector: string, options?: getByGrafanaSelectorOptions): Locator {
    return (options?.root ?? this.page).locator(resolveGrafanaSelector(selector, options));
  }
}

export function resolveGrafanaSelector(selector: string, options?: Omit<getByGrafanaSelectorOptions, 'root'>): string {
  const startsWith = options?.startsWith ? '^' : '';
  if (selector.startsWith('data-testid')) {
    return `[data-testid${startsWith}="${selector}"]`;
  }
  return `[aria-label${startsWith}="${selector}"]`;
}
