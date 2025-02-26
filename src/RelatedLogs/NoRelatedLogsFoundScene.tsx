import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { Alert, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import React from 'react';

export class NoRelatedLogsScene extends SceneObjectBase<SceneObjectState> {
  static readonly Component = () => {
    const styles = useStyles2(getStyles);

    return (
      <Stack direction="column" gap={2}>
        <Alert title="No related logs found" severity="info">
          We couldn&apos;t find any logs related to the current metric with your selected filters.
        </Alert>
        <Text>
          To find related logs, you can try:
          <ul className={styles.list}>
            <li>Adjusting your label filters to include labels that exist in both the current metric and your logs</li>
            <li>
              Selecting a metric created by a{' '}
              <TextLink external href="https://grafana.com/docs/loki/latest/alert/#recording-rules">
                Loki Recording Rule
              </TextLink>
            </li>
            <li>Broadening the time range to include more data</li>
          </ul>
        </Text>
        <Text variant="bodySmall" color="secondary">
          Note: Related logs is an experimental feature.
        </Text>
      </Stack>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      paddingLeft: theme.spacing(2),
      marginTop: theme.spacing(1),
    }),
  };
}
