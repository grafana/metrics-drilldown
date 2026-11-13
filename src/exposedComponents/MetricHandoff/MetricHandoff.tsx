import { t } from '@grafana/i18n';
import { Alert, LinkButton, Stack } from '@grafana/ui';
import React from 'react';

import { buildMetricHandoffLinks } from './buildMetricHandoffLinks';
import { type MetricHandoffProps } from './types';

export { type MetricHandoffProps } from './types';

export function MetricHandoff(props: Readonly<MetricHandoffProps>) {
  const { explore, drilldown } = buildMetricHandoffLinks(props);

  if (!explore && !drilldown) {
    return (
      <Alert severity="warning" title={t('metric-handoff.unavailable', 'No navigation available')}>
        {t('metric-handoff.check-inputs', 'Provide a valid data source, time range and queries or metric context.')}
      </Alert>
    );
  }

  return (
    <nav aria-label={t('metric-handoff.navigation', 'Metric navigation')}>
      <Stack direction="row" wrap="wrap">
        {explore && (
          <LinkButton href={explore} variant="secondary">
            {t('metric-handoff.explore', 'Open in Explore')}
          </LinkButton>
        )}
        {drilldown && (
          <LinkButton
            href={drilldown}
            variant="secondary"
            tooltip={t(
              'metric-handoff.drilldown-description',
              'Opens the metric and filters, not the Explore expressions.'
            )}
          >
            {t('metric-handoff.drilldown', 'Open metric in Metrics Drilldown')}
          </LinkButton>
        )}
      </Stack>
    </nav>
  );
}

export default MetricHandoff;
