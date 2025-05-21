import { type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL, ROUTES } from '../../../src/constants';
import { AppControls } from '../components/AppControls';

export class MetricSceneView extends DrilldownView {
  public appControls: AppControls;

  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, PLUGIN_BASE_URL, new URLSearchParams(defaultUrlSearchParams));

    this.appControls = new AppControls(page);
  }

  /* Navigation */

  goto(urlSearchParams = new URLSearchParams()) {
    super.setPathName(`${PLUGIN_BASE_URL}/${ROUTES.Drilldown}`);

    if (!urlSearchParams.has('metric')) {
      throw new Error('goto Error: No metric specified in the URL search parameters!');
    }

    // the spread order is important to override the default params (e.g. overriding "from" and "to")
    return super.goto(new URLSearchParams([...urlSearchParams, ...this.urlParams]));
  }

  /* Core UI assertions */

  async assertCoreUI() {
    await this.appControls.assert(true);
  }
}
