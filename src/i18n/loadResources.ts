import { type ResourceLoader } from '@grafana/i18n';

import { logger } from '../shared/logger/logger';

const FALLBACK_LANGUAGE = 'en-US';

export const loadResources: ResourceLoader = async (language: string) => {
  const locale = language || FALLBACK_LANGUAGE;

  if (locale === FALLBACK_LANGUAGE) {
    return {};
  }

  try {
    return await import(`../locales/${locale}/grafana-metricsdrilldown-app.json`);
  } catch (error) {
    logger.warn(`Failed to load translations for locale "${locale}"`, error);
    return {};
  }
};
