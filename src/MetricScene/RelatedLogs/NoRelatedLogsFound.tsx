import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import React from 'react';

export function NoRelatedLogs() {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={2}>
      <Alert title={t('related-logs.no-logs-title', 'No related logs found')} severity="info">
        {t(
          'related-logs.no-logs-message',
          "We couldn't find any logs related to the current metric with your selected filters."
        )}
      </Alert>
      <Text>
        <Trans i18nKey="related-logs.suggestions">
          To find related logs, try the following:
          <ul className={styles.list}>
            <li>Adjust your label filters to include labels that exist in both the current metric and your logs</li>
            <li>
              Select a metric created by a{' '}
              <TextLink external href="https://grafana.com/docs/loki/latest/alert/#recording-rules">
                Loki Recording Rule
              </TextLink>
            </li>
            <li>Broaden the time range to include more data</li>
          </ul>
        </Trans>
      </Text>
      <Text variant="bodySmall" color="secondary">
        {t('related-logs.experimental-note', 'Note: Related logs is an experimental feature.')}
      </Text>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      paddingLeft: theme.spacing(2),
      marginTop: theme.spacing(1),
    }),
  };
}
